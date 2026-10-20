import { UnifiedTransporte, EstadoPorteria, TipoVehiculo } from '../types';
import { getEstadoPorteria } from './porteria';

export interface InformesKPIs {
  total: number;
  activas: number;
  finalizadas: number;
  cumplimientoPct: number;
  sinPlaca: number;
}

export interface EstadoConteo {
  estado: string;
  count: number;
}

export interface ValorConteo {
  name: string;
  value: number;
}

/** Cuadrilla asociada a una fila: CCL es la flota interna; SLA/LTSA son terceros. */
export type GrupoCuadrilla = 'CCL' | 'SLA' | 'LTSA';

/** Umbrales y reglas de negocio usados por los reportes (ajustables). */
export const CONSTANTES = {
  /** Costo diario de la cuadrilla CCL (se multiplica por los días del rango del informe). */
  COSTO_DIARIO_CCL: 1_432_000,
  /** Meta diaria de cajas registradas (línea de referencia en el gráfico Cajas diarias). */
  META_CAJAS_DIARIAS: 22_000,
  /** Ingreso por caja para SLA/LTSA (rentabilidad de cuadrillas). */
  INGRESO_CAJA_SLA: 140,
  /** Hombres que componen una cuadrilla (cálculo del indicador HORA/HOMBRE). */
  HOMBRES_POR_CUADRILLA: 3,
} as const;

