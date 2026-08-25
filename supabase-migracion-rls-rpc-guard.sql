-- ============================================================================
-- MIGRACIÓN: RLS Real + RPC Guard
-- Fecha: 2026-08-25
--
-- OBJETIVO:
-- 1. Cerrar escrituras directas del rol anon (INSERT/UPDATE/DELETE)
-- 2. Mantener SELECT abierto (lectura libre)
-- 3. Crear RPCs SECURITY DEFINER que bypassan RLS para escrituras
-- 4. La app llama a RPCs en vez de .from().insert/update/delete
-- 5. El sync (Power Automate / Apps Script) NO se afecta (usa Service Role + SECURITY DEFINER)
--
-- ANTES DE EJECUTAR:
--   - Respaldar la BD
--   - Verificar que no haya sesiones activas escribiendo
-- DESPUÉS DE EJECUTAR:
--   - Desplegar el frontend actualizado (services/*.ts)
-- ============================================================================

-- ============================================================================
-- PASO 1: REVOCAR permisos de escritura directa del rol anon en todas las tablas
-- ============================================================================

REVOKE INSERT, UPDATE, DELETE ON TABLE public.transportes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.chat_messages FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.notificaciones FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.historial_movimientos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.roles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon;

-- ============================================================================
-- PASO 2: ELIMINAR todas las políticas RLS existentes y recrearlas
-- ============================================================================

-- --- transportes ---
DROP POLICY IF EXISTS "app_full_access_transportes" ON public.transportes;
DROP POLICY IF EXISTS "transportes_select" ON public.transportes;
DROP POLICY IF EXISTS "transportes_insert" ON public.transportes;
DROP POLICY IF EXISTS "transportes_update" ON public.transportes;
DROP POLICY IF EXISTS "transportes_delete" ON public.transportes;

CREATE POLICY "transportes_select" ON public.transportes
  FOR SELECT USING (true);

CREATE POLICY "transportes_insert" ON public.transportes
  FOR INSERT WITH CHECK (false);

CREATE POLICY "transportes_update" ON public.transportes
  FOR UPDATE USING (false);

CREATE POLICY "transportes_delete" ON public.transportes
  FOR DELETE USING (false);

-- --- chat_messages ---
DROP POLICY IF EXISTS "app_full_access_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_select" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_insert" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_update" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_delete" ON public.chat_messages;

CREATE POLICY "chat_select" ON public.chat_messages
  FOR SELECT USING (true);

CREATE POLICY "chat_insert" ON public.chat_messages
  FOR INSERT WITH CHECK (false);

CREATE POLICY "chat_update" ON public.chat_messages
  FOR UPDATE USING (false);

CREATE POLICY "chat_delete" ON public.chat_messages
  FOR DELETE USING (false);

-- --- notificaciones ---
DROP POLICY IF EXISTS "app_full_access_notificaciones" ON public.notificaciones;
DROP POLICY IF EXISTS "notif_select" ON public.notificaciones;
DROP POLICY IF EXISTS "notif_insert" ON public.notificaciones;
DROP POLICY IF EXISTS "notif_update" ON public.notificaciones;
DROP POLICY IF EXISTS "notif_delete" ON public.notificaciones;

CREATE POLICY "notif_select" ON public.notificaciones
  FOR SELECT USING (true);

CREATE POLICY "notif_insert" ON public.notificaciones
  FOR INSERT WITH CHECK (false);

CREATE POLICY "notif_update" ON public.notificaciones
  FOR UPDATE USING (false);

CREATE POLICY "notif_delete" ON public.notificaciones
  FOR DELETE USING (false);

-- --- historial_movimientos ---
DROP POLICY IF EXISTS "app_full_access_historial_movimientos" ON public.historial_movimientos;
DROP POLICY IF EXISTS "historial_select" ON public.historial_movimientos;
DROP POLICY IF EXISTS "historial_insert" ON public.historial_movimientos;

CREATE POLICY "historial_select" ON public.historial_movimientos
  FOR SELECT USING (true);

CREATE POLICY "historial_insert" ON public.historial_movimientos
  FOR INSERT WITH CHECK (false);

-- --- roles ---
DROP POLICY IF EXISTS "app_full_access_roles" ON public.roles;
DROP POLICY IF EXISTS "roles_select" ON public.roles;
DROP POLICY IF EXISTS "roles_insert" ON public.roles;
DROP POLICY IF EXISTS "roles_update" ON public.roles;
DROP POLICY IF EXISTS "roles_delete" ON public.roles;

CREATE POLICY "roles_select" ON public.roles
  FOR SELECT USING (true);

CREATE POLICY "roles_insert" ON public.roles
  FOR INSERT WITH CHECK (false);

CREATE POLICY "roles_update" ON public.roles
  FOR UPDATE USING (false);

CREATE POLICY "roles_delete" ON public.roles
  FOR DELETE USING (false);

-- --- users ---
DROP POLICY IF EXISTS "app_full_access_users" ON public.users;
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (false);

CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (false);

CREATE POLICY "users_delete" ON public.users
  FOR DELETE USING (false);

-- --- clientes (solo lectura, sin cambios) ---
-- Mantener cualquier política existente o crear SELECT abierto si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clientes' AND policyname = 'clientes_select'
  ) THEN
    CREATE POLICY "clientes_select" ON public.clientes
      FOR SELECT USING (true);
  END IF;
END $$;

-- --- ciudades (solo lectura, sin cambios) ---
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ciudades' AND policyname = 'ciudades_select'
  ) THEN
    CREATE POLICY "ciudades_select" ON public.ciudades
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- PASO 3: DAR PERMISOS de ejecución a anon y authenticated para los RPCs
-- ============================================================================

-- Los RPCs existentes (ccl_login, etc.) ya tienen GRANT EXECUTE.
-- Los nuevos los creamos más abajo con GRANT explícito.

-- ============================================================================
-- PASO 4: RPCs SECURITY DEFINER para escrituras
-- ============================================================================

-- --------------------------------------------------------------------------
-- 4.1 TRANSPORTES
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ccl_create_transporte(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  INSERT INTO public.transportes (
    llave, fecha_hora, placa, vehiculo_tipo, cita_cargue,
    transporte, denominacion, cajas, destino, region, kg,
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
    (p_data->>'cajas')::numeric,
    p_data->>'destino',
    p_data->>'region',
    (p_data->>'kg')::numeric,
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
  RETURNING to_jsonb(public.transportes.*);

  SELECT to_jsonb(t.*) INTO v_result
  FROM public.transportes t
  WHERE t.id = (
    SELECT id FROM public.transportes
    ORDER BY created_at DESC
    LIMIT 1
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ccl_update_transporte(p_id text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updates text := '';
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
    destino = CASE WHEN p_data ? 'destino' THEN p_data->>'destino' ELSE destino END,
    region = CASE WHEN p_data ? 'region' THEN p_data->>'region' ELSE region END,
    kg = CASE WHEN p_data ? 'kg' THEN (p_data->>'kg')::numeric ELSE kg END,
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

-- --------------------------------------------------------------------------
-- 4.2 CHAT MESSAGES
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ccl_send_message(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_result jsonb;
BEGIN
  INSERT INTO public.chat_messages (
    sender_role, sender_name, sender_module,
    llave_relacionada, muelle_sugerido,
    content, timestamp, is_read
  ) VALUES (
    p_data->>'sender_role',
    p_data->>'sender_name',
    p_data->>'sender_module',
    p_data->>'llave_relacionada',
    p_data->>'muelle_sugerido',
    p_data->>'content',
    (p_data->>'timestamp')::timestamptz,
    COALESCE((p_data->>'is_read')::boolean, false)
  )
  RETURNING id INTO v_id;

  SELECT to_jsonb(cm.*) INTO v_result
  FROM public.chat_messages cm
  WHERE cm.id = v_id;

  RETURN v_result;
END;
$$;

-- --------------------------------------------------------------------------
-- 4.3 NOTIFICACIONES
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ccl_create_notificacion(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_result jsonb;
BEGIN
  INSERT INTO public.notificaciones (
    tipo, titulo, mensaje, llave_relacionada, leida
  ) VALUES (
    p_data->>'tipo',
    p_data->>'titulo',
    p_data->>'mensaje',
    p_data->>'llave_relacionada',
    COALESCE((p_data->>'leida')::boolean, false)
  )
  RETURNING id INTO v_id;

  SELECT to_jsonb(n.*) INTO v_result
  FROM public.notificaciones n
  WHERE n.id = v_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ccl_mark_notifs_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notificaciones SET leida = true WHERE leida = false;
END;
$$;

-- --------------------------------------------------------------------------
-- 4.4 HISTORIAL MOVIMIENTOS
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ccl_create_movimiento(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_result jsonb;
BEGIN
  INSERT INTO public.historial_movimientos (
    usuario, tipo_usuario, cedula,
    accion, modulo, detalle, llave_relacionada, created_at
  ) VALUES (
    p_data->>'usuario',
    p_data->>'tipo_usuario',
    p_data->>'cedula',
    p_data->>'accion',
    COALESCE(p_data->>'modulo', 'general'),
    p_data->>'detalle',
    p_data->>'llave_relacionada',
    COALESCE((p_data->>'created_at')::timestamptz, now())
  )
  RETURNING id INTO v_id;

  SELECT to_jsonb(h.*) INTO v_result
  FROM public.historial_movimientos h
  WHERE h.id = v_id;

  RETURN v_result;
END;
$$;

-- --------------------------------------------------------------------------
-- 4.5 ROLES
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ccl_create_role(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  INSERT INTO public.roles (id, name, description, is_preset, permissions)
  VALUES (
    p_data->>'id',
    p_data->>'name',
    p_data->>'description',
    COALESCE((p_data->>'is_preset')::boolean, false),
    (p_data->>'permissions')::jsonb
  );

  SELECT to_jsonb(r.*) INTO v_result
  FROM public.roles r
  WHERE r.id = p_data->>'id';

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ccl_update_role(
  p_id text, p_name text, p_description text, p_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.roles
  SET name = p_name, description = p_description, permissions = p_permissions
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ccl_delete_role(p_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.roles WHERE id = p_id;
END;
$$;

-- --------------------------------------------------------------------------
-- 4.6 USERS
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ccl_create_user(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  INSERT INTO public.users (id, nombre, cedula, clave, tipo_usuario, role_id, role_name)
  VALUES (
    p_data->>'id',
    p_data->>'nombre',
    p_data->>'cedula',
    p_data->>'clave',
    p_data->>'tipo_usuario',
    p_data->>'role_id',
    p_data->>'role_name'
  );

  SELECT to_jsonb(u.*) INTO v_result
  FROM public.users u
  WHERE u.id = p_data->>'id';

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ccl_update_user(p_id text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users SET
    nombre = COALESCE(p_data->>'nombre', nombre),
    cedula = COALESCE(p_data->>'cedula', cedula),
    clave = COALESCE(p_data->>'clave', clave),
    tipo_usuario = COALESCE(p_data->>'tipo_usuario', tipo_usuario),
    role_id = COALESCE(p_data->>'role_id', role_id),
    role_name = COALESCE(p_data->>'role_name', role_name)
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ccl_delete_user(p_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.users WHERE id = p_id;
END;
$$;

-- --------------------------------------------------------------------------
-- 4.7 SEED (inicialización de datos)
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ccl_seed_initial_data()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_count integer;
  v_user_count integer;
BEGIN
  SELECT count(*) INTO v_role_count FROM public.roles;
  IF v_role_count = 0 THEN
    INSERT INTO public.roles (id, name, description, is_preset, permissions)
    VALUES
      ('ROLE_ADMIN', 'ADMIN', 'Acceso total al sistema y gestión de roles, usuarios e historial.', true, '{"despachos":{"canAccess":true,"canEdit":true},"planeacion":{"canAccess":true,"canEdit":true},"transportes":{"canAccess":true,"canEdit":true},"porteria":{"canAccess":true,"canEdit":true},"monitoreo":{"canAccess":true,"canEdit":true},"personal":{"canAccess":true,"canEdit":true},"informes":{"canAccess":true,"canEdit":true},"admin_roles":{"canAccess":true,"canEdit":true},"usuarios":{"canAccess":true,"canEdit":true},"chat":{"canAccess":true,"canEdit":true},"tablero":{"canAccess":true,"canEdit":true}}'),
      ('ROLE_DESPACHADOR', 'DESPACHADOR', 'Gestión de despachos y planeación.', true, '{"despachos":{"canAccess":true,"canEdit":true},"planeacion":{"canAccess":true,"canEdit":true},"transportes":{"canAccess":true,"canEdit":false},"porteria":{"canAccess":false,"canEdit":false},"monitoreo":{"canAccess":true,"canEdit":false},"personal":{"canAccess":false,"canEdit":false},"informes":{"canAccess":true,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":false,"canEdit":false},"tablero":{"canAccess":true,"canEdit":false}}'),
      ('ROLE_PORTERO', 'PORTERO', 'Control de puerta, muelles y estados de portería.', true, '{"despachos":{"canAccess":true,"canEdit":false},"planeacion":{"canAccess":true,"canEdit":false},"transportes":{"canAccess":true,"canEdit":false},"porteria":{"canAccess":true,"canEdit":true},"monitoreo":{"canAccess":true,"canEdit":false},"personal":{"canAccess":false,"canEdit":false},"informes":{"canAccess":false,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":true,"canEdit":false},"tablero":{"canAccess":true,"canEdit":false}}'),
      ('ROLE_PLANEADOR', 'PLANEADOR', 'Planeación de transporte y vista de despachos.', true, '{"despachos":{"canAccess":true,"canEdit":true},"planeacion":{"canAccess":true,"canEdit":true},"transportes":{"canAccess":true,"canEdit":false},"porteria":{"canAccess":false,"canEdit":false},"monitoreo":{"canAccess":true,"canEdit":false},"personal":{"canAccess":false,"canEdit":false},"informes":{"canAccess":true,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":false,"canEdit":false},"tablero":{"canAccess":true,"canEdit":false}}'),
      ('ROLE_SUPERVISOR', 'SUPERVISOR', 'Observación global de la operación e informes.', true, '{"despachos":{"canAccess":true,"canEdit":false},"planeacion":{"canAccess":true,"canEdit":false},"transportes":{"canAccess":true,"canEdit":true},"porteria":{"canAccess":true,"canEdit":false},"monitoreo":{"canAccess":true,"canEdit":true},"personal":{"canAccess":true,"canEdit":true},"informes":{"canAccess":true,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":true,"canEdit":false},"tablero":{"canAccess":true,"canEdit":false}}'),
      ('ROLE_MONITOREO', 'MONITOREO', 'Monitoreo de la operación y registro de salida de portería.', true, '{"despachos":{"canAccess":true,"canEdit":false},"planeacion":{"canAccess":true,"canEdit":false},"transportes":{"canAccess":true,"canEdit":false},"porteria":{"canAccess":true,"canEdit":false},"monitoreo":{"canAccess":true,"canEdit":true},"personal":{"canAccess":false,"canEdit":false},"informes":{"canAccess":true,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":false,"canEdit":false},"tablero":{"canAccess":true,"canEdit":false}}'),
      ('ROLE_TRANSPORTES', 'TRANSPORTES', 'Registro y edición de placas de transportes.', true, '{"despachos":{"canAccess":true,"canEdit":false},"planeacion":{"canAccess":true,"canEdit":false},"transportes":{"canAccess":true,"canEdit":true},"porteria":{"canAccess":false,"canEdit":false},"monitoreo":{"canAccess":false,"canEdit":false},"personal":{"canAccess":false,"canEdit":false},"informes":{"canAccess":true,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":false,"canEdit":false},"tablero":{"canAccess":true,"canEdit":false}}'),
      ('ROLE_TABLERO', 'TABLERO', 'Consulta del tablero del aeropuerto (solo lectura).', true, '{"despachos":{"canAccess":false,"canEdit":false},"planeacion":{"canAccess":false,"canEdit":false},"transportes":{"canAccess":false,"canEdit":false},"porteria":{"canAccess":false,"canEdit":false},"monitoreo":{"canAccess":false,"canEdit":false},"personal":{"canAccess":false,"canEdit":false},"informes":{"canAccess":false,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":false,"canEdit":false},"tablero":{"canAccess":true,"canEdit":false}}'),
      ('ROLE_INFORMES', 'INFORMES', 'Consulta y exportación de informes (sin edición operativa).', true, '{"despachos":{"canAccess":false,"canEdit":false},"planeacion":{"canAccess":false,"canEdit":false},"transportes":{"canAccess":false,"canEdit":false},"porteria":{"canAccess":false,"canEdit":false},"monitoreo":{"canAccess":false,"canEdit":false},"personal":{"canAccess":false,"canEdit":false},"informes":{"canAccess":true,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":false,"canEdit":false},"tablero":{"canAccess":false,"canEdit":false}}');
  END IF;

  SELECT count(*) INTO v_user_count FROM public.users;
  IF v_user_count = 0 THEN
    INSERT INTO public.users (id, nombre, cedula, clave, tipo_usuario, role_id, role_name)
    VALUES
      ('USER_ADMIN', 'ADMIN', '0000000000', 'admin', 'admin', 'ROLE_ADMIN', 'ADMIN'),
      ('USER_DESP', 'Juan Pérez', '1000000001', '1234', 'despachador', 'ROLE_DESPACHADOR', 'DESPACHADOR'),
      ('USER_PORTERO', 'Ramiro Torres', '1000000002', '1234', 'portero', 'ROLE_PORTERO', 'PORTERO'),
      ('USER_PLAN', 'Ana Gómez', '1000000003', '1234', 'planeador', 'ROLE_PLANEADOR', 'PLANEADOR'),
      ('USER_SUP', 'Luis Mora', '1000000004', '1234', 'supervisor', 'ROLE_SUPERVISOR', 'SUPERVISOR'),
      ('USER_MONITOREO', 'Carlos Montero', '1000000005', '1234', 'monitor', 'ROLE_MONITOREO', 'MONITOREO'),
      ('USER_TRANSPORTES', 'Diana Ríos', '1000000006', '1234', 'transportes', 'ROLE_TRANSPORTES', 'TRANSPORTES');
  END IF;

  RETURN true;
END;
$$;

-- ============================================================================
-- PASO 5: PERMISOS de ejecución para los nuevos RPCs
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.ccl_create_transporte(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_update_transporte(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_send_message(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_create_notificacion(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_mark_notifs_read() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_create_movimiento(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_create_role(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_update_role(text, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_delete_role(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_create_user(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_update_user(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_delete_user(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_seed_initial_data() TO anon, authenticated;

-- ============================================================================
-- FIN DE MIGRACIÓN
-- ============================================================================
