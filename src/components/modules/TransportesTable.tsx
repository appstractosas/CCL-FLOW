import React, { useEffect, useState, useRef } from 'react';
import { Edit2, XCircle } from 'lucide-react';
import { UnifiedTransporte, PorteriaTimeField, EstadoTransporte } from '../../types';
import { TipoBadge, EstadoBadge, EstatusBadge } from '../common/EstadoBadge';
import { TransporteDetailPanel } from './TransporteDetailPanel';
import { EstatusSelect } from './TransporteDetailBits';
import { Pagination } from '../common/Pagination';
import { getEstadoPorteria, isLlaveCerrada, puedeEditarOperacion } from '../../utils/porteria';
import { formatFechaHora } from '../../lib/dateUtils';
import { useVirtualList } from '../../hooks/useVirtualList';

/** Alto de fila de datos (py-2.5), alineado con el Tablero. Usado por la virtualización. */
const ROW_HEIGHT = 40;

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
  /** Muestra la columna informativa KG (columna del fuente, solo lectura) tras CAJAS. */
  showKg?: boolean;
  /** Muestra la columna informativa MTS (columna del fuente, solo lectura) tras KG. */
  showMts?: boolean;
  /** Muestra la columna ESTATUS (estado_transporte de la BD) entre CAJAS y ESTADO. */
  showEstatus?: boolean;
  /** Solo Planeación: reemplaza la columna FECHA por REGION (entre FECHA HORA CITA y LLAVE). */
  showRegion?: boolean;
  /** Muestra la sección "Detalle por transporte" en el modal de detalle (solo Transportes). */
  showDetalleLlave?: boolean;
  pageResetKey?: string;
  /** Si se pasa, la columna ESTATUS se vuelve un selector (solo Supervisor). */
  onEstatusChange?: (row: UnifiedTransporte, estado: EstadoTransporte | null) => void;
  /** Guarda las observaciones del detalle. Si se omite, se muestran en solo lectura. */
  onObservaciones?: (row: UnifiedTransporte, texto: string) => void;
  /** Predica si las observaciones son editables para la fila. */
  observacionesEditable?: (row: UnifiedTransporte) => boolean;
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
  showKg = false,
  showMts = false,
  showEstatus = false,
  showRegion = false,
  showDetalleLlave = false,
  pageResetKey,
  onEstatusChange,
  onObservaciones,
  observacionesEditable,
}) => {
  const [selected, setSelected] = useState<UnifiedTransporte | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Se vuelve a la página 1 solo cuando cambian los filtros (vía pageResetKey),
  // no cuando el array `rows` se refresca por time real (misma identidad de filtros).
  const resetKey = pageResetKey ?? rows;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intencional de paginación al cambiar filtros
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const showActions = (showEdit || showDelete) && !hideAcciones;
  const colCount =
    6 +
    (showRegion ? 1 : 0) +
    (showCajas ? 1 : 0) +
    (showKg ? 1 : 0) +
    (showMts ? 1 : 0) +
    (showEstatus ? 1 : 0) +
    (showActions ? 1 : 0);

  const displayedRow = selected ? rows.find((r) => r.id === selected.id) || null : null;

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { virtualItems, paddingTop, paddingBottom } = useVirtualList(tableContainerRef, {
    itemsCount: pageRows.length,
    itemHeight: ROW_HEIGHT,
    overscan: 5,
  });

  return (
    <div className="bg-[#0b0f19] rounded-2xl border border-zinc-800/90 overflow-hidden">
      {/* Cabecera inmovilizada: se mantiene fija al hacer scroll vertical del cuerpo. */}
      <div className="overflow-x-auto max-h-[calc(100vh-160px)]" ref={tableContainerRef}>
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#121726] border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider">
              <th className="py-2.5 px-3">FECHA HORA CITA</th>
              {showRegion && <th className="py-2.5 px-3">REGION</th>}
              <th className="py-2.5 px-3">TIPO</th>
              <th className="py-2.5 px-3">PLACA</th>
              <th className="py-2.5 px-3">LLAVE</th>
              <th className="py-2.5 px-3">MUELLE</th>
              {showCajas && <th className="py-2.5 px-3">CAJAS</th>}
              {showKg && <th className="py-2.5 px-3">KG</th>}
              {showMts && <th className="py-2.5 px-3">MTS</th>}
              {showEstatus && <th className="py-2.5 px-3">ESTATUS</th>}
              <th className="py-2.5 px-3">ESTADO</th>
              {showActions && <th className="py-2.5 px-3 text-right">ACCIONES</th>}
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
                      <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                        {formatFechaHora(row.citaCargue)}
                      </td>
                      {showRegion && (
                        <td className="py-2.5 px-3 text-zinc-300 whitespace-nowrap">
                          {row.region || '—'}
                        </td>
                      )}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <TipoBadge tipo={row.vehiculoTipo} />
                      </td>
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        {row.placa ? (
                          <span className="bg-zinc-800/80 text-zinc-100 font-bold px-2 py-0.5 rounded border border-zinc-700 text-base">
                            {row.placa}
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-semibold text-base">�</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-400 whitespace-nowrap text-base">
                        {row.llave}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-400 whitespace-nowrap">
                        {row.muelleAsignado || '—'}
                      </td>
                      {showCajas && (
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-400 whitespace-nowrap">
                          {row.cajas ? row.cajas.toLocaleString('es-CO') : '—'}
                        </td>
                      )}
                      {showKg && (
                        <td className="py-2.5 px-3 font-mono text-zinc-300 whitespace-nowrap">
                          {row.kg ? row.kg.toLocaleString('es-CO') : '—'}
                        </td>
                      )}
                      {showMts && (
                        <td className="py-2.5 px-3 font-mono text-zinc-300 whitespace-nowrap">
                          {row.mts ? row.mts.toLocaleString('es-CO') : '—'}
                        </td>
                      )}
                      {showEstatus && (
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {onEstatusChange ? (
                            <EstatusSelect row={row} onEstatusChange={onEstatusChange} />
                          ) : (
                            <EstatusBadge estado={row.estadoTransporte} />
                          )}
                        </td>
                      )}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <EstadoBadge estado={getEstadoPorteria(row)} />
                      </td>
                      {showActions && (
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            {showEdit &&
                              onEdit &&
                              !isLlaveCerrada(row) &&
                              puedeEditarOperacion(row) && (
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
                            {showDelete &&
                              onDelete &&
                              !isLlaveCerrada(row) &&
                              puedeEditarOperacion(row) &&
                              (!canCancel || canCancel(row)) && (
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
                    <td
                      colSpan={colCount}
                      style={{ height: paddingBottom, padding: 0, border: 0 }}
                    />
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
        showDetalleLlave={showDetalleLlave}
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
        onObservaciones={onObservaciones}
        observacionesEditable={observacionesEditable}
      />
    </div>
  );
};
