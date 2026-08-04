import React, { useState } from 'react';
import { X, Edit2, Trash2, Truck } from 'lucide-react';
import { UnifiedTransporte, PorteriaTimeField } from '../../types';
import { EstadoBadge, TipoBadge } from '../common/EstadoBadge';
import { getEstadoPorteria, isLlaveCerrada } from '../../utils/porteria';

interface TransporteDetailPanelProps {
  row: UnifiedTransporte | null;
  onClose: () => void;
  showEdit?: boolean;
  showDelete?: boolean;
  onEdit?: (row: UnifiedTransporte) => void;
  onDelete?: (row: UnifiedTransporte) => void;
  onAsignarMuelle?: (row: UnifiedTransporte, muelle: string) => void;
  checklistOwner?: 'porteria' | 'despachos' | 'monitoreo';
  onPorteriaHora?: (row: UnifiedTransporte, campo: PorteriaTimeField, hora: string) => void;
}

interface PorteriaStep {
  key: PorteriaTimeField;
  label: string;
  msg: string;
}

const PORTERIA_STEPS: PorteriaStep[] = [
  { key: 'horaLlegadaPorteria', label: 'H. Llegada Portería', msg: '¿Seguro que el vehículo llegó a portería?' },
  { key: 'horaIngreso', label: 'H. Ingreso Portería', msg: '¿Seguro que el vehículo ingresó a portería?' },
  { key: 'horaInicioCargue', label: 'H. Inicio Cargue', msg: '¿Seguro que el vehículo inició cargue?' },
  { key: 'horaFinCargue', label: 'H. Fin Cargue', msg: '¿Seguro que el vehículo finalizó cargue?' },
  { key: 'horaSalida', label: 'H. Salida Portería', msg: '¿Seguro que el vehículo salió de portería?' },
];

function timeSet(value?: string): boolean {
  return value != null && value !== '' && value !== '--:--';
}

function nowHHMM(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function DetailRow({ label, value }: { label: string; value?: string | number }) {
  const v = value === undefined || value === null || value === '' ? '—' : String(value);
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pt-0.5">{label}</span>
      <span className="text-xs font-semibold text-zinc-100 text-right">{v}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pb-1">{children}</h4>
  );
}

