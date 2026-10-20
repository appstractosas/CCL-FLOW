-- =============================================================================
-- 0017: kg / mts — columnas INFORMATIVAS del fuente (hoja "CONSOLIDADO").
--
-- Motivo: la hoja/Excel trae las columnas "KG" (peso) y "MTS" (metros) y el
-- operador quiere verlas en el módulo TRANSPORTES. Son datos de SOLO LECTURA en
-- la app: nunca se editan (no entran al formulario ni a campos_manuales) ni se
-- pisan entre si. El sync las refresca en cada corrida como CAJAS.
--
-- Reglas (alineadas con CAJAS):
--   * Se SUMAN por el par (llave, placa_origen) cuando la hoja repite ese par.
--   * Se limpian [.,] y se REDONDEAN (sin decimales), igual que cajas.
--   * Si el fuente no trae el valor (0/NULL) se conserva el existente
--     (COALESCE(NULLIF(EXCLUDED.kg,0), transportes.kg)), igual que cajas.
--   * La app solo las LEE (select '*'); no las escribe.
--
-- Contrato de sync (regla AGENTS.md): este cambio se aplica en AMBOS flujos y en
-- el mismo commit:
--   * Apps Script: sheets-sync/transportes-sync.gs (MAPPING 'KG'->kg, 'MTS'->mts).
--   * Power Automate: power-automate/migracion-rpc-sync-transportes.sql (RPC).
--   Además, en el flujo de PA hay que agregar los pares clave/valor
--   `kg` <- columna KG y `mts` <- columna MTS en la acción "Seleccionar".
--
-- Orden: correr DESPUES de 0015. Reversible:
--   DROP COLUMN IF EXISTS mts; (kg se conserva para compatibilidad)
--   restaurar sync_transportes_full desde 0015.
-- =============================================================================

-- 1) Columnas kg / mts (kg ya puede existir; se agrega con IF NOT EXISTS).
ALTER TABLE public.transportes
  ADD COLUMN IF NOT EXISTS kg  NUMERIC,
  ADD COLUMN IF NOT EXISTS mts NUMERIC;

COMMENT ON COLUMN public.transportes.kg IS
  'Peso en KG del fuente (hoja/Excel, col. "KG"). INFORMATIVO y de solo lectura en la app; lo refresca el sync (suma por (llave, placa_origen), redondeado).';
COMMENT ON COLUMN public.transportes.mts IS
  'Metros (MTS) del fuente (hoja/Excel, col. "MTS"). INFORMATIVO y de solo lectura en la app; lo refresca el sync (suma por (llave, placa_origen), redondeado).';

-- 2) sync_transportes_full: upsert por (llave, placa_origen) con kg/mts (0015 + kg/mts).
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
           THEN r.estado_transporte ELSE 'ALISTADO' END,
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
      estado_transporte = CASE WHEN EXCLUDED.estado_transporte IN ('DESPACHADO','ALISTADO','EN PROCESO')
                                THEN EXCLUDED.estado_transporte ELSE 'ALISTADO' END,
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
