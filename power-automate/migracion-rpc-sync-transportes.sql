-- =============================================================================
-- MIGRACIÓN: RPC sync_transportes para Power Automate (Excel 365 -> Supabase)
-- -----------------------------------------------------------------------------
-- MODELO: UNA FILA POR PLACA.
--   * Cada LLAVE puede repetirse con PLACAS diferentes (cada placa = una fila).
--   * El par (llave, placa) identifica la fila (UNIQUE en la BD).
--   * Las CAJAS se SUMAN POR PLACA (filas del mismo llave+placa guardan la suma).
--
-- Cambios frente a la versión que "consolidaba por llave (SUMA cajas)":
--   - Cada fila del Excel es una LLAVE + PLACA. Una llave puede repetirse con
--     PLACAS diferentes: cada PLACA es un registro propio de la BD.
--   - Las CAJAS se SUMAN POR PLACA: si la misma (llave, placa) aparece en varias
--     filas del Excel (p. ej. varios transportes del mismo camión), el registro
--     de esa placa guarda la SUMA de esas filas (antes: la ÚLTIMA fila).
--   - El UPSERT usa ON CONFLICT (llave, placa) en lugar de ON CONFLICT (llave).
--
-- Qué hace (normalización conservada de la versión anterior):
--   1) Normaliza llave/placa a UPPER+TRIM y cajas a número (limpia [.,]).
--   2) Estatus 'CANCELADO' -> estado_porteria = 'CANCELADO'.
--   3) estatus (col. Estatus/estado_transporte del Excel) -> estado_transporte:
--      solo DESPACHADO/ALISTADO/PENDIENTE (valores del CHECK de la BD);
--      vacío o valor desconocido -> 'ALISTADO' (DEFAULT de la columna).
--   4) Agrupa por (llave, placa): ganador = ÚLTIMA fila del par para el resto de
--      campos y SUMA de cajas de todas las filas del par.
--   5) fecha_hora/cita_cargue: serial de Excel (ej. 46248) -> ISO, o se usan
--      tal cual si ya vienen en ISO.
--   6) UPSERT ON CONFLICT (llave, placa): solo actualiza campos no vacíos y
--      NUNCA pisa el estado de portería salvo que venga CANCELADO; cajas SÍ se
--      actualiza (se reconstruye la SUMA por placa en cada corrida).
--   7) CAJAS POR PLACA: cada registro (llave, placa) guarda la sumatoria de las
--      cajas de las filas del Excel con ese mismo par. La suma total de una
--      llave = la suma de sus placas (registros).
--   8) Si el Excel repite un TRANSPORTE en llaves DISTINTAS, el trigger
--      fn_transporte_una_llave lo rechaza y la corrida se aborta (regla de
--      negocio: un pedido no puede pertenecer a dos llaves).
--
-- ADITIVO y REVERSIBLE:
--   - Solo CREA/REEMPLAZA la función; NO toca tablas ni datos existentes.
--   - Revertir: DROP FUNCTION public.sync_transportes(jsonb);
--
-- Cómo se llama desde Power Automate:
--   URI:  https://<ref>.supabase.co/rest/v1/rpc/sync_transportes
--   POST: {"_filas": [ {fila} , ... ]}  (ver README.md, flujo 3 pasos)
--
-- Ejecutar en Supabase > SQL Editor.
-- =============================================================================

-- Helper: devuelve el primer valor no vacío probando varias claves de la fila.
-- Compara ignorando mayúsculas/minúsculas, espacios, guiones y guiones bajos,
-- de modo que 'Olt Inicial' ~ 'olt_inicial' ~ 'Olt-Inicial' son equivalentes.
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
BEGIN
  IF jsonb_typeof(_filas) <> 'array' OR jsonb_array_length(_filas) = 0 THEN
    RETURN;
  END IF;

  -- 1) NORMALIZAR: UPPER/TRIM, estatus CANCELADO, cajas -> número.
  --    transportadora/transporte/denominacion/estado_transporte se leen con _sync_campo.
  CREATE TEMP TABLE tmp_sync ON COMMIT DROP AS
  SELECT
    row_number() OVER ()::int AS row_id,
    UPPER(TRIM(COALESCE(f->>'llave','')))                AS llave,
    NULLIF(UPPER(TRIM(COALESCE(f->>'placa',''))) ,'')    AS placa,
    NULLIF(UPPER(TRIM(COALESCE(f->>'vehiculo_tipo',''))),'') AS vehiculo_tipo,
    NULLIF(_sync_campo(f, ARRAY['transportadora','olt inicial']),'') AS transportadora,
    NULLIF(_sync_campo(f, ARRAY['transporte']),'') AS transporte,
    NULLIF(_sync_campo(f, ARRAY['denominacion','denominación']),'') AS denominacion,
    NULLIF(_sync_campo(f, ARRAY['estado_transporte','estatus']),'') AS estado_transporte,
    NULLIF(TRIM(f->>'cita_cargue'),'')                   AS cita_cargue,
    NULLIF(TRIM(f->>'fecha_hora'),'')                    AS fecha_hora,
    COALESCE(ROUND(NULLIF(REGEXP_REPLACE(COALESCE(f->>'cajas',''),'[.,]','','g'),'')::numeric), 0) AS cajas,
    (UPPER(TRIM(COALESCE(f->>'estatus',''))) = 'CANCELADO') AS estado_cancelado
  FROM jsonb_array_elements(_filas) AS f
  WHERE NULLIF(TRIM(f->>'llave'),'') IS NOT NULL;

