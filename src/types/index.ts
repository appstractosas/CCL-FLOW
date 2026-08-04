export type AppModuleId = 
  | 'despachos' 
  | 'porteria'
  | 'monitoreo'
  | 'informes'
  | 'planeacion' 
  | 'personal'
  | 'admin_roles'
  | 'usuarios';

/** Tipos de usuario del sistema (mapean a un rol de la matriz de permisos). */
export type UserType = 'admin' | 'despachador' | 'portero' | 'planeador' | 'supervisor' | 'monitor';

export interface ModulePermission {
  canAccess: boolean;
  canEdit: boolean;
}

export type PermissionsMap = Record<AppModuleId, ModulePermission>;

export interface Role {
  id: string;
  name: string;
  description: string;
  isPreset: boolean;
  permissions: PermissionsMap;
}

export interface UserSession {
  id: string;
  name: string;
  cedula: string;
  tipoUsuario: UserType;
  roleId: string;
  roleName: string;
}

/** Registro de un usuario de la aplicación (tabla `users` en Supabase). */
export interface UserRecord {
  id: string;
  nombre: string;
  cedula: string;
  clave: string;
  tipoUsuario: UserType;
  roleId: string;
  roleName: string;
  createdAt?: string;
}

export type HistorialAccion =
  | 'INICIO_SESION'
  | 'CIERRE_SESION'
  | 'CREAR_USUARIO'
  | 'EDITAR_USUARIO'
  | 'ELIMINAR_USUARIO'
  | 'ACTUALIZAR_PERMISOS'
  | 'CREAR_TRANSPORTE'
  | 'EDITAR_TRANSPORTE'
  | 'ELIMINAR_TRANSPORTE'
  | 'CAMBIO_ESTADO_DESPACHO'
  | 'ACTUALIZAR_PORTERIA'
  | 'ASIGNAR_MUELLE'
  | 'OTRO';

/** Movimiento registrado por usuario (tabla `historial_movimientos` en Supabase). */
export interface HistorialMovimiento {
  id: string;
  usuario: string;
  tipoUsuario: UserType | string;
  cedula: string;
  accion: HistorialAccion | string;
  modulo: string;
  detalle?: string;
  llaveRelacionada?: string;
  createdAt: string;
}

/** Estado del módulo DESPACHOS (elegido al crear la llave). */
export type EstadoDespacho = 'ALISTADO' | 'DESPACHADO' | 'PTE ALISTAR';
/** Estado del flujo de PORTERÍA (columna ESTADO del modal principal de transportes). */
export type EstadoPorteria =
  | 'Pendiente'
  | 'LLEGO A PORTERIA'
  | 'INGRESO A MUELLE'
  | 'CARGANDO'
  | 'FINALIZO CARGUE'
  | 'SALIO DE PORTERIA';
export type EstadoTransporte = 'DESPACHADO' | 'ALISTADO' | 'PENDIENTE';
export type TipoVehiculo = 'SENCILLO' | 'TURBO' | 'MINIMULA' | 'LUV';

/** Campos de tiempo del control de portería (secuencia de registro de horas). */
export type PorteriaTimeField =
  | 'horaLlegadaPorteria'
  | 'horaIngreso'
  | 'horaInicioCargue'
  | 'horaFinCargue'
  | 'horaSalida';

/**
 * Registro único de la operación: una fila por vehículo/LLAVE.
 * Combinamos en una sola tabla los datos de TRANSPORTES, DESPACHOS y PORTERÍA.
 * Todos los roles leen y escriben sobre la misma fila.
 */
export interface UnifiedTransporte {
  id: string;
  llave: string;
  fechaHora: string;
  placa: string;
  numeroPedido: string;
  numeroPedido2?: string;
  numeroPedido3?: string;
  numeroPedido4?: string;
  vehiculoTipo: TipoVehiculo;
  denominacionCliente: string;
  destino: string;
  citaCargue: string;
  transportadora?: string;
  estadoTransporte: EstadoTransporte;
  estadoDespacho: EstadoDespacho;
  estadoPorteria: EstadoPorteria;
  muelleAsignado?: string;
  horaIngreso?: string;
  horaSalida?: string;
  horaLlegadaPorteria?: string;
  horaInicioCargue?: string;
  horaFinCargue?: string;
  observaciones?: string;
}

/** Datos de entrada para crear/editar un transporte (una fila por LLAVE). */
export interface TransporteData {
  placa?: string;
  fechaHora?: string;
  vehiculoTipo?: TipoVehiculo;
  denominacionCliente?: string;
  destino?: string;
  citaCargue?: string;
  transportadora?: string;
  numeroPedido?: string;
  numeroPedido2?: string;
  numeroPedido3?: string;
  numeroPedido4?: string;
  estado?: EstadoDespacho;
  estadoTransporte?: EstadoTransporte;
  muelleAsignado?: string;
  observaciones?: string;
}

export interface ChatMessage {
  id: string;
  senderRole: string;
  senderName: string;
  senderModule: 'Portería' | 'Despachos' | 'Planeación' | 'General';
  llaveRelacionada?: string;
  muelleSugerido?: string;
  content: string;
  timestamp: string;
  isRead?: boolean;
}

/** Cliente (tabla `clientes`): CODIGO SHIP-TO + DENOMINACION. */
export interface Cliente {
  id: string;
  codigoShipTo: number;
  denominacion: string;
}

/** Ciudad de Colombia (tabla `ciudades`). */
export interface Ciudad {
  id: string;
  ciudad: string;
}

export interface KPIStats {
  totalPedidos: number;
  cumplimientoSLA: number;
  tiempoMuertoHoras: number;
  cargasActivas: number;
}
