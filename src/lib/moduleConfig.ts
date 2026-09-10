import { AppModuleId, UserType } from '../types';

/** Etiqueta visible de cada módulo en la app. */
export const MODULE_LABELS: Record<AppModuleId, string> = {
  despachos: 'Despachos',
  planeacion: 'Planeación',
  transportes: 'Transportes',
  porteria: 'Portería',
  monitoreo: 'Monitoreo',
  personal: 'Supervisor',
  informes: 'Informes',
  admin_roles: 'Roles',
  usuarios: 'Usuarios',
  chat: 'Chat',
  tablero: 'Tablero',
};

export const ALL_MODULES: AppModuleId[] = [
  'despachos',
  'planeacion',
  'transportes',
  'porteria',
  'monitoreo',
  'personal',
  'informes',
  'admin_roles',
  'usuarios',
  'chat',
  'tablero',
];

/** Tipos de usuario operativos (columnas de la matriz de permisos). */
export const USER_TYPES: { value: UserType; label: string }[] = [
  { value: 'despachador', label: 'Despachador' },
  { value: 'portero', label: 'Portero' },
  { value: 'planeador', label: 'Planeador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'transportes', label: 'Transportes' },
  { value: 'tablero', label: 'Tablero' },
  { value: 'informes', label: 'Informes' },
];

/** Rol por tipo de usuario. */
export const ROLE_ID_BY_USER_TYPE: Record<UserType, string> = {
  admin: 'ROLE_ADMIN',
  despachador: 'ROLE_DESPACHADOR',
  portero: 'ROLE_PORTERO',
  planeador: 'ROLE_PLANEADOR',
  supervisor: 'ROLE_SUPERVISOR',
  monitor: 'ROLE_MONITOREO',
  transportes: 'ROLE_TRANSPORTES',
  tablero: 'ROLE_TABLERO',
  informes: 'ROLE_INFORMES',
};

export const ROLE_NAME_BY_USER_TYPE: Record<UserType, string> = {
  admin: 'ADMIN',
  despachador: 'DESPACHADOR',
  portero: 'PORTERO',
  planeador: 'PLANEADOR',
  supervisor: 'SUPERVISOR',
  monitor: 'MONITOREO',
  transportes: 'TRANSPORTES',
  tablero: 'TABLERO',
  informes: 'INFORMES',
};

export function userTypeLabel(tipo: UserType | string): string {
  const found = USER_TYPES.find((t) => t.value === tipo);
  if (found) return found.label;
  return tipo === 'admin' ? 'Administrador' : String(tipo);
}

export function moduleLabel(moduleId: AppModuleId | string): string {
  return MODULE_LABELS[moduleId as AppModuleId] || String(moduleId);
}
