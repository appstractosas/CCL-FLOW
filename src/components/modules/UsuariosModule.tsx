import React, { useState } from 'react';
import { UserPlus, Pencil, Trash2, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { UserRecord, UserType } from '../../types';
import { userTypeLabel } from '../../lib/moduleConfig';
import { UserFormModal } from '../rbac/UserFormModal';
import { ModuleToolbar } from '../common/ModuleToolbar';
import { useRowFilters } from '../../hooks/useRowFilters';

export const UsuariosModule: React.FC = () => {
  const { users, createUser, updateUser, deleteUser, isAdmin } = useAuthStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  const { searchTerm, setSearchTerm, filtered } = useRowFilters(users, {
    dateKey: 'createdAt',
    enableDate: false,
  });

  const handleOpenCreate = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (user: UserRecord) => {
    setEditingUser(user);
    setModalOpen(true);
  };

  const handleSave = async (data: { nombre: string; cedula: string; clave: string; tipoUsuario: UserType }) => {
    if (editingUser) {
      updateUser(editingUser.id, data);
    } else {
      await createUser(data);
    }
    setModalOpen(false);
  };

  const handleDelete = (user: UserRecord) => {
    if (window.confirm(`¿Eliminar el usuario ${user.nombre} (${user.cedula})?`)) {
      deleteUser(user.id);
    }
  };

  if (!isAdmin()) {
    return (
      <div className="bg-[#121726] rounded-2xl border border-zinc-800 p-8 text-center text-sm text-zinc-400">
        Solo el rol <strong className="text-white">ADMIN</strong> puede administrar usuarios.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ModuleToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nombre, cédula o tipo..."
        counter={`${filtered.length} de ${users.length} usuarios`}
        rightContent={
          <button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ NUEVO USUARIO</span>
          </button>
        }
      />

      <div className="bg-[#121726] rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-900/60 text-zinc-400 font-semibold uppercase tracking-wider border-b border-zinc-800">
                <th className="py-3 px-5">NOMBRE</th>
                <th className="py-3 px-4">CÉDULA</th>
                <th className="py-3 px-4">CLAVE</th>
                <th className="py-3 px-4">TIPO DE USUARIO</th>
                <th className="py-3 px-4">ROL</th>
                <th className="py-3 px-4 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    No se encontraron usuarios.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3 px-5 font-bold text-white whitespace-nowrap">{u.nombre}</td>
                    <td className="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap">{u.cedula}</td>
                    <td className="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap">{u.clave}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                          u.tipoUsuario === 'admin'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                        }`}
                      >
                        {userTypeLabel(u.tipoUsuario)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-300 whitespace-nowrap">{u.roleName}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-blue-400 hover:border-blue-500/40 transition-colors"
                          title="Editar usuario"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={u.tipoUsuario === 'admin'}
                          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={u.tipoUsuario === 'admin' ? 'El ADMIN no puede eliminarse' : 'Eliminar usuario'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="flex items-center space-x-1.5 text-[10px] text-zinc-500">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
        <span>Cada usuario toma los permisos configurados para su tipo de usuario en el módulo ROLES.</span>
      </p>

      <UserFormModal
        open={modalOpen}
        editingUser={editingUser}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
};
