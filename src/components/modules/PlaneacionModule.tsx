import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { TransportesTable } from './TransportesTable';
import { TransporteFormModal } from './TransporteFormModal';
import { ModuleToolbar } from '../common/ModuleToolbar';
import { useRowFilters } from '../../hooks/useRowFilters';
import { UnifiedTransporte, TransporteData } from '../../types';

export const PlaneacionModule: React.FC = () => {
  const { getUnifiedTransportes, addTransporte, updateTransporte, deleteTransporte } = useLogisticsStore();
  const { hasModuleEdit } = useAuthStore();
  const canEdit = hasModuleEdit('planeacion');

  const [editingRow, setEditingRow] = useState<UnifiedTransporte | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const unifiedRows = getUnifiedTransportes();
  const { searchTerm, setSearchTerm, dateFrom, setDateFrom, dateTo, setDateTo, filtered } = useRowFilters(unifiedRows, { keepActiveLlaves: true });

  const openCreate = () => {
    setEditingRow(null);
    setIsModalOpen(true);
  };

  const openEdit = (row: UnifiedTransporte) => {
    setEditingRow(row);
    setIsModalOpen(true);
  };

  const handleSave = async (data: TransporteData & { llave: string }) => {
    if (editingRow) {
      updateTransporte(editingRow.id, data);
    } else {
      await addTransporte(data);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (row: UnifiedTransporte) => {
    if (window.confirm(`¿Eliminar el transporte ${row.placa} (${row.llave})?`)) {
      deleteTransporte(row.id);
    }
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
      />

      <TransportesTable
        rows={filtered}
        showEdit={canEdit}
        showDelete={canEdit}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <TransporteFormModal
        open={isModalOpen}
        editingRow={editingRow}
        defaultLlave={`LL-${useLogisticsStore.getState().nextLlaveSeq}`}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
};
