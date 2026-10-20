-- =============================================================================
-- MIGRACIÓN: Eliminar restricción de transporte único por llave
-- -----------------------------------------------------------------------------
-- PROPÓSITO: Permitir que un mismo nº de transporte (pedido) exista en
--            distintas llaves. El trigger actual bloquea esto y genera error.
-- -----------------------------------------------------------------------------
-- IMPACTO: Solo BD. No toca app, sync, ni informes. El modelo (1 llave = N placas)
--          se mantiene intacto.
-- =============================================================================

DROP TRIGGER IF EXISTS trg_transporte_una_llave ON public.transportes;
DROP FUNCTION IF EXISTS public.fn_transporte_una_llave();