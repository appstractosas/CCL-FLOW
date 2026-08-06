import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { TransportesTable } from './TransportesTable';
import { TransporteFormModal } from './TransporteFormModal';
import { ModuleToolbar } from '../common/ModuleToolbar';
import { useRowFilters } from '../../hooks/useRowFilters';
import { UnifiedTransporte, TransporteData } from '../../types';
import { getEstadoPorteria } from '../../utils/porteria';

export const PlaneacionModule: React.FC = () => {
  const { getUnifiedTransportes, addTransporte, updateTransporte, cancelTransporte } = useLogisticsStore();
  const { hasModuleEdit, isAdmin } = useAuthStore();
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
    try {
      if (editingRow) {
        updateTransporte(editingRow.id, data);
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

  // El PLANEADOR solo puede cancelar llaves que aún estén en PENDIENTE o CONFIRMADO;
  // en estados posteriores únicamente puede editarlas. El ADMIN cancela en cualquier estado.
  const canCancelLlave = (row: UnifiedTransporte) => {
    const estado = getEstadoPorteria(row);
    if (isAdmin()) return true;
    return estado === 'Pendiente' || estado === 'Confirmado';
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
        canCancel={canCancelLlave}
        onEdit={openEdit}
        onDelete={handleCancel}
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
