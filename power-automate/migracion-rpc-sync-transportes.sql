-- =============================================================================
-- MIGRACIÓN: RPC sync_transportes para Power Automate (Excel 365 -> Supabase)
-- -----------------------------------------------------------------------------
-- MODELO: UNA FILA POR PLACA.
--   * Cada LLAVE puede repetirse con PLACAS diferentes (cada placa = una fila).
--   * El par (llave, placa) identifica la fila (UNIQUE en la BD).
--   * Las CAJAS se SUMAN POR PLACA (filas del mismo llave+placa guardan
--     la suma).
--
-- Cambios frente a la versión que "consolidaba por llave (SUMA cajas)":
--   - Cada fila del Excel es una LLAVE + PLACA. Una llave puede repetirse con
--     PLACAS diferentes: cada PLACA es un registro propio de la BD.
--   - Las CAJAS se SUMAN POR PLACA: si la misma (llave, placa) aparece en varias
--     filas del Excel (p. ej. varios transportes del mismo camión), el registro
--     de esa placa guarda la SUMA de esas filas (limpia [.,] + ROUND, sin
--     decimales).
--   - El UPSERT usa ON CONFLICT (llave, placa) en lugar de ON CONFLICT (llave).
--
-- Qué hace (normalización conservada de la versión anterior):
--   1) Normaliza llave/placa a UPPER+TRIM y cajas a número (limpia [.,] y
--      redondea).
--   2) Estatus 'CANCELADO' -> estado_porteria = 'CANCELADO'.
--   3) estatus (col. Estatus/estado_transporte del Excel) -> estado_transporte:
--      solo DESPACHADO/ALISTADO/PENDIENTE (valores del CHECK de la BD);
--      vacío o valor desconocido -> 'ALISTADO' (DEFAULT de la columna).
--   4) Agrupa por (llave, placa): ganador = ÚLTIMA fila del par para el resto de
--      campos y SUMA de cajas de todas las filas del par (mismo tratamiento
--      [.,] + ROUND; si ninguna fila del par trae cajas, la suma es 0).
--   5) fecha_hora/cita_cargue: serial de Excel (ej. 46248) -> ISO, o se usan
--      tal cual si ya vienen en ISO.
--   6) UPSERT ON CONFLICT (llave, placa): solo actualiza campos no vacíos y
--      NUNCA pisa el estado de portería salvo que venga CANCELADO; cajas SÍ se
--      actualizan (se reconstruye la SUMA por placa en cada corrida).
--   7) CAJAS POR PLACA: cada registro (llave, placa) guarda la sumatoria de las
--      cajas de las filas del Excel con ese mismo par. La suma total de una
--      llave = la suma de sus placas (registros).
--   8) Si el Excel repite un TRANSPORTE en llaves DISTINTAS, el trigger
--      fn_transporte_una_llave lo rechaza y la corrida se aborta (regla de
--      negocio: un pedido no puede pertenecer a dos llaves).
--   9) FILTRO POR FECHA (solo en este proceso): las filas cuya fecha_hora sea
--      ANTERIOR al 2026-09-01 se IGNORAN (CONTINUE). El sync solo procesa filas
--      del 01-sep en adelante. Para cambiar el límite, ajustar v_sync_desde.
--  10) FUSIONAR PLACAS VACÍAS: cuando el Excel asigna la placa a una fila que
--      venía vacía, deja de traer el par (llave,'') y en la BD no queda el
--      huérfano: se elimina(n) la(s) fila(s) (llave,'') de esa llave. Las
--      cajas ya se refrescan en el UPSERT por par. Mientras (llave,'') siga
--      llegando (placa aún sin asignar), la fila vacía se conserva y se
--      refresca cada corrida (sin doble conteo).
--  11) CAJAS MANUALES: si la fila tiene cajas_manual = TRUE (cajas editadas por
--      el despachador en la app), el sync NO la pisa; conserva el valor
--      capturado. La marca se limpia sola cuando el fuente trae EXACTAMENTE ese
--      mismo número de cajas (a partir de ahí el Excel vuelve a mandar).
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
  v_sync_desde constant timestamptz := '2026-09-01';
BEGIN
  IF jsonb_typeof(_filas) <> 'array' OR jsonb_array_length(_filas) = 0 THEN
    RETURN;
  END IF;

  -- 1) NORMALIZAR: UPPER/TRIM, estatus CANCELADO, cajas -> número.
  --    transportadora/transporte/denominacion/destino/region/estado_transporte
  --    se leen con _sync_campo. destino/region son OPCIONALES: si el Excel aún
  --    no los envía quedan en NULL y el upsert no los toca.
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

