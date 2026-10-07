-- =============================================================================
-- MIGRACIÓN: RPC sync_transportes_full - Sync completo por día con updates de placas quitadas
-- -----------------------------------------------------------------------------
-- PROPÓSITO: Sync completo del día.
--   1. UPSERT filas del payload (lógica v2).
--   2. Para cada llave en el payload: actualizar a placa='' y estado_porteria='Pendiente'
--      las filas de BD para esa fecha que NO están en el payload (placas quitadas en Sheets).
--   3. Fusionar huérfanos (llave,'').
-- -----------------------------------------------------------------------------
-- IMPACTO: Solo BD. Reemplaza sync_transportes para uso diario.
--   Apps Script debe llamar a sync_transportes_full(rows, fecha_hoy).
-- =============================================================================

-- 1. Helper _sync_campo (ya existe, pero la incluimos por si se ejecuta aislado)
CREATE OR REPLACE FUNCTION public._sync_campo(fila jsonb, claves text[])
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  c text;
  k text;
  v text;
BEGIN
  FOREACH c IN ARRAY claves LOOP
    FOR k IN SELECT * FROM jsonb_object_keys(fila) LOOP
      IF lower(regexp_replace(k, '[\s_-]', '', 'g')) = lower(regexp_replace(c, '[\s_-]', '', 'g')) THEN
        v := fila->>k;
        IF v IS NOT NULL AND NULLIF(TRIM(v), '') IS NOT NULL THEN
          RETURN TRIM(v);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$$;