/** "HH:MM" (o "HH:MM:SS", o "YYYY-MM-DD HH:MM") → minutos desde las 00:00; null si no es hora válida. */
export function minutosHora(hora?: string): number | null {
  if (!hora) return null;
  const m = hora.trim().match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Parsea "YYYY-MM-DD[ HH:MM[:SS]]" o timestamp/Año como Date local; null si no es válida. */
export function parsearFecha(fechaHora?: string): Date | null {
  if (!fechaHora) return null;
  const s = String(fechaHora).trim();
  if (/^\d{4}$/.test(s)) return new Date(Number(s), 0, 1);
  const fechaPart = s.slice(0, 10);
  const m = fechaPart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const hora = minutosHora(s.slice(11) || '');
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (hora != null && Number.isFinite(hora)) {
    d.setHours(Math.floor(hora / 60), hora % 60, 0, 0);
  }
  return d;
}

/** Clave "YYYY-MM-DD" (clave de día) de una fecha/hora; '' si no es válida. */
export function formatearFechaClave(fechaHora?: string): string {
  const d = parsearFecha(fechaHora);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** True si la fecha/hora cae en domingo. */
export function esDomingo(fechaHora?: string): boolean {
  const d = parsearFecha(fechaHora);
  return !!d && d.getDay() === 0;
}

/** Grupo al que pertenece una cuadrilla por nombre (CCL/SLA/LTSA). */
export function tipoGrupo(cuadrilla?: string): GrupoCuadrilla {
  const q = String(cuadrilla || '').toUpperCase();
  if (q.includes('CCL')) return 'CCL';
  if (q.includes('SLA')) return 'SLA';
  return 'LTSA';
}

/** Marca de hora: minutos del día y, si viene la fecha, el día desde 1970-01-01. */
interface MarcaHora {
  dia?: number;
  min: number;
}

/** Parsea "HH:MM" (opcional "HH:MM:SS") o "YYYY-MM-DD[ T ]HH:MM[:SS]" a {dia?, min}; null si no es válida. */
function marcasHora(hora?: string): MarcaHora | null {
  if (!hora) return null;
  const h = String(hora).trim();
  const conFecha = h.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ])(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (conFecha) {
    const y = Number(conFecha[1]);
    const mes = Number(conFecha[2]);
    const d = Number(conFecha[3]);
    const hh = Number(conFecha[4]);
    const mm = Number(conFecha[5]);
    if (mes < 1 || mes > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
    return { dia: Math.floor(Date.UTC(y, mes - 1, d) / 86_400_000), min: hh * 60 + mm };
  }
  const solo = h.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!solo) return null;
  const hh = Number(solo[1]);
  const mm = Number(solo[2]);
  if (hh > 23 || mm > 59) return null;
  return { min: hh * 60 + mm };
}

/** Diferencia en minutos entre dos horas "HH:MM" (fin − inicio); null si alguna no es válida.
 *  Solo hora del día: una etapa que da fin < inicio queda negativa (quien la use decide
 *  si la descarta como inconsistente o si aplica el cruce de medianoche con diffMinutosReales). */
export function diffMinutos(inicio?: string, fin?: string): number | null {
  const a = minutosHora(inicio);
  const b = minutosHora(fin);
  if (a == null || b == null) return null;
  return b - a;
}

/** Diferencia real entre dos marcas de hora (fin − inicio) asumiendo que si fin es menor
 *  que inicio el fin cae al día siguiente (cruce de medianoche). Admite "HH:MM" y
 *  "YYYY-MM-DD[ T ]HH:MM[:SS]"; null si alguna no es válida. */
export function diffMinutosReales(inicio?: string, fin?: string): number | null {
  const a = marcasHora(inicio);
  const b = marcasHora(fin);
  if (!a || !b) return null;
  const dia = a.dia ?? b.dia ?? 0;
  const diff = (b.dia ?? dia) * 1440 + b.min - ((a.dia ?? dia) * 1440 + a.min);
  return diff > 0 ? diff : diff + 1440;
}

/** Genera la lista de claves "YYYY-MM-DD" entre desde y hasta (inclusivo). */
export function generarDias(desde: string, hasta: string): string[] {
  const fechas: string[] = [];
  const cur = parsearFecha(desde);
  const fin = parsearFecha(hasta);
  if (!cur || !fin || fin.getTime() < cur.getTime()) return [];
  for (; cur.getTime() <= fin.getTime(); cur.setDate(cur.getDate() + 1)) {
    fechas.push(formatearFechaClave(cur.toISOString()));
  }
  return fechas;
}

/** Primer día ("YYYY-MM-DD") con datos según la fecha de cita; null si no hay ninguno.
 *  Base del preset "Año": el día más antiguo del año en el que hay datos para mostrar. */
export function primeraFechaDatos(rows: UnifiedTransporte[]): string | null {
  let min: string | null = null;
  for (const r of rows) {
    const dia = String(r.citaCargue || '').slice(0, 10);
    if (!dia) continue;
    if (!min || dia < min) min = dia;
  }
  return min;
}

const ESTADOS_FLUJO: EstadoPorteria[] = [
  'Pendiente',
  'Confirmado',
  'LLEGO A PORTERIA',
  'INGRESO A MUELLE',
  'CARGANDO',
  'FINALIZO CARGUE',
  'SALIO DE PORTERIA',
  'CANCELADO',
];

const TIPOS_VEHICULO: TipoVehiculo[] = ['SENCILLO', 'TURBO', 'MINIMULA', 'LUV', 'MULA'];

export const COLOR_FLOTA: Record<string, string> = {
  SENCILLO: '#3b82f6',
  TURBO: '#10b981',
  MINIMULA: '#f59e0b',
  LUV: '#8b5cf6',
  MULA: '#f43f5e',
};

export const COLOR_EMBUDO: Record<string, string> = {
  Pendiente: '#71717a',
  Confirmado: '#3b82f6',
  'LLEGO A PORTERIA': '#06b6d4',
  'INGRESO A MUELLE': '#10b981',
  CARGANDO: '#8b5cf6',
  'FINALIZO CARGUE': '#f59e0b',
  'SALIO DE PORTERIA': '#22c55e',
  CANCELADO: '#ef4444',
};

/** Cajas de una fila (con valor por defecto). */
const cajasDe = (r: UnifiedTransporte): number => r.cajas ?? 0;

/** Acumula una cantidad en un mapa numérico (crea la clave con 0 si no existe). */
function acumular<K>(mapa: Map<K, number>, clave: K, cantidad: number): void {
  mapa.set(clave, (mapa.get(clave) || 0) + cantidad);
}

/** Convierte un mapa nombre→valor a la forma que esperan los gráficos. */
function aValorConteo<K extends string>(mapa: Map<K, number>): ValorConteo[] {
  return [...mapa.entries()].map(([name, value]) => ({ name, value }));
}

/** Indicadores operativos del rango seleccionado. */
export function calcularKPIs(rows: UnifiedTransporte[]): InformesKPIs {
  const total = rows.length;
  const estados = rows.map((r) => getEstadoPorteria(r));
  const finalizadas = estados.filter((e) => e === 'SALIO DE PORTERIA').length;
  const activas = estados.filter((e) => e !== 'SALIO DE PORTERIA' && e !== 'CANCELADO').length;
  const sinPlaca = rows.filter((r) => !r.placa).length;
  const cumplimientoPct = total > 0 ? Math.round((finalizadas / total) * 100) : 0;
  return { total, activas, finalizadas, cumplimientoPct, sinPlaca };
}

/** Conteo de llaves por estado del flujo (en el orden operativo). */
export function embudoEstados(rows: UnifiedTransporte[]): EstadoConteo[] {
  const mapa = new Map<string, number>(ESTADOS_FLUJO.map((e) => [e, 0]));
  for (const r of rows) {
    acumular(mapa, getEstadoPorteria(r), 1);
  }
  return ESTADOS_FLUJO.map((e) => ({ estado: e, count: mapa.get(e) || 0 }));
}

/** Conteo de llaves por tipo de vehículo (siempre incluye los 4 tipos). */
export function porTipo(rows: UnifiedTransporte[]): ValorConteo[] {
  const mapa = new Map<TipoVehiculo, number>(TIPOS_VEHICULO.map((t) => [t, 0]));
  for (const r of rows) {
    const t = r.vehiculoTipo;
    if (mapa.has(t)) acumular(mapa, t, 1);
  }
  return TIPOS_VEHICULO.map((t) => ({ name: t, value: mapa.get(t) || 0 }));
}

/** Tiempo de cargue agregado por tipo de vehículo (minutos). */
export interface TiempoCargueTipo {
  name: string;
  promedio: number;
  minimo: number;
  maximo: number;
  conteo: number;
}

/** Promedio/mín/máx del tiempo de cargue (fin − inicio) por tipo de vehículo, en el orden
 *  de TIPOS_VEHICULO. Solo cuentan las llaves con ambas horas de cargue válidas y duración
 *  positiva. El cruce de medianoche lo resuelve diffMinutosReales; se descarta el caso
 *  degenerado fin == inicio (24 h según ese helper, sin duración real medida). */
export function tiempoCarguePorTipo(rows: UnifiedTransporte[]): TiempoCargueTipo[] {
  const medidas = new Map<TipoVehiculo, number[]>();
  for (const r of rows) {
    if (!TIPOS_VEHICULO.includes(r.vehiculoTipo)) continue;
    const mins = diffMinutosReales(r.horaInicioCargue, r.horaFinCargue);
    if (mins == null || mins <= 0 || mins >= 1440) continue;
    const lista = medidas.get(r.vehiculoTipo) ?? [];
    lista.push(mins);
    medidas.set(r.vehiculoTipo, lista);
  }
  return TIPOS_VEHICULO.map((t) => {
    const lista = medidas.get(t) ?? [];
    return {
      name: t,
      promedio: lista.length ? Math.round(lista.reduce((a, b) => a + b, 0) / lista.length) : 0,
      minimo: lista.length ? Math.min(...lista) : 0,
      maximo: lista.length ? Math.max(...lista) : 0,
      conteo: lista.length,
    };
  });
}

/** Llaves por transportadora (top N, ordenadas descendente). */
export function porTransportadora(rows: UnifiedTransporte[], topN = 8): ValorConteo[] {
  const mapa = new Map<string, number>();
  for (const r of rows) {
    const nombre = r.transportadora?.trim();
    if (nombre) acumular(mapa, nombre, 1);
  }
  return aValorConteo(mapa)
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
}

/** Número de llaves por día (YYYY-MM-DD) según la CITA DE CARGUE (programación), ascendente. */
export function volumenPorDia(rows: UnifiedTransporte[]): ValorConteo[] {
  const mapa = new Map<string, number>();
  for (const r of rows) {
    const dia = formatearFechaClave(r.citaCargue);
    if (dia) acumular(mapa, dia, 1);
  }
  return aValorConteo(mapa).sort((a, b) => a.name.localeCompare(b.name));
}

/** Punto de uso/ocupación de un muelle: despachos y cajas. */
export interface MuelleUso {
  name: string;
  despachos: number;
  cajas: number;
}

/** Frecuencia de despachos y volumen de cajas por muelle (según la cita del rango). */
export function usoPorMuelle(rows: UnifiedTransporte[]): MuelleUso[] {
  const mapa = new Map<string, MuelleUso>();
  for (const r of rows) {
    const muelle = String(r.muelleAsignado || '').trim();
    if (!muelle) continue;
    const cur = mapa.get(muelle) || { name: muelle, despachos: 0, cajas: 0 };
    cur.despachos += 1;
    cur.cajas += cajasDe(r);
    mapa.set(muelle, cur);
  }
  return [...mapa.values()].sort((a, b) => b.cajas - a.cajas);
}

/** Bucket mensual/quincenal de rentabilidad: costo CCL vs ingreso SLA. */
export interface RentabilidadBucket {
  name: string;
  costoCCL: number;
  ingresoSLA: number;
}

/**
 * Rentabilidad por cuadrilla con granularidad diaria según el rango [desde, hasta].
 * Solo se incluyen los días con movimiento (al menos una llave en el rango):
 * cada día Costo CCL = COSTO_DIARIO_CCL (tarifa fija diaria de la cuadrilla interna)
 * e ingreso SLA/LTSA = cajas de terceros de ese día × INGRESO_CAJA_SLA.
 */
export function rentabilidadCuadrillas(
  rows: UnifiedTransporte[],
  desde: string,
  hasta: string,
): RentabilidadBucket[] {
  const movimiento = new Set<string>();
  for (const r of rows) {
    const dia = formatearFechaClave(r.citaCargue);
    if (dia) movimiento.add(dia);
  }

  const buckets = new Map<string, RentabilidadBucket>();
  for (const dia of generarDias(desde, hasta)) {
    if (movimiento.has(dia))
      buckets.set(dia, { name: dia, costoCCL: CONSTANTES.COSTO_DIARIO_CCL, ingresoSLA: 0 });
  }

  // Ingreso de cuadrillas SLA según las cajas de cada día (LTSA no se incluye en este gráfico).
  // Las llaves sin cuadrilla asignada no se consideran operación de terceros.
  for (const r of rows) {
    const dia = formatearFechaClave(r.citaCargue);
    const bucket = buckets.get(dia);
    if (!bucket) continue;
    if (!String(r.cuadrilla || '').trim()) continue;
    const grupo = tipoGrupo(r.cuadrilla);
    if (grupo === 'SLA') {
      bucket.ingresoSLA += cajasDe(r) * CONSTANTES.INGRESO_CAJA_SLA;
    }
  }

  return [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Cajas registradas por día (YYYY-MM-DD) según la CITA DE CARGUE (programación), ascendente. */
export function cajasPorDia(rows: UnifiedTransporte[]): ValorConteo[] {
  const mapa = new Map<string, number>();
  for (const r of rows) {
    const dia = formatearFechaClave(r.citaCargue);
    if (dia) acumular(mapa, dia, cajasDe(r));
  }
  return aValorConteo(mapa).sort((a, b) => a.name.localeCompare(b.name));
}

/** Distribución de cajas por tipo de cuadrilla (CCL/SLA/LTSA). Las llaves sin cuadrilla no se asignan a LTSA. */
export function cajasPorCuadrilla(rows: UnifiedTransporte[]): ValorConteo[] {
  const mapa = new Map<GrupoCuadrilla, number>();
  for (const r of rows) {
    const grupo = tipoGrupo(r.cuadrilla);
    if (grupo === 'LTSA' && !String(r.cuadrilla || '').trim()) continue;
    acumular(mapa, grupo, cajasDe(r));
  }
  return (['CCL', 'SLA', 'LTSA'] as GrupoCuadrilla[]).map((g) => ({
    name: g,
    value: mapa.get(g) || 0,
  }));
}

/** Cajas cargadas por hora-hombre de las cuadrillas CCL y SLA (LTSA no cuenta).
 *  Solo participan las llaves con hora de inicio y fin de cargue válidas;
 *  el tiempo de cargue (minutos) de cada llave se multiplica por la tripulación
 *  de la cuadrilla (HOMBRES_POR_CUADRILLA) para obtener las horas-hombre.
 *  El índice combinado (indice) es el promedio de ambas cuadrillas (CCL + SLA). */
export interface ResultadoHoraHombreGrupo {
  cajas: number;
  horasHombre: number;
  indice: number;
}

export interface ResultadoHoraHombre extends ResultadoHoraHombreGrupo {
  ccl: ResultadoHoraHombreGrupo;
  sla: ResultadoHoraHombreGrupo;
}

function resultadoGrupo_(cajas: number, horasHombre: number): ResultadoHoraHombreGrupo {
  return { cajas, horasHombre, indice: horasHombre > 0 ? cajas / horasHombre : 0 };
}

export function horaHombre(rows: UnifiedTransporte[]): ResultadoHoraHombre {
  const grupos = { CCL: { cajas: 0, horasHombre: 0 }, SLA: { cajas: 0, horasHombre: 0 } };
  for (const r of rows) {
    const grupo = tipoGrupo(r.cuadrilla);
    if (grupo !== 'CCL' && grupo !== 'SLA') continue;
    const mins = diffMinutosReales(r.horaInicioCargue, r.horaFinCargue);
    if (mins == null || mins <= 0) continue;
    grupos[grupo].cajas += cajasDe(r);
    grupos[grupo].horasHombre += (mins / 60) * CONSTANTES.HOMBRES_POR_CUADRILLA;
  }
  const ccl = resultadoGrupo_(grupos.CCL.cajas, grupos.CCL.horasHombre);
  const sla = resultadoGrupo_(grupos.SLA.cajas, grupos.SLA.horasHombre);
  return {
    cajas: ccl.cajas + sla.cajas,
    horasHombre: ccl.horasHombre + sla.horasHombre,
    indice: ccl.horasHombre + sla.horasHombre > 0 ? (ccl.cajas + sla.cajas) / (ccl.horasHombre + sla.horasHombre) : 0,
    ccl,
    sla,
  };
}

// ===========================================================================
// TIEMPOS DE PORTERÍA POR ETAPA
// ---------------------------------------------------------------------------
// Segmentos de la secuencia operativa de una llave, desde que llega a portería
// hasta que sale. Cada etapa mide el tiempo entre DOS hitos de hora ya
// registrados (formato 'HH:MM'); se cuentan solo las llaves con AMBAS horas.
// ===========================================================================

/** Campo de hora de inicio/fin de una etapa (existe en UnifiedTransporte). */
type CampoHoraPorteria =
  | 'horaLlegadaPorteria'
  | 'horaMuelleAsignado'
  | 'horaIngreso'
  | 'horaInicioCargue'
  | 'horaFinCargue'
  | 'horaSalida';

/** Definición de una etapa: transición entre dos hitos de portería. */
export interface TiempoEtapa {
  id: string;
  label: string;
  descripcion: string;
  color: string;
  inicio: CampoHoraPorteria;
  fin: CampoHoraPorteria;
}

/** Resumen agregado de una etapa: promedio/mín/máx (min) y nº de llaves medidas. */
export interface TiempoEtapaResumen extends TiempoEtapa {
  promedio: number;
  minimo: number;
  maximo: number;
  conteo: number;
}

/** Seguimiento de la llave: 5 transiciones entre hitos de portería. */
export const ETAPAS_PORTERIA: TiempoEtapa[] = [
  {
    id: 'llegada_muelle',
    label: 'ASIGNACIÓN MUELLE',
    descripcion: 'Llegada a portería → Asignación de muelle',
    color: '#3b82f6',
    inicio: 'horaLlegadaPorteria',
    fin: 'horaMuelleAsignado',
  },
  {
    id: 'muelle_ingreso',
    label: 'INGRESO A MUELLE',
    descripcion: 'Asignación de muelle → Ingreso a muelle',
    color: '#10b981',
    inicio: 'horaMuelleAsignado',
    fin: 'horaIngreso',
  },
  {
    id: 'ingreso_cargando',
    label: 'INICIO DE CARGUE',
    descripcion: 'Ingreso a muelle → Inicio de cargue',
    color: '#f59e0b',
    inicio: 'horaIngreso',
    fin: 'horaInicioCargue',
  },
  {
    id: 'cargando_fin',
    label: 'FINALIZO DE CARGUE',
    descripcion: 'Inicio de cargue → Fin de cargue',
    color: '#8b5cf6',
    inicio: 'horaInicioCargue',
    fin: 'horaFinCargue',
  },
  {
    id: 'fin_salida',
    label: 'SALIDA DE PORTERIA',
    descripcion: 'Fin de cargue → Salida de portería',
    color: '#ec4899',
    inicio: 'horaFinCargue',
    fin: 'horaSalida',
  },
];

/** Duración de una etapa para una llave, o null si falta alguna de las dos horas. */
function duracionEtapa(etapa: TiempoEtapa, r: UnifiedTransporte): number | null {
  const d = diffMinutos(String(r[etapa.inicio] || ''), String(r[etapa.fin] || ''));
  if (d == null || d < 0) return null; // sin ambas horas, o inconsistente (fin < inicio)
  return d;
}

/**
 * Promedio/mín/máx (minutos) por cada etapa de portería para el conjunto de filas.
 * Solo se miden las llaves que tienen registradas las DOS horas de la etapa.
 */
export function tiemposPorteria(rows: UnifiedTransporte[]): TiempoEtapaResumen[] {
  return ETAPAS_PORTERIA.map((etapa) => {
    const dur: number[] = [];
    for (const r of rows) {
      const d = duracionEtapa(etapa, r);
      if (d != null) dur.push(d);
    }
    if (dur.length === 0) {
      return { ...etapa, promedio: 0, minimo: 0, maximo: 0, conteo: 0 };
    }
    const suma = dur.reduce((a, b) => a + b, 0);
    return {
      ...etapa,
      promedio: Math.round(suma / dur.length),
      minimo: Math.min(...dur),
      maximo: Math.max(...dur),
      conteo: dur.length,
    };
  });
}

// ===========================================================================
// FASE 7 — Mapa de calor de posicionamiento (matriz Fecha × Hora)
// ===========================================================================

/** Meses abreviados en español para las etiquetas de fecha del heatmap. */
export const MESES_ABREV = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** Clasificación de un vehículo frente a la cita de cargue. */
export type ClasificacionCita = 'aTiempo' | 'leve' | 'critico';

/** Clasifica la demora de inicio frente a la cita (min): <60 a tiempo, 60-179 leve, >=180 crítico. */
export function clasificarCita(demoraMins: number): ClasificacionCita {
  if (demoraMins < 60) return 'aTiempo';
  if (demoraMins >= 180) return 'critico';
  return 'leve';
}

/** Contenido agregado de una celda (fecha × hora) del heatmap. */
export interface CeldaPosicion {
  count: number;
  aTiempo: number;
  entre1y3h: number;
  masDe3h: number;
}

/** Fila del eje Fecha del heatmap, en orden cronológico ascendente. */
export interface FechaPosicion {
  label: string; // "DD-mmm" (ej: "16-jun")
  fecha: Date;
}

/** Resultado de agrupar las operaciones por fecha y hora de llegada a portería. */
export interface MapaPosicionamiento {
  celdas: Map<string, CeldaPosicion>; // clave "DD-mmm___HH:00"
  fechas: FechaPosicion[]; // ascendente (la más antigua arriba)
  horas: string[]; // eje "HH:00" desde el inicio de jornada hasta las 23:00
  totalFilas: number;
}

/**
 * Agrupa las operaciones en una matriz Fecha × Hora para el mapa de calor de
 * posicionamiento. Cada fila se ubica por la fecha y hora reales de llegada a
 * portería (hora_llegada_porteria; si falta o es inválida, se usa la hora de la
 * cita) y se clasifica contra la cita: <60 min a tiempo, 60-179 min leve,
 * ≥180 min crítico. La demora se calcula en minutos absolutos entre fechas
 * (soporta llegadas al día siguiente de la cita).
 */
export function mapaPosicionamiento(rows: UnifiedTransporte[]): MapaPosicionamiento {
  const celdas = new Map<string, CeldaPosicion>();
  const fechasMap = new Map<string, Date>();
  const horasSet = new Set<number>();

  const agregar = (
    fechaLabel: string,
    fecha: Date,
    horaMins: number,
    clasif: ClasificacionCita,
  ) => {
    const horaKey = `${String(Math.floor(horaMins / 60)).padStart(2, '0')}:00`;
    const key = `${fechaLabel}___${horaKey}`;
    const celda = celdas.get(key) ?? { count: 0, aTiempo: 0, entre1y3h: 0, masDe3h: 0 };
    celda.count += 1;
    if (clasif === 'aTiempo') celda.aTiempo += 1;
    else if (clasif === 'leve') celda.entre1y3h += 1;
    else celda.masDe3h += 1;
    celdas.set(key, celda);
    if (!fechasMap.has(fechaLabel)) fechasMap.set(fechaLabel, fecha);
    horasSet.add(Math.floor(horaMins / 60));
  };

  for (const r of rows) {
    const citaStr = String(r.citaCargue || '').trim();
    const llegadaStr = String(r.horaLlegadaPorteria || '').trim();
    const citaD = parsearFecha(citaStr);
    if (!citaD) continue;

    // Solo se posiciona una fila si hay una hora explícita: la de llegada real a
    // portería o, en su defecto, la de la cita. Demora = llegada − cita (min).
    let posD: Date | null = null;
    let clasif: ClasificacionCita = 'aTiempo';
    const llegadaD = parsearFecha(llegadaStr);
    if (llegadaD && /\d{2}:\d{2}/.test(llegadaStr)) {
      posD = llegadaD;
      const demoraMins = Math.max(0, (llegadaD.getTime() - citaD.getTime()) / 60000);
      clasif = clasificarCita(demoraMins);
    } else if (/\d{2}:\d{2}/.test(citaStr)) {
      posD = citaD;
    }
    if (!posD) continue; // sin hora explícita: no ubica en el mapa

    const fechaLabel = `${String(posD.getDate()).padStart(2, '0')}-${MESES_ABREV[posD.getMonth()]}`;
    agregar(fechaLabel, posD, posD.getHours() * 60 + posD.getMinutes(), clasif);
  }

  const fechas = [...fechasMap.entries()]
    .map(([label, fecha]) => ({ label, fecha }))
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  // La jornada inicia como mínimo a las 06:00 am; si hay cargues antes, el eje baja.
  const horasPresentes = [...horasSet];
  const minHora = horasPresentes.length ? Math.min(6, ...horasPresentes) : 6;
  const horas = Array.from(
    { length: 24 - minHora },
    (_, i) => `${String(minHora + i).padStart(2, '0')}:00`,
  );

  return { celdas, fechas, horas, totalFilas: rows.length };
}