-- 2) UNA FILA POR (llave, placa): la placa es el registro. Si el Excel repite la
--    MISMA (llave, placa) (un camión con varios transportes), gana la ÚLTIMA
--    fila para el resto de campos y las CAJAS se SUMAN (SUM por (llave,placa),
--    mismo tratamiento [.,] + ROUND). Placas DISTINTAS de la misma
--    llave son registros aparte (NO se mezclan).
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
    -- fecha_hora: serial de Excel (ej. 46248) -> ISO | ya ISO -> tal cual.
    IF r.fecha_hora ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_fecha := (date '1899-12-30' + r.fecha_hora::numeric * interval '1 day')::timestamptz;
    ELSE
      v_fecha := r.fecha_hora::timestamptz;
    END IF;

    -- FILTRO (solo para este proceso de sync): ignora las filas cuya fecha_hora
    -- sea ANTERIOR al 2026-09-01. Solo se procesan filas del 01-sep en adelante.
    -- NO afecta a la app; únicamente limita qué filas lee este RPC.
    IF v_fecha IS NULL OR v_fecha < v_sync_desde THEN
      CONTINUE;
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
      transporte, denominacion, destino, region, cita_cargue, cajas,
      estado_transporte, estado_porteria, updated_at
    ) VALUES (
      r.llave,
      COALESCE(v_fecha, now()),
      COALESCE(r.placa, ''),
      COALESCE(r.vehiculo_tipo, 'SENCILLO'),
      COALESCE(r.transportadora, ''),
      r.transporte, r.denominacion, r.destino, r.region, v_cita, r.cajas,
      -- estado_transporte: solo los valores del CHECK de la columna; si la
      -- celda Estatus viene vacía o con un valor desconocido, se aplica el
      -- DEFAULT 'ALISTADO' (el CHECK rechaza cualquier otro valor).
      CASE WHEN r.estado_transporte IN ('DESPACHADO','ALISTADO','PENDIENTE')
           THEN r.estado_transporte ELSE 'ALISTADO' END,
      -- estado_porteria (fila NUEVA): CANCELADO si el Estatus lo dice; si hay
      -- placa -> CONFIRMADO; sin placa -> PENDIENTE.
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
      -- región: igual que destino; solo se pisa cuando el Excel trae valor.
      region         = COALESCE(NULLIF(EXCLUDED.region,''), transportes.region),
      cita_cargue    = COALESCE(NULLIF(EXCLUDED.cita_cargue,''), transportes.cita_cargue),
      -- estado_transporte: el Excel ES la fuente; se pisa solo con valores
      -- válidos (vacío/desconocido -> 'ALISTADO', nunca fuera del CHECK).
      estado_transporte = CASE WHEN EXCLUDED.estado_transporte IN ('DESPACHADO','ALISTADO','PENDIENTE')
                               THEN EXCLUDED.estado_transporte ELSE 'ALISTADO' END,
      -- cajas: el fuente (Excel) manda y el valor se refresca en
      -- cada corrida con la SUMA del par (llave, placa) que trae este payload,
      -- SALVO si la fila tiene cajas_manual = TRUE (editada por el despachador
      -- en la app): ahí se conserva el valor capturado. La marca se limpia sola
      -- cuando el fuente trae ese mismo número de cajas.
      cajas = CASE WHEN transportes.cajas_manual THEN transportes.cajas
                   ELSE COALESCE(NULLIF(EXCLUDED.cajas,0), transportes.cajas) END,
      cajas_manual = CASE WHEN transportes.cajas_manual
                           AND EXCLUDED.cajas > 0
                           AND EXCLUDED.cajas = transportes.cajas
                          THEN FALSE ELSE transportes.cajas_manual END,
      -- estado_porteria (fila EXISTENTE): solo se pisa si llega CANCELADO, o si la
      -- fila aún está en PENDIENTE/CONFIRMADO y el Excel trae placa (avanza a
      -- CONFIRMADO). NUNCA retrocede un estado avanzado de portería.
      estado_porteria = CASE
        WHEN EXCLUDED.estado_porteria = 'CANCELADO' THEN 'CANCELADO'
        WHEN transportes.estado_porteria IN ('Pendiente','Confirmado') AND COALESCE(EXCLUDED.placa,'') <> '' THEN 'Confirmado'
        ELSE transportes.estado_porteria
      END,
      updated_at     = now();
  END LOOP;

  -- 4) FUSIONAR PLACAS VACÍAS (eliminar huérfanos, sin doble conteo):
  --    Cuando el Excel asigna la placa a una fila que venía vacía, deja de traer
  --    el par (llave,'') para esa llave y en la BD quedaría el huérfano de placa
  --    vacía. La señal de "ya se asignó la placa" es que esta corrida NO trae
  --    (llave,'') para una llave que en la BD conserva fila(s) de placa vacía
  --    junto a fila(s) con placa llena: se elimina(n) el(los) huérfano(s).
  --    Las cajas ya quedaron bien en el UPSERT (se refrescan por par en cada
  --    corrida); aquí solo se remueve la fila sin placa que ya no corresponde.
  --    Mientras el par (llave,'') SIGA llegando (placa aún sin asignar), la fila
  --    vacía se conserva y se refresca cada corrida (dinámica, sin acumular
  --    entre corridas).
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

-- Verificación rápida del parser (opcional, ejecutar aparte en el SQL Editor):
--   SELECT '1234'::numeric      AS cajas_entero;