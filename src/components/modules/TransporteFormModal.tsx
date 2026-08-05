import React, { useEffect, useState } from 'react';
import { Truck, X, CalendarClock } from 'lucide-react';
import { UnifiedTransporte, TipoVehiculo } from '../../types';
import { TransporteData } from '../../types';
import { DateTimePickerModal } from '../common/DateTimePickerModal';

interface TransporteFormModalProps {
  open: boolean;
  editingRow: UnifiedTransporte | null;
  defaultLlave: string;
  onClose: () => void;
  onSave: (data: TransporteData & { llave: string }) => void;
}

interface FormValues {
  vehiculoTipo: TipoVehiculo | '';
  llave: string;
  fechaHora: string;
  placa: string;
  transportadora: string;
}

function buildInitialForm(editingRow: UnifiedTransporte | null): FormValues {
  if (editingRow) {
    return {
      vehiculoTipo: editingRow.vehiculoTipo,
      llave: editingRow.llave,
      fechaHora: editingRow.fechaHora || '',
      placa: editingRow.placa,
      transportadora: editingRow.transportadora || '',
    };
  }
  return {
    vehiculoTipo: '',
    llave: '',
    fechaHora: '',
    placa: '',
    transportadora: '',
  };
}

export const TransporteFormModal: React.FC<TransporteFormModalProps> = ({
  open,
  editingRow,
  defaultLlave,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<FormValues>(() => buildInitialForm(editingRow));
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(buildInitialForm(editingRow));
      setPickerOpen(false);
    }
  }, [open, editingRow]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const llave = formData.llave.trim() || defaultLlave.trim();
    onSave({
      llave,
      placa: formData.placa,
      fechaHora: formData.fechaHora,
      citaCargue: formData.fechaHora,
      vehiculoTipo: formData.vehiculoTipo || undefined,
      transportadora: formData.transportadora,
    });
  };

  const inputCls =
    'w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#121726] rounded-2xl max-w-md w-full p-6 border border-zinc-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-500/20 text-blue-400 p-1.5 rounded-lg">
              <Truck className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">
              {editingRow ? `Editar Transporte ${editingRow.placa || editingRow.llave}` : '+ Nueva Llave'}
            </h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">LLAVE</label>
              <input
                type="text"
                placeholder={defaultLlave}
                value={formData.llave}
                onChange={(e) => setFormData({ ...formData, llave: e.target.value })}
                className={`${inputCls} font-mono uppercase`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Tipo Vehículo</label>
              <select
                value={formData.vehiculoTipo}
                onChange={(e) => setFormData({ ...formData, vehiculoTipo: e.target.value as TipoVehiculo | '' })}
                className={`${inputCls} ${formData.vehiculoTipo ? '' : 'text-zinc-500'}`}
              >
                <option value="">Seleccionar tipo</option>
                <option value="MINIMULA">MINIMULA</option>
                <option value="SENCILLO">SENCILLO</option>
                <option value="LUV">LUV</option>
                <option value="TURBO">TURBO</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Fecha y Hora</label>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs font-mono text-white focus:outline-none hover:border-blue-500/50"
              >
                <span className={formData.fechaHora ? 'text-white' : 'text-zinc-500'}>
                  {formData.fechaHora || 'Seleccionar fecha y hora'}
                </span>
                <CalendarClock className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Placa Remolque</label>
              <input
                type="text"
                placeholder="Opcional · Ej: TGB-512"
                value={formData.placa}
                onChange={(e) => setFormData({ ...formData, placa: e.target.value })}
                className={`${inputCls} font-mono uppercase`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">Transportadora</label>
            <input
              type="text"
              placeholder="Ej: TRANSPORTES ANDINA"
              value={formData.transportadora}
              onChange={(e) => setFormData({ ...formData, transportadora: e.target.value })}
              className={inputCls}
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md"
            >
              {editingRow ? 'Guardar Cambios' : 'Guardar Llave'}
            </button>
          </div>
        </form>
      </div>

      {pickerOpen && (
        <DateTimePickerModal
          initialValue={formData.fechaHora}
          onConfirm={(v) => {
            setFormData({ ...formData, fechaHora: v });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
};
