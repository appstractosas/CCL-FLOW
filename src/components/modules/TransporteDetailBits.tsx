import React, { useState } from 'react';
import { PorteriaTimeField, UnifiedTransporte } from '../../types';
import {
  timeSet,
  formatFechaHora,
  nowDateTime,
  horaOf,
  combinarFechaHora,
} from '../../lib/dateUtils';

export interface PorteriaStep {
  key: PorteriaTimeField;
  label: string;
  msg: string;
}

// eslint-disable-next-line react-refresh/only-export-components -- constantes de configuración compartidas con TransporteDetailPanel
export const PORTERIA_STEPS: PorteriaStep[] = [
  {
    key: 'horaLlegadaPorteria',
    label: 'H. Llegada Portería',
    msg: '¿Seguro que el vehículo llegó a portería?',
  },
  {
    key: 'horaIngreso',
    label: 'H. Ingreso a Muelle',
    msg: '¿Seguro que el vehículo ingresó al muelle?',
  },
  {
    key: 'horaInicioCargue',
    label: 'H. Inicio Cargue',
    msg: '¿Seguro que el vehículo inició cargue?',
  },
  { key: 'horaFinCargue', label: 'H. Fin Cargue', msg: '¿Seguro que el vehículo finalizó cargue?' },
  {
    key: 'horaSalida',
    label: 'H. Salida Portería',
    msg: '¿Seguro que el vehículo salió de portería?',
  },
];

// eslint-disable-next-line react-refresh/only-export-components -- constantes de configuración compartidas con TransporteDetailPanel
export const CUADRILLAS = ['CCL', 'LTSA (Éxito)', 'SLA'] as const;

// Las horas de operación no pueden ser futuras (solo anteriores o iguales a la hora actual).
// Acepta "HH:MM" o "YYYY-MM-DD HH:MM" y compara contra el instante actual.
function isHoraFutura(hora: string): boolean {
  const withFecha = hora.includes('-') ? hora : combinarFechaHora(hora, todayStrBase());
  return timeSet(withFecha) && withFecha > nowDateTime();
}

function todayStrBase(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DetailRow({ label, value }: { label: string; value?: string | number }) {
  const v = value === undefined || value === null || value === '' ? '—' : String(value);
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pt-0.5">
        {label}
      </span>
      <span className="text-xs font-semibold text-zinc-100 text-right">{v}</span>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pb-1">
      {children}
    </h4>
  );
}

export function TimeRow({
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
    return (
      <DetailRow
        label={step.label}
        value={value && timeSet(value) ? formatFechaHora(value) : value}
      />
    );
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
          value={horaOf(value) || ''}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const comb = combinarFechaHora(v, value);
            if (isHoraFutura(comb)) {
              window.alert(
                `No se puede registrar una hora futura (${comb}). Usa una hora anterior o igual a la hora actual (${nowDateTime()}).`,
              );
              return;
            }
            onEdit(comb);
          }}
          className="bg-zinc-900 text-zinc-100 border border-zinc-700 px-2 py-1 rounded-lg font-bold focus:outline-none text-xs"
          title={`Editar ${step.label}`}
        />
      ) : (
        <span
          className={`text-xs font-semibold text-right ${checked ? 'text-emerald-300' : 'text-zinc-100'}`}
        >
          {hasValue ? formatFechaHora(value) : '—'}
        </span>
      )}
    </div>
  );
}

export function CajasInput({
  row,
  onCajas,
  editable = true,
}: {
  row: UnifiedTransporte;
  onCajas: (row: UnifiedTransporte, cajas: number) => void;
  editable?: boolean;
}) {
  const [val, setVal] = useState<string>(row.cajas != null ? String(row.cajas) : '');

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el input con el valor recibido de la fila
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
      disabled={!editable}
      title={editable ? 'Editar número de cajas' : 'Solo editable en estados CARGANDO o FINALIZO CARGUE'}
      className={`bg-zinc-900 text-zinc-100 border border-zinc-700 px-2.5 py-1.5 rounded-lg font-bold focus:outline-none text-xs text-right w-24 focus:border-emerald-500 ${!editable ? 'opacity-50 cursor-not-allowed' : 'focus:border-emerald-500'}`}
    />
  );
}
