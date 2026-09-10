-- =============================================================================
-- MIGRACIÓN: columna REGION en TRANSPORTES
-- -----------------------------------------------------------------------------
-- Qué hace:
--   * Agrega la columna `region` (texto, nullable) a la tabla public.transportes.
--   * La región viene del Excel/Sheets (encabezado "Region") vía los dos flujos
--     de sincronización (RPC sync_transportes y Apps Script) y también puede
--     capturarse desde la app (formulario de NUEVA LLAVE / edición).
--
-- Por qué nullable:
--   * Las filas históricas quedan con region NULL hasta el próximo sync; la RPC
--     solo pisa la columna cuando el Excel trae valor (COALESCE igual que destino).
--
-- ADITIVO y REVERSIBLE:
--   * No toca datos existentes ni otras columnas.
--   * Revertir: ALTER TABLE public.transportes DROP COLUMN IF EXISTS region;
--
-- Ejecutar en Supabase > SQL Editor.
-- =============================================================================

ALTER TABLE public.transportes ADD COLUMN IF NOT EXISTS region TEXT;

-- Verificación (opcional):
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'transportes' AND column_name = 'region';