-- 2) UNA FILA POR (llave, placa): la placa es el registro. Si el Excel repite la
--    MISMA (llave, placa) (un camión con varios transportes), gana la ÚLTIMA
--    fila para el resto de campos y las CAJAS se SUMAN (SUM por (llave, placa)).
--    Placas DISTINTAS de la misma llave son registros aparte (NO se mezclan).
  CREATE TEMP TABLE tmp_cons ON COMMIT DROP AS
  SELECT DISTINCT ON (llave, placa)
    row_id,
    llave,
    placa,
    vehiculo_tipo,
    transportadora,
    transporte,
    denominacion,
    estado_transporte,
    cita_cargue,
    fecha_hora,
    estado_cancelado,
    SUM(cajas) OVER (PARTITION BY llave, placa)::numeric AS cajas
  FROM tmp_sync
  ORDER BY llave, placa, row_id DESC;

  -- 3) UPSERT por (llave, placa).
  FOR r IN SELECT * FROM tmp_cons ORDER BY llave, placa LOOP
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

    -- Valores por defecto para columnas NOT NULL con default (igual que antes:
    -- si el Excel llega vacío, la BD aplica su DEFAULT en vez de violar NOT NULL).
    INSERT INTO transportes (
      llave, fecha_hora, placa, vehiculo_tipo, transportadora,
      transporte, denominacion, cita_cargue, cajas, estado_transporte, estado_porteria, updated_at
    ) VALUES (
      r.llave,
      COALESCE(v_fecha, now()),
      COALESCE(r.placa, ''),
      COALESCE(r.vehiculo_tipo, 'SENCILLO'),
      COALESCE(r.transportadora, ''),
      r.transporte, r.denominacion, v_cita, r.cajas,
      -- estado_transporte: solo los valores del CHECK de la columna; si la
      -- celda Estatus viene vacía o con un valor desconocido, se aplica el
      -- DEFAULT 'ALISTADO' (el CHECK rechaza cualquier otro valor).
      CASE WHEN r.estado_transporte IN ('DESPACHADO','ALISTADO','PENDIENTE')
           THEN r.estado_transporte ELSE 'ALISTADO' END,
      CASE WHEN r.estado_cancelado THEN 'CANCELADO' ELSE 'Pendiente' END,
      now()
    )
    ON CONFLICT (llave, placa) DO UPDATE SET
      fecha_hora     = EXCLUDED.fecha_hora,
      vehiculo_tipo  = COALESCE(NULLIF(EXCLUDED.vehiculo_tipo,''), transportes.vehiculo_tipo),
      transportadora = COALESCE(NULLIF(EXCLUDED.transportadora,''), transportes.transportadora),
      transporte     = COALESCE(NULLIF(EXCLUDED.transporte,''), transportes.transporte),
      denominacion   = COALESCE(NULLIF(EXCLUDED.denominacion,''), transportes.denominacion),
      cita_cargue    = COALESCE(NULLIF(EXCLUDED.cita_cargue,''), transportes.cita_cargue),
      -- estado_transporte: el Excel ES la fuente; se pisa solo con valores
      -- válidos (vacío/desconocido -> 'ALISTADO', nunca fuera del CHECK).
      estado_transporte = CASE WHEN EXCLUDED.estado_transporte IN ('DESPACHADO','ALISTADO','PENDIENTE')
                               THEN EXCLUDED.estado_transporte ELSE 'ALISTADO' END,
      -- cajas: se SUMAN POR PLACA en tmp_cons, por lo que el sync ES la fuente
      -- de cajas de cada (llave, placa). Se incluye en el UPDATE para que una
      -- corrida posterior corrija el valor (p. ej. filas insertadas antes de
      -- este cambio, como la llave 81810).
      cajas = EXCLUDED.cajas,
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