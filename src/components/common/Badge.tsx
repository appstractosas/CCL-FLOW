import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, ArrowUpRight, Lock, Check } from 'lucide-react';

interface BadgeProps {
  status: string;
  type?: 'despacho' | 'porteria' | 'operador' | 'generic';
}

export const Badge: React.FC<BadgeProps> = ({ status, type = 'generic' }) => {
  const norm = status.toUpperCase().trim();

  // Green states
  if (norm === 'EN PROCESO' || norm === 'CONFIRMADO') {
    return (
      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-semibold shadow-2xs">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        {status}
      </span>
    );
  }

  // Yellow/Amber states
  if (norm === 'ALISTADO' || norm === 'CARGADO') {
    return (
      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-semibold shadow-2xs">
        <Clock className="w-3.5 h-3.5 text-amber-600" />
        {status}
      </span>
    );
  }

  // Red states
  if (norm === 'PENDIENTE') {
    return (
      <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-semibold shadow-2xs">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
        {status}
      </span>
    );
  }

  // Gray/Blue states (Despachado)
  if (norm === 'DESPACHADO') {
    return (
      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-1 rounded-full text-xs font-semibold shadow-2xs">
        <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
        {status}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-semibold">
      {status}
    </span>
  );
};
