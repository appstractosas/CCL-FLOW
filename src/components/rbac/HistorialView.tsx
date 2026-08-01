import React, { useState } from 'react';
import { Inbox } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { userTypeLabel } from '../../lib/moduleConfig';
import { moduleLabel } from '../../lib/moduleConfig';
import { ModuleToolbar } from '../common/ModuleToolbar';
import { useRowFilters } from '../../hooks/useRowFilters';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ACCION_STYLES: Record<string, string> = {
  INICIO_SESION: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  CIERRE_SESION: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  CREAR_USUARIO: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  EDITAR_USUARIO: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  ELIMINAR_USUARIO: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  ACTUALIZAR_PERMISOS: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  CREAR_TRANSPORTE: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  EDITAR_TRANSPORTE: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  ELIMINAR_TRANSPORTE: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  CAMBIO_ESTADO_DESPACHO: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  CAMBIO_ESTADO_PORTERIA: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  ACTUALIZAR_PORTERIA: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

export const HistorialView: React.FC = () => {
  const { historial } = useAuthStore();

  const { searchTerm, setSearchTerm, dateFrom, setDateFrom, dateTo, setDateTo, filtered } = useRowFilters(
    historial,
    { dateKey: 'createdAt' }
  );

  return (
    <div className="space-y-4">
      <ModuleToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar usuario, acción, módulo o detalle..."
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        counter={`${filtered.length} de ${historial.length} movimientos`}
      />

      <div className="bg-[#121726] rounded-2xl border border-zinc-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-sm flex flex-col items-center space-y-2">
            <Inbox className="w-8 h-8 text-zinc-700" />
            <span>Aún no hay movimientos registrados.</span>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0">
                <tr className="bg-zinc-900/80 text-zinc-400 font-semibold uppercase tracking-wider border-b border-zinc-800">
                  <th className="py-3 px-5">FECHA</th>
                  <th className="py-3 px-4">USUARIO</th>
                  <th className="py-3 px-4">TIPO</th>
                  <th className="py-3 px-4">ACCIÓN</th>
                  <th className="py-3 px-4">MÓDULO</th>
                  <th className="py-3 px-4">LLAVE</th>
                  <th className="py-3 px-4">DETALLE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-2.5 px-5 font-mono text-zinc-400 whitespace-nowrap">{formatDate(m.createdAt)}</td>
                    <td className="py-2.5 px-4 font-bold text-zinc-100 whitespace-nowrap">{m.usuario}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">{userTypeLabel(m.tipoUsuario)}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${ACCION_STYLES[m.accion] || 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}
                      >
                        {String(m.accion).replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-300 whitespace-nowrap">{moduleLabel(m.modulo)}</td>
                    <td className="py-2.5 px-4 font-mono text-blue-400 whitespace-nowrap">{m.llaveRelacionada || '—'}</td>
                    <td className="py-2.5 px-4 text-zinc-400 max-w-[260px] truncate" title={m.detalle}>
                      {m.detalle || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
