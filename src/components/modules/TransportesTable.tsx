import React, { useEffect, useState, useRef } from 'react';
import { Edit2, XCircle } from 'lucide-react';
import { UnifiedTransporte, PorteriaTimeField } from '../../types';
import { TipoBadge, EstadoBadge, EstatusBadge } from '../common/EstadoBadge';
import { TransporteDetailPanel } from './TransporteDetailPanel';
import { Pagination } from '../common/Pagination';
import { getEstadoPorteria, isLlaveCerrada, puedeEditarOperacion } from '../../utils/porteria';
import { formatFecha, formatFechaHora } from '../../lib/dateUtils';
import { useVirtualList } from '../../hooks/useVirtualList';

export interface TransportesTableProps {
  rows: UnifiedTransporte[];
  showEdit?: boolean;
  showDelete?: boolean;
  onEdit?: (row: UnifiedTransporte) => void;
  onDelete?: (row: UnifiedTransporte) => void;
  canCancel?: (row: UnifiedTransporte) => boolean;
  hideAcciones?: boolean;
  onAsignarMuelle?: (row: UnifiedTransporte, muelle: string) => void;
  onMuelleHora?: (row: UnifiedTransporte, hora: string) => void;
  onCuadrilla?: (row: UnifiedTransporte, cuadrilla: string) => void;
  onCajas?: (row: UnifiedTransporte, cajas: number) => void;
  checklistOwner?: 'porteria' | 'despachos' | 'monitoreo';
  onPorteriaHora?: (row: UnifiedTransporte, campo: PorteriaTimeField, hora: string) => void;
  showCajas?: boolean;
  /** Muestra la columna ESTATUS (estado_transporte de la BD) entre CAJAS y ESTADO. */
  showEstatus?: boolean;
  /** Llave que cambia solo cuando los FILTROS cambian (no cuando refrescan los datos por time real).
   *  Al cambiar, se vuelve a la página 1. Si no se pasa, se usa la identidad de `rows`. */
  pageResetKey?: string;
}

export const TransportesTable: React.FC<TransportesTableProps> = ({
  rows,
  showEdit = false,
  showDelete = false,
  onEdit,
  onDelete,
  canCancel,
  hideAcciones = false,
  onAsignarMuelle,
  onMuelleHora,
  onCuadrilla,
  onCajas,
  checklistOwner,
  onPorteriaHora,
  showCajas = false,
  showEstatus = false,
  pageResetKey,
}) => {
  const [selected, setSelected] = useState<UnifiedTransporte | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Se vuelve a la página 1 solo cuando cambian los filtros (vía pageResetKey),
  // no cuando el array `rows` se refresca por time real (misma identidad de filtros).
  const resetKey = pageResetKey ?? rows;
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const showActions = (showEdit || showDelete) && !hideAcciones;
  const colCount = 7 + (showCajas ? 1 : 0) + (showEstatus ? 1 : 0) + (showActions ? 1 : 0);

  const displayedRow = selected ? rows.find((r) => r.id === selected.id) || null : null;

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { virtualItems, paddingTop, paddingBottom } = useVirtualList(tableContainerRef, {
    itemsCount: pageRows.length,
    itemHeight: 48,
    overscan: 5,
  });

  return (
    <div className="bg-[#0b0f19] rounded-2xl border border-zinc-800/90 overflow-hidden">
      {/* Cabecera inmovilizada: se mantiene fija al hacer scroll vertical del cuerpo. */}
      <div className="overflow-x-auto max-h-[calc(100vh-160px)]" ref={tableContainerRef}>
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#121726] border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider">
              <th className="py-3.5 px-3">FECHA</th>
              <th className="py-3.5 px-3">FECHA HORA CITA</th>
              <th className="py-3.5 px-3">LLAVE</th>
              <th className="py-3.5 px-3">PLACA</th>
              <th className="py-3.5 px-3">TIPO</th>
              <th className="py-3.5 px-3">MUELLE</th>
              {showCajas && <th className="py-3.5 px-3">CAJAS</th>}
              {showEstatus && <th className="py-3.5 px-3">ESTATUS</th>}
              <th className="py-3.5 px-3">ESTADO</th>
              {showActions && <th className="py-3.5 px-3 text-right">ACCIONES</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-medium text-zinc-300">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="py-8 text-center text-zinc-500">
                  No se encontraron transportes para el rango seleccionado.
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td colSpan={colCount} style={{ height: paddingTop, padding: 0, border: 0 }} />
                  </tr>
                )}
                {virtualItems.map((vItem) => {
                  const row = pageRows[vItem.index];
                  if (!row) return null;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className="hover:bg-zinc-900/60 transition-colors cursor-pointer"
                      title="Clic para ver detalle"
                    >
                      <td className="py-3.5 px-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                        {formatFecha(row.fechaHora)}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                        {formatFechaHora(row.citaCargue)}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-blue-400 whitespace-nowrap">
                        {row.llave}
                      </td>
                      <td className="py-3.5 px-3 font-mono whitespace-nowrap">
                        {row.placa ? (
                          <span className="bg-zinc-800/80 text-zinc-100 font-bold px-2 py-0.5 rounded border border-zinc-700">
                            {row.placa}
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-semibold">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <TipoBadge tipo={row.vehiculoTipo} />
                      </td>
                      <td className="py-3.5 px-3 font-bold text-emerald-400 whitespace-nowrap">
                        {row.muelleAsignado || '—'}
                      </td>
                      {showCajas && (
                        <td className="py-3.5 px-3 font-mono font-bold text-amber-400 whitespace-nowrap">
                          {row.cajas ? row.cajas.toLocaleString('es-CO') : '—'}
                        </td>
                      )}
                      {showEstatus && (
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <EstatusBadge estado={row.estadoTransporte} />
                        </td>
                      )}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <EstadoBadge estado={getEstadoPorteria(row)} />
                      </td>
                      {showActions && (
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            {showEdit && onEdit && !isLlaveCerrada(row) && puedeEditarOperacion(row) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(row);
                                }}
                                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-blue-400 hover:border-blue-500/40 transition-colors"
                                title="Editar transporte"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {showDelete && onDelete && !isLlaveCerrada(row) && puedeEditarOperacion(row) && (!canCancel || canCancel(row)) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(row);
                                }}
                                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                                title="Cancelar transporte"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td colSpan={colCount} style={{ height: paddingBottom, padding: 0, border: 0 }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        totalItems={rows.length}
        onPageChange={setPage}
      />

      {/* Detalle en panel lateral */}
      <TransporteDetailPanel
        row={displayedRow}
        onClose={() => setSelected(null)}
        showEdit={showEdit}
        showDelete={showDelete}
        canCancel={canCancel}
        showEstatus={showEstatus}
        onEdit={(row) => {
          setSelected(null);
          onEdit?.(row);
        }}
        onDelete={(row) => {
          setSelected(null);
          onDelete?.(row);
        }}
        onAsignarMuelle={onAsignarMuelle}
        onMuelleHora={onMuelleHora}
        onCuadrilla={onCuadrilla}
        onCajas={onCajas}
        checklistOwner={checklistOwner}
        onPorteriaHora={onPorteriaHora}
      />
    </div>
  );
};
