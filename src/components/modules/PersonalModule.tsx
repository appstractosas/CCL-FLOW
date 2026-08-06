import React from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { TransportesTable } from './TransportesTable';
import { ModuleToolbar } from '../common/ModuleToolbar';
import { useRowFilters } from '../../hooks/useRowFilters';
import { UnifiedTransporte } from '../../types';

export const PersonalModule: React.FC = () => {
  const { getUnifiedTransportes, updateMuelleAsignado, updateMuelleHora } = useLogisticsStore();
  const { currentUser, isAdmin } = useAuthStore();
  // Todos los módulos visualizan el muelle; solo el SUPERVISOR lo asigna y edita su hora.
  // Se valida con roleName y tipoUsuario (según el rol venga de la BD o del seed).
  const canModifyMuelle =
    currentUser?.roleName?.toUpperCase() === 'SUPERVISOR' ||
    currentUser?.tipoUsuario === 'supervisor' ||
    isAdmin();

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
        onAsignarMuelle={canModifyMuelle ? handleAsignarMuelle : undefined}
        onMuelleHora={canModifyMuelle ? handleMuelleHora : undefined}
      />
    </div>
  );
};
