-- ============================================================================
-- HOTFIX: Cast UUID en ccl_update_transporte
-- Error: "operator does not exist: uuid = text"
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

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
