import React from 'react';
import { Search } from 'lucide-react';
import { DateRangeFilter } from './DateRangeFilter';

interface ModuleToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  rightContent?: React.ReactNode;
  counter?: string;
}

/** Barra única por módulo: rango de fechas + buscador en la misma fila (y acciones a la derecha). */
export const ModuleToolbar: React.FC<ModuleToolbarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Buscar en cualquier columna...',
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  rightContent,
  counter,
}) => {
  const showDate = dateFrom !== undefined && dateTo !== undefined;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
        {showDate && onDateFromChange && onDateToChange && (
          <DateRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onFromChange={onDateFromChange}
            onToChange={onDateToChange}
          />
        )}

        <div className="relative w-full sm:w-72 min-w-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {counter && (
          <span className="text-zinc-500 font-mono text-[11px] whitespace-nowrap">{counter}</span>
        )}
        {rightContent}
      </div>
    </div>
  );
};
