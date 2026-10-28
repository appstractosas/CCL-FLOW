-- ============================================================================
-- Migración: eliminar el módulo/rol MONITOREO
--
-- Contexto: el módulo MONITOREO desaparece de la app y su único paso
-- (H. Salida Portería) pasa a registrarse desde PORTERÍA. Los usuarios que
-- tenían el rol MONITOREO quedan con el rol PORTERO (permisos estándar).
--
-- IMPORTANTE: antes de ejecutar, respaldar:
--   SELECT * FROM public.roles;
--   SELECT * FROM public.users;
--
-- Orden de despliegue: ejecutar esta migración ANTES de publicar el frontend.
-- Si el frontend se publica primero, los usuarios con tipo 'monitor' quedan
-- apuntando a un rol inexistente y la app cae en el rol ADMIN como respaldo.
-- ============================================================================

BEGIN;

-- 1) Cerrar las sesiones activas de esos usuarios para que el próximo login
--    tome el rol nuevo (sessions se indexa por cédula).
DELETE FROM public.sessions
 WHERE cedula IN (
   SELECT cedula FROM public.users
    WHERE tipo_usuario = 'monitor' OR role_id = 'ROLE_MONITOREO'
 );

-- 2) Reasignar los usuarios del rol MONITOREO a PORTERO (antes de borrar el rol,
--    porque users.role_id referencia roles.id).
UPDATE public.users
   SET tipo_usuario = 'portero',
       role_id      = 'ROLE_PORTERO',
       role_name    = 'PORTERO'
 WHERE tipo_usuario = 'monitor'
    OR role_id = 'ROLE_MONITOREO';

-- 3) El CHECK de users.tipo_usuario deja de aceptar el tipo 'monitor'.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tipo_usuario_check;

ALTER TABLE public.users ADD CONSTRAINT users_tipo_usuario_check
  CHECK (tipo_usuario IN (
    'admin', 'despachador', 'portero', 'planeador', 'supervisor',
    'transportes', 'tablero', 'informes', 'informes_gerencia'
  ));

-- 4) Eliminar el rol.
DELETE FROM public.roles WHERE id = 'ROLE_MONITOREO';

-- 5) Limpiar la clave obsoleta 'monitoreo' del JSON de permisos de todos los roles.
UPDATE public.roles
   SET permissions = permissions - 'monitoreo'
 WHERE permissions ? 'monitoreo';

