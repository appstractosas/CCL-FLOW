-- =============================================================================
-- MIGRACIÓN: Trigger para persistir cambios y evitar duplicado de llave
-- -----------------------------------------------------------------------------
-- PROPÓSITO:
--   1. Al INSERTAR una fila con una llave que YA EXISTE → actualiza la fila
--      existente con los nuevos valores (placa, transporte, transportadora, etc.)
--      y cancela el INSERT (evita duplicado visual al cambiar placa).
--   2. Si la llave NO existe → INSERT normal (primera vez que se crea la llave).
-- -----------------------------------------------------------------------------
-- CAMPOS ACTUALIZABLES: placa, vehiculo_tipo, transportadora, transporte,
--                        denominacion, cita_cargue, cajas, estado_transporte
-- -----------------------------------------------------------------------------
-- IMPACTO: Solo BD. No toca app, sync, ni informes. Modelo (1 llave = N placas)
--          se mantiene. Sync (upsert por llave+placa) y Apps Script intactos.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_transporte_persistir_cambios()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.transportes WHERE llave = NEW.llave) THEN
    UPDATE public.transportes
    SET
      placa              = COALESCE(NEW.placa, placa),
      vehiculo_tipo      = COALESCE(NEW.vehiculo_tipo, vehiculo_tipo),
      transportadora     = COALESCE(NEW.transportadora, transportadora),
      transporte         = COALESCE(NEW.transporte, transporte),
      denominacion       = COALESCE(NEW.denominacion, denominacion),
      cita_cargue        = COALESCE(NEW.cita_cargue, cita_cargue),
      cajas              = COALESCE(NULLIF(NEW.cajas, 0), cajas),
      estado_transporte  = COALESCE(NEW.estado_transporte, estado_transporte),
      updated_at         = now()
    WHERE llave = NEW.llave;
    RETURN NULL; -- cancela el INSERT duplicado
  END IF;
  RETURN NEW; -- primera vez que se crea la llave: INSERT normal
END;
$$;

DROP TRIGGER IF EXISTS trg_transporte_persistir_cambios ON public.transportes;
CREATE TRIGGER trg_transporte_persistir_cambios
  BEFORE INSERT ON public.transportes
  FOR EACH ROW EXECUTE FUNCTION public.trg_transporte_persistir_cambios();