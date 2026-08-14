import React from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CrudModule } from '../common/CrudModule';
import { UnifiedTransporte, PorteriaTimeField } from '../../types';

export const DespachosModule: React.FC = () => {
  const { updatePorteriaHora, updateCuadrilla } = useLogisticsStore();
  const { hasModuleEdit, currentUser, isAdmin } = useAuthStore();
  const canEditRole = hasModuleEdit('despachos');
  // Todos los módulos visualizan la cuadrilla; solo el DESPACHADOR (y el ADMIN) la modifican.
  const canModifyCuadrilla = currentUser?.roleName?.toUpperCase() === 'DESPACHADOR' || isAdmin();

  const handlePorteriaHora = (row: UnifiedTransporte, campo: PorteriaTimeField, hora: string) => {
    updatePorteriaHora(row.id, campo, hora);
  };

  const handleCuadrilla = (row: UnifiedTransporte, cuadrilla: string) => {
    updateCuadrilla(row.id, cuadrilla);
  };

  return (
    <CrudModule
      searchPlaceholder="Buscar placa, llave, pedido o cliente..."
      tableProps={{
        checklistOwner: canEditRole ? 'despachos' : undefined,
        showCajas: true,
        onPorteriaHora: canEditRole ? handlePorteriaHora : undefined,
        onCuadrilla: canModifyCuadrilla ? handleCuadrilla : undefined,
      }}
    />
  );
};