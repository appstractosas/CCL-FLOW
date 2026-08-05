import React, { useState } from 'react';
import { ChevronDown, Shield, LogOut, UserCog, Users } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { userTypeLabel } from '../../lib/moduleConfig';

interface UserSessionBarProps {
  onOpenRoles: () => void;
  onOpenUsuarios: () => void;
}

export const UserSessionBar: React.FC<UserSessionBarProps> = ({ onOpenRoles, onOpenUsuarios }) => {
  const { currentUser, logout, isAdmin } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!currentUser) return null;

  const initials = currentUser.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center space-x-2.5 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 rounded-xl pl-1.5 pr-2.5 py-1 transition-colors"
        title="Menú de sesión"
      >
        <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-bold text-xs shrink-0">
          {initials || 'U'}
        </div>
        <div className="text-left min-w-0">
          <p className="text-xs font-bold text-white leading-tight">{userTypeLabel(currentUser.tipoUsuario)}</p>
          <p className="text-[10px] text-zinc-400 leading-tight truncate max-w-[140px]">{currentUser.name}</p>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 z-50 bg-[#121726] border border-zinc-800 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2.5 border-b border-zinc-800 mb-1">
              <p className="text-xs font-bold text-white">{currentUser.name}</p>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                {userTypeLabel(currentUser.tipoUsuario)} · {currentUser.roleName}
              </p>
              <p className="text-[10px] text-zinc-500 font-mono">C.C. {currentUser.cedula}</p>
            </div>

            {isAdmin() && (
              <>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenRoles();
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  <UserCog className="w-4 h-4 text-indigo-400" />
                  <span>Roles</span>
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenUsuarios();
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Usuarios</span>
                </button>
              </>
            )}

            <button
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión</span>
            </button>

            {isAdmin() && (
              <div className="mt-1 px-3 py-2 border-t border-zinc-800 flex items-center space-x-1.5 text-[10px] text-zinc-500">
                <Shield className="w-3 h-3 text-amber-400" />
                <span>ADMIN tiene acceso total por defecto</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
