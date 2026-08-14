import React from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CrudModule } from '../common/CrudModule';
import { UnifiedTransporte, PorteriaTimeField } from '../../types';

export const PorteriaModule: React.FC = () => {
  const { updatePorteriaHora } = useLogisticsStore();
  const { hasModuleEdit } = useAuthStore();
  const canEditRole = hasModuleEdit('porteria');

  const handlePorteriaHora = (row: UnifiedTransporte, campo: PorteriaTimeField, hora: string) => {
    updatePorteriaHora(row.id, campo, hora);
  };

  return (
    <CrudModule
      searchPlaceholder="Buscar por LLAVE, placa o transportadora..."
      tableProps={{
        hideAcciones: true,
        checklistOwner: canEditRole ? 'porteria' : undefined,
        onPorteriaHora: canEditRole ? handlePorteriaHora : undefined,
      }}
    />
  );
};