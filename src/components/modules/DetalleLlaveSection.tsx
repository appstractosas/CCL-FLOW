import React from 'react';
import type { DetalleLlave } from '../../types';
import { SectionTitle } from './TransporteDetailBits';
import { formatCitaCorta } from '../../lib/dateUtils';

/** Máximo de líneas sin barra de desplazamiento; por encima se activa el scroll. */
const MAX_LINEAS_SIN_SCROLL = 7;

const TITULOS = ['Denominación', 'Destino', 'Cita de entrega'];

export const DetalleLlaveSection: React.FC<{ lineas?: DetalleLlave[] }> = ({ lineas }) => {
  if (!lineas || lineas.length === 0) return null;
  const conScroll = lineas.length > MAX_LINEAS_SIN_SCROLL;

  return (
    <div>
      <SectionTitle>Detalle por transporte</SectionTitle>
      <div className="bg-[#121726] rounded-xl border border-zinc-800 overflow-hidden">
        <div className="flex divide-x divide-zinc-800/70 bg-[#0b0f19] text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
          {TITULOS.map((t) => (
            <div key={t} className="flex-1 px-3 py-2">
              {t}
            </div>
          ))}
        </div>
        <div className={conScroll ? 'max-h-[22.25rem] overflow-y-auto' : undefined}>
          {lineas.map((l, i) => (
            <div
              key={i}
              className="flex divide-x divide-zinc-800/60 border-t border-zinc-800/60 text-xs"
            >
              <div className="flex-1 px-3 py-2 text-zinc-200">{l.denominacion || '—'}</div>
              <div className="flex-1 px-3 py-2 text-zinc-200">{l.destino || '—'}</div>
              <div className="flex-1 px-3 py-2 text-zinc-200 whitespace-nowrap">
                {formatCitaCorta(l.citaEntrega) || '—'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};