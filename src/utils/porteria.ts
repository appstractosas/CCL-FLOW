import { EstadoPorteria, UnifiedTransporte } from '../types';
import { timeSet, addDaysStr } from '../lib/dateUtils';

type PorteriaRow = Pick<
  UnifiedTransporte,
  | 'estadoPorteria'
  | 'horaLlegadaPorteria'
  | 'horaIngreso'
  | 'horaInicioCargue'
  | 'horaFinCargue'
  | 'horaSalida'
>;

/** Orden canónico de la columna ESTADO: Pendiente arriba, canceladas al final. */
export const ORDEN_ESTADOS: EstadoPorteria[] = [
  'Pendiente',
  'Confirmado',
  'LLEGO A PORTERIA',
  'INGRESO A MUELLE',
  'CARGANDO',
  'FINALIZO CARGUE',
  'SALIO DE PORTERIA',
  'CANCELADO',
];

/** Orden del Tablero: primero los que ya llegaron a portería/patio (arriba LLEGO A PORTERIA),
 *  luego PENDIENTE y CONFIRMADO abajo; cerradas al final. */
export const ORDEN_ESTADOS_TABLERO: EstadoPorteria[] = [
  'LLEGO A PORTERIA',
  'INGRESO A MUELLE',
  'CARGANDO',
  'FINALIZO CARGUE',
  'Pendiente',
  'Confirmado',
  'SALIO DE PORTERIA',
  'CANCELADO',
];

export function rankEstado(estado: EstadoPorteria, orden: EstadoPorteria[] = ORDEN_ESTADOS): number {
  const i = orden.indexOf(estado);
  return i === -1 ? orden.length : i;
}

function llaveNum(llave?: string): number {
  const n = parseInt(String(llave || '').replace('LL-', ''), 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/**
 * Ordena por estado de portería según el orden dado (por defecto el canónico:
 * Pendiente → Confirmado → LLEGO A PORTERIA → … → SALIO DE PORTERIA → CANCELADO)
 * con desempate estable por número de llave.
 * Es determinístico: la misma BD siempre produce el mismo orden, así las filas
 * no saltan de posición al refrescarse por tiempo real. El Tablero pasa su
 * propio orden (ORDEN_ESTADOS_TABLERO) sin afectar a los demás módulos.
 */
export function sortTransportesPorEstado<T extends PorteriaRow & { llave?: string }>(
  rows: T[],
  orden: EstadoPorteria[] = ORDEN_ESTADOS
): T[] {
  return [...rows].sort((a, b) => {
    const d = rankEstado(getEstadoPorteria(a), orden) - rankEstado(getEstadoPorteria(b), orden);
    if (d !== 0) return d;
    return llaveNum(a.llave) - llaveNum(b.llave) ||
      String(a.llave || '').localeCompare(String(b.llave || ''));
  });
}

/**
 * Estado de portería derivado de las horas registradas (secuencia):
 * Pendiente/Confirmado → LLEGO A PORTERIA → INGRESO A MUELLE → CARGANDO →
 * FINALIZO CARGUE → SALIO DE PORTERIA.
 * CANCELADO es persistido (vehículo cancelado) y se conserva tal cual.
 * Es la fuente de verdad de la columna ESTADO, así reacciona siempre
 * a las acciones de portería/despachos aunque la fila no tenga
 * `estado_porteria` persistido.
 */
export function getEstadoPorteria(row: PorteriaRow): EstadoPorteria {
  if (row.estadoPorteria === 'CANCELADO') return 'CANCELADO';
  if (timeSet(row.horaSalida)) return 'SALIO DE PORTERIA';
  if (timeSet(row.horaFinCargue)) return 'FINALIZO CARGUE';
  if (timeSet(row.horaInicioCargue)) return 'CARGANDO';
  if (timeSet(row.horaIngreso)) return 'INGRESO A MUELLE';
  if (timeSet(row.horaLlegadaPorteria)) return 'LLEGO A PORTERIA';
  return row.estadoPorteria === 'Confirmado' ? 'Confirmado' : 'Pendiente';
}

export function isLlaveCerrada(row: PorteriaRow): boolean {
  const estado = getEstadoPorteria(row);
  return estado === 'SALIO DE PORTERIA' || estado === 'CANCELADO';
}

/**
 * Los módulos PLANEACIÓN y TRANSPORTES solo pueden editar/cancelar llaves en
 * estado PENDIENTE o CONFIRMADO. En cuanto la llave pasa a LLEGO A PORTERIA
 * (o cualquier estado posterior) ya no se puede editar ni cancelar.
 */
export function puedeEditarOperacion(row: PorteriaRow): boolean {
  const estado = getEstadoPorteria(row);
  return estado === 'Pendiente' || estado === 'Confirmado';
}

/** Filtros de estado disponibles en los módulos de operación (mismo estilo INFORMES). */
export type FiltroEstadoId = 'todas' | 'activas' | 'finalizadas' | 'canceladas';

export const FILTROS_ESTADO: { id: FiltroEstadoId; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'activas', label: 'Activas' },
  { id: 'finalizadas', label: 'Finalizadas' },
  { id: 'canceladas', label: 'Canceladas' },
];

/** True si la fila pasa el filtro de estado seleccionado. */
export function cumpleFiltroEstado(row: PorteriaRow, filtro: FiltroEstadoId): boolean {
  const estado = getEstadoPorteria(row);
  switch (filtro) {
    case 'activas':
      return estado !== 'SALIO DE PORTERIA' && estado !== 'CANCELADO';
    case 'finalizadas':
      return estado === 'SALIO DE PORTERIA';
    case 'canceladas':
      return estado === 'CANCELADO';
    default:
      return true;
  }
}

/**
 * Regla de la vista ACTIVAS: estado NO cerrado (diferente de SALIO DE PORTERIA
 * y CANCELADO) con fecha programada (cita) hasta HOY + 1 día inclusive.
 * - Pasado (cualquier día anterior a hoy): incluido automáticamente.
 * - Hoy y mañana: incluidos.
 * - Pasado mañana (HOY + 2) en adelante: EXCLUIDO, sin importar el estado.
 * - Sin fecha programada (cita_cargue vacío): EXCLUIDA.
 * El rango manual del toolbar de fechas NO limita esta vista: la regla define
 * su propia ventana.
 */
export function cumpleFiltroActivas(row: PorteriaRow & { citaCargue?: string }): boolean {
  if (!cumpleFiltroEstado(row, 'activas')) return false;
  const dia = String(row.citaCargue || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  return dia <= addDaysStr(1);
}
