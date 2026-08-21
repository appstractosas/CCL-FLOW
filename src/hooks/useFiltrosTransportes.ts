import { useMemo, useState } from 'react';
import { useRowFilters, matchesSearch } from './useRowFilters';
import { cumpleFiltroActivas, cumpleFiltroEstado, getFechaSalidaPorteria, FiltroEstadoId } from '../utils/porteria';
import { UnifiedTransporte } from '../types';

/**
 * Filtros compartidos de los módulos sobre la tabla unificada de transportes:
 * buscador + rango de fechas + filtro de estado (Todas/Activas/Finalizadas/Canceladas).
 * La vista FINALIZADAS toma la fecha de salida del patio (horaSalida / SALIO DE PORTERIA).
 */
interface UseFiltrosTransportesOptions {
  /** Valor inicial del filtro de estado (por defecto 'activas'). El selector queda funcional. */
  estadoInicial?: FiltroEstadoId;
}

export function useFiltrosTransportes(rows: UnifiedTransporte[], options?: UseFiltrosTransportesOptions) {
  const estadoInicial = options?.estadoInicial ?? 'activas';
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstadoId>(estadoInicial);

  const { searchTerm, setSearchTerm, dateFrom, setDateFrom, dateTo, setDateTo, filtered } = useRowFilters(rows);

  const rowsFiltradas = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();

    // VISTA ACTIVAS: regla propia de la app (estado no cerrado + fecha programada <= HOY + 1 día)
    if (estadoFiltro === 'activas') {
      return rows.filter((row) => matchesSearch(row, s) && cumpleFiltroActivas(row));
    }

    // VISTA FINALIZADAS: rango de fechas del toolbar aplicado sobre la fecha de SALIO DE PORTERIA (horaSalida)
    if (estadoFiltro === 'finalizadas') {
      return rows.filter((row) => {
        if (!matchesSearch(row, s)) return false;
        if (!cumpleFiltroEstado(row, 'finalizadas')) return false;

        const d = getFechaSalidaPorteria(row);
        if (d) {
          const inRange = (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
          if (!inRange) return false;
        }
        return true;
      });
    }

    // Resto de vistas: rango de fechas del toolbar (citaCargue) + estado.
    return filtered.filter((row) => cumpleFiltroEstado(row, estadoFiltro));
  }, [rows, filtered, searchTerm, estadoFiltro, dateFrom, dateTo]);

  const pageResetKey = `${searchTerm}|${dateFrom}|${dateTo}|${estadoFiltro}`;

  return {
    searchTerm,
    setSearchTerm,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    rowsFiltradas,
    estadoFiltro,
    setEstadoFiltro,
    pageResetKey,
  };
}
