import React from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { TransportesTable } from './TransportesTable';
import { ModuleToolbar } from '../common/ModuleToolbar';
import { useRowFilters } from '../../hooks/useRowFilters';
import { UnifiedTransporte, PorteriaTimeField } from '../../types';

export const PorteriaModule: React.FC = () => {
  const { getUnifiedTransportes, updatePorteriaHora } = useLogisticsStore();
  const { hasModuleEdit } = useAuthStore();
  const canEditRole = hasModuleEdit('porteria');

  const unifiedRows = getUnifiedTransportes();
  const { searchTerm, setSearchTerm, dateFrom, setDateFrom, dateTo, setDateTo, filtered } = useRowFilters(unifiedRows, { keepActiveLlaves: true });

  const handlePorteriaHora = (row: UnifiedTransporte, campo: PorteriaTimeField, hora: string) => {
    updatePorteriaHora(row.id, campo, hora);
  };

  return (
    <div className="space-y-4">
      <ModuleToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por LLAVE, placa, cliente o destino..."
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        counter={`Mostrando ${filtered.length} de ${unifiedRows.length} transportes`}
      />

      <TransportesTable
        rows={filtered}
        hideAcciones={true}
        checklistOwner={canEditRole ? 'porteria' : undefined}
        onPorteriaHora={canEditRole ? handlePorteriaHora : undefined}
      />
    </div>
  );
};
