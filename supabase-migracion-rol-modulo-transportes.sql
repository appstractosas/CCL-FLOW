-- ============================================================
-- Migración: Módulo TRANSPORTES + Rol TRANSPORTES
-- Ejecutar en Supabase: SQL Editor → New query → Run
-- ============================================================

-- 1) Ampliar el CHECK de tipo_usuario para aceptar el tipo 'transportes'.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tipo_usuario_check;
ALTER TABLE public.users ADD CONSTRAINT users_tipo_usuario_check
  CHECK (tipo_usuario IN ('admin', 'despachador', 'portero', 'planeador', 'supervisor', 'monitor', 'transportes'));

-- 2) Crear el rol TRANSPORTES (edición de placas en el módulo Transportes; lectura de Informes y Tablero).
INSERT INTO public.roles (id, name, description, is_preset, permissions)
VALUES (
  'ROLE_TRANSPORTES',
  'TRANSPORTES',
  'Registro y edición de placas de transportes.',
  true,
  '{
    "despachos":  {"canAccess": true,  "canEdit": false},
    "planeacion": {"canAccess": true,  "canEdit": false},
    "transportes": {"canAccess": true,  "canEdit": true},
    "porteria":   {"canAccess": false, "canEdit": false},
    "monitoreo":  {"canAccess": false, "canEdit": false},
    "personal":   {"canAccess": false, "canEdit": false},
    "informes":   {"canAccess": true,  "canEdit": false},
    "admin_roles":{"canAccess": false, "canEdit": false},
    "usuarios":   {"canAccess": false, "canEdit": false},
    "chat":       {"canAccess": false, "canEdit": false},
    "tablero":    {"canAccess": true,  "canEdit": false}
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 3) Permisos del nuevo módulo TRANSPORTES en los roles existentes.
--    ADMIN y SUPERVISOR: acceso + edición. DESPACHADOR / PORTERO / PLANEADOR / MONITOREO: solo lectura.
UPDATE public.roles
SET permissions = permissions || '{"transportes":{"canAccess":true,"canEdit":true}}'::jsonb
WHERE id IN ('ROLE_ADMIN', 'ROLE_SUPERVISOR');

UPDATE public.roles
SET permissions = permissions || '{"transportes":{"canAccess":true,"canEdit":false}}'::jsonb
WHERE id IN ('ROLE_DESPACHADOR', 'ROLE_PORTERO', 'ROLE_PLANEADOR', 'ROLE_MONITOREO');

-- 4) Crear el usuario TRANSPORTES (cédula consecutiva 1000000006, misma clave de los demás).
INSERT INTO public.users (id, nombre, cedula, clave, tipo_usuario, role_id, role_name)
VALUES ('USER_TRANSPORTES', 'Diana Ríos', '1000000006', '1234', 'transportes', 'ROLE_TRANSPORTES', 'TRANSPORTES')
ON CONFLICT (id) DO NOTHING;