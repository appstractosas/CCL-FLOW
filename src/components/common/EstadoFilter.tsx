import React from 'react';
import { FILTROS_ESTADO, FiltroEstadoId } from '../../utils/porteria';

interface EstadoFilterProps {
  value: FiltroEstadoId;
  onChange: (value: FiltroEstadoId) => void;
}

/** Filtro de estado tipo segment (mismo estilo que los presets de INFORMES): Todas/Activas/Finalizadas/Canceladas. */
export const EstadoFilter: React.FC<EstadoFilterProps> = ({ value, onChange }) => {
  return (
    <div className="flex items-center rounded-xl bg-zinc-900 border border-zinc-800 p-0.5">
      {FILTROS_ESTADO.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            value === id ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
