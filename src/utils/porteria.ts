import { EstadoPorteria, UnifiedTransporte } from '../types';

type PorteriaRow = Pick<UnifiedTransporte, 'horaLlegadaPorteria' | 'horaIngreso' | 'horaInicioCargue' | 'horaFinCargue' | 'horaSalida'>;

function timeSet(value?: string): boolean {
  return value != null && value !== '' && value !== '--:--';
}

/**
 * Estado de portería derivado de las horas registradas (secuencia):
 * Pendiente → LLEGO A PORTERIA → INGRESO A MUELLE → CARGANDO →
 * FINALIZO CARGUE → SALIO DE PORTERIA.
 * Es la fuente de verdad de la columna ESTADO, así reacciona siempre
 * a las acciones de portería/despachos aunque la fila no tenga
 * `estado_porteria` persistido.
 */
export function getEstadoPorteria(row: PorteriaRow): EstadoPorteria {
  if (timeSet(row.horaSalida)) return 'SALIO DE PORTERIA';
  if (timeSet(row.horaFinCargue)) return 'FINALIZO CARGUE';
  if (timeSet(row.horaInicioCargue)) return 'CARGANDO';
  if (timeSet(row.horaIngreso)) return 'INGRESO A MUELLE';
  if (timeSet(row.horaLlegadaPorteria)) return 'LLEGO A PORTERIA';
  return 'Pendiente';
}

export function isLlaveCerrada(row: PorteriaRow): boolean {
  return getEstadoPorteria(row) === 'SALIO DE PORTERIA';
}
