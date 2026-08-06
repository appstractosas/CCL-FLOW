import React, { useState } from 'react';
import { X, Edit2, XCircle } from 'lucide-react';
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
  canCancel?: (row: UnifiedTransporte) => boolean;
  onAsignarMuelle?: (row: UnifiedTransporte, muelle: string) => void;
  onMuelleHora?: (row: UnifiedTransporte, hora: string) => void;
  onCuadrilla?: (row: UnifiedTransporte, cuadrilla: string) => void;
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
  { key: 'horaIngreso', label: 'H. Ingreso a Muelle', msg: '¿Seguro que el vehículo ingresó al muelle?' },
  { key: 'horaInicioCargue', label: 'H. Inicio Cargue', msg: '¿Seguro que el vehículo inició cargue?' },
  { key: 'horaFinCargue', label: 'H. Fin Cargue', msg: '¿Seguro que el vehículo finalizó cargue?' },
  { key: 'horaSalida', label: 'H. Salida Portería', msg: '¿Seguro que el vehículo salió de portería?' },
];

export const CUADRILLAS = ['CCL', 'LTSA (Éxito)', 'SLA'] as const;

function timeSet(value?: string): boolean {
  return value != null && value !== '' && value !== '--:--';
}

function nowHHMM(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Las horas de operación no pueden ser futuras (solo anteriores o iguales a la hora actual).
function isHoraFutura(hora: string): boolean {
  return timeSet(hora) && hora > nowHHMM();
}

function formatSlot(value?: string): string {
  if (!value) return '';
  const m = value.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?/);
  if (!m) return value;
  return `${m[1]} ${m[2]}:${m[3]}`;
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
  editable,
  onCheck,
  onEdit,
}: {
  showCheck: boolean;
  step: PorteriaStep;
  checked: boolean;
  enabled: boolean;
  value?: string;
  editable: boolean;
  onCheck: () => void;
  onEdit: (hora: string) => void;
}) {
  if (!showCheck) {
    return <DetailRow label={step.label} value={value} />;
  }
  const hasValue = timeSet(value);
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
      {editable && hasValue ? (
        <input
          type="time"
          value={value || ''}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            if (isHoraFutura(v)) {
              window.alert(`No se puede registrar una hora futura (${v}). Usa una hora anterior o igual a la hora actual (${nowHHMM()}).`);
              return;
            }
            onEdit(v);
          }}
          className="bg-zinc-900 text-zinc-100 border border-zinc-700 px-2 py-1 rounded-lg font-bold focus:outline-none text-xs"
          title={`Editar ${step.label}`}
        />
      ) : (
        <span className={`text-xs font-semibold text-right ${checked ? 'text-emerald-300' : 'text-zinc-100'}`}>
          {hasValue ? value : '—'}
        </span>
      )}
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
  canCancel,
  onAsignarMuelle,
  onMuelleHora,
  onCuadrilla,
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
  const stepEditable = (i: number) => !cerrada && ownedIndexes.includes(i) && setFlags[i];

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
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-800">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0">Llave</p>
              <h3 className="text-lg font-black text-white font-mono truncate">{row.llave}</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0">Placa</p>
              <p className="text-[11px] font-semibold text-zinc-100 truncate">{row.placa || 'SIN PLACA'}</p>
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <TipoBadge tipo={row.vehiculoTipo} />
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1.5 rounded-lg shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Control de tiempos / columnas de operación */}
          <div>
            <div className="flex items-center justify-between pb-1">
              <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Control de Tiempos</h4>
              <EstadoBadge estado={getEstadoPorteria(row)} />
            </div>
            <div className="bg-[#121726] rounded-xl border border-zinc-800 px-4">
              <DetailRow label="Transportadora" value={row.transportadora} />
              <DetailRow label="Hora Cita (Slot programado)" value={formatSlot(row.citaCargue)} />
              <TimeRow
                showCheck={showCheck && ownedIndexes.includes(0)}
                step={PORTERIA_STEPS[0]}
                checked={setFlags[0]}
                enabled={stepEnabled(0)}
                editable={stepEditable(0)}
                value={row.horaLlegadaPorteria}
                onCheck={() => setConfirmIndex(0)}
                onEdit={(hora) => onPorteriaHora?.(row, PORTERIA_STEPS[0].key, hora)}
              />
              <TimeRow
                showCheck={showCheck && ownedIndexes.includes(1)}
                step={PORTERIA_STEPS[1]}
                checked={setFlags[1]}
                enabled={stepEnabled(1)}
                editable={stepEditable(1)}
                value={row.horaIngreso}
                onCheck={() => setConfirmIndex(1)}
                onEdit={(hora) => onPorteriaHora?.(row, PORTERIA_STEPS[1].key, hora)}
              />
              <div className="border-b border-zinc-800/60">
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pt-0.5">
                    Muelle Asignado
                  </span>
                  {onAsignarMuelle ? (
                    <select
                      value={row.muelleAsignado || ''}
                      onChange={(e) => onAsignarMuelle(row, e.target.value)}
                      disabled={cerrada}
                      className="bg-zinc-900 text-zinc-100 border border-zinc-700 px-2.5 py-1.5 rounded-lg font-bold focus:outline-none text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Asignar muelle (incluye MUELLE CERO)"
                    >
                      <option value="">Sin asignar</option>
                      <option value="MUELLE CERO">MUELLE CERO</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={`Muelle ${n}`}>
                          Muelle {n}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs font-semibold text-zinc-100 text-right">
                      {row.muelleAsignado || '—'}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 pb-2.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pt-0.5">
                    H. Asignación Muelle
                  </span>
                  {onMuelleHora ? (
                    <input
                      type="time"
                      value={timeSet(row.horaMuelleAsignado) ? row.horaMuelleAsignado : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        onMuelleHora(row, v);
                      }}
                      disabled={cerrada}
                      className="bg-zinc-900 text-zinc-100 border border-zinc-700 px-2 py-1 rounded-lg font-bold focus:outline-none text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Editar hora de asignación del muelle (permite horas programadas)"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-zinc-100 text-right">
                      {timeSet(row.horaMuelleAsignado) ? row.horaMuelleAsignado : '—'}
                    </span>
                  )}
                </div>
              </div>
              <TimeRow
                showCheck={showCheck && ownedIndexes.includes(2)}
                step={PORTERIA_STEPS[2]}
                checked={setFlags[2]}
                enabled={stepEnabled(2)}
                editable={stepEditable(2)}
                value={row.horaInicioCargue}
                onCheck={() => setConfirmIndex(2)}
                onEdit={(hora) => onPorteriaHora?.(row, PORTERIA_STEPS[2].key, hora)}
              />
              <TimeRow
                showCheck={showCheck && ownedIndexes.includes(3)}
                step={PORTERIA_STEPS[3]}
                checked={setFlags[3]}
                enabled={stepEnabled(3)}
                editable={stepEditable(3)}
                value={row.horaFinCargue}
                onCheck={() => setConfirmIndex(3)}
                onEdit={(hora) => onPorteriaHora?.(row, PORTERIA_STEPS[3].key, hora)}
              />
              <div className="flex items-center justify-between gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pt-0.5">
                  Cuadrilla
                </span>
                {onCuadrilla ? (
                  <select
                    value={row.cuadrilla || ''}
                    onChange={(e) => onCuadrilla(row, e.target.value)}
                    disabled={cerrada}
                    className="bg-zinc-900 text-zinc-100 border border-zinc-700 px-2.5 py-1.5 rounded-lg font-bold focus:outline-none text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Seleccionar cuadrilla de cargue"
                  >
                    <option value="">Sin cuadrilla</option>
                    {CUADRILLAS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-semibold text-zinc-100 text-right">
                    {row.cuadrilla || '—'}
                  </span>
                )}
              </div>
              <TimeRow
                showCheck={showCheck && ownedIndexes.includes(4)}
                step={PORTERIA_STEPS[4]}
                checked={setFlags[4]}
                enabled={stepEnabled(4)}
                editable={stepEditable(4)}
                value={row.horaSalida}
                onCheck={() => setConfirmIndex(4)}
                onEdit={(hora) => onPorteriaHora?.(row, PORTERIA_STEPS[4].key, hora)}
              />
            </div>
          </div>

          {/* Detalle */}
          <div>
            <SectionTitle>Detalle</SectionTitle>
            <div className="bg-[#121726] rounded-xl border border-zinc-800 px-4">
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
