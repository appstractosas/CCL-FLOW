import React, { useMemo } from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { ModuleToolbar } from './ModuleToolbar';
import { EstadoFilter } from './EstadoFilter';
import { TransportesTable, TransportesTableProps } from '../modules/TransportesTable';
import { useFiltrosTransportes } from '../../hooks/useFiltrosTransportes';
import { sortTransportesPorEstado, ORDEN_ESTADOS_TABLERO } from '../../utils/porteria';

interface CrudModuleProps {
  searchPlaceholder: string;
  tableProps?: Omit<TransportesTableProps, 'rows' | 'pageResetKey'>;
  rightContent?: React.ReactNode;
  children?: React.ReactNode;
}

/** Esqueleto compartido de los módulos sobre la tabla unificada de transportes:
 *  filtra por buscador + rango de fechas + filtro de estado
 *  (Todas/Activas/Finalizadas/Canceladas). Las llaves activas y las que coinciden
 *  con el filtro de estado se conservan sin importar el día (como en el Tablero). */
export const CrudModule: React.FC<CrudModuleProps> = ({
  searchPlaceholder,
  tableProps,
  rightContent,
  children,
}) => {
  const transportes = useLogisticsStore((s) => s.transportes);
  const {
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
  } = useFiltrosTransportes(transportes);

  const rowsOrdenadas = useMemo(
    () => sortTransportesPorEstado(rowsFiltradas, ORDEN_ESTADOS_TABLERO),
    [rowsFiltradas],
  );

  return (
    <div className="space-y-4 mt-[-6px] sm:mt-[-14px] lg:mt-[-22px]">
      <ModuleToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={searchPlaceholder}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        searchWidthClass="sm:w-36"
        counter={`${rowsOrdenadas.length} llaves`}
        counterClassName="bg-blue-900/60 border border-blue-800 rounded-xl px-3 py-2 text-xs text-white whitespace-nowrap"
        rightBeforeCounter={<EstadoFilter value={estadoFiltro} onChange={setEstadoFiltro} />}
        rightContent={rightContent}
      />

      <TransportesTable rows={rowsOrdenadas} pageResetKey={pageResetKey} {...tableProps} />
      {children}
    </div>
  );
};
