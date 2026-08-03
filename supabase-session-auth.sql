-- ============================================================================
-- CCL FLOW · Sesiones con token validado desde la BD
-- Ejecuta este script en Supabase: SQL Editor -> New query -> Run.
-- Es seguro de ejecutar (usa IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- NO borra ni modifica tus tablas existentes.
-- ============================================================================

-- 1) Tabla de sesiones
CREATE TABLE IF NOT EXISTS public.sessions (
  token      TEXT PRIMARY KEY,
  cedula     VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_cedula ON public.sessions (cedula);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON public.sessions (expires_at);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Las sesiones SOLO se manipulan desde las funciones (nunca por REST directo)
DROP POLICY IF EXISTS "sessions_no_anon_select" ON public.sessions;
CREATE POLICY "sessions_no_anon_select" ON public.sessions FOR SELECT USING (false);

DROP POLICY IF EXISTS "sessions_no_anon_insert" ON public.sessions;
CREATE POLICY "sessions_no_anon_insert" ON public.sessions FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "sessions_no_anon_delete" ON public.sessions;
CREATE POLICY "sessions_no_anon_delete" ON public.sessions FOR DELETE USING (false);

-- 2) LOGIN: valida cédula+clave contra la BD y crea la sesión (24 horas)
CREATE OR REPLACE FUNCTION public.ccl_login(p_cedula TEXT, p_clave TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_token TEXT;
BEGIN
  SELECT * INTO v_user
  FROM public.users
  WHERE cedula = p_cedula AND clave = p_clave
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

-- 3) VALIDAR SESIÓN: se llama al recargar la app
CREATE OR REPLACE FUNCTION public.ccl_validate_session(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT u.* INTO v_user
  FROM public.sessions s
  JOIN public.users u ON u.cedula = s.cedula
  WHERE s.token = p_token AND s.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE);
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
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

-- 4) LOGOUT: invalida el token en la BD
CREATE OR REPLACE FUNCTION public.ccl_logout(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sessions WHERE token = p_token;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

-- 5) Permitir llamar estas funciones con la anon key
GRANT EXECUTE ON FUNCTION public.ccl_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_validate_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccl_logout(TEXT) TO anon, authenticated;
