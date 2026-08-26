-- ============================================================================
-- MIGRACIÓN: Seguridad de Login — Rate Limiting + Password Policy + Session Timeout
-- Fecha: 2026-08-25
--
-- OBJETIVO:
-- 1. Rate limiting: máximo 5 intentos fallidos por cédula en 5 minutos
-- 2. Password policy: mínimo 8 caracteres, 1 mayúscula, 1 número
-- 3. Session timeout: 30 minutos de inactividad (en vez de 24h fijas)
-- 4. Actualizar contraseñas semilla al nuevo formato fuerte
--
-- ANTES DE EJECUTAR:
--   - Respaldar la BD
--   - Verificar que supabase-migracion-pgcrypto.sql ya fue ejecutado
-- DESPUÉS DE EJECUTAR:
--   - Actualizar el frontend (UserFormModal, LoginScreen, rbacService)
-- ============================================================================

-- ============================================================================
-- PASO 1: Tabla de intentos de login (rate limiting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id          BIGSERIAL PRIMARY KEY,
  cedula      VARCHAR(30) NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_cedula_time
  ON public.login_attempts (cedula, attempted_at DESC);

-- RLS: solo las funciones pueden acceder
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_attempts_no_anon" ON public.login_attempts;
CREATE POLICY "login_attempts_no_anon" ON public.login_attempts
  FOR ALL USING (false);

-- ============================================================================
-- PASO 2: Función auxiliar — validar fortaleza de contraseña
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ccl_validate_password_strength(p_clave TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_clave IS NULL OR length(p_clave) < 8 THEN
    RETURN 'La contraseña debe tener al menos 8 caracteres.';
  END IF;
  IF p_clave !~ '[A-Z]' THEN
    RETURN 'La contraseña debe contener al menos 1 letra mayúscula.';
  END IF;
  IF p_clave !~ '[0-9]' THEN
    RETURN 'La contraseña debe contener al menos 1 número.';
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================================================
-- PASO 3: Actualizar ccl_login — rate limiting + session timeout
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
  v_failed_count INTEGER;
BEGIN
  -- PASO A: Rate limiting — contar intentos fallidos en últimos 5 minutos
  SELECT count(*) INTO v_failed_count
  FROM public.login_attempts
  WHERE cedula = p_cedula
    AND attempted_at > now() - INTERVAL '5 minutes';

  IF v_failed_count >= 5 THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'Demasiados intentos fallidos. Intenta de nuevo en 5 minutos.',
      'locked', TRUE
    );
  END IF;

  -- PASO B: Buscar usuario y validar contraseña con bcrypt
  SELECT * INTO v_user
  FROM public.users
  WHERE cedula = p_cedula AND clave = crypt(p_clave, clave::text)
  LIMIT 1;

  IF NOT FOUND THEN
    -- Registrar intento fallido
    INSERT INTO public.login_attempts (cedula, attempted_at)
    VALUES (p_cedula, now());

    RETURN jsonb_build_object('ok', FALSE, 'error', 'Credenciales inválidas.');
  END IF;

  -- PASO C: Login exitoso — limpiar intentos fallidos de esta cédula
  DELETE FROM public.login_attempts WHERE cedula = p_cedula;

  -- PASO D: Crear sesión con 24h de expiración absoluta + 30 min de inactividad
  v_token := 'ccl_' || md5(gen_random_uuid()::TEXT || clock_timestamp()::TEXT || p_cedula);

  INSERT INTO public.sessions (token, cedula, created_at, expires_at)
  VALUES (v_token, p_cedula, now(), now() + INTERVAL '24 hours');

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
-- PASO 4: Actualizar ccl_validate_session — timeout 30 min inactividad
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ccl_validate_session(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id TEXT;
  v_nombre TEXT;
  v_cedula TEXT;
  v_tipo_usuario TEXT;
  v_role_id TEXT;
  v_role_name TEXT;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Buscar sesión válida (columnas individuales para evitar ambigüedad)
  SELECT u.id, u.nombre, u.cedula, u.tipo_usuario, u.role_id, u.role_name, s.created_at
  INTO v_id, v_nombre, v_cedula, v_tipo_usuario, v_role_id, v_role_name, v_created_at
  FROM public.sessions s
  JOIN public.users u ON u.cedula = s.cedula
  WHERE s.token = p_token
    AND s.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE);
  END IF;

  -- Verificar inactividad: si la sesión tiene más de 30 minutos sin usar
  IF v_created_at < now() - INTERVAL '30 minutes' THEN
    DELETE FROM public.sessions WHERE token = p_token;
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'session_expired_inactive');
  END IF;

  -- Actualizar timestamp de última actividad (extender ventana 30 min)
  UPDATE public.sessions
  SET created_at = now()
  WHERE token = p_token;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'user', jsonb_build_object(
      'id', v_id,
      'nombre', v_nombre,
      'cedula', v_cedula,
      'tipo_usuario', v_tipo_usuario,
      'role_id', v_role_id,
      'role_name', v_role_name
    )
  );