-- 6) Actualizar la semilla para que una instalación nueva no recree el rol ni el
--    usuario MONITOREO (versión vigente: supabase-migracion-seguridad-login.sql).
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
      ('ROLE_ADMIN', 'ADMIN', 'Acceso total al sistema y gestión de roles, usuarios e historial.', true, '{"despachos":{"canAccess":true,"canEdit":true},"planeacion":{"canAccess":true,"canEdit":true},"transportes":{"canAccess":true,"canEdit":true},"porteria":{"canAccess":true,"canEdit":true},"personal":{"canAccess":true,"canEdit":true},"informes":{"canAccess":true,"canEdit":true},"admin_roles":{"canAccess":true,"canEdit":true},"usuarios":{"canAccess":true,"canEdit":true},"chat":{"canAccess":true,"canEdit":true},"tablero":{"canAccess":true,"canEdit":true}}'),
      ('ROLE_DESPACHADOR', 'DESPACHADOR', 'Gestión de despachos y planeación.', true, '{"despachos":{"canAccess":true,"canEdit":true},"planeacion":{"canAccess":true,"canEdit":true},"transportes":{"canAccess":true,"canEdit":false},"porteria":{"canAccess":false,"canEdit":false},"personal":{"canAccess":false,"canEdit":false},"informes":{"canAccess":true,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":false,"canEdit":false},"tablero":{"canAccess":true,"canEdit":false}}'),
      ('ROLE_PORTERO', 'PORTERO', 'Control de puerta, muelles y estados de portería.', true, '{"despachos":{"canAccess":true,"canEdit":false},"planeacion":{"canAccess":true,"canEdit":false},"transportes":{"canAccess":true,"canEdit":false},"porteria":{"canAccess":true,"canEdit":true},"personal":{"canAccess":false,"canEdit":false},"informes":{"canAccess":false,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":true,"canEdit":false},"tablero":{"canAccess":true,"canEdit":false}}'),
      ('ROLE_PLANEADOR', 'PLANEADOR', 'Planeación de transporte y vista de despachos.', true, '{"despachos":{"canAccess":true,"canEdit":true},"planeacion":{"canAccess":true,"canEdit":true},"transportes":{"canAccess":true,"canEdit":false},"porteria":{"canAccess":false,"canEdit":false},"personal":{"canAccess":false,"canEdit":false},"informes":{"canAccess":true,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":false,"canEdit":false},"tablero":{"canAccess":true,"canEdit":false}}'),
      ('ROLE_SUPERVISOR', 'SUPERVISOR', 'Observación global de la operación e informes.', true, '{"despachos":{"canAccess":true,"canEdit":false},"planeacion":{"canAccess":true,"canEdit":false},"transportes":{"canAccess":true,"canEdit":true},"porteria":{"canAccess":true,"canEdit":false},"personal":{"canAccess":true,"canEdit":true},"informes":{"canAccess":true,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":true,"canEdit":false},"tablero":{"canAccess":true,"canEdit":false}}'),
      ('ROLE_TRANSPORTES', 'TRANSPORTES', 'Registro y edición de placas de transportes.', true, '{"despachos":{"canAccess":true,"canEdit":false},"planeacion":{"canAccess":true,"canEdit":false},"transportes":{"canAccess":true,"canEdit":true},"porteria":{"canAccess":false,"canEdit":false},"personal":{"canAccess":false,"canEdit":false},"informes":{"canAccess":true,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":false,"canEdit":false},"tablero":{"canAccess":true,"canEdit":false}}'),
      ('ROLE_TABLERO', 'TABLERO', 'Consulta del tablero del aeropuerto (solo lectura).', true, '{"despachos":{"canAccess":false,"canEdit":false},"planeacion":{"canAccess":false,"canEdit":false},"transportes":{"canAccess":false,"canEdit":false},"porteria":{"canAccess":false,"canEdit":false},"personal":{"canAccess":false,"canEdit":false},"informes":{"canAccess":false,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":false,"canEdit":false},"tablero":{"canAccess":true,"canEdit":false}}'),
      ('ROLE_INFORMES', 'INFORMES', 'Consulta y exportación de informes (sin edición operativa).', true, '{"despachos":{"canAccess":false,"canEdit":false},"planeacion":{"canAccess":false,"canEdit":false},"transportes":{"canAccess":false,"canEdit":false},"porteria":{"canAccess":false,"canEdit":false},"personal":{"canAccess":false,"canEdit":false},"informes":{"canAccess":true,"canEdit":false},"admin_roles":{"canAccess":false,"canEdit":false},"usuarios":{"canAccess":false,"canEdit":false},"chat":{"canAccess":false,"canEdit":false},"tablero":{"canAccess":false,"canEdit":false}}');
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
      ('USER_TRANSPORTES', 'Diana Ríos', '1000000006', crypt('Trans1234', gen_salt('bf')), 'transportes', 'ROLE_TRANSPORTES', 'TRANSPORTES'),
      ('USER_TABLERO', 'Consultor Tablero', '1000000007', crypt('Tablero1234', gen_salt('bf')), 'tablero', 'ROLE_TABLERO', 'TABLERO'),
      ('USER_INFORMES', 'Consultor Informes', '1000000008', crypt('Inform1234', gen_salt('bf')), 'informes', 'ROLE_INFORMES', 'INFORMES');
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ccl_seed_initial_data() TO anon, authenticated;

COMMIT;

-- ============================================================================
-- Verificación (debe devolver 0 filas en las dos primeras consultas)
-- ============================================================================
-- SELECT * FROM public.roles  WHERE id = 'ROLE_MONITOREO';
-- SELECT * FROM public.users  WHERE tipo_usuario = 'monitor' OR role_id = 'ROLE_MONITOREO';
-- SELECT id, permissions ? 'monitoreo' AS tiene_clave FROM public.roles WHERE permissions ? 'monitoreo';
