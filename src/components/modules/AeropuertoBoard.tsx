import React, { useMemo } from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { getEstadoPorteria, sortTransportesPorEstado, ORDEN_ESTADOS_TABLERO } from '../../utils/porteria';
import { EstadoBadge, TipoBadge } from '../common/EstadoBadge';
import { EstadoFilter } from '../common/EstadoFilter';
import { ModuleToolbar } from '../common/ModuleToolbar';
import { Pagination } from '../common/Pagination';
import { useFiltrosTransportes } from '../../hooks/useFiltrosTransportes';
import { Clock } from 'lucide-react';
import { formatFechaHora } from '../../lib/dateUtils';

const PAGE_SIZE = 20;

export const AeropuertoBoard: React.FC = () => {
  const transportes = useLogisticsStore((s) => s.transportes);
  const {
    searchTerm,
    setSearchTerm,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    rowsFiltradas,
    estadoFiltro,
    setEstadoFiltro,
    pageResetKey,
  } = useFiltrosTransportes(transportes, { estadoInicial: 'activas' });

  const rows = useMemo(() => sortTransportesPorEstado(rowsFiltradas, ORDEN_ESTADOS_TABLERO), [rowsFiltradas]);
  const [page, setPage] = React.useState(1);

  // Resetea a página 1 solo cuando cambian los filtros, no cuando refresca time real.
  React.useEffect(() => {
    setPage(1);
  }, [pageResetKey]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-2.5 mt-[-6px] sm:mt-[-14px] lg:mt-[-22px]">
      <ModuleToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar llave o placa..."
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        leftContent={<EstadoFilter value={estadoFiltro} onChange={setEstadoFiltro} />}
      />

      <div className="bg-[#0b0f19] rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
        {/* Contenedor de scroll: misma altura que los demás módulos; la cabecera de
            columnas queda inmovilizada al hacer scroll por las filas. */}
        <div className="max-h-[calc(100vh-160px)] overflow-y-auto">
          {/* Cabecera tipo tablero de vuelos */}
          <div className="grid grid-cols-[10rem_7rem_6rem_5rem_1fr_5rem_6rem_5rem_9rem] gap-2 px-4 py-2.5 bg-[#121726] border-b border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-500 sticky top-0 z-10">
            <span>Cita (Fecha Hora)</span>
            <span>Llave</span>
            <span>Placa</span>
            <span>Tipo</span>
            <span>Transportadora</span>
            <span>Muelle</span>
            <span>Cuadrilla</span>
            <span>Cajas</span>
            <span className="text-right">Estado</span>
          </div>
          {rows.length === 0 ? (
            <div className="px-4 py-16 text-center text-zinc-500 text-sm">Sin llaves que mostrar</div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
            {pageRows.map((row) => {
              const estado = getEstadoPorteria(row);
              const esFinalizado = estado === 'SALIO DE PORTERIA' || estado === 'CANCELADO';
              return (
                <div
                  key={row.id}
                  className={`grid grid-cols-[10rem_7rem_6rem_5rem_1fr_5rem_6rem_5rem_9rem] gap-2 items-center px-4 py-2.5 text-xs transition-colors ${
                    esFinalizado ? 'opacity-60 bg-zinc-900/30' : 'bg-[#0d1322] hover:bg-[#111827]'
                  }`}
                >
                  <span className="font-mono text-zinc-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-600 shrink-0" />
                    {formatFechaHora(row.citaCargue)}
                  </span>
                  <span className="font-mono font-bold text-white">{row.llave}</span>
                  <span className="font-mono text-zinc-200">{row.placa || '—'}</span>
                  <span>
                    <TipoBadge tipo={row.vehiculoTipo} />
                  </span>
                  <span className="text-zinc-300 truncate">{row.transportadora || '—'}</span>
                  <span className="font-mono text-zinc-200">{row.muelleAsignado || '—'}</span>
                  <span className="text-zinc-300 truncate">{row.cuadrilla || '—'}</span>
                  <span className="font-mono text-amber-400">{row.cajas ? row.cajas.toLocaleString('es-CO') : '—'}</span>
                  <span className="flex justify-end">
                    <EstadoBadge estado={estado} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
        </div>

        <div className="px-4 py-2 bg-zinc-900/60 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Total {rows.length} llaves
          </span>
          <span className="text-[10px] text-zinc-600 font-mono">CCL · YARD</span>
        </div>
        <Pagination
          page={safePage}
          totalPages={totalPages}
          totalItems={rows.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};
