-- ============================================================================
-- CCL FLOW · Migración: ampliar el CHECK de tipo_usuario en USERS
-- ----------------------------------------------------------------------------
-- La columna users.tipo_usuario tiene un CHECK que solo admite los tipos
-- originales; al crear usuarios de los nuevos roles TABLERO/INFORMES falla con:
--   "new row for relation "users" violates check constraint
--    "users_tipo_usuario_check""
--
-- Esta migración reconstruye el CHECK con TODOS los tipos del sistema:
--   admin, despachador, portero, planeador, supervisor, monitor,
--   transportes, tablero, informes
--
-- Ejecutar en Supabase: SQL Editor -> New query -> Run.
-- ============================================================================

-- Definición actual (para auditoría antes del cambio):
SELECT conname, pg_get_constraintdef(oid) AS definicion_actual
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass AND conname = 'users_tipo_usuario_check';

-- Reconstruir el CHECK con la lista completa:
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tipo_usuario_check;

ALTER TABLE public.users ADD CONSTRAINT users_tipo_usuario_check
  CHECK (tipo_usuario IN (
    'admin', 'despachador', 'portero', 'planeador', 'supervisor',
    'monitor', 'transportes', 'tablero', 'informes'
  ));

-- Verificación: debe mostrar el CHECK con los 9 valores.
SELECT conname, pg_get_constraintdef(oid) AS definicion_nueva
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass AND conname = 'users_tipo_usuario_check';
