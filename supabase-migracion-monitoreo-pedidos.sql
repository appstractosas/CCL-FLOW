-- ============================================================
-- Migración: Módulo MONITOREO + Pedidos múltiples (Pedido 2/3/4)
-- Ejecutar en Supabase: SQL Editor → New query → Run
-- ============================================================

-- 1) Columnas nuevas para pedidos múltiples en la tabla TRANSPORTES
ALTER TABLE public.transportes ADD COLUMN IF NOT EXISTS numero_pedido2 text;
ALTER TABLE public.transportes ADD COLUMN IF NOT EXISTS numero_pedido3 text;
ALTER TABLE public.transportes ADD COLUMN IF NOT EXISTS numero_pedido4 text;

-- 2) Permisos del nuevo módulo MONITOREO en los roles existentes.
--    ADMIN y SUPERVISOR: acceso + edición (marcan "H. Salida Portería").
--    DESPACHADOR / PORTERO / PLANEADOR: solo lectura del módulo.
UPDATE public.roles
SET permissions = permissions || '{"monitoreo":{"canAccess":true,"canEdit":true}}'::jsonb
WHERE id IN ('ROLE_ADMIN', 'ROLE_SUPERVISOR');

UPDATE public.roles
SET permissions = permissions || '{"monitoreo":{"canAccess":true,"canEdit":false}}'::jsonb
WHERE id IN ('ROLE_DESPACHADOR', 'ROLE_PORTERO', 'ROLE_PLANEADOR');