-- 2. RPC principal: sync_transportes_full
CREATE OR REPLACE FUNCTION public.sync_transportes_full(_filas jsonb, _fecha date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_fecha timestamptz;
  v_cita  text;
  v_placas_dia  text[];         -- placas por llave en payload (formato llave|placa)
BEGIN
  IF jsonb_typeof(_filas) <> 'array' OR jsonb_array_length(_filas) = 0 THEN
    RETURN;
  END IF;

  -- 1. Normalizar payload a tmp_sync
  CREATE TEMP TABLE tmp_sync ON COMMIT DROP AS
  SELECT
    row_number() OVER ()::int AS row_id,
    UPPER(TRIM(COALESCE(f->>'llave','')))                AS llave,
    NULLIF(UPPER(TRIM(COALESCE(f->>'placa',''))) ,'')    AS placa,
    NULLIF(UPPER(TRIM(COALESCE(f->>'vehiculo_tipo',''))),'') AS vehiculo_tipo,
    NULLIF(public._sync_campo(f, ARRAY['transportadora','olt inicial']),'') AS transportadora,
    NULLIF(public._sync_campo(f, ARRAY['transporte']),'') AS transporte,
    NULLIF(public._sync_campo(f, ARRAY['denominacion','denominación']),'') AS denominacion,
    NULLIF(public._sync_campo(f, ARRAY['destino']),'') AS destino,
    NULLIF(public._sync_campo(f, ARRAY['region','región']),'') AS region,
    NULLIF(public._sync_campo(f, ARRAY['estado_transporte','estatus']),'') AS estado_transporte,
    NULLIF(TRIM(f->>'cita_cargue'),'')                   AS cita_cargue,
    NULLIF(TRIM(f->>'fecha_hora'),'')                    AS fecha_hora,
    COALESCE(ROUND(NULLIF(REGEXP_REPLACE(COALESCE(f->>'cajas',''),'[.,]','','g'),'')::numeric), 0) AS cajas,
    (UPPER(TRIM(COALESCE(f->>'estatus',''))) = 'CANCELADO') AS estado_cancelado
  FROM jsonb_array_elements(_filas) AS f
  WHERE NULLIF(TRIM(f->>'llave'),'') IS NOT NULL;

  -- 2. Dedupe por (llave, placa) y suma de cajas
  CREATE TEMP TABLE tmp_cons ON COMMIT DROP AS
  SELECT DISTINCT ON (llave, placa)
    row_id,
    llave,
    placa,
    vehiculo_tipo,
    transportadora,
    transporte,
    denominacion,
    destino,
    region,
    estado_transporte,
    cita_cargue,
    fecha_hora,
    estado_cancelado,
    SUM(cajas) OVER (PARTITION BY llave, placa)::numeric AS cajas
  FROM tmp_sync
  ORDER BY llave, placa, row_id DESC;

  -- 3. Recolectar claves (llave|placa) que llegaron en el payload de HOY
  SELECT array_agg(DISTINCT llave || '|' || COALESCE(placa,'')) INTO v_placas_dia
  FROM tmp_cons;

  -- 4. UPSERT filas del payload (lógica v2)
  FOR r IN SELECT * FROM tmp_cons ORDER BY llave, placa LOOP
    IF r.fecha_hora ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_fecha := (date '1899-12-30' + r.fecha_hora::numeric * interval '1 day')::timestamptz;
    ELSE
      v_fecha := r.fecha_hora::timestamptz;
    END IF;

    IF v_fecha IS NULL OR v_fecha < '2026-09-01'::timestamptz THEN
      CONTINUE;
    END IF;

    IF r.cita_cargue ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_cita := to_char((date '1899-12-30' + r.cita_cargue::numeric * interval '1 day'), 'YYYY-MM-DD"T"HH24:MI:00');
    ELSE
      v_cita := r.cita_cargue;
    END IF;

    INSERT INTO transportes (
      llave, fecha_hora, placa, vehiculo_tipo, transportadora,
      transporte, denominacion, destino, region, cita_cargue, cajas,
      estado_transporte, estado_porteria, updated_at
    ) VALUES (
      r.llave,
      COALESCE(v_fecha, now()),
      COALESCE(r.placa, ''),
      COALESCE(r.vehiculo_tipo, 'SENCILLO'),
      COALESCE(r.transportadora, ''),
      r.transporte, r.denominacion, r.destino, r.region, r.cita_cargue, r.cajas,
      CASE WHEN r.estado_transporte IN ('DESPACHADO','ALISTADO','PENDIENTE')
           THEN r.estado_transporte ELSE 'ALISTADO' END,
      CASE
        WHEN r.estado_cancelado THEN 'CANCELADO'
        WHEN COALESCE(r.placa,'') <> '' THEN 'Confirmado'
        ELSE 'Pendiente'
      END,
      now()
    )
    ON CONFLICT (llave, placa) DO UPDATE SET
      fecha_hora     = EXCLUDED.fecha_hora,
      vehiculo_tipo  = COALESCE(NULLIF(EXCLUDED.vehiculo_tipo,''), transportes.vehiculo_tipo),
      transportadora = COALESCE(NULLIF(EXCLUDED.transportadora,''), transportes.transportadora),
      transporte     = COALESCE(NULLIF(EXCLUDED.transporte,''), transportes.transporte),
      denominacion   = COALESCE(NULLIF(EXCLUDED.denominacion,''), transportes.denominacion),
      destino        = COALESCE(NULLIF(EXCLUDED.destino,''), transportes.destino),
      region         = COALESCE(NULLIF(EXCLUDED.region,''), transportes.region),
      cita_cargue    = COALESCE(NULLIF(EXCLUDED.cita_cargue,''), transportes.cita_cargue),
      estado_transporte = CASE WHEN EXCLUDED.estado_transporte IN ('DESPACHADO','ALISTADO','PENDIENTE')
                                THEN EXCLUDED.estado_transporte ELSE 'ALISTADO' END,
      cajas = CASE WHEN transportes.cajas_manual THEN transportes.cajas
                    ELSE COALESCE(NULLIF(EXCLUDED.cajas,0), transportes.cajas) END,
      cajas_manual = CASE WHEN transportes.cajas_manual
                           AND EXCLUDED.cajas > 0
                           AND EXCLUDED.cajas = transportes.cajas
                          THEN FALSE ELSE transportes.cajas_manual END,
      estado_porteria = CASE
        WHEN EXCLUDED.estado_porteria = 'CANCELADO' THEN 'CANCELADO'
        WHEN transportes.estado_porteria IN ('Pendiente','Confirmado') AND COALESCE(EXCLUDED.placa,'') <> '' THEN 'Confirmado'
        ELSE transportes.estado_porteria
      END,
      updated_at     = now();
  END LOOP;

  -- 5. ACTUALIZAR placas quitadas: para cada llave en el payload, buscar placas en BD para hoy
  --    que NO estén en el payload y ponerlas a placa='' y estado_porteria='Pendiente'
  --    Usamos cita_cargue para identificar filas del día (parseando serial/ISO a date).
  UPDATE public.transportes t
  SET
    placa = '',
    estado_porteria = 'Pendiente',
    updated_at = now()
  WHERE t.cita_cargue IS NOT NULL
    AND (
      CASE
        WHEN t.cita_cargue ~ '^[0-9]+(\.[0-9]+)?$' THEN
          (date '1899-12-30' + t.cita_cargue::numeric * interval '1 day')::date
        ELSE
          t.cita_cargue::date
      END
    ) = _fecha
    AND (t.llave || '|' || COALESCE(t.placa,'')) <> ALL(v_placas_dia)
    AND COALESCE(t.placa,'') <> '';  -- solo tocar las que tenían placa

  -- 6. FUSIONAR PLACAS VACÍAS (huérfanos) para las llaves del día
  --    (regla existente: si llave tiene placa y también fila (llave,''), eliminar la vacía)
  FOR r IN
    SELECT DISTINCT t.llave
    FROM public.transportes t
    WHERE COALESCE(t.placa,'') = ''
      AND EXISTS (SELECT 1 FROM public.transportes t2
                  WHERE t2.llave = t.llave
                    AND COALESCE(t2.placa,'') <> '')
      AND NOT EXISTS (SELECT 1 FROM tmp_sync s
                      WHERE s.llave = t.llave
                        AND s.placa IS NULL)
  LOOP
    DELETE FROM public.transportes
    WHERE llave = r.llave AND COALESCE(placa,'') = '';
  END LOOP;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.sync_transportes_full(jsonb, date) TO anon, authenticated, service_role;