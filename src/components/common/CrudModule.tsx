import React from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { ModuleToolbar } from './ModuleToolbar';
import { EstadoFilter } from './EstadoFilter';
import { TransportesTable, TransportesTableProps } from '../modules/TransportesTable';
import { useFiltrosTransportes } from '../../hooks/useFiltrosTransportes';

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

  return (
    <div className="space-y-4">
      <ModuleToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={searchPlaceholder}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        leftContent={<EstadoFilter value={estadoFiltro} onChange={setEstadoFiltro} />}
        rightContent={rightContent}
      />

      <TransportesTable rows={rowsFiltradas} pageResetKey={pageResetKey} {...tableProps} />
      {children}
    </div>
  );
};
