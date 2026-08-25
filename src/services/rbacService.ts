import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Role, UserRecord, UserType, AppModuleId, PermissionsMap } from '../types';
import { ALL_MODULES, ROLE_ID_BY_USER_TYPE, ROLE_NAME_BY_USER_TYPE } from '../lib/moduleConfig';

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
    id: 'ROLE_ADMIN',
    name: 'ADMIN',
    description: 'Acceso total al sistema y gestión de roles, usuarios e historial.',
    isPreset: true,
    permissions: permissionsAll(ALL_MODULES),
  },
  {
    id: 'ROLE_DESPACHADOR',
    name: 'DESPACHADOR',
    description: 'Gestión de despachos y planeación.',
    isPreset: true,
    permissions: permissionsAll(
      ['despachos', 'planeacion', 'informes', 'monitoreo', 'tablero'],
      ['despachos', 'planeacion'],
    ),
  },
  {
    id: 'ROLE_PORTERO',
    name: 'PORTERO',
    description: 'Control de puerta, muelles y estados de portería.',
    isPreset: true,
    permissions: permissionsAll(
      ['porteria', 'despachos', 'planeacion', 'monitoreo', 'chat', 'tablero'],
      ['porteria'],
    ),
  },
  {
    id: 'ROLE_PLANEADOR',
    name: 'PLANEADOR',
    description: 'Planeación de transporte y vista de despachos.',
    isPreset: true,
    permissions: permissionsAll(
      ['planeacion', 'despachos', 'informes', 'monitoreo', 'tablero'],
      ['planeacion', 'despachos'],
    ),
  },
  {
    id: 'ROLE_SUPERVISOR',
    name: 'SUPERVISOR',
    description: 'Observación global de la operación e informes.',
    isPreset: true,
    permissions: permissionsAll([
      'despachos',
      'planeacion',
      'porteria',
      'monitoreo',
      'informes',
      'personal',
      'chat',
      'tablero',
    ]),
  },
  {
    id: 'ROLE_MONITOREO',
    name: 'MONITOREO',
    description: 'Monitoreo de la operación y registro de salida de portería.',
    isPreset: true,
    permissions: permissionsAll(
      ['monitoreo', 'despachos', 'planeacion', 'porteria', 'informes', 'tablero'],
      ['monitoreo'],
    ),
  },
  {
    id: 'ROLE_TRANSPORTES',
    name: 'TRANSPORTES',
    description: 'Registro y edición de placas de transportes.',
    isPreset: true,
    permissions: permissionsAll(['transportes', 'informes', 'tablero'], ['transportes']),
  },
  {
    id: 'ROLE_TABLERO',
    name: 'TABLERO',
    description: 'Consulta del tablero del aeropuerto (solo lectura).',
    isPreset: true,
    permissions: permissionsAll(['tablero'], []),
  },
  {
    id: 'ROLE_INFORMES',
    name: 'INFORMES',
    description: 'Consulta y exportación de informes (sin edición operativa).',
    isPreset: true,
    permissions: permissionsAll(['informes'], []),
  },
];

export const ROLE_ID_BY_TYPE: Record<UserType, string> = ROLE_ID_BY_USER_TYPE;
export const ROLE_NAME_BY_TYPE: Record<UserType, string> = ROLE_NAME_BY_USER_TYPE;

/** Usuarios semilla (offline / primer arranque). Claves: mínimo 8 chars, 1 mayúscula, 1 número. */
export const PRESET_USERS: UserRecord[] = [
  {
    id: 'USER_ADMIN',
    nombre: 'ADMIN',
    cedula: '0000000000',
    clave: 'Admin1234',
    tipoUsuario: 'admin',
    roleId: 'ROLE_ADMIN',
    roleName: 'ADMIN',
  },
  {
    id: 'USER_DESP',
    nombre: 'Juan Pérez',
    cedula: '1000000001',
    clave: 'Despa1234',
    tipoUsuario: 'despachador',
    roleId: 'ROLE_DESPACHADOR',
    roleName: 'DESPACHADOR',
  },
  {
    id: 'USER_PORTERO',
    nombre: 'Ramiro Torres',
    cedula: '1000000002',
    clave: 'Porte1234',
    tipoUsuario: 'portero',
    roleId: 'ROLE_PORTERO',
    roleName: 'PORTERO',
  },
  {
    id: 'USER_PLAN',
    nombre: 'Ana Gómez',
    cedula: '1000000003',
    clave: 'Plane1234',
    tipoUsuario: 'planeador',
    roleId: 'ROLE_PLANEADOR',
    roleName: 'PLANEADOR',
  },
  {
    id: 'USER_SUP',
    nombre: 'Luis Mora',
    cedula: '1000000004',
    clave: 'Super1234',
    tipoUsuario: 'supervisor',
    roleId: 'ROLE_SUPERVISOR',
    roleName: 'SUPERVISOR',
  },
  {
    id: 'USER_MONITOREO',
    nombre: 'Carlos Montero',
    cedula: '1000000005',
    clave: 'Monit1234',
    tipoUsuario: 'monitor',
    roleId: 'ROLE_MONITOREO',
    roleName: 'MONITOREO',
  },
  {
    id: 'USER_TRANSPORTES',
    nombre: 'Diana Ríos',
    cedula: '1000000006',
    clave: 'Trans1234',
    tipoUsuario: 'transportes',
    roleId: 'ROLE_TRANSPORTES',
    roleName: 'TRANSPORTES',
  },
];

