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
  { id: 'TR-1', llave: 'LL-60533', fechaHora: dateTimeStr(0, 8, 30), placa: 'TLX-842', numeroPedido: '3000576478', vehiculoTipo: 'TURBO', denominacionCliente: 'CEDI NEIVA', destino: 'NEIVA', citaCargue: dateTimeStr(0, 7, 0), transportadora: 'TRANSPORTES ANDINA', estadoTransporte: 'DESPACHADO', estadoDespacho: 'DESPACHADO', estadoPorteria: 'SALIO DE PORTERIA', muelleAsignado: 'Muelle 4', horaLlegadaPorteria: '07:40', horaIngreso: '07:45', horaSalida: '08:40', horaInicioCargue: '08:00', horaFinCargue: '08:35', observaciones: 'Carga prioritaria refrigerada para Neiva' },
  { id: 'TR-2', llave: 'LL-60534', fechaHora: dateTimeStr(0, 9, 15), placa: 'WNK-591', numeroPedido: '3000576479', vehiculoTipo: 'MINIMULA', denominacionCliente: 'EXITO CALI', destino: 'CALI', citaCargue: dateTimeStr(0, 8, 30), transportadora: 'LOGÍSTICA DEL HUILA', estadoTransporte: 'ALISTADO', estadoDespacho: 'ALISTADO', estadoPorteria: 'CARGANDO', muelleAsignado: 'Muelle 1', horaLlegadaPorteria: '08:05', horaIngreso: '08:10', horaSalida: '--:--', horaInicioCargue: '08:45', horaFinCargue: '--:--', observaciones: 'Esperando pase de seguridad de Despachos' },
  { id: 'TR-3', llave: 'LL-60535', fechaHora: dateTimeStr(0, 9, 45), placa: 'KLR-104', numeroPedido: '3000576480', vehiculoTipo: 'SENCILLO', denominacionCliente: 'SERVITENDAS', destino: 'IBAGUÉ', citaCargue: dateTimeStr(0, 9, 0), transportadora: 'RED TRACK S.A.', estadoTransporte: 'DESPACHADO', estadoDespacho: 'DESPACHADO', estadoPorteria: 'SALIO DE PORTERIA', muelleAsignado: 'Muelle 2', horaLlegadaPorteria: '08:45', horaIngreso: '08:50', horaSalida: '09:30', horaInicioCargue: '09:10', horaFinCargue: '09:25', observaciones: 'Cargue finalizado sin novedades' },
  { id: 'TR-4', llave: 'LL-60536', fechaHora: dateTimeStr(0, 10, 0), placa: 'SSZ-332', numeroPedido: '3000576481', vehiculoTipo: 'LUV', denominacionCliente: 'ALMACENES CARTAGENA', destino: 'CARTAGENA', citaCargue: dateTimeStr(0, 10, 15), transportadora: 'CARGA EXPRESA', estadoTransporte: 'PENDIENTE', estadoDespacho: 'PTE ALISTAR', estadoPorteria: 'Pendiente', muelleAsignado: 'Muelle 5', horaLlegadaPorteria: '--:--', horaIngreso: '--:--', horaSalida: '--:--', horaInicioCargue: '--:--', horaFinCargue: '--:--', observaciones: 'Programado para hoy en la tarde' },
  { id: 'TR-5', llave: 'LL-60537', fechaHora: dateTimeStr(0, 10, 10), placa: 'OVP-715', numeroPedido: '3000576482', vehiculoTipo: 'MINIMULA', denominacionCliente: 'SUPERINTER BOGOTA', destino: 'BOGOTA', citaCargue: dateTimeStr(0, 11, 0), transportadora: 'TRANSPORTES DEL SUR', estadoTransporte: 'ALISTADO', estadoDespacho: 'ALISTADO', estadoPorteria: 'CARGANDO', muelleAsignado: 'Muelle 3', horaLlegadaPorteria: '10:00', horaIngreso: '10:05', horaSalida: '--:--', horaInicioCargue: '10:20', horaFinCargue: '--:--', observaciones: 'Documentación física validada' },
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
