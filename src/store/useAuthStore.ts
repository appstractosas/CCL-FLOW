import { create } from 'zustand';
import {
  Role, UserSession, UserRecord, AppModuleId, PermissionsMap,
  HistorialMovimiento, UserType,
} from '../types';
import {
  fetchRoles, updateRole, fetchUsers, createUser, updateUser as updateUserRemote,
  deleteUser as deleteUserRemote, seedInitialData, PRESET_ROLES, PRESET_USERS, roleForUserType,
} from '../services/rbacService';
import { fetchHistorial, createMovimiento } from '../services/historialService';
import { isSupabaseConfigured } from '../lib/supabase';
import { ALL_MODULES, userTypeLabel, moduleLabel } from '../lib/moduleConfig';

function permissionsAllTrue(): PermissionsMap {
  const map = {} as PermissionsMap;
  for (const mod of ALL_MODULES) {
    map[mod] = { canAccess: true, canEdit: true };
  }
  return map;
}

function buildSession(user: UserRecord): UserSession {
  return {
    id: user.id,
    name: user.nombre,
    cedula: user.cedula,
    tipoUsuario: user.tipoUsuario,
    roleId: user.roleId,
    roleName: user.roleName,
  };
}

interface AuthState {
  initialized: boolean;
  roles: Role[];
  users: UserRecord[];
  currentUser: UserSession | null;
  historial: HistorialMovimiento[];
  initialize: () => Promise<void>;
  login: (cedula: string, clave: string) => boolean;
  logout: () => void;
  addMovimiento: (accion: string, modulo: string, detalle?: string, llave?: string) => void;
  createUser: (data: { nombre: string; cedula: string; clave: string; tipoUsuario: UserType }) => Promise<UserRecord>;
  updateUser: (id: string, data: Partial<UserRecord>) => void;
  deleteUser: (id: string) => boolean;
  updateRolePermissions: (roleId: string, moduleId: AppModuleId, enabled: boolean) => void;
  hasModuleAccess: (moduleId: AppModuleId) => boolean;
  hasModuleEdit: (moduleId: AppModuleId) => boolean;
  getActiveRole: () => Role | undefined;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  initialized: false,
  roles: PRESET_ROLES,
  users: PRESET_USERS,
  currentUser: null,
  historial: [],

  initialize: async () => {
    if (get().initialized) return;
    if (!isSupabaseConfigured) {
      set({
        roles: PRESET_ROLES,
        users: PRESET_USERS,
        currentUser: get().currentUser ?? buildSession(PRESET_USERS[0]),
        initialized: true,
      });
      return;
    }

    try {
      await seedInitialData();

      const [roles, users, historial] = await Promise.all([
            fetchRoles(),
            fetchUsers(),
            fetchHistorial(),
          ]);

          const mergedRoles = roles.length > 0 ? roles : PRESET_ROLES;
          const mergedUsers = users.length > 0 ? users : PRESET_USERS;
          const adminUser = mergedUsers.find((u) => u.tipoUsuario === 'admin') || PRESET_USERS[0];

          set({
            roles: mergedRoles,
            users: mergedUsers,
            currentUser: get().currentUser ?? buildSession(adminUser),
            historial,
            initialized: true,
          });
        } catch (err) {
          console.error('Error loading auth data from Supabase:', err);
          set({
            roles: PRESET_ROLES,
            users: PRESET_USERS,
            currentUser: get().currentUser ?? buildSession(PRESET_USERS[0]),
            initialized: true,
          });
        }
      },

