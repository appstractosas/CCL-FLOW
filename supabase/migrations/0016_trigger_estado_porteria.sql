-- =============================================================================
-- MIGRACIÓN: Documentar trigger trg_transportes_estado_porteria
-- -----------------------------------------------------------------------------
-- CONTEXTO:
--   Este trigger existía SOLO en la base de datos (creado por un script viejo,
--   fuera del repo). Al reconstruir la BD desde las migraciones se perdía, así
--   que se incorpora aquí para que el repo sea la fuente de verdad.
--
-- QUÉ HACE:
--   En cada INSERT/UPDATE de transportes ajusta el estado de portería según la
--   placa:
--     - Placa llena + estado 'Pendiente'  -> 'Confirmado'
--     - Placa vacía + estado 'Confirmado' -> 'Pendiente'
--   No toca estados avanzados (LLEGO A PORTERIA en adelante) ni 'CANCELADO',
--   porque sus condiciones solo aplican a 'Pendiente'/'Confirmado'.
--   Cubre el caso en que la app edita y agrega una placa sin pasar a Confirmado.
--
-- IMPACTO: Solo BD. Idempotente (se puede re-ejecutar sin error).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.transportes_set_estado_porteria()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  -- Placa llena: PENDIENTE -> CONFIRMADO (solo si no ha avanzado).
  IF (NEW.placa IS NOT NULL AND NEW.placa <> '') AND NEW.estado_porteria = 'Pendiente' THEN
    NEW.estado_porteria := 'Confirmado';
  END IF;
  -- Placa vacía: CONFIRMADO -> PENDIENTE.
  IF (NEW.placa IS NULL OR NEW.placa = '') AND NEW.estado_porteria = 'Confirmado' THEN
    NEW.estado_porteria := 'Pendiente';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_transportes_estado_porteria ON public.transportes;
CREATE TRIGGER trg_transportes_estado_porteria
  BEFORE INSERT OR UPDATE ON public.transportes
  FOR EACH ROW EXECUTE FUNCTION public.transportes_set_estado_porteria();
