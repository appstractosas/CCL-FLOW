-- =============================================================================
-- 0019: ESTATUS (estado_transporte) SIN DATO cuando el fuente viene vacío.
--
-- Motivo: si la celda "Estado mercancia" del Sheets/Excel viene vacía, la app
-- no debe inventar 'ALISTADO'. Se guarda NULL y la columna ESTATUS muestra "—".
--
-- Cambios:
--   1) transportes.estado_transporte pasa a NULL-able (DROP NOT NULL,
--      DEFAULT NULL) y el CHECK acepta NULL.
--   2) ccl_create_transporte: al crear una llave sin ESTATUS se guarda NULL.
--   3) ccl_update_transporte: permite limpiar el ESTATUS desde la app (NULL) y
--      marca 'estado_transporte' en campos_manuales también al limpiarlo.
--   4) sync_transportes_full: vacío/ausente -> NULL; valores desconocidos no
--      vacíos conservan el fallback 'ALISTADO' de siempre.
--
-- Contrato de sync (regla AGENTS.md): este cambio se aplica en AMBOS flujos y en
-- el mismo commit:
--   * Apps Script: sheets-sync/transportes-sync.gs (llama a este RPC; sin cambios).
--   * Power Automate: power-automate/migracion-rpc-sync-transportes.sql.
--
-- Orden: correr DESPUÉS de 0018. Reversible: revertir las RPC; si se vuelve a
-- NOT NULL, primero rellenar los NULL existentes.
-- =============================================================================

-- 1) Columna NULL-able y CHECK que acepta NULL.
ALTER TABLE public.transportes
  ALTER COLUMN estado_transporte DROP NOT NULL;
ALTER TABLE public.transportes
  ALTER COLUMN estado_transporte SET DEFAULT NULL;
ALTER TABLE public.transportes DROP CONSTRAINT IF EXISTS transportes_estado_transporte_check;
ALTER TABLE public.transportes ADD CONSTRAINT transportes_estado_transporte_check
  CHECK (estado_transporte IS NULL OR estado_transporte = ANY (ARRAY['ALISTADO','EN PROCESO','DESPACHADO','PENDIENTE']));

-- 2) ccl_create_transporte: al crear sin ESTATUS se guarda NULL.
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
    llave, fecha_hora, placa, placa_origen, vehiculo_tipo, cita_cargue,
    transporte, denominacion, cajas, destino, region,
    transportadora, estado_transporte, estado_porteria,
    muelle_asignado, cuadrilla, hora_muelle_asignado,
    hora_llegada_porteria, hora_ingreso, hora_inicio_cargue,
    hora_fin_cargue, hora_salida, observaciones,
    campos_manuales
  ) VALUES (
    p_data->>'llave',
    (p_data->>'fecha_hora')::timestamptz,
    p_data->>'placa',
    COALESCE(p_data->>'placa', ''),
    COALESCE(p_data->>'vehiculo_tipo', 'SENCILLO'),
    p_data->>'cita_cargue',
    p_data->>'transporte',
    p_data->>'denominacion',
    NULLIF(p_data->>'cajas','')::numeric,
    p_data->>'destino',
    p_data->>'region',
    COALESCE(p_data->>'transportadora', ''),
    NULLIF(p_data->>'estado_transporte', ''),
    COALESCE(p_data->>'estado_porteria', 'Pendiente'),
    p_data->>'muelle_asignado',
    p_data->>'cuadrilla',
    p_data->>'hora_muelle_asignado',
    p_data->>'hora_llegada_porteria',
    p_data->>'hora_ingreso',
    p_data->>'hora_inicio_cargue',
    p_data->>'hora_fin_cargue',
    p_data->>'hora_salida',
    p_data->>'observaciones',
    ARRAY(
      SELECT c FROM unnest(ARRAY['fecha_hora','cita_cargue','vehiculo_tipo','transportadora',
                                 'transporte','denominacion','destino','region']) AS c
      WHERE NULLIF(p_data->>c, '') IS NOT NULL
    )
  )
  RETURNING id INTO v_id;

  SELECT to_jsonb(t.*) INTO v_result
  FROM public.transportes t
  WHERE t.id = v_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ccl_create_transporte(jsonb) TO anon, authenticated;

