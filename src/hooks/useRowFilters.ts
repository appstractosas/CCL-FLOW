import { useMemo, useState } from 'react';
import { todayStr } from '../lib/dateUtils';
import { getEstadoPorteria } from '../utils/porteria';

interface RowFiltersOptions<T extends object = Record<string, any>> {
  /** Nombre de la propiedad que contiene la fecha del rango (por defecto 'citaCargue' = FECHA HORA CITA). Se extrae el fragmento YYYY-MM-DD. */
  dateKey?: string;
  /** Si se especifica, busca únicamente en estas columnas; si no, busca en TODAS las columnas de la fila. */
  searchKeys?: string[];
  /** Activa/desactiva el filtro por rango de fechas (por defecto true). */
  enableDate?: boolean;
  /**
   * Si está activo, las llaves cuyo estado de portería sea diferente de
   * SALIO DE PORTERIA se muestran siempre, aunque su fecha esté fuera del
   * rango seleccionado (llaves activas de cualquier día).
   */
  keepActiveLlaves?: boolean;
  /**
   * Predicado adicional: si devuelve true para una fila, esta se muestra
   * aunque su fecha esté fuera del rango. Útil para que el filtro de estado
   * (p.ej. FINALIZADAS/CANCELADAS) conserve las filas de cualquier día.
   */
  keepIf?: (row: T) => boolean;
}

/** Extrae el fragmento YYYY-MM-DD de un valor de fecha (soporta "2026-08-01 08:30" e ISO). */
function extractDatePart(value: unknown): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ''));
  return m ? m[1] : '';
}

/**
 * Búsqueda textual sobre una fila: si `searchKeys` se especifica, busca solo en
 * esas columnas; si no, en TODAS las columnas. Compartida para no duplicar la
 * lógica del buscador entre el rango de fechas y el filtro ACTIVAS.
 */
export function matchesSearch(row: object, term: string, searchKeys?: string[]): boolean {
  if (!term) return true;
  const record = row as Record<string, unknown>;
  return searchKeys
    ? searchKeys.some((k) => record[k] != null && String(record[k]).toLowerCase().includes(term))
    : Object.values(record).some((v) => v != null && String(v).toLowerCase().includes(term));
}

/** Filtro compartido: buscador (todas las columnas) + rango de fechas, en la misma fila. */
export function useRowFilters<T extends object>(rows: T[], options: RowFiltersOptions<T> = {}) {
  const {
    dateKey = 'citaCargue',
    searchKeys,
    enableDate = true,
    keepActiveLlaves = false,
    keepIf,
  } = options;

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState(enableDate ? todayStr() : '');
  const [dateTo, setDateTo] = useState(enableDate ? todayStr() : '');

  const filtered = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      if (!matchesSearch(row, s, searchKeys)) return false;

      if (enableDate) {
        const record = row as Record<string, unknown>;
        const rawDate = record[dateKey];
        const d = rawDate != null ? extractDatePart(rawDate) : '';
        if (d) {
          const inRange = (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
          if (!inRange) {
            // Llaves activas (aún no SALIO DE PORTERIA) se conservan sin importar el día.
            if (
              keepActiveLlaves &&
              getEstadoPorteria(record as Parameters<typeof getEstadoPorteria>[0]) !==
                'SALIO DE PORTERIA'
            ) {
              // keep
            } else if (keepIf && keepIf(row)) {
              // keep (filtro de estado: FINALIZADAS/CANCELADAS de cualquier día)
            } else {
              return false;
            }
          }
        }
      }

      return true;
    });
  }, [
    rows,
    searchTerm,
    dateFrom,
    dateTo,
    dateKey,
    searchKeys,
    enableDate,
    keepActiveLlaves,
    keepIf,
  ]);

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
