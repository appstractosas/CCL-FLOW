export type AppModuleId = 
  | 'despachos' 
  | 'porteria'
  | 'monitoreo'
  | 'informes'
  | 'planeacion' 
  | 'transportes'
  | 'personal'
  | 'admin_roles'
  | 'usuarios'
  | 'chat'
  | 'tablero';

/** Tipos de usuario del sistema (mapean a un rol de la matriz de permisos). */
export type UserType = 'admin' | 'despachador' | 'portero' | 'planeador' | 'supervisor' | 'monitor' | 'transportes' | 'tablero' | 'informes';

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
  | 'CANCELAR_TRANSPORTE'
  | 'ACTUALIZAR_PORTERIA'
  | 'ASIGNAR_MUELLE'
  | 'ASIGNAR_CUADRILLA'
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

/** Estado del flujo de PORTERÍA (columna ESTADO del modal principal de transportes). */
export type EstadoPorteria =
  | 'Pendiente'
  | 'Confirmado'
  | 'LLEGO A PORTERIA'
  | 'INGRESO A MUELLE'
  | 'CARGANDO'
  | 'FINALIZO CARGUE'
  | 'SALIO DE PORTERIA'
  | 'CANCELADO';
export type EstadoTransporte = 'DESPACHADO' | 'ALISTADO' | 'PENDIENTE';
export type TipoVehiculo = 'SENCILLO' | 'TURBO' | 'MINIMULA' | 'LUV' | 'MULA';

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
  vehiculoTipo: TipoVehiculo;
  citaCargue: string;
  /** Número de pedido (no es placa ni vehículo). Alimenta el módulo de informes. */
  transporte?: string;
  /** Nombre del cliente (denominación). Alimenta el módulo de informes. */
  denominacion?: string;
  /** Cantidad de cajas del pedido. Alimenta el módulo de informes. */
  cajas?: number;
  /** Ciudad/lugar de destino del pedido (viene del Excel o se captura en la app). */
  destino?: string;
  /** Región del pedido (columna Region del Excel / region en la BD). */
  region?: string;
  /** Peso del pedido en kilogramos (lo escribe la app, no el sync). */
  kg?: number;
  transportadora?: string;
  estadoTransporte: EstadoTransporte;
  estadoPorteria: EstadoPorteria;
  muelleAsignado?: string;
  cuadrilla?: string;
  horaMuelleAsignado?: string;
  horaIngreso?: string;
  horaSalida?: string;
  horaLlegadaPorteria?: string;
  horaInicioCargue?: string;
  horaFinCargue?: string;
  observaciones?: string;
  createdAt?: string;
}

/** Datos de entrada para crear/editar un transporte (una fila por LLAVE). */
export interface TransporteData {
  placa?: string;
  fechaHora?: string;
  vehiculoTipo?: TipoVehiculo;
  citaCargue?: string;
  transportadora?: string;
  /** Número de pedido (no es placa ni vehículo). Un transporte no puede pertenecer a dos llaves. */
  transporte?: string;
  /** Nombre del cliente (denominación). */
  denominacion?: string;
  estadoTransporte?: EstadoTransporte;
  muelleAsignado?: string;
  cuadrilla?: string;
  cajas?: number;
  destino?: string;
  region?: string;
  kg?: number;
  horaMuelleAsignado?: string;
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

/** Tipo de notificación in-app (tabla `notificaciones` en Supabase). */
export type TipoNotificacion = 'LLEGO_PORTERIA' | 'MUELLE_ASIGNADO';

/** Notificación de la operación visible para todos los usuarios (broadcast). */
export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  llaveRelacionada?: string;
  leida: boolean;
  createdAt: string;
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
