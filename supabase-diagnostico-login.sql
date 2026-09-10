-- ============================================================================
-- DIAGNÓSTICO RÁPIDO — Ejecuta estas 3 consultas y dime el resultado:
-- ============================================================================

-- 1) ¿Qué devuelve ccl_login con las credenciales correctas?
SELECT public.ccl_login('0000000000', 'Admin1234');

-- 2) ¿Qué versión de ccl_login está activa? (debe contener 'crypt')
SELECT public.ccl_login('');

-- 3) ¿Hay intentos fallidos bloqueando?
SELECT count(*) AS intentos_fallidos FROM public.login_attempts
WHERE cedula = '0000000000' AND attempted_at > now() - INTERVAL '5 minutes';

-- ============================================================================
-- FIX RÁPIDO — Si el diagnóstico muestra problemas, ejecuta esto:
-- ============================================================================

-- Limpiar rate limiting
DELETE FROM public.login_attempts;

-- Forzar reemplazo de ccl_login con la versión correcta
CREATE OR REPLACE FUNCTION public.ccl_login(p_cedula TEXT, p_clave TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_token TEXT;
  v_failed_count INTEGER;
BEGIN
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

  SELECT * INTO v_user
  FROM public.users
  WHERE cedula = p_cedula AND clave = crypt(p_clave, clave)
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.login_attempts (cedula, attempted_at)
    VALUES (p_cedula, now());
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Credenciales inválidas.');
  END IF;

  DELETE FROM public.login_attempts WHERE cedula = p_cedula;

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

GRANT EXECUTE ON FUNCTION public.ccl_login(TEXT, TEXT) TO anon, authenticated;

-- Verificar que funciona
SELECT public.ccl_login('0000000000', 'Admin1234');
