import React, { useState } from 'react';
import { X, Edit2, XCircle } from 'lucide-react';
import { UnifiedTransporte, PorteriaTimeField } from '../../types';
import { EstadoBadge, EstatusBadge, TipoBadge } from '../common/EstadoBadge';
import { getEstadoPorteria, isLlaveCerrada, puedeEditarOperacion } from '../../utils/porteria';
import { MUELLES, MUELLE_CERO } from '../../lib/muelles';
import { timeSet, nowDateTime, formatSlot, horaOf, combinarFechaHora, formatFechaHora } from '../../lib/dateUtils';
import { CUADRILLAS, PORTERIA_STEPS, DetailRow, TimeRow } from './TransporteDetailBits';

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
}

const CajasInput: React.FC<{
  row: UnifiedTransporte;
  onCajas: (row: UnifiedTransporte, cajas: number) => void;
}> = ({ row, onCajas }) => {
  const [val, setVal] = useState<string>(row.cajas != null ? String(row.cajas) : '');

  React.useEffect(() => {
    setVal(row.cajas != null ? String(row.cajas) : '');
  }, [row.cajas]);

  const commit = () => {
    const num = Number(val);
    if (Number.isFinite(num) && num >= 0 && num !== row.cajas) {
      onCajas(row, num);
    }
  };

  return (
    <input
      type="number"
      min={0}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      title="Editar número de cajas"
      className="bg-zinc-900 text-zinc-100 border border-zinc-700 px-2.5 py-1.5 rounded-lg font-bold focus:outline-none text-xs text-right w-24 focus:border-emerald-500"
    />
  );
};

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
}) => {
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  if (!row) return null;

  const cerrada = isLlaveCerrada(row);
  const estado = getEstadoPorteria(row);
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
  // Regla: H. INGRESO A MUELLE solo se activa si ya hay un muelle asignado,
  // en TODOS los módulos (portería, despachos, monitoreo).
  const ingresoRequiereMuelle = Boolean(row.muelleAsignado);
  // PORTERÍA solo puede iniciar el proceso (H. Llegada Portería) si la llave
  // está CONFIRMADA; una llave en PENDIENTE (sin placa) no se puede iniciar.
  const puedeIniciarPorteria = estado === 'Confirmado';
  const stepEnabled = (i: number) =>
    !cerrada &&
    ownedIndexes.includes(i) &&
    enabledIndex === i &&
    muelleOk &&
    (i !== 1 || ingresoRequiereMuelle) &&
    (i !== 3 || Boolean(row.cuadrilla)) &&
    (checklistOwner !== 'porteria' || i !== 0 || puedeIniciarPorteria);

  // P3: al activar un checkbox, los anteriores quedan desactivados mostrando su
  // hora; el recién activado conserva la hora editable. Solo el ÚLTIMO paso
  // marcado del flujo es editable; los anteriores se muestran con la hora
  // bloqueada (aunque pertenezcan al mismo módulo).
  const stepEditable = (i: number) =>
    !cerrada && ownedIndexes.includes(i) && setFlags[i] && i === setFlags.lastIndexOf(true);

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
          <div className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-semibold text-zinc-100 truncate">{row.transportadora || '—'}</span>
              <TipoBadge tipo={row.vehiculoTipo} />
            </div>
            <span className="text-[11px] font-semibold text-zinc-100 truncate">{row.region || '—'}</span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1.5 rounded-lg shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Control de tiempos / columnas de operación */}
          <div>
            <div className="flex items-center justify-between pb-1 gap-1.5">
              <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Control de Tiempos</h4>
              <div className="flex items-center gap-1.5 shrink-0">
                {showEstatus && <EstatusBadge estado={row.estadoTransporte} />}
                <EstadoBadge estado={getEstadoPorteria(row)} />
              </div>
            </div>
            {checklistOwner === 'porteria' && estado === 'Pendiente' && (
              <div className="mb-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] rounded-lg px-3 py-2 leading-relaxed">
                Llave en <strong>PENDIENTE</strong>: el proceso de portería no se puede iniciar hasta que la
                llave esté <strong>CONFIRMADA</strong> (placa asignada).
              </div>
            )}
            <div className="bg-[#121726] rounded-xl border border-zinc-800 px-4">
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
                      <option value={MUELLE_CERO}>{MUELLE_CERO}</option>
                      {MUELLES.map((m) => (
                        <option key={m} value={m}>
                          {m}
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
                      value={timeSet(row.horaMuelleAsignado) ? horaOf(row.horaMuelleAsignado) : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        onMuelleHora(row, combinarFechaHora(v, row.horaMuelleAsignado));
                      }}
                      disabled={cerrada}
                      className="bg-zinc-900 text-zinc-100 border border-zinc-700 px-2 py-1 rounded-lg font-bold focus:outline-none text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Editar hora de asignación del muelle (permite horas programadas)"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-zinc-100 text-right">
                      {timeSet(row.horaMuelleAsignado) ? formatFechaHora(row.horaMuelleAsignado) : '—'}
                    </span>
                  )}
                </div>
              </div>
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
              <TimeRow
                showCheck={showCheck && ownedIndexes.includes(2)}
                step={PORTERIA_STEPS[2]}
                checked={setFlags[2]}
                enabled={stepEnabled(2)}
                editable={stepEditable(2)}
                value={row.horaInicioCargue}
                onCheck={() => {
                setConfirmIndex(2);
                onPorteriaHora?.(row.id, 'horaInicioCargue', nowDateTime());
              }}
                onEdit={(hora) => onPorteriaHora?.(row, PORTERIA_STEPS[2].key, hora)}
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
              <div className="flex items-center justify-between gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pt-0.5">
                  Cajas
                </span>
                {onCajas ? (
                  <CajasInput row={row} onCajas={onCajas} />
                ) : (
                  <span className="text-xs font-semibold text-zinc-100 text-right">
                    {row.cajas != null ? row.cajas.toLocaleString('es-CO') : '—'}
                  </span>
                )}
              </div>
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
              {/* Nº Pedido y Cliente retirados de la UI (siguen en la BD). */}
              <DetailRow label="Kg" value={row.kg != null ? row.kg.toLocaleString('es-CO') : undefined} />
            </div>
          </div>
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
                  onPorteriaHora?.(row, PORTERIA_STEPS[confirmIndex].key, nowDateTime());
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