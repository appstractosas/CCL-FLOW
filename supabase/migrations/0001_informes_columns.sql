-- =============================================================================
-- CCL FLOW — Fase 0: columnas nuevas para el Módulo de Informes
-- Tabla: transportes
-- Campos requeridos por los reportes (prompt de informes):
--   transporte   → NÚMERO DE PEDIDO (no es placa ni vehículo)
--   denominacion → Nombre del cliente
--   cajas        → Cantidad de cajas
-- =============================================================================

ALTER TABLE transportes
  ADD COLUMN IF NOT EXISTS transporte   TEXT,
  ADD COLUMN IF NOT EXISTS denominacion TEXT,
  ADD COLUMN IF NOT EXISTS cajas        NUMERIC DEFAULT 0;

-- Índice para filtrar informes por rango de fecha (ya se consulta por fecha_hora)
CREATE INDEX IF NOT EXISTS idx_transportes_fecha_hora ON transportes (fecha_hora);