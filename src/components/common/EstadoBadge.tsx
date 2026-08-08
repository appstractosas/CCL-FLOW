import React from 'react';
import { TipoVehiculo } from '../../types';

export const TipoBadge: React.FC<{ tipo: TipoVehiculo }> = ({ tipo }) => {
  switch (tipo) {
    case 'MINIMULA':
      return <span className="bg-amber-500/10 text-white border border-amber-500/20 px-2 py-0.5 rounded-full font-bold text-[10px]">MINIMULA</span>;
    case 'SENCILLO':
      return <span className="bg-blue-500/10 text-white border border-blue-500/20 px-2 py-0.5 rounded-full font-bold text-[10px]">SENCILLO</span>;
    case 'LUV':
      return <span className="bg-violet-500/10 text-white border border-violet-500/20 px-2 py-0.5 rounded-full font-bold text-[10px]">LUV</span>;
    case 'TURBO':
      return <span className="bg-emerald-500/10 text-white border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold text-[10px]">TURBO</span>;
    default:
      return <span className="bg-zinc-800 text-zinc-500 border border-zinc-700 px-2 py-0.5 rounded-full font-bold text-[10px]">{tipo}</span>;
  }
};

// Color único por estado (estilo consistente con el resto de la app).
// Tailwind genera las clases porque aparecen literalmente en este archivo.
const ESTADO_CLASSES: Record<string, string> = {
  PENDIENTE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  CONFIRMADO: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  'LLEGO A PORTERIA': 'bg-red-500/20 text-red-300 border-red-500/40',
  'INGRESO A MUELLE': 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
  CARGANDO: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  'FINALIZO CARGUE': 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  'SALIO DE PORTERIA': 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  CANCELADO: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40',
  DESPACHADO: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  CARGADO: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  'PTE ALISTAR': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  'EN PROCESO': 'bg-green-500/20 text-green-300 border-green-500/40',
  ALISTADO: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
};

export const EstadoBadge: React.FC<{ estado: string }> = ({ estado }) => {
  const colorClasses = ESTADO_CLASSES[estado.toUpperCase()] || 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
  return (
    <span className={`${colorClasses} px-2.5 py-0.5 rounded-full font-extrabold text-[11px] whitespace-nowrap`}>• {estado}</span>
  );
};
