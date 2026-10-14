import React from 'react';
import { X, Edit2, XCircle } from 'lucide-react';
import { UnifiedTransporte, PorteriaTimeField } from '../../types';
import { TipoBadge } from '../common/EstadoBadge';
import { isLlaveCerrada, puedeEditarOperacion } from '../../utils/porteria';
import { ControlTiemposCard } from './ControlTiemposCard';
import { DetalleLlaveSection } from './DetalleLlaveSection';

interface TransporteDetailPanelProps {
  row: UnifiedTransporte | null;
  onClose: () => void;
  showEdit?: boolean;
  showDelete?: boolean;
  onEdit?: (row: UnifiedTransporte) => void;
  onDelete?: (row: UnifiedTransporte) => void;
  canCancel?: (row: UnifiedTransporte) => boolean;
  onAsignarMuelle?: (row: UnifiedTransporte, muelle: string) => void;
  onMuelleHora?: (row: UnifiedTransporte, hora: string) => void;
  onCuadrilla?: (row: UnifiedTransporte, cuadrilla: string) => void;
  onCajas?: (row: UnifiedTransporte, cajas: number) => void;
  checklistOwner?: 'porteria' | 'despachos' | 'monitoreo';
  onPorteriaHora?: (row: UnifiedTransporte, campo: PorteriaTimeField, hora: string) => void;
  /** Muestra el badge ESTATUS (estado_transporte) junto al estado de portería. */
  showEstatus?: boolean;
  /** Muestra la sección "Detalle por transporte" (líneas de la llave). Solo la activa Transportes. */
  showDetalleLlave?: boolean;
}

export const TransporteDetailPanel: React.FC<TransporteDetailPanelProps> = ({
  row,
  onClose,
  showEdit = false,
  showDelete = false,
  onEdit,
  onDelete,
  canCancel,
  onAsignarMuelle,
  onMuelleHora,
  onCuadrilla,
  onCajas,
  checklistOwner,
  onPorteriaHora,
  showEstatus = false,
  showDetalleLlave = false,
}) => {
  if (!row) return null;

  const cerrada = isLlaveCerrada(row);

  const handleEdit = () => {
    if (onEdit && !cerrada && puedeEditarOperacion(row)) {
      onClose();
      onEdit(row);
    }
  };

  const handleDelete = () => {
    if (onDelete && !cerrada && puedeEditarOperacion(row)) {
      onClose();
      onDelete(row);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0e1320] border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-zinc-800">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0">
                Llave
              </p>
              <h3 className="text-lg font-black text-white font-mono truncate">{row.llave}</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0">
                Placa
              </p>
              <p className="text-[11px] font-semibold text-zinc-100 truncate">
                {row.placa || 'SIN PLACA'}
              </p>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-semibold text-zinc-100 truncate">
                {row.transportadora || '—'}
              </span>
              <TipoBadge tipo={row.vehiculoTipo} />
            </div>
            <span className="text-[11px] font-semibold text-zinc-100 truncate">
              {row.region || '—'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-4 space-y-4">
          {showDetalleLlave && <DetalleLlaveSection lineas={row.detalleLlave} />}
          <ControlTiemposCard
            row={row}
            showEstatus={showEstatus}
            checklistOwner={checklistOwner}
            onAsignarMuelle={onAsignarMuelle}
            onMuelleHora={onMuelleHora}
            onCuadrilla={onCuadrilla}
            onCajas={onCajas}
            onPorteriaHora={onPorteriaHora}
          />
        </div>

        {/* Footer: acciones */}
        {(showEdit || showDelete) && !cerrada && puedeEditarOperacion(row) && (
          <div className="px-5 py-4 border-t border-zinc-800 space-y-3">
            <div className="flex items-center space-x-2">
              {showEdit && (
                <button
                  onClick={handleEdit}
                  className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-zinc-900 border border-zinc-700 text-zinc-200 hover:border-blue-500/40 hover:text-blue-400 rounded-xl text-xs font-bold transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
              )}
              {showDelete && (!canCancel || canCancel(row)) && (
                <button
                  onClick={handleDelete}
                  className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-zinc-900 border border-zinc-700 text-zinc-200 hover:border-rose-500/40 hover:text-rose-400 rounded-xl text-xs font-bold transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" /> Cancelar
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
};