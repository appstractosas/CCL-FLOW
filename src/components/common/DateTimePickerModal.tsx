import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateTimePickerModalProps {
  initialValue?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
const MINUTES = [0, 15, 30, 45];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseInitial(value?: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const fallback = new Date();
  if (!value) return { year: fallback.getFullYear(), month: fallback.getMonth(), day: fallback.getDate(), hour: 8, minute: 0 };
  const d = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) {
    return { year: fallback.getFullYear(), month: fallback.getMonth(), day: fallback.getDate(), hour: 8, minute: 0 };
  }
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), hour: d.getHours(), minute: d.getMinutes() };
}

export const DateTimePickerModal: React.FC<DateTimePickerModalProps> = ({ initialValue, onConfirm, onClose }) => {
  const [sel, setSel] = useState(() => parseInitial(initialValue));
  const [view, setView] = useState(() => {
    const s = parseInitial(initialValue);
    return { year: s.year, month: s.month };
  });

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const firstWeekday = new Date(view.year, view.month, 1).getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () =>
    setView(({ year, month }) => (month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }));
  const nextMonth = () =>
    setView(({ year, month }) => (month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }));

  const isSelected = (day: number) => sel.year === view.year && sel.month === view.month && sel.day === day;

  const confirm = () => {
    onConfirm(`${sel.year}-${pad(sel.month + 1)}-${pad(sel.day)} ${pad(sel.hour)}:${pad(sel.minute)}`);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#121726] rounded-2xl border border-zinc-800 shadow-2xl w-full max-w-xs overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h4 className="text-sm font-bold text-white">Seleccionar Fecha y Hora</h4>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navegación de mes */}
        <div className="flex items-center justify-between px-4 pt-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-white">
            {MONTHS[view.month]} {view.year}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Calendario */}
        <div className="grid grid-cols-7 gap-1 px-4 pt-3 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="text-[10px] font-bold text-zinc-500">
              {w}
            </span>
          ))}
          {cells.map((day, i) =>
            day === null ? (
              <span key={`b-${i}`} />
            ) : (
              <button
                key={day}
                onClick={() => setSel((s) => ({ ...s, year: view.year, month: view.month, day }))}
                className={`h-8 w-8 mx-auto rounded-lg text-xs font-bold transition-colors ${
                  isSelected(day)
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {day}
              </button>
            )
          )}
        </div>

        {/* Hora y minutos */}
        <div className="flex items-center justify-center gap-2 px-4 py-3">
          <select
            value={sel.hour}
            onChange={(e) => setSel({ ...sel, hour: Number(e.target.value) })}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none"
          >
            {Array.from({ length: 24 }, (_, i) => i).map((h) => (
              <option key={h} value={h}>
                {pad(h)}
              </option>
            ))}
          </select>
          <span className="text-zinc-500 font-black">:</span>
          <select
            value={sel.minute}
            onChange={(e) => setSel({ ...sel, minute: Number(e.target.value) })}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none"
          >
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {pad(m)}
              </option>
            ))}
          </select>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end space-x-2 px-4 py-3 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md"
          >
            Seleccionar
          </button>
        </div>
      </div>
    </div>
  );
};
