import React from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CrudModule } from '../common/CrudModule';
import { UnifiedTransporte, EstadoTransporte } from '../../types';

export const PersonalModule: React.FC = () => {
  const {
    updateMuelleAsignado,
    updateMuelleHora,
    updateEstadoTransporte,
    updateObservaciones,
  } = useLogisticsStore();
  const { currentUser, isAdmin } = useAuthStore();
  // Todos los módulos visualizan el muelle; solo el SUPERVISOR lo asigna, cambia
  // el ESTATUS y edita observaciones. Se valida con roleName y tipoUsuario
  // (según el rol venga de la BD o del seed).
  const isSupervisor =
    currentUser?.roleName?.toUpperCase() === 'SUPERVISOR' ||
    currentUser?.tipoUsuario === 'supervisor' ||
    isAdmin();

  const handleAsignarMuelle = (row: UnifiedTransporte, muelle: string) => {
    updateMuelleAsignado(row.id, muelle);
  };

  const handleMuelleHora = (row: UnifiedTransporte, hora: string) => {
    updateMuelleHora(row.id, hora);
  };

  const handleEstatus = (row: UnifiedTransporte, estado: EstadoTransporte | null) => {
    void updateEstadoTransporte(row.id, estado);
  };

  const handleObservaciones = (row: UnifiedTransporte, texto: string) => {
    void updateObservaciones(row.id, texto, 'personal');
  };

  return (
    <CrudModule
      searchPlaceholder="Buscar placa, llave, pedido o cliente..."
      tableProps={{
        onAsignarMuelle: isSupervisor ? handleAsignarMuelle : undefined,
        onMuelleHora: isSupervisor ? handleMuelleHora : undefined,
        onEstatusChange: isSupervisor ? handleEstatus : undefined,
        onObservaciones: isSupervisor ? handleObservaciones : undefined,
        showCajas: true,
        showEstatus: true,
      }}
    />
  );
};