/**
 * Retorna el roleId y roleName correspondientes a un tipo de usuario.
 * Mapea: admin → ROLE_ADMIN, portero → ROLE_PORTERO, etc.
 */
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

/** Obtiene todos los roles de la BD. Si la BD está vacía, retorna los roles predefinidos. */
export async function fetchRoles(): Promise<Role[]> {
  if (!isOnline()) return PRESET_ROLES;
  const { data, error } = await supabase
    .from(ROLES_TABLE)
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  const roles = (data || []).map(mapRoleFromDB);
  return roles.length > 0 ? roles : PRESET_ROLES;
}

/** Crea un rol nuevo via RPC `ccl_create_role`. */
export async function createRole(item: Role): Promise<Role> {
  const { data, error } = await supabase.rpc('ccl_create_role', { p_data: mapRoleToDB(item) });
  if (error) throw error;
  return mapRoleFromDB(data);
}

/** Actualiza nombre, descripción y permisos de un rol via RPC `ccl_update_role`. */
export async function updateRole(
  id: string,
  name: string,
  description: string,
  permissions: any,
): Promise<void> {
  const { error } = await supabase.rpc('ccl_update_role', {
    p_id: id,
    p_name: name,
    p_description: description,
    p_permissions: permissions,
  });
  if (error) throw error;
}

/** Elimina un rol via RPC `ccl_delete_role`. No se pueden eliminar roles predefinidos. */
export async function deleteRole(id: string): Promise<void> {
  const { error } = await supabase.rpc('ccl_delete_role', { p_id: id });
  if (error) throw error;
}

/** Obtiene todos los usuarios de la BD. Si está vacía, retorna los usuarios predefinidos. */
export async function fetchUsers(): Promise<UserRecord[]> {
  if (!isOnline()) return PRESET_USERS;
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('*')
    .order('nombre', { ascending: true });
  if (error) throw error;
  const users = (data || []).map(mapUserFromDB);
  return users.length > 0 ? users : PRESET_USERS;
}

/**
 * Crea un usuario via RPC `ccl_create_user`.
 * La contraseña se hashea server-side con bcrypt (pgcrypto).
 * Valida fortaleza: mínimo 8 caracteres, 1 mayúscula, 1 número.
 */
export async function createUser(item: UserRecord): Promise<UserRecord> {
  const { data, error } = await supabase.rpc('ccl_create_user', { p_data: mapUserToDB(item) });
  if (error) throw error;
  return mapUserFromDB(data);
}

/** Actualiza un usuario via RPC `ccl_update_user`. Si cambia la clave, se re-hashea con bcrypt. */
export async function updateUser(id: string, item: Partial<UserRecord>): Promise<void> {
  const dbUpdates: Record<string, any> = {};
  if (item.nombre !== undefined) dbUpdates.nombre = item.nombre;
  if (item.cedula !== undefined) dbUpdates.cedula = item.cedula;
  if (item.clave !== undefined) dbUpdates.clave = item.clave;
  if (item.tipoUsuario !== undefined) dbUpdates.tipo_usuario = item.tipoUsuario;
  if (item.roleId !== undefined) dbUpdates.role_id = item.roleId;
  if (item.roleName !== undefined) dbUpdates.role_name = item.roleName;
  const { error } = await supabase.rpc('ccl_update_user', { p_id: id, p_data: dbUpdates });
  if (error) throw error;
}

/** Elimina un usuario via RPC `ccl_delete_user`. */
export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.rpc('ccl_delete_user', { p_id: id });
  if (error) throw error;
}

/**
 * Inicializa roles y usuarios predefinidos en la BD si está vacía.
 * Se llama al arrancar la app (initialize). Las contraseñas se hashean con bcrypt.
 */
export async function seedInitialData(): Promise<boolean> {
  if (!isOnline()) return false;
  const { error } = await supabase.rpc('ccl_seed_initial_data');
  if (error) throw error;
  return true;
}
