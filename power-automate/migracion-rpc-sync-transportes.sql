-- =============================================================================
-- MIGRACIÓN: RPC sync_transportes para Power Automate (Excel 365 -> Supabase)
-- -----------------------------------------------------------------------------
-- Reemplaza el POST batch del .gs: recibe el array completo del flujo,
-- normaliza, consolida por llave (SUMA cajas) y hace UPSERT ON CONFLICT(llave).
--
-- ADITIVO y REVERSIBLE:
--   - Solo CREA la función; NO toca tablas, columnas ni datos existentes.
--   - Revertir: DROP FUNCTION public.sync_transportes(jsonb);
--   - NO modifica la app (src/) ni transportes-sync.gs (siguen cómo respaldo).
--
-- Comportamiento replicado de transportes-sync.gs (buildRows_ + syncTransportes):
--   1) Normaliza llave/placa a UPPER+TRIM y cajas a número (limpia [.,]).
--   2) Estatus 'CANCELADO' -> estado_porteria = 'CANCELADO'.
--   3) Llaves en conflicto (misma llave con 2+ placas reales) se omiten.
--   4) Consolidación por llave: cajas se SUMAN; el resto toma el último valor
--      no vacío (una fila vacía no pisa datos previos).
--   5) fecha_hora/cita_cargue: si llegan como serial de Excel (ej. 46248) se
--      convierten a ISO; si ya vienen en ISO se usan tal cual.
--   6) UPSERT ON CONFLICT(llave): solo actualiza campos no vacíos y NUNCA pisa
--      el estado de portería salvo que venga CANCELADO.
--
-- Cómo se llama desde Power Automate:
--   URI:  https://<ref>.supabase.co/rest/v1/rpc/sync_transportes
--   POST: {"_filas": [ {fila} , ... ]}  (ver README.md, flujo 3 pasos)
--
-- Ejecutar en Supabase > SQL Editor.
-- =============================================================================

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
    NULLIF(TRIM(f->>'transportadora'),'')                AS transportadora,
    NULLIF(TRIM(f->>'transporte'),'')                    AS transporte,
    NULLIF(TRIM(f->>'denominacion'),'')                  AS denominacion,
    NULLIF(TRIM(f->>'cita_cargue'),'')                   AS cita_cargue,
    NULLIF(TRIM(f->>'fecha_hora'),'')                    AS fecha_hora,
    ROUND(NULLIF(REGEXP_REPLACE(COALESCE(f->>'cajas',''),'[.,]','','g'),'')::numeric) AS cajas,
    (UPPER(TRIM(COALESCE(f->>'estatus',''))) = 'CANCELADO') AS estado_cancelado
  FROM jsonb_array_elements(_filas) AS f
  WHERE NULLIF(TRIM(f->>'llave'),'') IS NOT NULL;

  -- 2) CONFLICTO (igual que el .gs): misma llave con 2+ placas reales -> se omite.
  DELETE FROM tmp_sync
  WHERE llave IN (
    SELECT llave FROM tmp_sync
    WHERE placa IS NOT NULL AND placa <> ''
    GROUP BY llave
    HAVING count(DISTINCT placa) > 1
  );

  -- 3) CONSOLIDAR por llave: cajas = SUMA; resto = último valor no vacío.
  CREATE TEMP TABLE tmp_cons ON COMMIT DROP AS
  SELECT
    llave,
    (array_agg(placa            ORDER BY row_id DESC) FILTER (WHERE placa IS NOT NULL))[1]            AS placa,
    (array_agg(vehiculo_tipo    ORDER BY row_id DESC) FILTER (WHERE vehiculo_tipo IS NOT NULL))[1]    AS vehiculo_tipo,
    (array_agg(transportadora   ORDER BY row_id DESC) FILTER (WHERE transportadora IS NOT NULL))[1]   AS transportadora,
    (array_agg(transporte       ORDER BY row_id DESC) FILTER (WHERE transporte IS NOT NULL))[1]       AS transporte,
    (array_agg(denominacion     ORDER BY row_id DESC) FILTER (WHERE denominacion IS NOT NULL))[1]     AS denominacion,
    (array_agg(cita_cargue      ORDER BY row_id DESC) FILTER (WHERE cita_cargue IS NOT NULL))[1]      AS cita_cargue,
    (array_agg(fecha_hora       ORDER BY row_id DESC) FILTER (WHERE fecha_hora IS NOT NULL))[1]       AS fecha_hora,
    COALESCE(SUM(cajas), 0)      AS cajas,
    BOOL_OR(estado_cancelado)    AS estado_cancelado
  FROM tmp_sync
  GROUP BY llave;

  -- 4) UPSERT por llave.
  FOR r IN SELECT * FROM tmp_cons LOOP
    -- fecha_hora: serial de Excel (ej. 46248) -> ISO | ya ISO -> tal cual.
    IF r.fecha_hora ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_fecha := (date '1899-12-30' + r.fecha_hora::numeric * interval '1 day')::timestamptz;
    ELSE
      v_fecha := r.fecha_hora::timestamptz;
    END IF;

    -- cita_cargue: serial con fracción -> ISO YYYY-MM-DDTHH:MI:00 | ya ISO -> tal cual.
    IF r.cita_cargue ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_cita := to_char((date '1899-12-30' + r.cita_cargue::numeric * interval '1 day'), 'YYYY-MM-DD"T"HH24:MI:00');
    ELSE
      v_cita := r.cita_cargue;
    END IF;

    -- Valores por defecto para columnas NOT NULL con default (igual que el .gs:
    -- si el Excel llega vacío, la BD aplica su DEFAULT en vez de violar NOT NULL).
    INSERT INTO transportes (
      llave, fecha_hora, placa, vehiculo_tipo, transportadora,
      transporte, denominacion, cita_cargue, cajas, estado_porteria, updated_at
    ) VALUES (
      r.llave,
      COALESCE(v_fecha, now()),
      COALESCE(NULLIF(r.placa,''), ''),
      COALESCE(NULLIF(r.vehiculo_tipo,''), 'SENCILLO'),
      COALESCE(NULLIF(r.transportadora,''), ''),
      r.transporte, r.denominacion, v_cita, r.cajas,
      CASE WHEN r.estado_cancelado THEN 'CANCELADO' ELSE 'Pendiente' END,
      now()
    )
    ON CONFLICT (llave) DO UPDATE SET
      fecha_hora     = EXCLUDED.fecha_hora,
      placa          = COALESCE(NULLIF(EXCLUDED.placa,''), transportes.placa),
      vehiculo_tipo  = COALESCE(NULLIF(EXCLUDED.vehiculo_tipo,''), transportes.vehiculo_tipo),
      transportadora = COALESCE(NULLIF(EXCLUDED.transportadora,''), transportes.transportadora),
      transporte     = COALESCE(NULLIF(EXCLUDED.transporte,''), transportes.transporte),
      denominacion   = COALESCE(NULLIF(EXCLUDED.denominacion,''), transportes.denominacion),
      cita_cargue    = COALESCE(NULLIF(EXCLUDED.cita_cargue,''), transportes.cita_cargue),
      cajas          = EXCLUDED.cajas,
      -- estado_porteria: SOLO se pisa si llega CANCELADO; el resto del flujo de
      -- portería (Confirmado, INGRESO A MUELLE, etc.) NUNCA se sobreescribe.
      estado_porteria = CASE WHEN EXCLUDED.estado_porteria = 'CANCELADO'
                             THEN 'CANCELADO' ELSE transportes.estado_porteria END,
      updated_at     = now();
  END LOOP;
END;
$$;

-- Permisos para el rol que usa el Service Role key (POST vía PostgREST).
GRANT EXECUTE ON FUNCTION public.sync_transportes(jsonb) TO anon, authenticated, service_role;