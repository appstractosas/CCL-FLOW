import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Role, UserRecord, UserType, AppModuleId, PermissionsMap } from '../types';
import {
  ALL_MODULES,
  ROLE_ID_BY_USER_TYPE,
  ROLE_NAME_BY_USER_TYPE,
} from '../lib/moduleConfig';

const ROLES_TABLE = 'roles';
const USERS_TABLE = 'users';

function permissionsAll(active: AppModuleId[], editable: AppModuleId[] = active): PermissionsMap {
  const map = {} as PermissionsMap;
  for (const mod of ALL_MODULES) {
    const canAccess = active.includes(mod);
    const canEdit = editable.includes(mod);
    map[mod] = { canAccess, canEdit };
  }
  return map;
}

/** Roles predefinidos del sistema (ADMIN siempre tiene todo; los 4 roles operativos son editables desde la matriz). */
export const PRESET_ROLES: Role[] = [
  {
    id: 'ROLE_ADMIN', name: 'ADMIN', description: 'Acceso total al sistema y gestión de roles, usuarios e historial.', isPreset: true,
    permissions: permissionsAll(ALL_MODULES),
  },
  {
    id: 'ROLE_DESPACHADOR', name: 'DESPACHADOR', description: 'Gestión de despachos y planeación.', isPreset: true,
    permissions: permissionsAll(['despachos', 'planeacion', 'informes', 'monitoreo'], ['despachos', 'planeacion']),
  },
  {
    id: 'ROLE_PORTERO', name: 'PORTERO', description: 'Control de puerta, muelles y estados de portería.', isPreset: true,
    permissions: permissionsAll(['porteria', 'despachos', 'planeacion', 'monitoreo', 'chat'], ['porteria']),
  },
  {
    id: 'ROLE_PLANEADOR', name: 'PLANEADOR', description: 'Planeación de transporte y vista de despachos.', isPreset: true,
    permissions: permissionsAll(['planeacion', 'despachos', 'informes', 'monitoreo'], ['planeacion', 'despachos']),
  },
  {
    id: 'ROLE_SUPERVISOR', name: 'SUPERVISOR', description: 'Observación global de la operación e informes.', isPreset: true,
    permissions: permissionsAll(['despachos', 'planeacion', 'porteria', 'monitoreo', 'informes', 'personal', 'chat']),
  },
  {
    id: 'ROLE_MONITOREO', name: 'MONITOREO', description: 'Monitoreo de la operación y registro de salida de portería.', isPreset: true,
    permissions: permissionsAll(['monitoreo', 'despachos', 'planeacion', 'porteria', 'informes'], ['monitoreo']),
  },
];

export const ROLE_ID_BY_TYPE: Record<UserType, string> = ROLE_ID_BY_USER_TYPE;
export const ROLE_NAME_BY_TYPE: Record<UserType, string> = ROLE_NAME_BY_USER_TYPE;

/** Usuarios semilla (offline / primer arranque). La clave por defecto del ADMIN es "admin". */
export const PRESET_USERS: UserRecord[] = [
  { id: 'USER_ADMIN', nombre: 'ADMIN', cedula: '0000000000', clave: 'admin', tipoUsuario: 'admin', roleId: 'ROLE_ADMIN', roleName: 'ADMIN' },
  { id: 'USER_DESP', nombre: 'Juan Pérez', cedula: '1000000001', clave: '1234', tipoUsuario: 'despachador', roleId: 'ROLE_DESPACHADOR', roleName: 'DESPACHADOR' },
  { id: 'USER_PORTERO', nombre: 'Ramiro Torres', cedula: '1000000002', clave: '1234', tipoUsuario: 'portero', roleId: 'ROLE_PORTERO', roleName: 'PORTERO' },
  { id: 'USER_PLAN', nombre: 'Ana Gómez', cedula: '1000000003', clave: '1234', tipoUsuario: 'planeador', roleId: 'ROLE_PLANEADOR', roleName: 'PLANEADOR' },
  { id: 'USER_SUP', nombre: 'Luis Mora', cedula: '1000000004', clave: '1234', tipoUsuario: 'supervisor', roleId: 'ROLE_SUPERVISOR', roleName: 'SUPERVISOR' },
  { id: 'USER_MONITOREO', nombre: 'Carlos Montero', cedula: '1000000005', clave: '1234', tipoUsuario: 'monitor', roleId: 'ROLE_MONITOREO', roleName: 'MONITOREO' },
];

