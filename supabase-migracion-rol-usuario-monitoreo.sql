-- ============================================================
-- Migración: Rol MONITOREO + Usuario MONITOREO
-- Ejecutar en Supabase: SQL Editor → New query → Run
-- ============================================================

-- 1) Ampliar el CHECK de tipo_usuario para aceptar el tipo 'monitor'.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tipo_usuario_check;
ALTER TABLE public.users ADD CONSTRAINT users_tipo_usuario_check
  CHECK (tipo_usuario IN ('admin', 'despachador', 'portero', 'planeador', 'supervisor', 'monitor'));

-- 2) Crear el rol MONITOREO (acceso y edición del módulo Monitoreo; solo lectura del resto).
INSERT INTO public.roles (id, name, description, is_preset, permissions)
VALUES (
  'ROLE_MONITOREO',
  'MONITOREO',
  'Monitoreo de la operación y registro de salida de portería.',
  true,
  '{
    "despachos":  {"canAccess": true,  "canEdit": false},
    "planeacion": {"canAccess": true,  "canEdit": false},
    "porteria":   {"canAccess": true,  "canEdit": false},
    "monitoreo":  {"canAccess": true,  "canEdit": true},
    "personal":   {"canAccess": false, "canEdit": false},
    "informes":   {"canAccess": true,  "canEdit": false},
    "admin_roles":{"canAccess": false, "canEdit": false},
    "usuarios":   {"canAccess": false, "canEdit": false}
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 3) Crear el usuario MONITOREO (cédula consecutiva 1000000005, misma clave de los demás).
INSERT INTO public.users (id, nombre, cedula, clave, tipo_usuario, role_id, role_name)
VALUES ('USER_MONITOREO', 'Carlos Montero', '1000000005', '1234', 'monitor', 'ROLE_MONITOREO', 'MONITOREO')
ON CONFLICT (id) DO NOTHING;
