import React from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { TransportesTable } from './TransportesTable';
import { ModuleToolbar } from '../common/ModuleToolbar';
import { useRowFilters } from '../../hooks/useRowFilters';
import { UnifiedTransporte } from '../../types';

export const PersonalModule: React.FC = () => {
  const { getUnifiedTransportes, updateMuelleAsignado, updateMuelleHora } = useLogisticsStore();
  const { hasModuleEdit } = useAuthStore();
  const canEdit = hasModuleEdit('personal');

  const unifiedRows = getUnifiedTransportes();

  const { searchTerm, setSearchTerm, dateFrom, setDateFrom, dateTo, setDateTo, filtered } = useRowFilters(unifiedRows, { keepActiveLlaves: true });

  const handleAsignarMuelle = (row: UnifiedTransporte, muelle: string) => {
    updateMuelleAsignado(row.id, muelle);
  };

  const handleMuelleHora = (row: UnifiedTransporte, hora: string) => {
    updateMuelleHora(row.id, hora);
  };

  return (
    <div className="space-y-4">
      <ModuleToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar placa, llave, pedido o cliente..."
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        counter={`Mostrando ${filtered.length} de ${unifiedRows.length} transportes`}
      />

      <TransportesTable
        rows={filtered}
        onAsignarMuelle={canEdit ? handleAsignarMuelle : undefined}
        onMuelleHora={canEdit ? handleMuelleHora : undefined}
      />
    </div>
  );
};
