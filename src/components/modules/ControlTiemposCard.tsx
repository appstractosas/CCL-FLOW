import React, { useState } from 'react';
import { UnifiedTransporte, PorteriaTimeField } from '../../types';
import { EstadoBadge, EstatusBadge } from '../common/EstadoBadge';
import { getEstadoPorteria, isLlaveCerrada } from '../../utils/porteria';
import { MUELLES, MUELLE_CERO } from '../../lib/muelles';
import {
  timeSet,
  nowDateTime,
  formatSlot,
  horaOf,
  combinarFechaHora,
  formatFechaHora,
} from '../../lib/dateUtils';
import { CUADRILLAS, PORTERIA_STEPS, DetailRow, TimeRow, CajasInput } from './TransporteDetailBits';

interface ControlTiemposCardProps {
  row: UnifiedTransporte;
  showEstatus?: boolean;
  checklistOwner?: 'porteria' | 'despachos';
  onAsignarMuelle?: (row: UnifiedTransporte, muelle: string) => void;
  onMuelleHora?: (row: UnifiedTransporte, hora: string) => void;
  onCuadrilla?: (row: UnifiedTransporte, cuadrilla: string) => void;
  onCajas?: (row: UnifiedTransporte, cajas: number) => void;
  onPorteriaHora?: (row: UnifiedTransporte, campo: PorteriaTimeField, hora: string) => void;
}

export const ControlTiemposCard: React.FC<ControlTiemposCardProps> = ({
  row,
  showEstatus = false,
  checklistOwner,
  onAsignarMuelle,
  onMuelleHora,
  onCuadrilla,
  onCajas,
  onPorteriaHora,
}) => {
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  const cerrada = isLlaveCerrada(row);
  const estado = getEstadoPorteria(row);
  const estadosCajasEditables = ['CARGANDO', 'FINALIZO CARGUE'];
  const cajasEditable = estadosCajasEditables.includes(estado);
  const setFlags = PORTERIA_STEPS.map((s) =>
    timeSet((row as Record<string, unknown>)[s.key] as string | undefined),
  );
  const enabledIndex = setFlags.findIndex((f) => !f);
  // Matriz de control de tiempos por módulo:
  // - PORTERÍA: H. Llegada (0), H. Ingreso (1) y H. Salida (4).
  // - DESPACHOS: H. Inicio Cargue (2) y H. Fin Cargue (3).
  const ownedIndexes = checklistOwner === 'despachos' ? [2, 3] : [0, 1, 4];
  const showCheck = Boolean(checklistOwner) && Boolean(onPorteriaHora);
  const requiresMuelle = checklistOwner === 'despachos';
  const muelleOk = !requiresMuelle || Boolean(row.muelleAsignado);
  // Regla: H. INGRESO A MUELLE solo se activa si ya hay un muelle asignado,
  // en TODOS los módulos (portería, despachos).
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

  return (
    <>
      <div>
        <div className="flex items-center justify-between pb-1 gap-1.5">
          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            Control de Tiempos
          </h4>
          <div className="flex items-center gap-1.5 shrink-0">
            {showEstatus && <EstatusBadge estado={row.estadoTransporte} />}
            <EstadoBadge estado={getEstadoPorteria(row)} />
          </div>
        </div>
        {checklistOwner === 'porteria' && estado === 'Pendiente' && (
          <div className="mb-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] rounded-lg px-3 py-2 leading-relaxed">
            Llave en <strong>PENDIENTE</strong>: el proceso de portería no se puede iniciar
            hasta que la llave esté <strong>CONFIRMADA</strong> (placa asignada).
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
                  {timeSet(row.horaMuelleAsignado)
                    ? formatFechaHora(row.horaMuelleAsignado)
                    : '—'}
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
              <CajasInput row={row} onCajas={onCajas} editable={cajasEditable} />
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
        </div>
      </div>

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