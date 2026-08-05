-- =============================================================================
-- MIGRACIÓN: Módulo CHAT en la matriz de permisos (ROLES)
-- Agrega el módulo "chat" dentro del JSONB de permissions de cada rol.
-- - Con el módulo CHAT activado, el rol puede escribir mensajes de coordinación.
-- - Los botones de Solicitud/Asignación de muelle los usan ADMIN, PORTERÍA
--   y SUPERVISOR según su función (PORTERO -> solicitud, SUPERVISOR -> confirmar).
-- IDEMPOTENTE: se puede ejecutar varias veces sin efecto secundario.
-- Ejecutar en Supabase > SQL Editor.
-- =============================================================================

-- ADMIN, PORTERÍA y SUPERVISOR: chat activado por defecto.
UPDATE public.roles
SET permissions = permissions || '{"chat":{"canAccess":true,"canEdit":false}}'::jsonb
WHERE name IN ('ADMIN', 'PORTERO', 'SUPERVISOR');

-- El resto de roles: chat desactivado (solo lectura) hasta activarlo en la matriz.
UPDATE public.roles
SET permissions = permissions || '{"chat":{"canAccess":false,"canEdit":false}}'::jsonb
WHERE name NOT IN ('ADMIN', 'PORTERO', 'SUPERVISOR');

-- Limpieza por si se ejecutó una versión anterior del script (columna chat_enabled).
ALTER TABLE public.roles DROP COLUMN IF EXISTS chat_enabled;
