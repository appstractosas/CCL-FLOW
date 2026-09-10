-- =============================================================================
-- MIGRACIÓN: NOTIFICACIONES (Fase 1)
-- Notificaciones in-app de eventos de la operación (llegada a portería y
-- asignación de muelle) visibles para TODOS los usuarios (broadcast general).
-- IDEMPOTENTE: se puede ejecutar varias veces sin efecto secundario.
-- Ejecutar en Supabase > SQL Editor.
-- =============================================================================

-- 1. TABLA DE NOTIFICACIONES
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo              VARCHAR(30) NOT NULL
                    CHECK (tipo IN ('LLEGO_PORTERIA', 'MUELLE_ASIGNADO')),
  titulo            VARCHAR(200) NOT NULL,
  mensaje           TEXT NOT NULL,
  llave_relacionada VARCHAR(20), -- sin FK: llave ya no es única (una llave = varias placas)
  leida             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_leida ON public.notificaciones(leida);
CREATE INDEX IF NOT EXISTS idx_notif_created ON public.notificaciones(created_at);

-- 2. RLS PERMISIVO (igual que el resto de tablas de la app)
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_full_access_notificaciones" ON public.notificaciones;
CREATE POLICY "app_full_access_notificaciones" ON public.notificaciones
  FOR ALL USING (true) WITH CHECK (true);

-- 3. TIEMPO REAL: se agrega la tabla a la publicación de Realtime para que
--    la campana y el banner se actualicen en vivo.
ALTER TABLE public.notificaciones REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
