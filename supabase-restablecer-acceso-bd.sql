-- ============================================================================
-- CCL FLOW · Restablecer Políticas de Acceso Directo de la BD (100% Funcional)
-- ----------------------------------------------------------------------------
-- Elimina los bloqueos RLS restrictivos (ccl_rls_*) y restablece las políticas
-- abiertas app_full_access_* para que la app lea y escriba directamente los
-- datos reales de Supabase con el rol anon.
--
-- Idempotente y seguro con esquemas parciales: si una tabla no existe se
-- omite sin abortar el resto del script (antes un ALTER sobre tabla faltante
-- detenía todo dejando políticas a medias).
--
-- Ejecutar en Supabase: SQL Editor -> New query -> Run.
-- Al final imprime las políticas resultantes para verificación visual.
-- ============================================================================

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'transportes', 'chat_messages', 'notificaciones',
    'clientes', 'ciudades', 'roles', 'users', 'historial_movimientos'
  ];
  viejas text[] := ARRAY[
    'ccl_rls_%select', 'ccl_rls_%insert', 'ccl_rls_%update',
    'ccl_rls_%delete', 'ccl_rls_%write', 'ccl_rls_%all'
  ];
  v_pol record;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    -- Solo si la tabla existe en el esquema public.
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Limpieza de políticas restrictivas previas (cualquier variante ccl_rls_*).
    FOR v_pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname LIKE 'ccl_rls%'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', v_pol.policyname, t);
    END LOOP;

    -- Política abierta única para la app (idempotente).
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'app_full_access_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
      'app_full_access_' || t, t
    );
  END LOOP;
END $$;

-- Verificación: deben quedar SOLO políticas app_full_access_* por tabla.
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
