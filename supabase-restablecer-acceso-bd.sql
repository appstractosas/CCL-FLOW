-- ============================================================================
-- CCL FLOW · Restablecer Políticas de Acceso Directo de la BD (100% Funcional)
-- ----------------------------------------------------------------------------
-- Elimina los bloqueos RLS y restablece las políticas abiertas app_full_access_*
-- para que la app lea y escriba directamente los datos reales de Supabase.
--
-- Ejecutar en Supabase: SQL Editor -> New query -> Run.
-- ============================================================================

ALTER TABLE public.transportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ciudades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_movimientos ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas RLS restrictivas
DROP POLICY IF EXISTS "ccl_rls_transportes_select" ON public.transportes;
DROP POLICY IF EXISTS "ccl_rls_transportes_insert" ON public.transportes;
DROP POLICY IF EXISTS "ccl_rls_transportes_update" ON public.transportes;
DROP POLICY IF EXISTS "ccl_rls_transportes_delete" ON public.transportes;
DROP POLICY IF EXISTS "app_full_access_transportes" ON public.transportes;
CREATE POLICY "app_full_access_transportes" ON public.transportes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ccl_rls_chat_select" ON public.chat_messages;
DROP POLICY IF EXISTS "ccl_rls_chat_insert" ON public.chat_messages;
DROP POLICY IF EXISTS "app_full_access_chat" ON public.chat_messages;
CREATE POLICY "app_full_access_chat" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ccl_rls_notif_select" ON public.notificaciones;
DROP POLICY IF EXISTS "ccl_rls_notif_insert" ON public.notificaciones;
DROP POLICY IF EXISTS "ccl_rls_notif_update" ON public.notificaciones;
DROP POLICY IF EXISTS "app_full_access_notificaciones" ON public.notificaciones;
CREATE POLICY "app_full_access_notificaciones" ON public.notificaciones FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ccl_rls_clientes_select" ON public.clientes;
DROP POLICY IF EXISTS "app_full_access_clientes" ON public.clientes;
CREATE POLICY "app_full_access_clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ccl_rls_ciudades_select" ON public.ciudades;
DROP POLICY IF EXISTS "app_full_access_ciudades" ON public.ciudades;
CREATE POLICY "app_full_access_ciudades" ON public.ciudades FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ccl_rls_users_select" ON public.users;
DROP POLICY IF EXISTS "ccl_rls_users_write" ON public.users;
DROP POLICY IF EXISTS "ccl_rls_users_all" ON public.users;
DROP POLICY IF EXISTS "app_full_access_users" ON public.users;
CREATE POLICY "app_full_access_users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ccl_rls_roles_select" ON public.roles;
DROP POLICY IF EXISTS "ccl_rls_roles_write" ON public.roles;
DROP POLICY IF EXISTS "ccl_rls_roles_all" ON public.roles;
DROP POLICY IF EXISTS "app_full_access_roles" ON public.roles;
CREATE POLICY "app_full_access_roles" ON public.roles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ccl_rls_historial_select" ON public.historial_movimientos;
DROP POLICY IF EXISTS "ccl_rls_historial_insert" ON public.historial_movimientos;
DROP POLICY IF EXISTS "app_full_access_historial" ON public.historial_movimientos;
CREATE POLICY "app_full_access_historial" ON public.historial_movimientos FOR ALL USING (true) WITH CHECK (true);
