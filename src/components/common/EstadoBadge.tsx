import React from 'react';
import { TipoVehiculo } from '../../types';

export const TipoBadge: React.FC<{ tipo: TipoVehiculo }> = ({ tipo }) => {
  switch (tipo) {
    case 'MINIMULA':
      return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-extrabold text-[10px]">MINIMULA</span>;
    case 'SENCILLO':
      return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-extrabold text-[10px]">SENCILLO</span>;
    case 'LUV':
      return <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded font-extrabold text-[10px]">LUV</span>;
    case 'TURBO':
      return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-extrabold text-[10px]">TURBO</span>;
    default:
      return <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[10px]">{tipo}</span>;
  }
};

export const EstadoBadge: React.FC<{ estado: string }> = ({ estado }) => {
  const key = estado.toUpperCase();
  if (key === 'LLEGO A PORTERIA') {
    return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap">• {estado}</span>;
  }
  if (key === 'INGRESO A MUELLE') {
    return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap">• {estado}</span>;
  }
  if (key === 'CARGANDO') {
    return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap">• {estado}</span>;
  }
  if (key === 'FINALIZO CARGUE') {
    return <span className="bg-sky-500/10 text-sky-400 border border-sky-500/30 px-2.5 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap">• {estado}</span>;
  }
  if (key === 'SALIO DE PORTERIA') {
    return <span className="bg-violet-500/10 text-violet-400 border border-violet-500/30 px-2.5 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap">• {estado}</span>;
  }
  if (key === 'DESPACHADO' || key === 'CONFIRMADO') {
    return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap">• {estado}</span>;
  }
  if (key === 'CARGADO') {
    return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap">• {estado}</span>;
  }
  if (key === 'PTE ALISTAR') {
    return <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2.5 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap">• {estado}</span>;
  }
  if (key === 'EN PROCESO' || key === 'ALISTADO') {
    return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap">• {estado}</span>;
  }
  return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap">• {estado}</span>;
};
