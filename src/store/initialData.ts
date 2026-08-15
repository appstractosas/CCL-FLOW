import { UnifiedTransporte, ChatMessage, Cliente, Ciudad } from '../types';
import { INITIAL_CIUDADES } from '../data/ciudades';

function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateTimeStr(offsetDays = 0, hour = 8, minute = 0) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${dateStr(offsetDays)} ${hh}:${mm}`;
}

export const initialTransportes: UnifiedTransporte[] = [
  { id: 'TR-1', llave: 'LL-60533', fechaHora: dateTimeStr(0, 8, 30), placa: 'TLX-842', vehiculoTipo: 'TURBO', citaCargue: dateTimeStr(0, 7, 0), transportadora: 'TRANSPORTES ANDINA', estadoTransporte: 'DESPACHADO', estadoPorteria: 'SALIO DE PORTERIA', muelleAsignado: 'Muelle 4', cuadrilla: 'CCL', horaMuelleAsignado: dateTimeStr(0, 7, 38), horaLlegadaPorteria: dateTimeStr(0, 7, 40), horaIngreso: dateTimeStr(0, 7, 45), horaSalida: dateTimeStr(0, 8, 40), horaInicioCargue: dateTimeStr(0, 8, 0), horaFinCargue: dateTimeStr(0, 8, 35), observaciones: 'Carga prioritaria refrigerada para Neiva' },
  { id: 'TR-2', llave: 'LL-60534', fechaHora: dateTimeStr(0, 9, 15), placa: 'WNK-591', vehiculoTipo: 'MINIMULA', citaCargue: dateTimeStr(0, 8, 30), transportadora: 'LOGÍSTICA DEL HUILA', estadoTransporte: 'ALISTADO', estadoPorteria: 'CARGANDO', muelleAsignado: 'Muelle 1', cuadrilla: 'LTSA (Éxito)', horaMuelleAsignado: dateTimeStr(0, 8, 4), horaLlegadaPorteria: dateTimeStr(0, 8, 5), horaIngreso: dateTimeStr(0, 8, 10), horaSalida: '--:--', horaInicioCargue: dateTimeStr(0, 8, 45), horaFinCargue: '--:--', observaciones: 'Esperando pase de seguridad de Despachos' },
  { id: 'TR-3', llave: 'LL-60535', fechaHora: dateTimeStr(0, 9, 45), placa: 'KLR-104', vehiculoTipo: 'SENCILLO', citaCargue: dateTimeStr(0, 9, 0), transportadora: 'RED TRACK S.A.', estadoTransporte: 'DESPACHADO', estadoPorteria: 'SALIO DE PORTERIA', muelleAsignado: 'Muelle 2', cuadrilla: 'SLA', horaMuelleAsignado: dateTimeStr(0, 8, 44), horaLlegadaPorteria: dateTimeStr(0, 8, 45), horaIngreso: dateTimeStr(0, 8, 50), horaSalida: dateTimeStr(0, 9, 30), horaInicioCargue: dateTimeStr(0, 9, 10), horaFinCargue: dateTimeStr(0, 9, 25), observaciones: 'Cargue finalizado sin novedades' },
  { id: 'TR-4', llave: 'LL-60536', fechaHora: dateTimeStr(0, 10, 0), placa: 'SSZ-332', vehiculoTipo: 'LUV', citaCargue: dateTimeStr(0, 10, 15), transportadora: 'CARGA EXPRESA', estadoTransporte: 'PENDIENTE', estadoPorteria: 'Confirmado', muelleAsignado: 'Muelle 5', horaLlegadaPorteria: '--:--', horaIngreso: '--:--', horaSalida: '--:--', horaInicioCargue: '--:--', horaFinCargue: '--:--', observaciones: 'Programado para hoy en la tarde' },
  { id: 'TR-5', llave: 'LL-60537', fechaHora: dateTimeStr(0, 10, 10), placa: 'OVP-715', vehiculoTipo: 'MINIMULA', citaCargue: dateTimeStr(0, 11, 0), transportadora: 'TRANSPORTES DEL SUR', estadoTransporte: 'ALISTADO', estadoPorteria: 'CARGANDO', muelleAsignado: 'Muelle 3', cuadrilla: 'CCL', horaMuelleAsignado: dateTimeStr(0, 9, 58), horaLlegadaPorteria: dateTimeStr(0, 10, 0), horaIngreso: dateTimeStr(0, 10, 5), horaSalida: '--:--', horaInicioCargue: dateTimeStr(0, 10, 20), horaFinCargue: '--:--', observaciones: 'Documentación física validada' },
  { id: 'TR-6', llave: 'LL-60538', fechaHora: dateTimeStr(0, 11, 30), placa: '', vehiculoTipo: 'SENCILLO', citaCargue: dateTimeStr(0, 11, 0), transportadora: 'TRANSPORTES DEL SUR', estadoTransporte: 'ALISTADO', estadoPorteria: 'Pendiente', muelleAsignado: '', horaLlegadaPorteria: '--:--', horaIngreso: '--:--', horaSalida: '--:--', horaInicioCargue: '--:--', horaFinCargue: '--:--', observaciones: 'Placa pendiente de asignación' },
];

export const initialMessages: ChatMessage[] = [
  { id: 'MSG-1', senderRole: 'DESPACHADOR', senderName: 'Carlos (Despachos)', senderModule: 'Despachos', llaveRelacionada: 'LL-60533', muelleSugerido: 'Muelle 4', content: 'Por favor autorizar ingreso para LL-60533 (Placa TLX-842) en Muelle 4. Alistamiento listo.', timestamp: '08:15 AM', isRead: true },
  { id: 'MSG-2', senderRole: 'PORTERO', senderName: 'Ramiro (Portería)', senderModule: 'Portería', llaveRelacionada: 'LL-60533', muelleSugerido: 'Muelle 4', content: 'Recibido Despachos. Conductor en báscula, estado actualizado a CONFIRMADO Muelle 4.', timestamp: '08:18 AM', isRead: true },
  { id: 'MSG-3', senderRole: 'DESPACHADOR', senderName: 'Carlos (Despachos)', senderModule: 'Despachos', llaveRelacionada: 'LL-60537', muelleSugerido: 'Muelle 3', content: 'Solicitud de asignación para LL-60537 (Placa OVP-715). Asignarle Muelle 3 cuando libere espacio.', timestamp: '09:55 AM', isRead: false },
];

export const initialClientes: Cliente[] = [
  { id: 'CL-1', codigoShipTo: 1001, denominacion: 'CEDI NEIVA' },
  { id: 'CL-2', codigoShipTo: 1002, denominacion: 'EXITO CALI' },
  { id: 'CL-3', codigoShipTo: 1003, denominacion: 'SERVITENDAS' },
  { id: 'CL-4', codigoShipTo: 1004, denominacion: 'ALMACENES CARTAGENA' },
  { id: 'CL-5', codigoShipTo: 1005, denominacion: 'SUPERINTER BOGOTA' },
  { id: 'CL-6', codigoShipTo: 1006, denominacion: 'OLIMPICA' },
  { id: 'CL-7', codigoShipTo: 1007, denominacion: 'HOME CENTER' },
  { id: 'CL-8', codigoShipTo: 1008, denominacion: 'FALABELLA' },
];

export const initialCiudades: Ciudad[] = INITIAL_CIUDADES.map((ciudad, i) => ({
  id: `CI-${i}`,
  ciudad,
}));
