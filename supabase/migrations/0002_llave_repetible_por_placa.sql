-- =============================================================================
-- CCL FLOW — Modelo: UNA FILA POR PLACA (una llave puede repetirse)
-- -----------------------------------------------------------------------------
-- REGLA DE NEGOCIO (confirmada):
--   * Una LLAVE puede tener VARIOS TRANSPORTES y VARIAS PLACAS.
--   * CADA PLACA es UNA FILA en la tabla (cajas se registran POR PLACA).
--   * Un TRANSPORTE (nº pedido) NO puede pertenecer a dos llaves distintas.
--
-- Cambios sobre el modelo anterior ("1 llave = 1 fila"):
--   1) ELIMINA el UNIQUE sobre `llave` -> la misma llave puede tener VARIAS
--      filas, siempre que cada fila tenga una PLACA distinta.
--   2) AGREGA UNIQUE (llave, placa): mismas llave+placa = misma fila (es el
--      "on conflict" que usan Power Automate y el respaldo .gs).
--      placa '' (PENDIENTE) cuenta: una llave no puede tener 2 filas sin placa.
--   3) Limpia TRANSPORTES duplicados en llaves DISTINTAS (deja el valor en la
--      fila más reciente; las demás quedan NULL) para que el trigger no bloquee
--      la primera carga.
--   4) Mantiene el TRIGGER trg_transporte_una_llave: un transporte solo puede
--      existir en UNA llave (dentro de la MISMA llave puede repetirse si el
--      pedido se reparte en varias placas).
--
-- IDEMPOTENTE: se puede ejecutar varias veces sin error.
-- Ejecutar en Supabase > SQL Editor.
-- =============================================================================

-- 1) Deduplicar transportes que estén en MÁS DE UNA llave: conservar el valor
--    en la fila más reciente (updated_at) y NULL en las demás. Los transportes
--    repetidos DENTRO de la misma llave (pedido repartido en varias placas) se
--    conservan.
UPDATE public.transportes t
SET transporte = NULL
WHERE t.transporte IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.transportes t2
    WHERE t2.transporte = t.transporte AND t2.llave <> t.llave
  )
  AND t.id <> (
    SELECT t3.id FROM public.transportes t3
    WHERE t3.transporte = t.transporte
    ORDER BY t3.updated_at DESC, t3.created_at DESC, t3.id DESC
    LIMIT 1
  );

-- 2) ELIMINAR las FKs que dependían del UNIQUE(llave) y luego el UNIQUE sobre
--    llave (permite repetir la misma llave en varias filas).
--    chat_messages.llave_relacionada y notificaciones.llave_relacionada
--    apuntaban a transportes(llave): como ahora llave NO es única (varias filas
--    por llave), una FK sobre llave sola ya no tiene sentido. Se eliminan: los
--    mensajes/notificaciones siguen guardando la llave como TEXTO (índice
--    idx_chat_llave) y la integridad se valida en la app.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_messages_llave_relacionada_fkey' AND conrelid = 'chat_messages'::regclass
  ) THEN
    ALTER TABLE public.chat_messages DROP CONSTRAINT chat_messages_llave_relacionada_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notificaciones_llave_relacionada_fkey' AND conrelid = 'notificaciones'::regclass
  ) THEN
    ALTER TABLE public.notificaciones DROP CONSTRAINT notificaciones_llave_relacionada_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transportes_llave_key' AND conrelid = 'public.transportes'::regclass
  ) THEN
    ALTER TABLE public.transportes DROP CONSTRAINT transportes_llave_key;
  END IF;
END;
$$;

-- 3) GARANTIZAR UNIQUE (llave, placa): la combinación identifica la fila.
--    placa NOT NULL (nunca NULL: se guarda ''). Dos filas de la misma llave con
--    la misma placa (incluida '') no pueden existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transportes_llave_placa_key' AND conrelid = 'public.transportes'::regclass
  ) THEN
    ALTER TABLE public.transportes
      ADD CONSTRAINT transportes_llave_placa_key UNIQUE (llave, placa);
  END IF;
END;
$$;

-- 4) Trigger: un transporte (nº pedido) solo puede estar en UNA llave.
CREATE OR REPLACE FUNCTION public.fn_transporte_una_llave()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.transporte IS NOT NULL AND NEW.transporte <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.transportes
      WHERE transporte = NEW.transporte
        AND llave <> NEW.llave
        AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'El transporte % ya pertenece a otra llave.', NEW.transporte;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transporte_una_llave ON public.transportes;
CREATE TRIGGER trg_transporte_una_llave
  BEFORE INSERT OR UPDATE OF transporte, llave ON public.transportes
  FOR EACH ROW EXECUTE FUNCTION public.fn_transporte_una_llave();