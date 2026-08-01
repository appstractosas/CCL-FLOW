import React from 'react';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { ALL_MODULES, MODULE_LABELS, USER_TYPES, ROLE_ID_BY_USER_TYPE } from '../../lib/moduleConfig';
import { AppModuleId } from '../../types';
import { Toggle } from '../common/Toggle';

export const PermissionMatrix: React.FC = () => {
  const { roles, updateRolePermissions } = useAuthStore();

  return (
    <div className="bg-[#121726] rounded-2xl border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div>
          <h3 className="text-sm font-bold text-white">Matriz de Permisos por Módulo</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Activa o desactiva cada módulo por rol. El ADMIN mantiene acceso total por defecto.
          </p>
        </div>
        <span className="hidden md:flex items-center space-x-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full">
          <Lock className="w-3 h-3" />
          <span>ADMIN: acceso total</span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-900/60 text-zinc-400 font-semibold uppercase tracking-wider border-b border-zinc-800">
              <th className="py-3 px-5">MÓDULO</th>
              {USER_TYPES.map((t) => (
                <th key={t.value} className="py-3 px-4 text-center whitespace-nowrap">
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {ALL_MODULES.map((modId) => {
              const mod = modId as AppModuleId;
              return (
                <tr key={modId} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-2.5 px-5 font-bold text-zinc-200 whitespace-nowrap">
                    {MODULE_LABELS[mod]}
                    <span className="hidden xl:inline text-zinc-600 font-mono text-[10px] ml-2">{modId}</span>
                  </td>
                  {USER_TYPES.map((t) => {
                    const role = roles.find((r) => r.id === ROLE_ID_BY_USER_TYPE[t.value]);
                    if (!role) return <td key={t.value} className="py-2.5 px-4 text-center">—</td>;
                    const enabled = Boolean(role.permissions[mod]?.canAccess);
                    return (
                      <td key={t.value} className="py-2.5 px-4">
                        <div className="flex justify-center">
                          <Toggle
                            checked={enabled}
                            onChange={() => updateRolePermissions(role.id, mod, !enabled)}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 bg-zinc-900/40 border-t border-zinc-800 text-[10px] text-zinc-500">
        Los cambios se guardan automáticamente y quedan registrados en el historial de movimientos.
      </div>
    </div>
  );
};
