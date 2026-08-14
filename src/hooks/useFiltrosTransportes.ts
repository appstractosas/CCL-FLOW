import { useMemo, useState } from 'react';
import { useRowFilters } from './useRowFilters';
import { cumpleFiltroEstado, FiltroEstadoId } from '../utils/porteria';
import { UnifiedTransporte } from '../types';

/**
 * Filtros compartidos de los módulos sobre la tabla unificada de transportes:
 * buscador + rango de fechas + filtro de estado (Todas/Activas/Finalizadas/Canceladas).
 * Las llaves activas y las que coinciden con el filtro de estado se conservan
 * sin importar el día. Devuelve además un `pageResetKey` que cambia solo cuando
 * cambian los filtros, para que la paginación no se reinicie al refrescar datos.
 */
export function useFiltrosTransportes(rows: UnifiedTransporte[]) {
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstadoId>('todas');

  const { searchTerm, setSearchTerm, dateFrom, setDateFrom, dateTo, setDateTo, filtered } = useRowFilters(rows, {
    // Filtro estricto por fechas: el rango seleccionado (FECHA HORA CITA) es el
    // único determinante del día; NO se conservan llaves activas ni finalizadas
    // de otros días. Solo se muestran las llaves cuya cita cae en el rango.
  });

  const rowsFiltradas = useMemo(
    () => filtered.filter((row) => cumpleFiltroEstado(row, estadoFiltro)),
    [filtered, estadoFiltro]
  );

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
