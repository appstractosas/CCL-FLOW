import React from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CrudModule } from '../common/CrudModule';
import { UnifiedTransporte, PorteriaTimeField } from '../../types';

export const MonitoreoModule: React.FC = () => {
  const { updatePorteriaHora, transportes } = useLogisticsStore();
  const { hasModuleEdit } = useAuthStore();
  const canEditRole = hasModuleEdit('monitoreo');

  const handlePorteriaHora = (row: UnifiedTransporte, campo: PorteriaTimeField, hora: string) => {
    updatePorteriaHora(row.id, campo, hora);
  };

  return (
    <CrudModule
      searchPlaceholder="Buscar por LLAVE, placa o transportadora..."
      tableProps={{
        hideAcciones: true,
        checklistOwner: canEditRole ? 'monitoreo' : undefined,
        onPorteriaHora: canEditRole ? handlePorteriaHora : undefined,

      }}
    />
  );
};