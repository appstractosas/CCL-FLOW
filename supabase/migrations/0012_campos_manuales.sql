-- =============================================================================
-- 0012: campos_manuales — protege frente al sync los campos que la app edita
--
-- Motivo: cuando la app guarda un dato (creacion o edicion de llave por el
-- planeador), la siguiente corrida del sync (Apps Script o Power Automate)
-- lo reemplazaba con el valor viejo del Sheets/Excel.
--
-- Solucion (mismo patron que cajas_manual, pero en UNA sola columna lista):
--   * transportes.campos_manuales text[] = listado de campos de ESTA fila
--     editados desde la app. El upsert del sync, al encontrar el campo en la
--     lista, conserva el valor de la BD.
--   * La marca se limpia sola cuando el fuente trae el mismo valor
--     (comparacion con _mismo_valor: texto exacto o mismo instante) y a partir
--     de ahi el fuente vuelve a mandar sobre ese campo.
--   * ccl_create_transporte marca los campos con valor enviados al crear.
--   * ccl_update_transporte marca los campos enviados que difieren del valor
--     actual (evita falsas marcas por diferencia de formato).
--
-- Campos protegidos (8): fecha_hora, cita_cargue, vehiculo_tipo,
--   transportadora, transporte, denominacion, destino, region.
-- NO protegidos: placa (es parte de la clave del upsert; decision de diseño),
--   estado_transporte y cajas (autoridad del fuente / cajas_manual) y las
--   columnas de porteria (las escribe solo la app, el sync no las envia).
--
-- Tambien reconstruye el CHECK de estado_transporte para aceptar 'EN PROCESO'
--   (nuevo valor del origen) conservando 'PENDIENTE' (filas historicas).
--
-- Orden: correr ANTES que 0013_sync_full_campos_manuales.sql.
-- Reversible: DROP COLUMN campos_manuales; restaurar funciones desde 0011.
-- Aplicar en Supabase SQL Editor.
-- =============================================================================

-- 1) Columna (idempotente)
ALTER TABLE public.transportes
  ADD COLUMN IF NOT EXISTS campos_manuales text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.transportes.campos_manuales IS
  'Campos editados desde la app: el sync conserva estos valores hasta que la fuente trae el mismo.';

-- 2) CHECK de estado_transporte: acepta EN PROCESO (origen actual) y
--    PENDIENTE (filas historicas); sin esto, 0011 falla al sincronizar.
ALTER TABLE public.transportes DROP CONSTRAINT IF EXISTS transportes_estado_transporte_check;
ALTER TABLE public.transportes ADD CONSTRAINT transportes_estado_transporte_check
  CHECK (estado_transporte = ANY (ARRAY['ALISTADO','EN PROCESO','DESPACHADO','PENDIENTE']));

-- 3) Helper: igualdad tolerante a formato (texto exacto o mismo instante).
--    Evita marcar/proteger por diferencias de formato entre app y fuente
--    (p.ej. '2026-10-08 10:00' de la app vs '2026-10-08T10:00:00' del sync).
CREATE OR REPLACE FUNCTION public._mismo_valor(a text, b text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF a IS NOT DISTINCT FROM b THEN RETURN TRUE; END IF;
  IF a IS NULL OR b IS NULL THEN RETURN FALSE; END IF;
  BEGIN
    RETURN a::timestamptz = b::timestamptz;
  EXCEPTION WHEN others THEN
    RETURN FALSE;
  END;
END;
$$;

-- 4) ccl_create_transporte: al crear, marca los campos con valor que envio la
--    app, para que la siguiente corrida del sync no los reemplace por los
--    datos viejos del fuente (si es que la llave ya existia alla).
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
    hora_fin_cargue, hora_salida, observaciones,
    campos_manuales
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

-- 5) ccl_update_transporte: al editar, agrega a la lista los campos enviados
--    que difieren del valor actual. Conserva las marcas previas (se quitan
--    solas cuando el fuente trae el mismo valor, via sync).
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