-- 3) ccl_update_transporte: permite limpiar el ESTATUS y lo protege.
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
    -- Conserva la placa original del fuente para que el sync pueda encontrar la
    -- fila aunque la placa se edite varias veces desde la app.
    placa_origen = COALESCE(NULLIF(placa_origen, ''), placa),
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
    -- Permite limpiar el ESTATUS desde la app: JSON null/'' -> NULL.
    estado_transporte = CASE WHEN p_data ? 'estado_transporte'
                             THEN NULLIF(p_data->>'estado_transporte','')
                             ELSE estado_transporte END,
    estado_porteria = COALESCE(p_data->>'estado_porteria', estado_porteria),
    muelle_asignado = CASE WHEN p_data ? 'muelle_asignado' THEN p_data->>'muelle_asignado' ELSE muelle_asignado END,
    cuadrilla = CASE WHEN p_data ? 'cuadrilla' THEN p_data->>'cuadrilla' ELSE cuadrilla END,
    hora_muelle_asignado = CASE WHEN p_data ? 'hora_muelle_asignado' THEN p_data->>'hora_muelle_asignado' ELSE hora_muelle_asignado END,
    hora_llegada_porteria = CASE WHEN p_data ? 'hora_llegada_porteria' THEN p_data->>'hora_llegada_porteria' ELSE hora_llegada_porteria END,
    hora_ingreso = CASE WHEN p_data ? 'hora_ingreso' THEN p_data->>'hora_ingreso' ELSE hora_ingreso END,
    hora_inicio_cargue = CASE WHEN p_data ? 'hora_inicio_cargue' THEN p_data->>'hora_inicio_cargue' ELSE hora_inicio_cargue END,
    hora_fin_cargue = CASE WHEN p_data ? 'hora_fin_cargue' THEN p_data->>'hora_fin_cargue' ELSE hora_fin_cargue END,
    hora_salida = CASE WHEN p_data ? 'hora_salida' THEN p_data->>'hora_salida' ELSE hora_salida END,
    observaciones = CASE WHEN p_data ? 'observaciones' THEN p_data->>'observaciones' ELSE observaciones END,
    campos_manuales = ARRAY(
      SELECT DISTINCT c
      FROM unnest(
        COALESCE(campos_manuales, '{}')
        || (CASE WHEN p_data ? 'fecha_hora' AND NULLIF(p_data->>'fecha_hora','') IS NOT NULL
                      AND NOT public._mismo_valor(p_data->>'fecha_hora', fecha_hora::text)
                 THEN ARRAY['fecha_hora'] ELSE '{}'::text[] END)
        || (CASE WHEN p_data ? 'cita_cargue' AND NULLIF(p_data->>'cita_cargue','') IS NOT NULL
                      AND NOT public._mismo_valor(p_data->>'cita_cargue', cita_cargue)
                 THEN ARRAY['cita_cargue'] ELSE '{}'::text[] END)
        || (CASE WHEN p_data ? 'vehiculo_tipo' AND NULLIF(p_data->>'vehiculo_tipo','') IS NOT NULL
                      AND NOT public._mismo_valor(p_data->>'vehiculo_tipo', vehiculo_tipo)
                 THEN ARRAY['vehiculo_tipo'] ELSE '{}'::text[] END)
        || (CASE WHEN p_data ? 'transportadora' AND NULLIF(p_data->>'transportadora','') IS NOT NULL
                      AND NOT public._mismo_valor(p_data->>'transportadora', transportadora)
                 THEN ARRAY['transportadora'] ELSE '{}'::text[] END)
        || (CASE WHEN p_data ? 'transporte' AND NULLIF(p_data->>'transporte','') IS NOT NULL
                      AND NOT public._mismo_valor(p_data->>'transporte', transporte)
                 THEN ARRAY['transporte'] ELSE '{}'::text[] END)
        || (CASE WHEN p_data ? 'denominacion' AND NULLIF(p_data->>'denominacion','') IS NOT NULL
                      AND NOT public._mismo_valor(p_data->>'denominacion', denominacion)
                 THEN ARRAY['denominacion'] ELSE '{}'::text[] END)
        || (CASE WHEN p_data ? 'destino' AND NULLIF(p_data->>'destino','') IS NOT NULL
                      AND NOT public._mismo_valor(p_data->>'destino', destino)
                 THEN ARRAY['destino'] ELSE '{}'::text[] END)
        || (CASE WHEN p_data ? 'region' AND NULLIF(p_data->>'region','') IS NOT NULL
                      AND NOT public._mismo_valor(p_data->>'region', region)
                 THEN ARRAY['region'] ELSE '{}'::text[] END)
        || (CASE WHEN p_data ? 'placa' AND NULLIF(p_data->>'placa','') IS NOT NULL
                      AND NOT public._mismo_valor(p_data->>'placa', placa)
                 THEN ARRAY['placa'] ELSE '{}'::text[] END)
        || (CASE WHEN p_data ? 'estado_transporte'
                      AND NOT public._mismo_valor(p_data->>'estado_transporte', estado_transporte)
                 THEN ARRAY['estado_transporte'] ELSE '{}'::text[] END)
      ) AS c
    )
  WHERE id = p_id::uuid;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'La BD no actualizo ninguna fila (id=%). La fila no existe.', p_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ccl_update_transporte(text, jsonb) TO anon, authenticated;

