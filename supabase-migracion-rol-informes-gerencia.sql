-- ============================================================================
-- CCL FLOW · Migración: rol INFORMES GERENCIA
-- ----------------------------------------------------------------------------
-- Crea el rol ROLE_INFORMES_GERENCIA con acceso de solo lectura al módulo
-- 'informes-gerencia'. También amplía el CHECK de users.tipo_usuario para
-- aceptar el nuevo tipo 'informes_gerencia'.
--
-- Idempotente: si el rol ya existe no lo modifica (preserva ajustes hechos
-- desde la matriz de permisos).
--
-- Ejecutar en Supabase: SQL Editor -> New query -> Run.
-- ============================================================================

-- 1) Ampliar el CHECK de tipo_usuario con el nuevo tipo.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tipo_usuario_check;

ALTER TABLE public.users ADD CONSTRAINT users_tipo_usuario_check
  CHECK (tipo_usuario IN (
    'admin', 'despachador', 'portero', 'planeador', 'supervisor',
    'monitor', 'transportes', 'tablero', 'informes', 'informes_gerencia'
  ));

-- 2) Crear el rol con acceso solo a informes-gerencia.
INSERT INTO public.roles (id, name, description, is_preset, permissions)
VALUES (
  'ROLE_INFORMES_GERENCIA',
  'INFORMES GERENCIA',
  'Consulta de informes de gerencia (sin edición operativa).',
  false,
  jsonb_build_object(
    'despachos',         jsonb_build_object('canAccess', false, 'canEdit', false),
    'planeacion',        jsonb_build_object('canAccess', false, 'canEdit', false),
    'transportes',       jsonb_build_object('canAccess', false, 'canEdit', false),
    'porteria',          jsonb_build_object('canAccess', false, 'canEdit', false),
    'monitoreo',         jsonb_build_object('canAccess', false, 'canEdit', false),
    'personal',          jsonb_build_object('canAccess', false, 'canEdit', false),
    'informes',          jsonb_build_object('canAccess', false, 'canEdit', false),
    'informes-gerencia', jsonb_build_object('canAccess', true,  'canEdit', false),
    'admin_roles',       jsonb_build_object('canAccess', false, 'canEdit', false),
    'usuarios',          jsonb_build_object('canAccess', false, 'canEdit', false),
    'chat',              jsonb_build_object('canAccess', false, 'canEdit', false),
    'tablero',           jsonb_build_object('canAccess', false, 'canEdit', false)
  )
)
ON CONFLICT (id) DO NOTHING;

-- Verificación: el rol debe aparecer con acceso a informes-gerencia.
SELECT id, name, is_preset, permissions->'informes-gerencia' AS informes_gerencia
FROM public.roles
WHERE id = 'ROLE_INFORMES_GERENCIA';