function TimeRow({
  showCheck,
  step,
  checked,
  enabled,
  value,
  onCheck,
}: {
  showCheck: boolean;
  step: PorteriaStep;
  checked: boolean;
  enabled: boolean;
  value?: string;
  onCheck: () => void;
}) {
  if (!showCheck) {
    return <DetailRow label={step.label} value={value} />;
  }
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
      <label
        className={`flex items-center space-x-2.5 min-w-0 ${enabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={!enabled}
          onChange={onCheck}
          className="w-3.5 h-3.5 accent-emerald-500 shrink-0"
        />
        <span
          className={`text-[10px] font-bold uppercase tracking-wider pt-0.5 ${
            checked ? 'text-emerald-400' : enabled ? 'text-zinc-500' : 'text-zinc-600'
          }`}
        >
          {step.label}
        </span>
      </label>
      <span className={`text-xs font-semibold text-right ${checked ? 'text-emerald-300' : 'text-zinc-100'}`}>
        {checked && value ? value : '—'}
      </span>
    </div>
  );
}

export const TransporteDetailPanel: React.FC<TransporteDetailPanelProps> = ({
  row,
  onClose,
  showEdit = false,
  showDelete = false,
  onEdit,
  onDelete,
  onAsignarMuelle,
  checklistOwner,
  onPorteriaHora,
}) => {
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  if (!row) return null;

  const cerrada = isLlaveCerrada(row);
  const setFlags = PORTERIA_STEPS.map((s) => timeSet((row as Record<string, unknown>)[s.key] as string | undefined));
  const enabledIndex = setFlags.findIndex((f) => !f);
  // Matriz de control de tiempos por módulo:
  // - PORTERÍA: H. Llegada (0) y H. Ingreso (1).
  // - DESPACHOS: H. Inicio Cargue (2) y H. Fin Cargue (3).
  // - MONITOREO: H. Salida Portería (4).
  const ownedIndexes = checklistOwner === 'despachos' ? [2, 3] : checklistOwner === 'monitoreo' ? [4] : [0, 1];
  const showCheck = Boolean(checklistOwner) && Boolean(onPorteriaHora);
  const requiresMuelle = checklistOwner === 'despachos';
  const muelleOk = !requiresMuelle || Boolean(row.muelleAsignado);
  const stepEnabled = (i: number) => !cerrada && ownedIndexes.includes(i) && enabledIndex === i && muelleOk;

  const handleEdit = () => {
    onClose();
    onEdit?.(row);
  };

  const handleDelete = () => {
    onClose();
    onDelete?.(row);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0e1320] border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-500/20 text-blue-400 p-2 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white font-mono">{row.llave}</h3>
              <p className="text-[11px] text-zinc-400 font-semibold flex items-center space-x-1.5">
                <span>{row.placa}</span>
                <TipoBadge tipo={row.vehiculoTipo} />
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Estados */}
          <div className="flex flex-wrap items-center gap-1.5">
            <EstadoBadge estado={getEstadoPorteria(row)} />
          </div>

          {/* Control de tiempos / columnas de operación */}
          <div>
            <SectionTitle>Control de Tiempos</SectionTitle>
            <div className="bg-[#121726] rounded-xl border border-zinc-800 px-4">
              <DetailRow label="Transportadora" value={row.transportadora} />
              <DetailRow label="Hora Cita (Slot programado)" value={row.citaCargue} />
              <TimeRow
                showCheck={showCheck && ownedIndexes.includes(0)}
                step={PORTERIA_STEPS[0]}
                checked={setFlags[0]}
                enabled={stepEnabled(0)}
                value={row.horaLlegadaPorteria}
                onCheck={() => setConfirmIndex(0)}
              />
              <TimeRow
                showCheck={showCheck && ownedIndexes.includes(1)}
                step={PORTERIA_STEPS[1]}
                checked={setFlags[1]}
                enabled={stepEnabled(1)}
                value={row.horaIngreso}
                onCheck={() => setConfirmIndex(1)}
              />
              {onAsignarMuelle ? (
                <div className="flex items-center justify-between gap-3 py-2.5 border-b border-zinc-800/60">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pt-0.5">
                    Muelle Asignado
                  </span>
                  <select
                    value={row.muelleAsignado || ''}
                    onChange={(e) => onAsignarMuelle(row, e.target.value)}
                    disabled={cerrada}
                    className="bg-zinc-900 text-zinc-100 border border-zinc-700 px-2.5 py-1.5 rounded-lg font-bold focus:outline-none text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Asignar muelle (1 al 12)"
                  >
                    <option value="">Sin asignar</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={`Muelle ${n}`}>
                        Muelle {n}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <DetailRow label="Muelle Asignado" value={row.muelleAsignado} />
              )}
              <TimeRow
                showCheck={showCheck && ownedIndexes.includes(2)}
                step={PORTERIA_STEPS[2]}
                checked={setFlags[2]}
                enabled={stepEnabled(2)}
                value={row.horaInicioCargue}
                onCheck={() => setConfirmIndex(2)}
              />
              <TimeRow
                showCheck={showCheck && ownedIndexes.includes(3)}
                step={PORTERIA_STEPS[3]}
                checked={setFlags[3]}
                enabled={stepEnabled(3)}
                value={row.horaFinCargue}
                onCheck={() => setConfirmIndex(3)}
              />
              <TimeRow
                showCheck={showCheck && ownedIndexes.includes(4)}
                step={PORTERIA_STEPS[4]}
                checked={setFlags[4]}
                enabled={stepEnabled(4)}
                value={row.horaSalida}
                onCheck={() => setConfirmIndex(4)}
              />
            </div>
          </div>

          {/* Detalle */}
          <div>
            <SectionTitle>Detalle</SectionTitle>
            <div className="bg-[#121726] rounded-xl border border-zinc-800 px-4">
              <DetailRow label="Cliente / Denominación" value={row.denominacionCliente} />
              <DetailRow label="Destino" value={row.destino} />
              <DetailRow label="# Pedido" value={row.numeroPedido} />
              <DetailRow label="# Pedido 2" value={row.numeroPedido2} />
              <DetailRow label="# Pedido 3" value={row.numeroPedido3} />
              <DetailRow label="# Pedido 4" value={row.numeroPedido4} />
              <DetailRow label="Observaciones" value={row.observaciones} />
            </div>
          </div>
        </div>

        {/* Footer: acciones */}
        {(showEdit || showDelete) && !cerrada && (
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
              {showDelete && (
                <button
                  onClick={handleDelete}
                  className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-zinc-900 border border-zinc-700 text-zinc-200 hover:border-rose-500/40 hover:text-rose-400 rounded-xl text-xs font-bold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Modal de confirmación (registro de tiempo portería) */}
      {confirmIndex !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#121726] rounded-2xl max-w-sm w-full p-6 border border-zinc-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h4 className="text-sm font-bold text-white mb-3">Confirmar registro</h4>
            <p className="text-xs text-zinc-300 mb-6">{PORTERIA_STEPS[confirmIndex].msg}</p>
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setConfirmIndex(null)}
                className="px-4 py-2 border border-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl hover:bg-zinc-800 transition-colors"
              >
                No
              </button>
              <button
                onClick={() => {
                  onPorteriaHora?.(row, PORTERIA_STEPS[confirmIndex].key, nowHHMM());
                  setConfirmIndex(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
