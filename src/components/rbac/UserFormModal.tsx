import React, { useEffect, useState } from 'react';
import { UserPlus, X, Shield, AlertTriangle } from 'lucide-react';
import { UserRecord, UserType } from '../../types';
import { USER_TYPES } from '../../lib/moduleConfig';

function validatePassword(p: string): string | null {
  if (p.length < 8) return 'Mínimo 8 caracteres.';
  if (!/[A-Z]/.test(p)) return 'Al menos 1 mayúscula.';
  if (!/[0-9]/.test(p)) return 'Al menos 1 número.';
  return null;
}

interface UserFormModalProps {
  open: boolean;
  editingUser: UserRecord | null;
  onClose: () => void;
  onSave: (data: { nombre: string; cedula: string; clave: string; tipoUsuario: UserType }) => void;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({
  open,
  editingUser,
  onClose,
  onSave,
}) => {
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [clave, setClave] = useState('');
  const [tipoUsuario, setTipoUsuario] = useState<UserType>('despachador');

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reseteo del formulario al abrir/editar
      setNombre(editingUser?.nombre || '');
      setCedula(editingUser?.cedula || '');
      setClave(editingUser?.clave || '');
      setTipoUsuario(editingUser?.tipoUsuario || 'despachador');
    }
  }, [open, editingUser]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !cedula.trim() || !clave.trim()) return;
    if (validatePassword(clave)) return;
    onSave({ nombre: nombre.trim(), cedula: cedula.trim(), clave, tipoUsuario });
  };

  const claveError = clave ? validatePassword(clave) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="bg-[#121726] rounded-2xl max-w-md w-full p-6 border border-zinc-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-500/20 text-indigo-400 p-2 rounded-xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {editingUser ? `Editar Usuario · ${editingUser.nombre}` : '+ Nuevo Usuario'}
            </h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">Nombre Completo *</label>
            <input
              type="text"
              required
              placeholder="Ej: Pedro Ramírez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">Cédula *</label>
            <input
              type="text"
              required
              placeholder="Número de cédula"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">Clave *</label>
            <input
              type="text"
              required
              placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              className={`w-full px-3 py-2 bg-zinc-900 border rounded-xl text-sm font-mono text-white focus:outline-none ${
                claveError ? 'border-rose-500/60 focus:border-rose-500' : 'border-zinc-700 focus:border-indigo-500'
              }`}
            />
            {claveError && (
              <p className="flex items-center space-x-1 text-[10px] text-rose-400 mt-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>{claveError}</span>
              </p>
            )}
            {!claveError && clave && (
              <p className="text-[10px] text-emerald-400 mt-1.5">✓ Contraseña válida</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">Tipo de Usuario *</label>
            <select
              value={tipoUsuario}
              onChange={(e) => setTipoUsuario(e.target.value as UserType)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none"
            >
              {USER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="flex items-center space-x-1 text-[10px] text-zinc-500 mt-1.5">
              <Shield className="w-3 h-3 text-amber-400" />
              <span>El permiso se toma de la matriz de Roles & Usuarios.</span>
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md"
            >
              {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
