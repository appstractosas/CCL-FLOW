import React, { useState } from 'react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CrudModule } from '../common/CrudModule';
import { TransporteFormModal } from './TransporteFormModal';
import { UnifiedTransporte, TransporteData } from '../../types';

export const TransportesModule: React.FC = () => {
  const { updateTransporte, transportes } = useLogisticsStore();
  const { hasModuleEdit } = useAuthStore();
  const canEdit = hasModuleEdit('transportes');

  const [editingRow, setEditingRow] = useState<UnifiedTransporte | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openEdit = (row: UnifiedTransporte) => {
    setEditingRow(row);
    setIsModalOpen(true);
  };

  const handleSave = async (data: TransporteData & { llave: string }) => {
    try {
      if (editingRow) {
        await updateTransporte(editingRow.id, data);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo guardar la placa.');
    }
  };

  return (
    <CrudModule
      searchPlaceholder="Buscar placa, llave, pedido o cliente..."
      tableProps={{
        showEdit: canEdit,
        showDelete: false,
        showCajas: true,
        showEstatus: true,
        onEdit: openEdit,
      }}
    >
      {editingRow && (
        <TransporteFormModal
          open={isModalOpen}
          editingRow={editingRow}
          defaultLlave={editingRow.llave}
          editPlacaOnly
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </CrudModule>
  );
};
