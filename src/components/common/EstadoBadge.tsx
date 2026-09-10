import React from 'react';
import { TipoVehiculo } from '../../types';

export const TipoBadge: React.FC<{ tipo: TipoVehiculo }> = ({ tipo }) => {
  switch (tipo) {
    case 'MINIMULA':
      return (
        <span className="bg-amber-500/10 text-white border border-amber-500/20 px-2 py-0.5 rounded-full font-bold text-[10px]">
          MINIMULA
        </span>
      );
    case 'SENCILLO':
      return (
        <span className="bg-blue-500/10 text-white border border-blue-500/20 px-2 py-0.5 rounded-full font-bold text-[10px]">
          SENCILLO
        </span>
      );
    case 'LUV':
      return (
        <span className="bg-violet-500/10 text-white border border-violet-500/20 px-2 py-0.5 rounded-full font-bold text-[10px]">
          LUV
        </span>
      );
    case 'TURBO':
      return (
        <span className="bg-emerald-500/10 text-white border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold text-[10px]">
          TURBO
        </span>
      );
    case 'MULA':
      return (
        <span className="bg-rose-500/10 text-white border border-rose-500/20 px-2 py-0.5 rounded-full font-bold text-[10px]">
          MULA
        </span>
      );
    default:
      return (
        <span className="bg-zinc-800 text-zinc-500 border border-zinc-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
          {tipo}
        </span>
      );
  }
};

/**
 * Colores de texto para la columna ESTATUS (estadoTransporte).
 * Sin fondo ni borde circular: únicamente el texto en minúsculas y su punto '•' en el color asignado.
 */
const ESTATUS_CLASSES: Record<string, string> = {
  DESPACHADO: 'text-cyan-400 font-bold',
  ALISTADO: 'text-teal-400 font-bold',
  PENDIENTE: 'text-slate-300 font-bold',
  CARGADO: 'text-indigo-400 font-bold',
  'EN PROCESO': 'text-sky-400 font-bold',
  'PTE ALISTAR': 'text-violet-400 font-bold',
};

/** Badge para la columna ESTATUS: solo texto + punto '•' en MINÚSCULAS (sin borde ni fondo). */
export const EstatusBadge: React.FC<{ estado: string }> = ({ estado }) => {
  const key = (estado || '').toUpperCase();
  const colorClasses = ESTATUS_CLASSES[key] || 'text-cyan-400 font-bold';
  const textoMinuscula = (estado || '').toLowerCase();

  return (
    <span
      className={`${colorClasses} text-[11px] whitespace-nowrap inline-flex items-center gap-1`}
    >
      • {textoMinuscula}
    </span>
  );
};

/**
 * Colores específicos para la columna ESTADO (flujo de portería: LLEGO A PORTERIA, CARGANDO, etc.).
 * Se muestran en MAYÚSCULAS y con colores vivos diferenciados.
 */
const ESTADO_CLASSES: Record<string, string> = {
  PENDIENTE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  CONFIRMADO: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  'LLEGO A PORTERIA': 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  'INGRESO A MUELLE': 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
  CARGANDO: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  'FINALIZO CARGUE': 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  'SALIO DE PORTERIA': 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  CANCELADO: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/40',
};

/** Badge para la columna ESTADO: texto en MAYÚSCULAS. */
export const EstadoBadge: React.FC<{ estado: string }> = ({ estado }) => {
  const key = (estado || '').toUpperCase();
  const colorClasses =
    ESTADO_CLASSES[key] || 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
  const textoMayuscula = (estado || '').toUpperCase();

  return (
    <span
      className={`${colorClasses} border px-2.5 py-0.5 rounded-full font-extrabold text-[11px] whitespace-nowrap uppercase`}
    >
      • {textoMayuscula}
    </span>
  );
};