END;
$$;

-- ============================================================================
-- PASO 5: Actualizar ccl_create_user — validar contraseña fuerte
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
  v_error TEXT;
BEGIN
  -- Validar fortaleza de contraseña
  v_clave := p_data->>'clave';
  v_error := public.ccl_validate_password_strength(v_clave);
  IF v_error IS NOT NULL THEN
    RAISE EXCEPTION '%', v_error;
  END IF;

  -- Hashear la clave
  v_clave := crypt(v_clave, gen_salt('bf'));

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
-- PASO 6: Actualizar ccl_update_user — validar si cambia la contraseña
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ccl_update_user(p_id text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clave TEXT;
  v_error TEXT;
BEGIN
  IF p_data ? 'clave' THEN
    v_clave := p_data->>'clave';
    -- Solo validar si es nueva (no es ya un hash bcrypt)
    IF v_clave NOT LIKE '$2%' THEN
      v_error := public.ccl_validate_password_strength(v_clave);
      IF v_error IS NOT NULL THEN
        RAISE EXCEPTION '%', v_error;
      END IF;
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
-- PASO 7: Actualizar contraseñas semilla al formato fuerte
--   Formato: RoleName + 1234 (ej: Admin1234, Porte1234, Despa1234)
--   Todas tienen 9 caracteres, 1 mayúscula, 1 número ✓
-- ============================================================================

UPDATE public.users SET clave = crypt('Admin1234', gen_salt('bf')) WHERE id = 'USER_ADMIN';
UPDATE public.users SET clave = crypt('Despa1234', gen_salt('bf')) WHERE id = 'USER_DESP';
UPDATE public.users SET clave = crypt('Porte1234', gen_salt('bf')) WHERE id = 'USER_PORTERO';
UPDATE public.users SET clave = crypt('Plane1234', gen_salt('bf')) WHERE id = 'USER_PLAN';
UPDATE public.users SET clave = crypt('Super1234', gen_salt('bf')) WHERE id = 'USER_SUP';
UPDATE public.users SET clave = crypt('Monit1234', gen_salt('bf')) WHERE id = 'USER_MONITOREO';
UPDATE public.users SET clave = crypt('Trans1234', gen_salt('bf')) WHERE id = 'USER_TRANSPORTES';

-- ============================================================================
-- PASO 8: Actualizar ccl_seed_initial_data — contraseñas fuertes
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
      ('USER_ADMIN', 'ADMIN', '0000000000', crypt('Admin1234', gen_salt('bf')), 'admin', 'ROLE_ADMIN', 'ADMIN'),
      ('USER_DESP', 'Juan Pérez', '1000000001', crypt('Despa1234', gen_salt('bf')), 'despachador', 'ROLE_DESPACHADOR', 'DESPACHADOR'),
      ('USER_PORTERO', 'Ramiro Torres', '1000000002', crypt('Porte1234', gen_salt('bf')), 'portero', 'ROLE_PORTERO', 'PORTERO'),
      ('USER_PLAN', 'Ana Gómez', '1000000003', crypt('Plane1234', gen_salt('bf')), 'planeador', 'ROLE_PLANEADOR', 'PLANEADOR'),
      ('USER_SUP', 'Luis Mora', '1000000004', crypt('Super1234', gen_salt('bf')), 'supervisor', 'ROLE_SUPERVISOR', 'SUPERVISOR'),
      ('USER_MONITOREO', 'Carlos Montero', '1000000005', crypt('Monit1234', gen_salt('bf')), 'monitor', 'ROLE_MONITOREO', 'MONITOREO'),
      ('USER_TRANSPORTES', 'Diana Ríos', '1000000006', crypt('Trans1234', gen_salt('bf')), 'transportes', 'ROLE_TRANSPORTES', 'TRANSPORTES'),
      ('USER_TABLERO', 'Consultor Tablero', '1000000007', crypt('Tablero1234', gen_salt('bf')), 'tablero', 'ROLE_TABLERO', 'TABLERO'),
      ('USER_INFORMES', 'Consultor Informes', '1000000008', crypt('Inform1234', gen_salt('bf')), 'informes', 'ROLE_INFORMES', 'INFORMES');
  END IF;

  RETURN true;
END;
$$;

-- ============================================================================
-- PASO 9: Permisos de ejecución para la nueva función de validación
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.ccl_validate_password_strength(TEXT) TO anon, authenticated;

-- ============================================================================
-- FIN DE MIGRACIÓN
-- ============================================================================
