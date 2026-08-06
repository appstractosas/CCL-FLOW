import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Sidebar } from './components/common/Sidebar';
import { FloatingChatWidget } from './components/chat/FloatingChatWidget';
import { LoginScreen } from './components/auth/LoginScreen';
import { UserSessionBar } from './components/auth/UserSessionBar';
import { useAuthStore } from './store/useAuthStore';
import { useLogisticsStore } from './store/useLogisticsStore';
import { useCatalogosStore } from './store/useCatalogosStore';
import { AppModuleId } from './types';
import { Lock, Loader2, Menu, AlertTriangle } from 'lucide-react';
import logoSrc from '/assets/logo.png';

// Carga diferida de los módulos para no traer recharts/xlsx/etc. en el primer render.
const DespachosModule = lazy(() => import('./components/modules/DespachosModule').then((m) => ({ default: m.DespachosModule })));
const PlaneacionModule = lazy(() => import('./components/modules/PlaneacionModule').then((m) => ({ default: m.PlaneacionModule })));
const PorteriaModule = lazy(() => import('./components/modules/PorteriaModule').then((m) => ({ default: m.PorteriaModule })));
const MonitoreoModule = lazy(() => import('./components/modules/MonitoreoModule').then((m) => ({ default: m.MonitoreoModule })));
const InformesModule = lazy(() => import('./components/modules/InformesModule').then((m) => ({ default: m.InformesModule })));
const PersonalModule = lazy(() => import('./components/modules/PersonalModule').then((m) => ({ default: m.PersonalModule })));
const UsuariosModule = lazy(() => import('./components/modules/UsuariosModule').then((m) => ({ default: m.UsuariosModule })));
const RoleManager = lazy(() => import('./components/rbac/RoleManager').then((m) => ({ default: m.RoleManager })));

export default function App() {
  const { hasModuleAccess, currentUser, initialize: initAuth, demoMode: authDemo } = useAuthStore();
  const { loading, initialize: initLogistics, demoMode: logisticsDemo } = useLogisticsStore();
  const { initialize: initCatalogos } = useCatalogosStore();
  const [appReady, setAppReady] = useState(false);
  const [activeModule, setActiveModule] = useState<AppModuleId>('despachos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    Promise.all([initAuth(), initLogistics(), initCatalogos()]).finally(() => setAppReady(true));
  }, []);

  if (!appReady || loading) {
    return (
      <div className="min-h-screen bg-[#070a12] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm">Inicializando sistema...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  const isCurrentModuleAllowed = hasModuleAccess(activeModule);

  const renderActiveModule = () => {
    if (!isCurrentModuleAllowed) {
      return (
        <div className="bg-[#0b0f19] rounded-2xl p-12 text-center border border-zinc-800 shadow-2xl max-w-lg mx-auto my-12 space-y-4">
          <div className="bg-rose-500/10 p-4 rounded-full text-rose-400 inline-block border border-rose-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">Módulo Restringido</h3>
          <p className="text-sm text-zinc-400">
            El usuario <strong className="text-white font-bold">{currentUser.name}</strong> ({currentUser.roleName}) no
            tiene permisos para acceder a este módulo.
          </p>
        </div>
      );
    }

    switch (activeModule) {
      case 'despachos':
        return <DespachosModule />;
      case 'planeacion':
        return <PlaneacionModule />;
      case 'porteria':
        return <PorteriaModule />;
      case 'monitoreo':
        return <MonitoreoModule />;
      case 'personal':
        return <PersonalModule />;
      case 'informes':
        return <InformesModule />;
      case 'admin_roles':
        return <RoleManager />;
      case 'usuarios':
        return <UsuariosModule />;
      default:
        return <DespachosModule />;
    }
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-zinc-100 font-sans antialiased flex selection:bg-emerald-500 selection:text-zinc-950">
      {/* Fixed Navigation Sidebar Left */}
      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Bar with Session Control (Superior Derecha) */}
        <header className="sticky top-0 z-20 bg-[#090d16]/95 backdrop-blur border-b border-zinc-800/80 px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition-colors"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <img src={logoSrc} alt="CCL Logo" className="h-8 w-auto lg:hidden" />
            <span className="hidden lg:block text-xs font-mono text-zinc-500">
              CCL · gestión de patios logísticos <span className="text-emerald-400">v1.0</span>
            </span>
          </div>

          <div className="flex items-center justify-end">
            <UserSessionBar
              onOpenRoles={() => setActiveModule('admin_roles')}
              onOpenUsuarios={() => setActiveModule('usuarios')}
            />
          </div>
        </header>

        {authDemo || logisticsDemo ? (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 sm:px-6 lg:px-8 py-2 flex items-start gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              <strong className="font-bold">MODO DEMO</strong> — Sin conexión a la base de datos. Los datos mostrados
              son de ejemplo. Configura <code className="font-mono bg-black/30 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code>{' '}
              y <code className="font-mono bg-black/30 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> en las variables
              de entorno de Vercel y vuelve a desplegar.
            </p>
          </div>
        ) : null}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Suspense
            fallback={
              <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
            }
          >
            {renderActiveModule()}
          </Suspense>
        </main>

        {/* Global Footer */}
        <footer className="border-t border-zinc-800/80 py-4 px-8 text-xs text-zinc-500 bg-[#090d16]">
          <span>gestión de patios logísticos CCL © 2026</span>
        </footer>
      </div>

      {/* Floating Inter-Module Chat Widget */}
      <FloatingChatWidget />
    </div>
  );
}