-- 4) sync_transportes_full: protege estado_transporte vía campos_manuales.
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
  v_pares text[];               -- pares (llave|placa_origen) del payload
BEGIN
  IF jsonb_typeof(_filas) <> 'array' OR jsonb_array_length(_filas) = 0 THEN
    RETURN;
  END IF;

  -- 1. Normalizar payload a tmp_sync. placa_origen = placa del fuente.
  CREATE TEMP TABLE tmp_sync ON COMMIT DROP AS
  SELECT
    row_number() OVER ()::int AS row_id,
    UPPER(TRIM(COALESCE(f->>'llave','')))                AS llave,
    NULLIF(UPPER(TRIM(COALESCE(f->>'placa',''))) ,'')    AS placa,
    NULLIF(UPPER(TRIM(COALESCE(f->>'placa',''))) ,'')    AS placa_origen,
    (NULLIF(UPPER(TRIM(COALESCE(f->>'placa',''))),'') IS NOT NULL) AS tenia_placa,
    NULLIF(UPPER(TRIM(COALESCE(f->>'vehiculo_tipo',''))),'') AS vehiculo_tipo,
    NULLIF(public._sync_campo(f, ARRAY['transportadora','olt inicial']),'') AS transportadora,
    NULLIF(public._sync_campo(f, ARRAY['transporte']),'') AS transporte,
    NULLIF(public._sync_campo(f, ARRAY['denominacion','denominación']),'') AS denominacion,
    NULLIF(public._sync_campo(f, ARRAY['destino']),'') AS destino,
    NULLIF(public._sync_campo(f, ARRAY['region','región']),'') AS region,
    NULLIF(public._sync_campo(f, ARRAY['cita_entrega','cita de entrega']),'') AS cita_entrega,
    NULLIF(public._sync_campo(f, ARRAY['estado_transporte','estatus']),'') AS estado_transporte,
    NULLIF(TRIM(f->>'cita_cargue'),'')                   AS cita_cargue,
    NULLIF(TRIM(f->>'fecha_hora'),'')                    AS fecha_hora,
    COALESCE(ROUND(NULLIF(REGEXP_REPLACE(COALESCE(f->>'cajas',''),'[.,]','','g'),'')::numeric), 0) AS cajas,
    COALESCE(ROUND(NULLIF(REGEXP_REPLACE(COALESCE(f->>'kg',''),'[.,]','','g'),'')::numeric), 0) AS kg,
    COALESCE(ROUND(NULLIF(REGEXP_REPLACE(COALESCE(f->>'mts',''),'[.,]','','g'),'')::numeric), 0) AS mts,
    (UPPER(TRIM(COALESCE(f->>'estatus',''))) = 'CANCELADO') AS estado_cancelado
  FROM jsonb_array_elements(_filas) AS f
  WHERE NULLIF(TRIM(f->>'llave'),'') IS NOT NULL;

  -- Regla: si la llave tiene placa, TODAS sus filas usan esa placa. Las lineas
  -- con Placa vacia se fusionan en la fila con placa (misma clave) y sus CAJAS/
  -- KG/MTS se IGNORAN: asi no queda una fila PENDIENTE fantasma por la misma llave.
  UPDATE tmp_sync s
  SET placa_origen = p.placa_llave,
      cajas = 0,
      kg = 0,
      mts = 0
  FROM (
    SELECT llave, MAX(placa) AS placa_llave
    FROM tmp_sync WHERE placa IS NOT NULL GROUP BY llave
  ) p
  WHERE s.llave = p.llave AND s.placa IS NULL;

  -- Misma regla cuando la hoja NO trae placa pero la BD YA tiene una para la
  -- llave (asignada desde la app): la linea vacia se fusiona en la fila
  -- existente en vez de crear una PENDIENTE con po='' que duplicaria la llave.
  UPDATE tmp_sync s
  SET placa_origen = d.placa_db,
      cajas = 0,
      kg = 0,
      mts = 0
  FROM (
    SELECT llave, MAX(placa_origen) AS placa_db
    FROM public.transportes
    WHERE COALESCE(placa_origen,'') <> ''
    GROUP BY llave
  ) d
  WHERE s.llave = d.llave
    AND s.placa IS NULL
    AND COALESCE(s.placa_origen,'') = '';

  -- 2. Dedupe por (llave, placa_origen) y suma de cajas/kg/mts
  CREATE TEMP TABLE tmp_cons ON COMMIT DROP AS
  SELECT DISTINCT ON (llave, placa_origen)
    row_id,
    llave,
    placa,
    placa_origen,
    vehiculo_tipo,
    transportadora,
    transporte,
    denominacion,
    destino,
    region,
    cita_entrega,
    estado_transporte,
    cita_cargue,
    fecha_hora,
    estado_cancelado,
    SUM(cajas) OVER (PARTITION BY llave, placa_origen)::numeric AS cajas,
    SUM(kg)    OVER (PARTITION BY llave, placa_origen)::numeric AS kg,
    SUM(mts)   OVER (PARTITION BY llave, placa_origen)::numeric AS mts
  FROM tmp_sync
  ORDER BY llave, placa_origen, tenia_placa DESC, row_id DESC;

  -- 3. Claves (llave|placa_origen) que llegaron en el payload
  SELECT array_agg(DISTINCT llave || '|' || COALESCE(placa_origen,'')) INTO v_pares
  FROM tmp_cons;

  -- 3.5 TRANSFERENCIA DE PLACAS (renombrado) por placa_origen. Excluye filas con
  --     placa editada manualmente en la app (no se renombran).
  WITH
    nuevas AS (
      SELECT t.llave, t.placa_origen
      FROM tmp_cons t
      WHERE t.placa_origen IS NOT NULL AND t.placa_origen <> ''
      GROUP BY t.llave, t.placa_origen
    ),
    viejas AS (
      SELECT x.llave, x.placa_origen
      FROM public.transportes x
      WHERE x.placa_origen IS NOT NULL AND x.placa_origen <> ''
        AND NOT ('placa' = ANY(COALESCE(x.campos_manuales, '{}')))
    ),
    nueva_x AS (
      SELECT n.llave, n.placa_origen,
             row_number() OVER (PARTITION BY n.llave ORDER BY n.placa_origen) AS rn
      FROM nuevas n
      LEFT JOIN viejas v ON v.llave = n.llave AND v.placa_origen = n.placa_origen
      WHERE v.placa_origen IS NULL
    ),
    vieja_x AS (
      SELECT v.llave, v.placa_origen,
             row_number() OVER (PARTITION BY v.llave ORDER BY v.placa_origen) AS rn
      FROM viejas v
      LEFT JOIN nuevas n ON n.llave = v.llave AND n.placa_origen = v.placa_origen
      WHERE n.placa_origen IS NULL
    ),
    emparejada AS (
      SELECT nx.llave, nx.placa_origen AS origen_nueva, vx.placa_origen AS origen_vieja
      FROM nueva_x nx
      JOIN vieja_x vx ON vx.llave = nx.llave AND vx.rn = nx.rn
    )
  UPDATE public.transportes t
  SET placa = e.origen_nueva,
      placa_origen = e.origen_nueva,
      updated_at = now()
  FROM emparejada e
  WHERE t.llave = e.llave AND t.placa_origen = e.origen_vieja;

  -- 4. UPSERT por (llave, placa_origen). `placa` NO se actualiza: la app manda.
  FOR r IN SELECT * FROM tmp_cons ORDER BY llave, placa_origen LOOP
    IF r.fecha_hora ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_fecha := (date '1899-12-30' + r.fecha_hora::numeric * interval '1 day')::timestamptz;
    ELSE
      v_fecha := NULLIF(r.fecha_hora,'')::timestamptz;
    END IF;

    IF v_fecha IS NULL OR v_fecha < '2026-09-01'::timestamptz THEN
      CONTINUE;
    END IF;

    IF r.cita_cargue ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_cita := to_char((date '1899-12-30' + r.cita_cargue::numeric * interval '1 day'), 'YYYY-MM-DD"T"HH24:MI:00');
    ELSE
      v_cita := r.cita_cargue;
    END IF;

    INSERT INTO public.transportes (
      llave, fecha_hora, placa, placa_origen, vehiculo_tipo, transportadora,
      transporte, denominacion, destino, region, cita_cargue, cajas, kg, mts,
      estado_transporte, estado_porteria, updated_at
    ) VALUES (
      r.llave,
      COALESCE(v_fecha, now()),
      COALESCE(r.placa, ''),
      COALESCE(r.placa_origen, ''),
      COALESCE(r.vehiculo_tipo, 'SENCILLO'),
      COALESCE(r.transportadora, ''),
      r.transporte, r.denominacion, r.destino, r.region, r.cita_cargue, r.cajas, r.kg, r.mts,
      CASE WHEN r.estado_transporte IN ('DESPACHADO','ALISTADO','EN PROCESO')
           THEN r.estado_transporte
           WHEN r.estado_transporte IS NULL THEN NULL
           ELSE 'ALISTADO' END,
      CASE
        WHEN r.estado_cancelado THEN 'CANCELADO'
        WHEN COALESCE(r.placa,'') <> '' THEN 'Confirmado'
        ELSE 'Pendiente'
      END,
      now()
    )
    ON CONFLICT (llave, placa_origen) DO UPDATE SET
      -- Campos protegidos (campos_manuales): si la app los edito, conserva el
      -- valor de la BD; si no, el fuente manda con la logica de siempre.
      -- NOTA: `placa` NO aparece aqui; se conserva siempre la de la BD.
      fecha_hora     = CASE WHEN 'fecha_hora' = ANY(transportes.campos_manuales)
                            THEN transportes.fecha_hora ELSE EXCLUDED.fecha_hora END,
      vehiculo_tipo  = CASE WHEN 'vehiculo_tipo' = ANY(transportes.campos_manuales)
                            THEN transportes.vehiculo_tipo
                            ELSE COALESCE(NULLIF(EXCLUDED.vehiculo_tipo,''), transportes.vehiculo_tipo) END,
      transportadora = CASE WHEN 'transportadora' = ANY(transportes.campos_manuales)
                            THEN transportes.transportadora
                            ELSE COALESCE(NULLIF(EXCLUDED.transportadora,''), transportes.transportadora) END,
      transporte     = CASE WHEN 'transporte' = ANY(transportes.campos_manuales)
                            THEN transportes.transporte
                            ELSE COALESCE(NULLIF(EXCLUDED.transporte,''), transportes.transporte) END,
      denominacion   = CASE WHEN 'denominacion' = ANY(transportes.campos_manuales)
                            THEN transportes.denominacion
                            ELSE COALESCE(NULLIF(EXCLUDED.denominacion,''), transportes.denominacion) END,
      destino        = CASE WHEN 'destino' = ANY(transportes.campos_manuales)
                            THEN transportes.destino
                            ELSE COALESCE(NULLIF(EXCLUDED.destino,''), transportes.destino) END,
      region         = CASE WHEN 'region' = ANY(transportes.campos_manuales)
                            THEN transportes.region
                            ELSE COALESCE(NULLIF(EXCLUDED.region,''), transportes.region) END,
      cita_cargue    = CASE WHEN 'cita_cargue' = ANY(transportes.campos_manuales)
                            THEN transportes.cita_cargue
                            ELSE COALESCE(NULLIF(EXCLUDED.cita_cargue,''), transportes.cita_cargue) END,
      -- ESTATUS: si la app lo edito (campos_manuales), la BD manda; si no, el fuente.
      estado_transporte = CASE WHEN 'estado_transporte' = ANY(transportes.campos_manuales)
                               THEN transportes.estado_transporte
                               ELSE CASE WHEN EXCLUDED.estado_transporte IN ('DESPACHADO','ALISTADO','EN PROCESO')
                                         THEN EXCLUDED.estado_transporte
                                         WHEN EXCLUDED.estado_transporte IS NULL THEN NULL
                                         ELSE 'ALISTADO' END END,
      cajas = CASE WHEN transportes.cajas_manual THEN transportes.cajas
                    ELSE COALESCE(NULLIF(EXCLUDED.cajas,0), transportes.cajas) END,
      -- kg/mts: el fuente manda igual que cajas; si el payload no trae valor
      -- (0) se conserva el existente. La app no los edita (no hay *_manual).
      kg  = COALESCE(NULLIF(EXCLUDED.kg,0), transportes.kg),
      mts = COALESCE(NULLIF(EXCLUDED.mts,0), transportes.mts),
      cajas_manual = CASE WHEN transportes.cajas_manual
                           AND EXCLUDED.cajas > 0
                           AND EXCLUDED.cajas = transportes.cajas
                          THEN FALSE ELSE transportes.cajas_manual END,
      campos_manuales = (
        SELECT COALESCE(array_agg(DISTINCT f ORDER BY f), '{}')
        FROM unnest(transportes.campos_manuales) AS f
        WHERE NOT (
             (f = 'fecha_hora'     AND EXCLUDED.fecha_hora IS NOT DISTINCT FROM transportes.fecha_hora)
          OR (f = 'cita_cargue'    AND public._mismo_valor(EXCLUDED.cita_cargue, transportes.cita_cargue))
          OR (f = 'vehiculo_tipo'  AND public._mismo_valor(EXCLUDED.vehiculo_tipo, transportes.vehiculo_tipo))
          OR (f = 'transportadora' AND public._mismo_valor(EXCLUDED.transportadora, transportes.transportadora))
          OR (f = 'transporte'     AND public._mismo_valor(EXCLUDED.transporte, transportes.transporte))
          OR (f = 'denominacion'   AND public._mismo_valor(EXCLUDED.denominacion, transportes.denominacion))
          OR (f = 'destino'        AND public._mismo_valor(EXCLUDED.destino, transportes.destino))
          OR (f = 'region'         AND public._mismo_valor(EXCLUDED.region, transportes.region))
          OR (f = 'estado_transporte' AND public._mismo_valor(EXCLUDED.estado_transporte, transportes.estado_transporte))
        )
      ),
      estado_porteria = CASE
        WHEN EXCLUDED.estado_porteria = 'CANCELADO' THEN 'CANCELADO'
        WHEN transportes.estado_porteria IN ('Pendiente','Confirmado') AND COALESCE(EXCLUDED.placa,'') <> '' THEN 'Confirmado'
        ELSE transportes.estado_porteria
      END,
      updated_at     = now();
  END LOOP;

  -- 4.5 DETALLE POR LLAVE: reconstruir el array (una entrada por FILA del
  --   fuente, en orden). NO se protege con campos_manuales; la app solo lo lee.
  WITH llaves AS (
    SELECT llave,
           jsonb_agg(
             jsonb_build_object(
               'denominacion', denominacion,
               'destino', destino,
               'cita_entrega', cita_entrega
             ) ORDER BY row_id
           ) AS detalle
    FROM tmp_sync
    GROUP BY llave
  )
  UPDATE public.transportes t
  SET detalle_llave = l.detalle,
      updated_at = now()
  FROM llaves l
  WHERE t.llave = l.llave;

  -- 5. Placas quitadas SIN reemplazo: por placa_origen (no toca lo que quedo).
  UPDATE public.transportes t
  SET
    placa = '',
    placa_origen = '',
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
    AND (t.llave || '|' || COALESCE(t.placa_origen,'')) <> ALL(v_pares)
    AND COALESCE(t.placa_origen,'') <> '';

  -- 6. FUSIONAR PLACAS VACÍAS (huérfanos) para las llaves del payload
  FOR r IN
    SELECT DISTINCT t.llave
    FROM public.transportes t
    WHERE COALESCE(t.placa_origen,'') = ''
      AND EXISTS (SELECT 1 FROM public.transportes t2
                  WHERE t2.llave = t.llave
                    AND COALESCE(t2.placa_origen,'') <> '')
      AND NOT EXISTS (SELECT 1 FROM tmp_sync s
                      WHERE s.llave = t.llave
                        AND s.placa_origen IS NULL)
  LOOP
    DELETE FROM public.transportes
    WHERE llave = r.llave AND COALESCE(placa_origen,'') = '';
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_transportes_full(jsonb, date) TO anon, authenticated, service_role;
