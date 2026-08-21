import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CrudModule } from '../common/CrudModule';
import { TransporteFormModal } from './TransporteFormModal';
import { UnifiedTransporte, TransporteData } from '../../types';
import { puedeEditarOperacion } from '../../utils/porteria';

export const PlaneacionModule: React.FC = () => {
  const { addTransporte, updateTransporte, cancelTransporte } = useLogisticsStore();
  const { hasModuleEdit } = useAuthStore();
  const canEdit = hasModuleEdit('planeacion');

  const [editingRow, setEditingRow] = useState<UnifiedTransporte | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openCreate = () => {
    setEditingRow(null);
    setIsModalOpen(true);
  };

  const openEdit = (row: UnifiedTransporte) => {
    setEditingRow(row);
    setIsModalOpen(true);
  };

  const handleSave = async (data: TransporteData & { llave: string }) => {
    try {
      if (editingRow) {
        await updateTransporte(editingRow.id, data);
      } else {
        await addTransporte(data);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo guardar la llave.');
    }
  };

  const handleCancel = (row: UnifiedTransporte) => {
    if (window.confirm(`¿Cancelar el transporte ${row.placa || 'SIN PLACA'} (${row.llave})? No se elimina: quedará con estado CANCELADO.`)) {
      cancelTransporte(row.id);
    }
  };

  // Los módulos PLANEACIÓN y TRANSPORTES solo pueden cancelar llaves en estado
  // PENDIENTE o CONFIRMADO. En cuanto la llave pasa a LLEGO A PORTERIA (o un
  // estado posterior) ya no se puede cancelar, para ningún rol (incluido ADMIN).
  const canCancelLlave = (row: UnifiedTransporte) => puedeEditarOperacion(row);

  return (
    <CrudModule
      searchPlaceholder="Buscar placa, llave, pedido o cliente..."
      tableProps={{
        showEdit: canEdit,
        showDelete: canEdit,
        showCajas: true,
        showEstatus: true,
        canCancel: canCancelLlave,
        onEdit: openEdit,
        onDelete: handleCancel,
      }}
      rightContent={
        canEdit ? (
          <button
            onClick={openCreate}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>NUEVA LLAVE</span>
          </button>
        ) : undefined
      }
    >
      <TransporteFormModal
        open={isModalOpen}
        editingRow={editingRow}
        defaultLlave={`LL-${useLogisticsStore.getState().nextLlaveSeq}`}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </CrudModule>
  );
};