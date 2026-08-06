import React from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { TransportesTable } from './TransportesTable';
import { ModuleToolbar } from '../common/ModuleToolbar';
import { useRowFilters } from '../../hooks/useRowFilters';
import { UnifiedTransporte, PorteriaTimeField } from '../../types';

export const DespachosModule: React.FC = () => {
  const { getUnifiedTransportes, updatePorteriaHora, updateCuadrilla } = useLogisticsStore();
  const { hasModuleEdit, currentUser, isAdmin } = useAuthStore();
  const canEditRole = hasModuleEdit('despachos');
  // Todos los módulos visualizan la cuadrilla; solo el DESPACHADOR (y el ADMIN) la modifican.
  const canModifyCuadrilla = currentUser?.roleName?.toUpperCase() === 'DESPACHADOR' || isAdmin();

  const unifiedRows = getUnifiedTransportes();

  const { searchTerm, setSearchTerm, dateFrom, setDateFrom, dateTo, setDateTo, filtered } = useRowFilters(unifiedRows, { keepActiveLlaves: true });

  const handlePorteriaHora = (row: UnifiedTransporte, campo: PorteriaTimeField, hora: string) => {
    updatePorteriaHora(row.id, campo, hora);
  };

  const handleCuadrilla = (row: UnifiedTransporte, cuadrilla: string) => {
    updateCuadrilla(row.id, cuadrilla);
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
        checklistOwner={canEditRole ? 'despachos' : undefined}
        onPorteriaHora={canEditRole ? handlePorteriaHora : undefined}
        onCuadrilla={canModifyCuadrilla ? handleCuadrilla : undefined}
      />
    </div>
  );
};
