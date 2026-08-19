import { useMemo, useState } from 'react';
import { useRowFilters, matchesSearch } from './useRowFilters';
import { cumpleFiltroActivas, cumpleFiltroEstado, FiltroEstadoId } from '../utils/porteria';
import { UnifiedTransporte } from '../types';

/**
 * Filtros compartidos de los módulos sobre la tabla unificada de transportes:
 * buscador + rango de fechas + filtro de estado (Todas/Activas/Finalizadas/Canceladas).
 * Las llaves activas y las que coinciden con el filtro de estado se conservan
 * sin importar el día. Devuelve además un `pageResetKey` que cambia solo cuando
 * cambian los filtros, para que la paginación no se reinicie al refrescar datos.
 */
interface UseFiltrosTransportesOptions {
  /** Valor inicial del filtro de estado (por defecto 'activas'). El selector queda funcional. */
  estadoInicial?: FiltroEstadoId;
}

export function useFiltrosTransportes(rows: UnifiedTransporte[], options?: UseFiltrosTransportesOptions) {
  const estadoInicial = options?.estadoInicial ?? 'activas';
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstadoId>(estadoInicial);

  const { searchTerm, setSearchTerm, dateFrom, setDateFrom, dateTo, setDateTo, filtered } = useRowFilters(rows, {
    // Filtro estricto por fechas: el rango seleccionado (FECHA HORA CITA) es el
    // único determinante del día; NO se conservan llaves activas ni finalizadas
    // de otros días. Solo se muestran las llaves cuya cita cae en el rango.
  });

  const rowsFiltradas = useMemo(() => {
    // VISTA ACTIVAS: regla propia de la app (estado no cerrado + fecha programada
    // <= HOY + 1 día, todo el pasado incluido y pasado mañana en adelante
    // excluido). Ignora el rango manual del toolbar; el buscador sí aplica.
    if (estadoFiltro === 'activas') {
      const s = searchTerm.trim().toLowerCase();
      return rows.filter((row) => matchesSearch(row, s) && cumpleFiltroActivas(row));
    }
    // Resto de vistas: rango de fechas del toolbar + estado.
    return filtered.filter((row) => cumpleFiltroEstado(row, estadoFiltro));
  }, [rows, filtered, searchTerm, estadoFiltro]);

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
