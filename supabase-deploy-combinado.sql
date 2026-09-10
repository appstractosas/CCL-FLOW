-- ============================================================================
-- DEPLOY COMBINADO: CCL FLOW — cajas_manual + RPCs SIN kg
-- ============================================================================
-- Ejecutar TODO de una sola vez en Supabase > SQL Editor (botón Run).
-- Es idempotente y seguro de re-ejecutar.
--
-- Este script arregla el error:
--   "column kg does not exist" al guardar horaLlegadaPorteria / cualquier
--   campo de portería desde la app.
--
-- Qué hace, en orden:
--   1) Garantiza la columna cajas_manual (editadas por el despachador).
--   2) Recrea ccl_create_transporte -> SIN kg (crear llaves desde la app).
--   3) Recrea ccl_update_transporte -> SIN kg + con cast p_id::uuid.
--   4) Recrea sync_transportes       -> SIN kg (sync activo de Power Automate).
--   5) Garantiza la columna kg como NULL (compatibilidad; nadie la usa).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASO 1: columna cajas_manual (idempotente)
-- ----------------------------------------------------------------------------
ALTER TABLE public.transportes
  ADD COLUMN IF NOT EXISTS cajas_manual BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.transportes.cajas_manual IS
  'TRUE = cajas editadas desde la app (despachador): el sync conserva el valor y no lo pisa hasta que el fuente trae el mismo número de cajas.';

