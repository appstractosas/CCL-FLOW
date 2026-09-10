-- ============================================================================
-- CCL FLOW · Migración: Roles TABLERO e INFORMES (solo lectura)
-- ----------------------------------------------------------------------------
-- Crea los roles ROLE_TABLERO y ROLE_INFORMES en tablas EXISTENTES:
--   * ROLE_TABLERO  → acceso de consulta al módulo 'tablero' (AeropuertoBoard).
--   * ROLE_INFORMES → acceso de consulta al módulo 'informes'.
-- Ninguno puede editar ningún módulo (canEdit false en todo).
--
-- Idempotente: si el rol ya existe no lo toca (preserva ajustes hechos desde
-- la matriz de permisos). El permissions incluye TODOS los módulos del sistema
-- con {canAccess, canEdit}, igual que generan los presets de la app.
--
-- Ejecutar en Supabase: SQL Editor -> New query -> Run.
-- ============================================================================

INSERT INTO public.roles (id, name, description, is_preset, permissions)
SELECT
  'ROLE_TABLERO',
  'TABLERO',
  'Consulta del tablero del aeropuerto (solo lectura).',
  true,
  jsonb_build_object(
    'despachos',   jsonb_build_object('canAccess', false, 'canEdit', false),
    'planeacion',  jsonb_build_object('canAccess', false, 'canEdit', false),
    'transportes', jsonb_build_object('canAccess', false, 'canEdit', false),
    'porteria',    jsonb_build_object('canAccess', false, 'canEdit', false),
    'monitoreo',   jsonb_build_object('canAccess', false, 'canEdit', false),
    'personal',    jsonb_build_object('canAccess', false, 'canEdit', false),
    'informes',    jsonb_build_object('canAccess', false, 'canEdit', false),
    'admin_roles', jsonb_build_object('canAccess', false, 'canEdit', false),
    'usuarios',    jsonb_build_object('canAccess', false, 'canEdit', false),
    'chat',        jsonb_build_object('canAccess', false, 'canEdit', false),
    'tablero',     jsonb_build_object('canAccess', true,  'canEdit', false)
  )
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE id = 'ROLE_TABLERO');

INSERT INTO public.roles (id, name, description, is_preset, permissions)
SELECT
  'ROLE_INFORMES',
  'INFORMES',
  'Consulta y exportación de informes (sin edición operativa).',
  true,
  jsonb_build_object(
    'despachos',   jsonb_build_object('canAccess', false, 'canEdit', false),
    'planeacion',  jsonb_build_object('canAccess', false, 'canEdit', false),
    'transportes', jsonb_build_object('canAccess', false, 'canEdit', false),
    'porteria',    jsonb_build_object('canAccess', false, 'canEdit', false),
    'monitoreo',   jsonb_build_object('canAccess', false, 'canEdit', false),
    'personal',    jsonb_build_object('canAccess', false, 'canEdit', false),
    'informes',    jsonb_build_object('canAccess', true,  'canEdit', false),
    'admin_roles', jsonb_build_object('canAccess', false, 'canEdit', false),
    'usuarios',    jsonb_build_object('canAccess', false, 'canEdit', false),
    'chat',        jsonb_build_object('canAccess', false, 'canEdit', false),
    'tablero',     jsonb_build_object('canAccess', false, 'canEdit', false)
  )
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE id = 'ROLE_INFORMES');

-- Verificación: los dos nuevos deben aparecer con sus permisos.
SELECT id, name, permissions->'tablero' AS tablero, permissions->'informes' AS informes
FROM public.roles
WHERE id IN ('ROLE_TABLERO', 'ROLE_INFORMES')
ORDER BY id;
