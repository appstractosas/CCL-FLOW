import { EstadoPorteria, UnifiedTransporte } from '../types';

type PorteriaRow = Pick<
  UnifiedTransporte,
  | 'estadoPorteria'
  | 'horaLlegadaPorteria'
  | 'horaIngreso'
  | 'horaInicioCargue'
  | 'horaFinCargue'
  | 'horaSalida'
>;

function timeSet(value?: string): boolean {
  return value != null && value !== '' && value !== '--:--';
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
