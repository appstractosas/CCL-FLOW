import React, { useState } from 'react';
import {
  Package,
  Truck,
  DoorClosed,
  Eye,
  BarChart3,
  UserCheck,
  Settings,
  Users,
} from 'lucide-react';
import { AppModuleId } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import logoSrc from '/assets/logo.png';

interface SidebarProps {
  activeModule: AppModuleId;
  setActiveModule: (module: AppModuleId) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  setActiveModule,
  isOpen,
  onClose,
}) => {
  const { hasModuleAccess } = useAuthStore();

  const navItems = [
    { id: 'planeacion' as AppModuleId, label: 'Planeación', icon: Truck },
    { id: 'porteria' as AppModuleId, label: 'Portería', icon: DoorClosed },
    { id: 'monitoreo' as AppModuleId, label: 'Monitoreo', icon: Eye },
    { id: 'despachos' as AppModuleId, label: 'Despachos', icon: Package },
    { id: 'personal' as AppModuleId, label: 'Supervisor', icon: UserCheck },
    { id: 'informes' as AppModuleId, label: 'Informes', icon: BarChart3 },
    { id: 'admin_roles' as AppModuleId, label: 'ROLES', icon: Settings },
    { id: 'usuarios' as AppModuleId, label: 'USUARIOS', icon: Users },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-30 h-full w-fit min-w-fit bg-[#090d16] border-r border-zinc-800/80 flex flex-col shrink-0 text-zinc-300 select-none transition-transform duration-200 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen`}
    >
      {/* Logo & Header */}
      <div className="px-3 py-2.5 border-b border-zinc-800/80">
        <div className="flex items-center space-x-1.5 cursor-pointer" onClick={() => setActiveModule('despachos')}>
          <img src={logoSrc} alt="CCL Logo" className="h-8 w-auto" />
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
            YMS
          </span>
        </div>
      </div>

      {/* Section Label */}
      <div className="px-3 pt-3 pb-1.5 text-[9px] font-bold text-zinc-500 tracking-wider uppercase">
        Principal
      </div>

      {/* Navigation Items — scrollable */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 min-h-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const modId = item.id as AppModuleId;
          const canAccess = hasModuleAccess(modId);
          const isActive = activeModule === modId;

          if (!canAccess) return null;

          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveModule(modId);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold'
                  : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
