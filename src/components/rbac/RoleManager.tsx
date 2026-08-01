import React, { useState } from 'react';
import { Grid3X3, History } from 'lucide-react';
import { PermissionMatrix } from './PermissionMatrix';
import { HistorialView } from './HistorialView';

type Tab = 'matriz' | 'historial';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'matriz', label: 'Matriz de Permisos', icon: <Grid3X3 className="w-4 h-4" /> },
  { id: 'historial', label: 'Historial', icon: <History className="w-4 h-4" /> },
];

export const RoleManager: React.FC = () => {
  const [tab, setTab] = useState<Tab>('matriz');

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-1 bg-zinc-900/70 border border-zinc-800 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'matriz' && <PermissionMatrix />}
      {tab === 'historial' && <HistorialView />}
    </div>
  );
};
