import { AppModuleId, UserType } from '../types';

/** Etiqueta visible de cada módulo en la app. */
export const MODULE_LABELS: Record<AppModuleId, string> = {
  despachos: 'Despachos',
  planeacion: 'Planeación',
  transportes: 'Transportes',
  porteria: 'Portería',
  personal: 'Supervisor',
  informes: 'Informes',
  'informes-gerencia': 'Informes Gerencia',
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
  'personal',
  'informes',
  'informes-gerencia',
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
  { value: 'transportes', label: 'Transportes' },
  { value: 'tablero', label: 'Tablero' },
  { value: 'informes', label: 'Informes' },
  { value: 'informes_gerencia', label: 'Informes Gerencia' },
];

/** Rol por tipo de usuario. */
export const ROLE_ID_BY_USER_TYPE: Record<UserType, string> = {
  admin: 'ROLE_ADMIN',
  despachador: 'ROLE_DESPACHADOR',
  portero: 'ROLE_PORTERO',
  planeador: 'ROLE_PLANEADOR',
  supervisor: 'ROLE_SUPERVISOR',
  transportes: 'ROLE_TRANSPORTES',
  tablero: 'ROLE_TABLERO',
  informes: 'ROLE_INFORMES',
  informes_gerencia: 'ROLE_INFORMES_GERENCIA',
};

export const ROLE_NAME_BY_USER_TYPE: Record<UserType, string> = {
  admin: 'ADMIN',
  despachador: 'DESPACHADOR',
  portero: 'PORTERO',
  planeador: 'PLANEADOR',
  supervisor: 'SUPERVISOR',
  transportes: 'TRANSPORTES',
  tablero: 'TABLERO',
  informes: 'INFORMES',
  informes_gerencia: 'INFORMES GERENCIA',
};

export function userTypeLabel(tipo: UserType | string): string {
  const found = USER_TYPES.find((t) => t.value === tipo);
  if (found) return found.label;
  return tipo === 'admin' ? 'Administrador' : String(tipo);
}

export function moduleLabel(moduleId: AppModuleId | string): string {
  return MODULE_LABELS[moduleId as AppModuleId] || String(moduleId);
}