export function roleForUserType(tipo: UserType): { roleId: string; roleName: string } {
  return { roleId: ROLE_ID_BY_USER_TYPE[tipo], roleName: ROLE_NAME_BY_USER_TYPE[tipo] };
}

function mapRoleToDB(item: Role): Record<string, any> {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    is_preset: item.isPreset,
    permissions: item.permissions,
  };
}

function mapRoleFromDB(item: Record<string, any>): Role {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    isPreset: item.is_preset,
    permissions: item.permissions,
  };
}

function mapUserToDB(item: UserRecord): Record<string, any> {
  const db: Record<string, any> = {
    id: item.id,
    nombre: item.nombre,
    cedula: item.cedula,
    clave: item.clave,
    tipo_usuario: item.tipoUsuario,
    role_id: item.roleId,
    role_name: item.roleName,
  };
  if (item.createdAt) db.created_at = item.createdAt;
  return db;
}

function mapUserFromDB(item: Record<string, any>): UserRecord {
  return {
    id: item.id,
    nombre: item.nombre,
    cedula: item.cedula,
    clave: item.clave,
    tipoUsuario: item.tipo_usuario,
    roleId: item.role_id,
    roleName: item.role_name,
    createdAt: item.created_at || undefined,
  };
}

function isOnline(): boolean {
  return isSupabaseConfigured;
}

export async function fetchRoles(): Promise<Role[]> {
  if (!isOnline()) return PRESET_ROLES;
  const { data, error } = await supabase.from(ROLES_TABLE).select('*').order('name', { ascending: true });
  if (error) throw error;
  const roles = (data || []).map(mapRoleFromDB);
  return roles.length > 0 ? roles : PRESET_ROLES;
}

export async function createRole(item: Role): Promise<Role> {
  const { data, error } = await supabase.from(ROLES_TABLE).insert(mapRoleToDB(item)).select().single();
  if (error) throw error;
  return mapRoleFromDB(data);
}

export async function updateRole(id: string, name: string, description: string, permissions: any): Promise<void> {
  const { error } = await supabase.from(ROLES_TABLE).update({ name, description, permissions }).eq('id', id);
  if (error) throw error;
}

export async function deleteRole(id: string): Promise<void> {
  const { error } = await supabase.from(ROLES_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function fetchUsers(): Promise<UserRecord[]> {
  if (!isOnline()) return PRESET_USERS;
  const { data, error } = await supabase.from(USERS_TABLE).select('*').order('nombre', { ascending: true });
  if (error) throw error;
  const users = (data || []).map(mapUserFromDB);
  return users.length > 0 ? users : PRESET_USERS;
}

export async function createUser(item: UserRecord): Promise<UserRecord> {
  const { data, error } = await supabase.from(USERS_TABLE).insert(mapUserToDB(item)).select().single();
  if (error) throw error;
  return mapUserFromDB(data);
}

export async function updateUser(id: string, item: Partial<UserRecord>): Promise<void> {
  const dbUpdates: Record<string, any> = {};
  if (item.nombre !== undefined) dbUpdates.nombre = item.nombre;
  if (item.cedula !== undefined) dbUpdates.cedula = item.cedula;
  if (item.clave !== undefined) dbUpdates.clave = item.clave;
  if (item.tipoUsuario !== undefined) dbUpdates.tipo_usuario = item.tipoUsuario;
  if (item.roleId !== undefined) dbUpdates.role_id = item.roleId;
  if (item.roleName !== undefined) dbUpdates.role_name = item.roleName;
  const { error } = await supabase.from(USERS_TABLE).update(dbUpdates).eq('id', id);
  if (error) throw error;
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.from(USERS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function seedInitialData(): Promise<boolean> {
  if (!isOnline()) return false;

  const { count: roleCount, error: roleErr } = await supabase.from(ROLES_TABLE).select('*', { count: 'exact', head: true });
  if (roleErr) throw roleErr;

  if (!roleCount || roleCount === 0) {
    const { error: insertRoleErr } = await supabase.from(ROLES_TABLE).insert(PRESET_ROLES.map(mapRoleToDB));
    if (insertRoleErr) throw insertRoleErr;
  }

  const { count: userCount, error: userErr } = await supabase.from(USERS_TABLE).select('*', { count: 'exact', head: true });
  if (userErr) throw userErr;

  if (!userCount || userCount === 0) {
    const { error: insertUserErr } = await supabase.from(USERS_TABLE).insert(PRESET_USERS.map(mapUserToDB));
    if (insertUserErr) throw insertUserErr;
  }

  return true;
}
