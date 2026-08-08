import React, { useMemo, useState } from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { getEstadoPorteria } from '../../utils/porteria';
import { EstadoBadge, TipoBadge } from '../common/EstadoBadge';
import { UnifiedTransporte } from '../../types';
import { Search, Clock } from 'lucide-react';

type FiltroEstado = 'todas' | 'activas' | 'finalizadas' | 'canceladas';

const FILTROS: { id: FiltroEstado; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'activas', label: 'Activas' },
  { id: 'finalizadas', label: 'Finalizadas' },
  { id: 'canceladas', label: 'Canceladas' },
];

function horaCita(row: UnifiedTransporte): string {
  const m = String(row.fechaHora || row.citaCargue || '').match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '--:--';
}

function estadoOrden(estado: string): number {
  const orden: Record<string, number> = {
    Pendiente: 0,
    Confirmado: 1,
    'LLEGO A PORTERIA': 2,
    'INGRESO A MUELLE': 3,
    CARGANDO: 4,
    'FINALIZO CARGUE': 5,
    'SALIO DE PORTERIA': 6,
    CANCELADO: 7,
  };
  return orden[estado] ?? 99;
}

function cumpleFiltro(row: UnifiedTransporte, filtro: FiltroEstado): boolean {
  const estado = getEstadoPorteria(row);
  switch (filtro) {
    case 'activas':
      return estado !== 'SALIO DE PORTERIA' && estado !== 'CANCELADO';
    case 'finalizadas':
      return estado === 'SALIO DE PORTERIA';
    case 'canceladas':
      return estado === 'CANCELADO';
    default:
      return true;
  }
}

export const AeropuertoBoard: React.FC = () => {
  const { getUnifiedTransportes } = useLogisticsStore();
  const [filtro, setFiltro] = useState<FiltroEstado>('todas');
  const [searchTerm, setSearchTerm] = useState('');

  const rows = useMemo(() => {
    const term = searchTerm.trim().toUpperCase();
    const all = getUnifiedTransportes();
    const filtered = all.filter(
      (t) =>
        cumpleFiltro(t, filtro) &&
        (!term || t.llave.toUpperCase().includes(term) || t.placa.toUpperCase().includes(term))
    );
    return filtered.sort((a, b) => {
      const ea = getEstadoPorteria(a);
      const eb = getEstadoPorteria(b);
      const byEstado = estadoOrden(ea) - estadoOrden(eb);
      if (byEstado !== 0) return byEstado;
      return String(a.llave).localeCompare(String(b.llave), undefined, { numeric: true });
    });
  }, [getUnifiedTransportes, filtro, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Pantalla de operaciones</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar llave o placa..."
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-emerald-500/50 w-56"
            />
          </div>
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors border ${
                filtro === f.id
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#0b0f19] rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
        {/* Cabecera tipo tablero de vuelos */}
        <div className="grid grid-cols-[4rem_7rem_6rem_5rem_1fr_5rem_6rem_9rem] gap-2 px-4 py-2.5 bg-zinc-900/60 border-b border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-500">
          <span>Hora</span>
          <span>Llave</span>
          <span>Placa</span>
          <span>Tipo</span>
          <span>Transportadora</span>
          <span>Muelle</span>
          <span>Cuadrilla</span>
          <span className="text-right">Estado</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-16 text-center text-zinc-500 text-sm">Sin llaves que mostrar</div>
        ) : (
          <div className="divide-y divide-zinc-800/60 max-h-[calc(100vh-260px)] overflow-y-auto">
            {rows.map((row) => {
              const estado = getEstadoPorteria(row);
              const esFinalizado = estado === 'SALIO DE PORTERIA' || estado === 'CANCELADO';
              return (
                <div
                  key={row.id}
                  className={`grid grid-cols-[4rem_7rem_6rem_5rem_1fr_5rem_6rem_9rem] gap-2 items-center px-4 py-2.5 text-xs transition-colors ${
                    esFinalizado ? 'opacity-60 bg-zinc-900/30' : 'bg-[#0d1322] hover:bg-[#111827]'
                  }`}
                >
                  <span className="font-mono text-zinc-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-600" />
                    {horaCita(row)}
                  </span>
                  <span className="font-mono font-bold text-white">{row.llave}</span>
                  <span className="font-mono text-zinc-200">{row.placa || '—'}</span>
                  <span>
                    <TipoBadge tipo={row.vehiculoTipo} />
                  </span>
                  <span className="text-zinc-300 truncate">{row.transportadora || '—'}</span>
                  <span className="font-mono text-zinc-200">{row.muelleAsignado || '—'}</span>
                  <span className="text-zinc-300 truncate">{row.cuadrilla || '—'}</span>
                  <span className="flex justify-end">
                    <EstadoBadge estado={estado} />
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-4 py-2 bg-zinc-900/60 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Total {rows.length} llaves
          </span>
          <span className="text-[10px] text-zinc-600 font-mono">CCL · YARD</span>
        </div>
      </div>
    </div>
  );
};
