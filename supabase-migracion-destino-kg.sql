-- =============================================================================
-- MIGRACIÓN: columnas destino y kg en transportes (app CCL FLOW)
-- -----------------------------------------------------------------------------
-- - destino  TEXT     : ciudad/lugar de destino del pedido (lo escribe la app).
-- - kg       NUMERIC  : peso del pedido en kilogramos.
--   >>> OBSOLETO: la app ya no lee ni escribe KG (se quitó del formulario, del
--       panel de detalle y de las dos sincronizaciones). La columna se deja en
--       la BD por compatibilidad (siempre NULL) y puede eliminarse con:
--       ALTER TABLE transportes DROP COLUMN IF EXISTS kg;
--
-- ADITIVO y REVERSIBLE:
--   - Solo AGREGA columnas nulas; NO toca datos existentes.
--   - El sync (.gs / RPC Power Automate) NO escribe estas columnas: quedan
--     bajo responsabilidad de la app y el upsert por (llave, placa) no las pisa.
--   - Revertir: ALTER TABLE transportes DROP COLUMN IF EXISTS destino;
--               ALTER TABLE transportes DROP COLUMN IF EXISTS kg;
--
-- Ejecutar en Supabase > SQL Editor.
-- =============================================================================

ALTER TABLE transportes ADD COLUMN IF NOT EXISTS destino TEXT;
ALTER TABLE transportes ADD COLUMN IF NOT EXISTS kg NUMERIC;