-- ----------------------------------------------------------------------------
-- PASO 2: ccl_create_transporte SIN kg (crear llaves/transportes desde la app)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ccl_create_transporte(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
  v_result jsonb;
BEGIN
  INSERT INTO public.transportes (
    llave, fecha_hora, placa, vehiculo_tipo, cita_cargue,
    transporte, denominacion, cajas, destino, region,
    transportadora, estado_transporte, estado_porteria,
    muelle_asignado, cuadrilla, hora_muelle_asignado,
    hora_llegada_porteria, hora_ingreso, hora_inicio_cargue,
    hora_fin_cargue, hora_salida, observaciones
  ) VALUES (
    p_data->>'llave',
    (p_data->>'fecha_hora')::timestamptz,
    p_data->>'placa',
    COALESCE(p_data->>'vehiculo_tipo', 'SENCILLO'),
    p_data->>'cita_cargue',
    p_data->>'transporte',
    p_data->>'denominacion',
    NULLIF(p_data->>'cajas','')::numeric,
    p_data->>'destino',
    p_data->>'region',
    COALESCE(p_data->>'transportadora', ''),
    COALESCE(p_data->>'estado_transporte', 'ALISTADO'),
    COALESCE(p_data->>'estado_porteria', 'Pendiente'),
    p_data->>'muelle_asignado',
    p_data->>'cuadrilla',
    p_data->>'hora_muelle_asignado',
    p_data->>'hora_llegada_porteria',
    p_data->>'hora_ingreso',
    p_data->>'hora_inicio_cargue',
    p_data->>'hora_fin_cargue',
    p_data->>'hora_salida',
    p_data->>'observaciones'
  )
  RETURNING id INTO v_id;

  SELECT to_jsonb(t.*) INTO v_result
  FROM public.transportes t
  WHERE t.id = v_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ccl_create_transporte(jsonb) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- PASO 3: ccl_update_transporte SIN kg + cast p_id::uuid
--   (escrituras de la app: portería, muelles, cuadrilla, observaciones, etc.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ccl_update_transporte(p_id text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.transportes SET
    fecha_hora = COALESCE((p_data->>'fecha_hora')::timestamptz, fecha_hora),
    placa = COALESCE(p_data->>'placa', placa),
    vehiculo_tipo = COALESCE(p_data->>'vehiculo_tipo', vehiculo_tipo),
    cita_cargue = COALESCE(p_data->>'cita_cargue', cita_cargue),
    transporte = CASE WHEN p_data ? 'transporte' THEN p_data->>'transporte' ELSE transporte END,
    denominacion = CASE WHEN p_data ? 'denominacion' THEN p_data->>'denominacion' ELSE denominacion END,
    cajas = CASE WHEN p_data ? 'cajas' THEN (p_data->>'cajas')::numeric ELSE cajas END,
    cajas_manual = CASE WHEN p_data ? 'cajas_manual' THEN COALESCE((p_data->>'cajas_manual')::boolean, TRUE) ELSE cajas_manual END,
    destino = CASE WHEN p_data ? 'destino' THEN p_data->>'destino' ELSE destino END,
    region = CASE WHEN p_data ? 'region' THEN p_data->>'region' ELSE region END,
    transportadora = COALESCE(p_data->>'transportadora', transportadora),
    estado_transporte = COALESCE(p_data->>'estado_transporte', estado_transporte),
    estado_porteria = COALESCE(p_data->>'estado_porteria', estado_porteria),
    muelle_asignado = CASE WHEN p_data ? 'muelle_asignado' THEN p_data->>'muelle_asignado' ELSE muelle_asignado END,
    cuadrilla = CASE WHEN p_data ? 'cuadrilla' THEN p_data->>'cuadrilla' ELSE cuadrilla END,
    hora_muelle_asignado = CASE WHEN p_data ? 'hora_muelle_asignado' THEN p_data->>'hora_muelle_asignado' ELSE hora_muelle_asignado END,
    hora_llegada_porteria = CASE WHEN p_data ? 'hora_llegada_porteria' THEN p_data->>'hora_llegada_porteria' ELSE hora_llegada_porteria END,
    hora_ingreso = CASE WHEN p_data ? 'hora_ingreso' THEN p_data->>'hora_ingreso' ELSE hora_ingreso END,
    hora_inicio_cargue = CASE WHEN p_data ? 'hora_inicio_cargue' THEN p_data->>'hora_inicio_cargue' ELSE hora_inicio_cargue END,
    hora_fin_cargue = CASE WHEN p_data ? 'hora_fin_cargue' THEN p_data->>'hora_fin_cargue' ELSE hora_fin_cargue END,
    hora_salida = CASE WHEN p_data ? 'hora_salida' THEN p_data->>'hora_salida' ELSE hora_salida END,
    observaciones = CASE WHEN p_data ? 'observaciones' THEN p_data->>'observaciones' ELSE observaciones END
  WHERE id = p_id::uuid;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'La BD no actualizó ninguna fila (id=%). La fila no existe.', p_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ccl_update_transporte(text, jsonb) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- PASO 3: sync_transportes SIN kg (sync activo de Power Automate)
-- ----------------------------------------------------------------------------

-- Helper: devuelve el primer valor no vacío probando varias claves de la fila.
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

CREATE OR REPLACE FUNCTION public.sync_transportes(_filas jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_fecha timestamptz;
  v_cita  text;
  v_sync_desde constant timestamptz := '2026-09-01';
BEGIN
  IF jsonb_typeof(_filas) <> 'array' OR jsonb_array_length(_filas) = 0 THEN
    RETURN;
  END IF;

  -- 1) NORMALIZAR: UPPER/TRIM, estatus CANCELADO, cajas -> número.
  CREATE TEMP TABLE tmp_sync ON COMMIT DROP AS
  SELECT
    row_number() OVER ()::int AS row_id,
    UPPER(TRIM(COALESCE(f->>'llave','')))                AS llave,
    NULLIF(UPPER(TRIM(COALESCE(f->>'placa',''))) ,'')    AS placa,
    NULLIF(UPPER(TRIM(COALESCE(f->>'vehiculo_tipo',''))),'') AS vehiculo_tipo,
    NULLIF(_sync_campo(f, ARRAY['transportadora','olt inicial']),'') AS transportadora,
    NULLIF(_sync_campo(f, ARRAY['transporte']),'') AS transporte,
    NULLIF(_sync_campo(f, ARRAY['denominacion','denominación']),'') AS denominacion,
    NULLIF(_sync_campo(f, ARRAY['destino']),'') AS destino,
    NULLIF(_sync_campo(f, ARRAY['region','región']),'') AS region,
    NULLIF(_sync_campo(f, ARRAY['estado_transporte','estatus']),'') AS estado_transporte,
    NULLIF(TRIM(f->>'cita_cargue'),'')                   AS cita_cargue,
    NULLIF(TRIM(f->>'fecha_hora'),'')                    AS fecha_hora,
    COALESCE(ROUND(NULLIF(REGEXP_REPLACE(COALESCE(f->>'cajas',''),'[.,]','','g'),'')::numeric), 0) AS cajas,
    (UPPER(TRIM(COALESCE(f->>'estatus',''))) = 'CANCELADO') AS estado_cancelado
  FROM jsonb_array_elements(_filas) AS f
  WHERE NULLIF(TRIM(f->>'llave'),'') IS NOT NULL;

  -- 2) UNA FILA POR (llave, placa): la placa es el registro; cajas se SUMAN por par.
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

  -- 3) UPSERT por (llave, placa).
  FOR r IN SELECT * FROM tmp_cons ORDER BY llave, placa LOOP
    IF r.fecha_hora ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_fecha := (date '1899-12-30' + r.fecha_hora::numeric * interval '1 day')::timestamptz;
    ELSE
      v_fecha := r.fecha_hora::timestamptz;
    END IF;

    IF v_fecha IS NULL OR v_fecha < v_sync_desde THEN
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
      r.transporte, r.denominacion, r.destino, r.region, v_cita, r.cajas,
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

  -- 4) FUSIONAR PLACAS VACÍAS (eliminar huérfanos, sin doble conteo).
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

-- Permisos para el rol que usa el Service Role key (POST vía PostgREST).
GRANT EXECUTE ON FUNCTION public.sync_transportes(jsonb) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- PASO 4: columna kg conservada como NULL (compatibilidad; nadie la usa)
--   Si prefieres ELIMINARLA por completo, cambia el siguiente Add por:
--     ALTER TABLE public.transportes DROP COLUMN IF EXISTS kg;
-- ----------------------------------------------------------------------------
ALTER TABLE public.transportes
  ADD COLUMN IF NOT EXISTS kg NUMERIC;

-- ============================================================================
-- VERIFICACIÓN (leer el resultado; no es necesario copiar la salida)
-- ============================================================================
SELECT 'ccl_update_transporte' AS funcion, count(*) AS definiciones
  FROM pg_proc WHERE proname = 'ccl_update_transporte'
UNION ALL
SELECT 'sync_transportes', count(*)
  FROM pg_proc WHERE proname = 'sync_transportes';

SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'transportes'
   AND column_name IN ('kg','cajas_manual')
 ORDER BY column_name;
