import React from 'react';
import { Calendar } from 'lucide-react';

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onFromChange: (val: string) => void;
  onToChange: (val: string) => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  dateFrom,
  dateTo,
  onFromChange,
  onToChange,
}) => {
  return (
    <div className="flex items-center space-x-2">
      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => onFromChange(e.target.value)}
        className="bg-zinc-900 text-zinc-300 border border-zinc-800 px-2.5 py-1 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500/50 [color-scheme:dark]"
      />
      <span className="text-zinc-500 text-xs">—</span>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => onToChange(e.target.value)}
        className="bg-zinc-900 text-zinc-300 border border-zinc-800 px-2.5 py-1 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500/50 [color-scheme:dark]"
      />
    </div>
  );
};
