-- =============================================================================
-- MIGRACIÓN: Ajustes a la creación de llaves y control de tiempos (v2)
-- Cambios:
--   1) Elimina columnas que ya no se piden al crear la llave:
--      PEDIDOS (numero_pedido, numero_pedido2, numero_pedido3, numero_pedido4),
--      DESTINO (destino), CLIENTE (denominacion_cliente) y ESTADO (estado_despacho).
--   2) Placa opcional: se guarda '' cuando no se digita (columna sigue NOT NULL).
--   3) Nuevos estados en estado_porteria: 'Confirmado' (con placa) y 'CANCELADO'
--      (vehículo cancelado, no se elimina).
--   4) Nuevas columnas: cuadrilla (DESPACHOS) y hora_muelle_asignado (SUPERVISOR).
-- IDEMPOTENTE: se puede ejecutar varias veces sin error.
-- Ejecutar en Supabase > SQL Editor.
-- =============================================================================

-- 1) Eliminar columnas que ya no se usan en el formulario de creación.
ALTER TABLE public.transportes
  DROP COLUMN IF EXISTS numero_pedido,
  DROP COLUMN IF EXISTS numero_pedido2,
  DROP COLUMN IF EXISTS numero_pedido3,
  DROP COLUMN IF EXISTS numero_pedido4,
  DROP COLUMN IF EXISTS destino,
  DROP COLUMN IF EXISTS denominacion_cliente,
  DROP COLUMN IF EXISTS estado_despacho;

-- Índices sobre columnas eliminadas.
DROP INDEX IF EXISTS public.idx_transportes_destino;
DROP INDEX IF EXISTS public.idx_transportes_estado_despacho;

-- 2) Placa opcional (NOT NULL pero con valor vacío por defecto).
ALTER TABLE public.transportes ALTER COLUMN placa SET DEFAULT '';
-- (Si alguna fila quedara NULL por un proceso externo, la normaliza:)
UPDATE public.transportes SET placa = '' WHERE placa IS NULL;

-- 3) Ampliar el CHECK de estado_porteria con CONFIRMADO y CANCELADO.
ALTER TABLE public.transportes
  DROP CONSTRAINT IF EXISTS transportes_estado_porteria_check;

ALTER TABLE public.transportes
  ADD CONSTRAINT transportes_estado_porteria_check
  CHECK (estado_porteria IN
    ('Pendiente', 'Confirmado', 'LLEGO A PORTERIA', 'INGRESO A MUELLE',
     'CARGANDO', 'FINALIZO CARGUE', 'SALIO DE PORTERIA', 'CANCELADO'));

-- 4) Nuevas columnas: cuadrilla de cargue (DESPACHOS) y hora de asignación de
--    muelle (SUPERVISOR). Se registra la hora actual al asignar muelle.
ALTER TABLE public.transportes
  ADD COLUMN IF NOT EXISTS cuadrilla VARCHAR(50),
  ADD COLUMN IF NOT EXISTS hora_muelle_asignado VARCHAR(10) DEFAULT '--:--';

CREATE INDEX IF NOT EXISTS idx_transportes_cuadrilla
  ON public.transportes(cuadrilla);
