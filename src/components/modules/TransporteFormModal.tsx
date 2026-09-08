import React, { useEffect, useState } from 'react';
import { Truck, X, CalendarClock } from 'lucide-react';
import { UnifiedTransporte, TipoVehiculo } from '../../types';
import { TransporteData } from '../../types';
import { DateTimePickerModal } from '../common/DateTimePickerModal';
import { useCatalogosStore } from '../../store/useCatalogosStore';

interface TransporteFormModalProps {
  open: boolean;
  editingRow: UnifiedTransporte | null;
  defaultLlave: string;
  /** En edición solo se permite modificar la placa (resto de campos bloqueados). */
  editPlacaOnly?: boolean;
  onClose: () => void;
  onSave: (data: TransporteData & { llave: string }) => void;
}

interface FormValues {
  vehiculoTipo: TipoVehiculo | '';
  llave: string;
  fechaHora: string;
  placa: string;
  transportadora: string;
  transporte: string;
  denominacion: string;
  cajas: string;
  destino: string;
  region: string;
}

/** Convierte el texto del input a número (vacío/inválido → undefined). */
function numeroDe(valor: string): number | undefined {
  const t = valor.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function buildInitialForm(editingRow: UnifiedTransporte | null): FormValues {
  if (editingRow) {
    return {
      vehiculoTipo: editingRow.vehiculoTipo,
      llave: editingRow.llave,
      fechaHora: editingRow.fechaHora || '',
      placa: editingRow.placa,
      transportadora: editingRow.transportadora || '',
      transporte: editingRow.transporte || '',
      denominacion: editingRow.denominacion || '',
      cajas: editingRow.cajas != null ? String(editingRow.cajas) : '',
      destino: editingRow.destino || '',
      region: editingRow.region || '',
    };
  }
  return {
    vehiculoTipo: '',
    llave: '',
    fechaHora: '',
    placa: '',
    transportadora: '',
    transporte: '',
    denominacion: '',
    cajas: '',
    destino: '',
    region: '',
  };
}

export const TransporteFormModal: React.FC<TransporteFormModalProps> = ({
  open,
  editingRow,
  defaultLlave,
  editPlacaOnly = false,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<FormValues>(() => buildInitialForm(editingRow));
  const [pickerOpen, setPickerOpen] = useState(false);
  const { transportadoras, clientes, ciudades } = useCatalogosStore();

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reseteo del formulario al abrir/editar
      setFormData(buildInitialForm(editingRow));
      setPickerOpen(false);
    }
  }, [open, editingRow]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const llave = formData.llave.trim() || defaultLlave.trim();
    if (locked) {
      // Modo "solo placa": enviar únicamente la placa y la llave, sin reescribir
      // los campos bloqueados (evita pisar fecha_hora/cita_cargue con valores viejos).
      onSave({ llave, placa: formData.placa });
      return;
    }
    onSave({
      llave,
      placa: formData.placa,
      fechaHora: formData.fechaHora,
      citaCargue: formData.fechaHora,
      vehiculoTipo: formData.vehiculoTipo || undefined,
      transportadora: formData.transportadora,
      transporte: formData.transporte.trim() || undefined,
      denominacion: formData.denominacion.trim() || undefined,
      cajas: numeroDe(formData.cajas),
      destino: formData.destino.trim() || undefined,
      region: formData.region.trim() || undefined,
    });
  };

  const inputCls =
    'w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none';

  const lockedCls =
    'w-full px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-xl text-xs text-zinc-500 focus:outline-none';
  const locked = Boolean(editingRow && editPlacaOnly);

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
              {editingRow
                ? `Editar Transporte ${editingRow.placa || editingRow.llave}`
                : '+ Nueva Llave'}
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
                disabled={locked}
                onChange={(e) => setFormData({ ...formData, llave: e.target.value })}
                className={`${locked ? lockedCls : inputCls} font-mono uppercase`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Tipo Vehículo</label>
              <select
                value={formData.vehiculoTipo}
                disabled={locked}
                onChange={(e) =>
                  setFormData({ ...formData, vehiculoTipo: e.target.value as TipoVehiculo | '' })
                }
                className={`${locked ? lockedCls : inputCls} ${formData.vehiculoTipo ? '' : 'text-zinc-500'}`}
              >
                <option value="">Seleccionar tipo</option>
                <option value="MINIMULA">MINIMULA</option>
                <option value="SENCILLO">SENCILLO</option>
                <option value="LUV">LUV</option>
                <option value="TURBO">TURBO</option>
                <option value="MULA">MULA</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Fecha y Hora</label>
              <button
                type="button"
                disabled={locked}
                onClick={() => setPickerOpen(true)}
                className={`w-full flex items-center justify-between px-3 py-2 ${
                  locked
                    ? 'bg-zinc-900/50 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-500'
                    : 'bg-zinc-900 border border-zinc-700 rounded-xl text-xs font-mono text-white hover:border-blue-500/50'
                }`}
              >
                <span
                  className={
                    formData.fechaHora ? (locked ? 'text-zinc-500' : 'text-white') : 'text-zinc-500'
                  }
                >
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
            <select
              value={formData.transportadora}
              disabled={locked}
              onChange={(e) => setFormData({ ...formData, transportadora: e.target.value })}
              className={`${locked ? lockedCls : inputCls} ${formData.transportadora ? '' : 'text-zinc-500'}`}
            >
              <option value="">Seleccionar transportadora</option>
              {transportadoras.map((t) => (
                <option key={t.id} value={t.nombre}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Nº Pedido y Cliente se retiraron de la UI (no aportan al control de patios).
              Sus valores siguen viajando intactos en el submit para NO borrarlos de la BD. */}

          {/* Nº Pedido (transporte) y Cliente (denominación) ahora son visibles. */}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Denominación</label>
              <select
                value={formData.denominacion}
                disabled={locked}
                onChange={(e) => setFormData({ ...formData, denominacion: e.target.value })}
                className={`${locked ? lockedCls : inputCls} ${formData.denominacion ? '' : 'text-zinc-500'}`}
              >
                <option value="">Seleccionar cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.denominacion}>
                    {c.denominacion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Transporte</label>
              <input
                type="text"
                placeholder="Ej: 3000214899"
                value={formData.transporte}
                disabled={locked}
                onChange={(e) => setFormData({ ...formData, transporte: e.target.value })}
                className={`${locked ? lockedCls : inputCls} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Cajas</label>
              <input
                type="number"
                min={0}
                placeholder="Ej: 579"
                value={formData.cajas}
                disabled={locked}
                onChange={(e) => setFormData({ ...formData, cajas: e.target.value })}
                className={`${locked ? lockedCls : inputCls} font-mono text-right`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Destino</label>
              <select
                value={formData.destino}
                disabled={locked}
                onChange={(e) => {
                  const destino = e.target.value;
                  const ciudad = ciudades.find((c) => c.ciudad === destino);
                  setFormData({
                    ...formData,
                    destino,
                    region: ciudad?.region || formData.region,
                  });
                }}
                className={`${locked ? lockedCls : inputCls} ${formData.destino ? '' : 'text-zinc-500'}`}
              >
                <option value="">Seleccionar destino</option>
                {ciudades.map((c) => (
                  <option key={c.id} value={c.ciudad}>
                    {c.ciudad}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Región</label>
              <input
                type="text"
                value={formData.region}
                disabled
                className={lockedCls}
              />
            </div>
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
              {editingRow ? (locked ? 'Guardar Placa' : 'Guardar Cambios') : 'Guardar Llave'}
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
