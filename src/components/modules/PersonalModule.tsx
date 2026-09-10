import React from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CrudModule } from '../common/CrudModule';
import { UnifiedTransporte } from '../../types';

export const PersonalModule: React.FC = () => {
  const { updateMuelleAsignado, updateMuelleHora } = useLogisticsStore();
  const { currentUser, isAdmin } = useAuthStore();
  // Todos los módulos visualizan el muelle; solo el SUPERVISOR lo asigna y edita su hora.
  // Se valida con roleName y tipoUsuario (según el rol venga de la BD o del seed).
  const canModifyMuelle =
    currentUser?.roleName?.toUpperCase() === 'SUPERVISOR' ||
    currentUser?.tipoUsuario === 'supervisor' ||
    isAdmin();

  const handleAsignarMuelle = (row: UnifiedTransporte, muelle: string) => {
    updateMuelleAsignado(row.id, muelle);
  };

  const handleMuelleHora = (row: UnifiedTransporte, hora: string) => {
    updateMuelleHora(row.id, hora);
  };

  return (
    <CrudModule
      searchPlaceholder="Buscar placa, llave, pedido o cliente..."
      tableProps={{
        onAsignarMuelle: canModifyMuelle ? handleAsignarMuelle : undefined,
        onMuelleHora: canModifyMuelle ? handleMuelleHora : undefined,
        showCajas: true,
        showEstatus: true,
      }}
    />
  );
};
