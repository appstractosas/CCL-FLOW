-- ============================================================================
-- MIGRACIÓN: Hash de contraseñas con pgcrypto (bcrypt)
-- Fecha: 2026-08-25
--
-- OBJETIVO:
-- 1. Habilitar extensión pgcrypto
-- 2. Hashear todas las claves existentes en texto plano con bcrypt
-- 3. Actualizar ccl_login para comparar con crypt()
-- 4. Actualizar ccl_create_user / ccl_update_user para hashear al guardar
-- 5. Actualizar ccl_seed_initial_data para hashear las claves semilla
--
-- ANTES DE EJECUTAR:
--   - Respaldar la BD
--   - Verificar que supabase-migracion-rls-rpc-guard.sql ya fue ejecutado
-- DESPUÉS DE EJECUTAR:
--   - No requiere cambios en el frontend (el hashing es 100% server-side)
-- ============================================================================

-- ============================================================================
-- PASO 1: Habilitar pgcrypto (bcrypt)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- PASO 2: Hashear claves existentes que estén en texto plano
-- Solo hashea si la clave NO empieza con '$2' (prefijo bcrypt).
-- Esto es idempotente: ejecutarlo varias veces no duplica hashes.
-- ============================================================================

UPDATE public.users
SET clave = crypt(clave, gen_salt('bf'))
WHERE clave NOT LIKE '$2%';

-- ============================================================================
-- PASO 3: Actualizar ccl_login — comparar con crypt()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ccl_login(p_cedula TEXT, p_clave TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_token TEXT;
BEGIN
  SELECT * INTO v_user
  FROM public.users
  WHERE cedula = p_cedula AND clave = crypt(p_clave, clave::text)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Credenciales inválidas');
  END IF;

  v_token := 'ccl_' || md5(gen_random_uuid()::TEXT || clock_timestamp()::TEXT || p_cedula);

  INSERT INTO public.sessions (token, cedula, expires_at)
  VALUES (v_token, p_cedula, now() + INTERVAL '24 hours');

  RETURN jsonb_build_object(
    'ok', TRUE,
    'token', v_token,
    'user', jsonb_build_object(
      'id', v_user.id,
      'nombre', v_user.nombre,
      'cedula', v_user.cedula,
      'tipo_usuario', v_user.tipo_usuario,
      'role_id', v_user.role_id,
      'role_name', v_user.role_name
    )
  );
END;
$$;

-- ============================================================================
-- PASO 4: Actualizar ccl_create_user — hashear clave al insertar
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ccl_create_user(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_result jsonb;
  v_clave TEXT;
BEGIN
  -- Hashear la clave si se proporciona
  v_clave := p_data->>'clave';
  IF v_clave IS NOT NULL AND v_clave NOT LIKE '$2%' THEN
    v_clave := crypt(v_clave, gen_salt('bf'));
  END IF;

  INSERT INTO public.users (id, nombre, cedula, clave, tipo_usuario, role_id, role_name)
  VALUES (
    p_data->>'id',
    p_data->>'nombre',
    p_data->>'cedula',
    v_clave,
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

-- ============================================================================
-- PASO 5: Actualizar ccl_update_user — hashear clave si cambia
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ccl_update_user(p_id text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clave TEXT;
BEGIN
  -- Hashear la clave solo si se está cambiando y no es ya un hash
  IF p_data ? 'clave' THEN
    v_clave := p_data->>'clave';
    IF v_clave IS NOT NULL AND v_clave NOT LIKE '$2%' THEN
      v_clave := crypt(v_clave, gen_salt('bf'));
    END IF;
  ELSE
    v_clave := NULL;
  END IF;

  UPDATE public.users SET
    nombre = COALESCE(p_data->>'nombre', nombre),
    cedula = COALESCE(p_data->>'cedula', cedula),
    clave = COALESCE(v_clave, clave),
    tipo_usuario = COALESCE(p_data->>'tipo_usuario', tipo_usuario),
    role_id = COALESCE(p_data->>'role_id', role_id),
    role_name = COALESCE(p_data->>'role_name', role_name)
  WHERE id = p_id;
END;
$$;

-- ============================================================================
-- PASO 6: Actualizar ccl_seed_initial_data — hashear claves semilla
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ccl_seed_initial_data()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
      ('USER_ADMIN', 'ADMIN', '0000000000', crypt('admin', gen_salt('bf')), 'admin', 'ROLE_ADMIN', 'ADMIN'),
      ('USER_DESP', 'Juan Pérez', '1000000001', crypt('1234', gen_salt('bf')), 'despachador', 'ROLE_DESPACHADOR', 'DESPACHADOR'),
      ('USER_PORTERO', 'Ramiro Torres', '1000000002', crypt('1234', gen_salt('bf')), 'portero', 'ROLE_PORTERO', 'PORTERO'),
      ('USER_PLAN', 'Ana Gómez', '1000000003', crypt('1234', gen_salt('bf')), 'planeador', 'ROLE_PLANEADOR', 'PLANEADOR'),
      ('USER_SUP', 'Luis Mora', '1000000004', crypt('1234', gen_salt('bf')), 'supervisor', 'ROLE_SUPERVISOR', 'SUPERVISOR'),
      ('USER_MONITOREO', 'Carlos Montero', '1000000005', crypt('1234', gen_salt('bf')), 'monitor', 'ROLE_MONITOREO', 'MONITOREO'),
      ('USER_TRANSPORTES', 'Diana Ríos', '1000000006', crypt('1234', gen_salt('bf')), 'transportes', 'ROLE_TRANSPORTES', 'TRANSPORTES'),
      ('USER_TABLERO', 'Consultor Tablero', '1000000007', crypt('Tablero1234', gen_salt('bf')), 'tablero', 'ROLE_TABLERO', 'TABLERO'),
      ('USER_INFORMES', 'Consultor Informes', '1000000008', crypt('Inform1234', gen_salt('bf')), 'informes', 'ROLE_INFORMES', 'INFORMES');
  END IF;

  RETURN true;
END;
$$;

-- ============================================================================
-- FIN DE MIGRACIÓN
-- ============================================================================