      addMovimiento: (accion, modulo, detalle, llave) => {
        const user = get().currentUser;
        if (!user) return;

        const mov: HistorialMovimiento = {
          id: `HIS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          usuario: user.name,
          tipoUsuario: user.tipoUsuario,
          cedula: user.cedula,
          accion,
          modulo,
          detalle,
          llaveRelacionada: llave,
          createdAt: new Date().toISOString(),
        };

        if (isSupabaseConfigured) {
          createMovimiento(mov).catch(console.error);
        }

        set((s) => ({ historial: [mov, ...s.historial].slice(0, 500) }));
      },

      login: (cedula, clave) => {
        const c = cedula.trim();
        const user = get().users.find((u) => u.cedula === c && u.clave === clave);
        if (!user) return false;

        set({ currentUser: buildSession(user) });
        get().addMovimiento('INICIO_SESION', 'seguridad', `Inicio de sesión de ${user.nombre} (${userTypeLabel(user.tipoUsuario)})`);
        return true;
      },

      logout: () => {
        const user = get().currentUser;
        if (user) {
          get().addMovimiento('CIERRE_SESION', 'seguridad', `Cierre de sesión de ${user.name}`);
        }
        set({ currentUser: null });
      },

      createUser: async (data) => {
        const existing = get().users.find((u) => u.cedula === data.cedula.trim());
        if (existing) throw new Error('La cédula ya está registrada');

        const { roleId, roleName } = roleForUserType(data.tipoUsuario);
        const newUser: UserRecord = {
          id: `USER_${Date.now()}`,
          nombre: data.nombre.trim(),
          cedula: data.cedula.trim(),
          clave: data.clave,
          tipoUsuario: data.tipoUsuario,
          roleId,
          roleName,
          createdAt: new Date().toISOString(),
        };

        if (isSupabaseConfigured) {
          try {
            await createUser(newUser);
          } catch (err) {
            console.error('Error saving user to Supabase:', err);
          }
        }

        set((s) => ({ users: [...s.users, newUser] }));
        get().addMovimiento('CREAR_USUARIO', 'usuarios', `Usuario ${newUser.nombre} (${userTypeLabel(newUser.tipoUsuario)})`);
        return newUser;
      },

      updateUser: (id, data) => {
        const target = get().users.find((u) => u.id === id);
        if (!target) return;

        let updated: UserRecord = { ...target, ...data };
        if (data.tipoUsuario) {
          const { roleId, roleName } = roleForUserType(data.tipoUsuario);
          updated = { ...updated, roleId, roleName };
        }

        if (isSupabaseConfigured) {
          updateUserRemote(id, {
            nombre: updated.nombre,
            cedula: updated.cedula,
            clave: updated.clave,
            tipoUsuario: updated.tipoUsuario,
            roleId: updated.roleId,
            roleName: updated.roleName,
          }).catch(console.error);
        }

        set((s) => ({
          users: s.users.map((u) => (u.id === id ? updated : u)),
        }));
        get().addMovimiento('EDITAR_USUARIO', 'usuarios', `Edición del usuario ${updated.nombre}`);

        if (get().currentUser?.id === id) {
          set({ currentUser: buildSession(updated) });
        }
      },

      deleteUser: (id) => {
        const target = get().users.find((u) => u.id === id);
        if (!target) return false;
        if (target.tipoUsuario === 'admin') return false;
        if (get().currentUser?.id === id) return false;

        if (isSupabaseConfigured) {
          deleteUserRemote(id).catch(console.error);
        }

        set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
        get().addMovimiento('ELIMINAR_USUARIO', 'usuarios', `Eliminación del usuario ${target.nombre}`);
        return true;
      },

      updateRolePermissions: (roleId, moduleId, enabled) => {
        const role = get().roles.find((r) => r.id === roleId);
        if (!role || role.id === 'ROLE_ADMIN') return;

        const permissions: PermissionsMap = {
          ...role.permissions,
          [moduleId]: { canAccess: enabled, canEdit: enabled },
        };

        if (isSupabaseConfigured) {
          updateRole(roleId, role.name, role.description, permissions).catch(console.error);
        }

        set((s) => ({
          roles: s.roles.map((r) => (r.id === roleId ? { ...r, permissions } : r)),
        }));
        get().addMovimiento(
          'ACTUALIZAR_PERMISOS',
          moduleId,
          `Rol ${role.name}: módulo ${moduleLabel(moduleId)} ${enabled ? 'activado' : 'desactivado'}`
        );
      },

      getActiveRole: () => {
        const { roles, currentUser } = get();
        if (!currentUser) return roles.find((r) => r.id === 'ROLE_ADMIN') || roles[0];
        return roles.find((r) => r.id === currentUser.roleId) || roles.find((r) => r.id === 'ROLE_ADMIN') || roles[0];
      },

      hasModuleAccess: (moduleId) => {
        const activeRole = get().getActiveRole();
        if (!activeRole) return false;
        return Boolean(activeRole.permissions[moduleId]?.canAccess);
      },

      hasModuleEdit: (moduleId) => {
        const activeRole = get().getActiveRole();
        if (!activeRole) return false;
        return Boolean(activeRole.permissions[moduleId]?.canEdit);
      },

      isAdmin: () => {
        return get().currentUser?.tipoUsuario === 'admin';
      },
}));
