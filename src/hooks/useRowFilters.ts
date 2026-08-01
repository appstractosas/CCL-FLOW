import { useMemo, useState } from 'react';
import { todayStr } from '../lib/dateUtils';

interface RowFiltersOptions {
  /** Nombre de la propiedad que contiene la fecha (por defecto 'fechaHora'). Se extrae el fragmento YYYY-MM-DD. */
  dateKey?: string;
  /** Si se especifica, busca únicamente en estas columnas; si no, busca en TODAS las columnas de la fila. */
  searchKeys?: string[];
  /** Activa/desactiva el filtro por rango de fechas (por defecto true). */
  enableDate?: boolean;
}

/** Filtro compartido: buscador (todas las columnas) + rango de fechas, en la misma fila. */
export function useRowFilters<T extends object>(rows: T[], options: RowFiltersOptions = {}) {
  const { dateKey = 'fechaHora', searchKeys, enableDate = true } = options;

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState(enableDate ? todayStr() : '');
  const [dateTo, setDateTo] = useState(enableDate ? todayStr() : '');

  const filtered = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      const record = row as Record<string, unknown>;

      if (s) {
        const match = searchKeys
          ? searchKeys.some((k) => record[k] != null && String(record[k]).toLowerCase().includes(s))
          : Object.values(record).some((v) => v != null && String(v).toLowerCase().includes(s));
        if (!match) return false;
      }

      if (enableDate) {
        const rawDate = record[dateKey];
        const d = rawDate != null ? String(rawDate).split(' ')[0] : '';
        if (!d) return true;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }

      return true;
    });
  }, [rows, searchTerm, dateFrom, dateTo, dateKey, searchKeys, enableDate]);

  const resetFilters = () => {
    setSearchTerm('');
    setDateFrom(todayStr());
    setDateTo(todayStr());
  };

  return {
    searchTerm,
    setSearchTerm,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    filtered,
    resetFilters,
  };
}
