-- ============================================================================
-- MIGRACIÓN: columna cajas_manual en transportes
-- ----------------------------------------------------------------------------
-- Marca las filas cuyas CAJAS fueron EDITADAS manualmente desde la app
-- (despachador). Mientras la marca esté activa, el sync NO pisa el valor
-- capturado; se limpia sola cuando el fuente (Excel/Sheets) trae ese mismo
-- número de cajas (ver reglas en migracion-rpc-sync-transportes.sql).
--
-- Reversible: ALTER TABLE public.transportes DROP COLUMN cajas_manual;
--
-- Ejecutar en Supabase > SQL Editor.
-- ============================================================================

ALTER TABLE public.transportes
  ADD COLUMN IF NOT EXISTS cajas_manual BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.transportes.cajas_manual IS
  'TRUE = cajas editadas desde la app (despachador): el sync conserva el valor y no lo pisa hasta que el fuente trae el mismo número de cajas.';