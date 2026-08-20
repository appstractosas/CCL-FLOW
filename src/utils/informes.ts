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

/**
 * CONTEXTO DE DATOS (fila plana por LLAVE).
 * La fuente es la tabla `transportes`; los nombres siguen la BD para que el
 * motor de informes (prompt) los consuma sin mapeos extra.
 * Las horas llegan como 'HH:MM' (o '') y los minutos derivados van en `*_minutos`.
 */
export interface Fila {
  created_at: string;
  llave: string;
  transporte: string;
  denominacion: string;
  cita_cargue: string;
  cajas: number;
  transportadora: string;
  cuadrilla: string;
  hora_inicio_cargue: string;
  hora_fin_cargue: string;
  muelle_asignado: string;
  // Derivados (mmol/mueble) no vienen de la BD, se calculan al construir la fila.
  tiempo_muelle_minutos: number | null;
  llegada_minutos: number | null;
  inicio_minutos: number | null;
  fin_minutos: number | null;
  turno: string | null;
  costo_diario_ccl: number;
}

/** Cuadrilla asociada a una fila: CCL es la flota interna; SLA/LTSA son terceros. */
export type GrupoCuadrilla = 'CCL' | 'SLA' | 'LTSA';

/** Umbrales y reglas de negocio usados por los reportes (ajustables). */
export const CONSTANTES = {
  /** Costo diario de la cuadrilla CCL (se multiplica por los días del rango del informe). */
  COSTO_DIARIO_CCL: 1_432_000,
  /** Meta SLA (min) para clasificar el tiempo en muelle. */
  SLA_MINUTOS: 45,
  /** Minutos de demora para considerarla leve (sobre el SLA). */
  DEMORA_LEVE_MAX: 60,
  /** Minutos de demora para considerarla crítica (sobre el SLA). */
  DEMORA_CRITICO_MIN: 120,
  /** Horas no atendidas (con SLA esperado) que no se cargan a CCL. */
  HORAS_DENTRO_SLA: 24,
  /** Meta diaria de cajas registradas (línea de referencia en el gráfico Cajas diarias). */
  META_CAJAS_DIARIAS: 22_000,
  /** Costo por caja para la flota CCL (rentabilidad de cuadrillas). */
  COSTO_CAJA_CCL: 200,
  /** Ingreso por caja para SLA/LTSA (rentabilidad de cuadrillas). */
  INGRESO_CAJA_SLA: 140,
  /** Hombres que componen una cuadrilla (cálculo del indicador HORA/HOMBRE). */
  HOMBRES_POR_CUADRILLA: 3,
} as const;

export type DemoraNivel = 'aTiempo' | 'leve' | 'critico';

/** "HH:MM" (o "HH:MM:SS", o "YYYY-MM-DD HH:MM") → minutos desde las 00:00; null si no es hora válida. */
export function minutosHora(hora?: string): number | null {
  if (!hora) return null;
  const m = hora
    .trim()
    .match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?$/);
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

/** Convierte una hora a minutos desde 00:00 (alias de minutosHora, estilo BI). */
export const _c = minutosHora;

/** Diferencia en minutos entre dos horas "HH:MM" (fin − inicio); null si alguna no es válida. */
export function diffMinutos(inicio?: string, fin?: string): number | null {
  const a = minutosHora(inicio);
  const b = minutosHora(fin);
  if (a == null || b == null) return null;
  return b - a;
}

/** Clasifica la demora (min) contra el SLA: aTiempo, leve o critico. */
export function clasificacionDemora(demoraMin?: number | null): DemoraNivel {
  if (demoraMin == null || demoraMin <= 0) return 'aTiempo';
  if (demoraMin <= CONSTANTES.DEMORA_LEVE_MAX) return 'leve';
  if (demoraMin >= CONSTANTES.DEMORA_CRITICO_MIN) return 'critico';
  return 'leve';
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

/** Turno de una hora "HH:MM": T1 (00:00-07:59), T2 (08:00-15:59), T3 (16:00-23:59). */
export function turnoDeHora(hora?: string): string | null {
  const min = minutosHora(hora);
  if (min == null) return null;
  if (min < 8 * 60) return 'T1';
  if (min < 16 * 60) return 'T2';
  return 'T3';
}

/** Formateadores compartidos por los reportes. */
export const formatos = {
  clavesFecha: formatearFechaClave,
  diaSemana: (fechaHora?: string): string => {
    const d = parsearFecha(fechaHora);
    return d ? d.toLocaleDateString('es-ES', { weekday: 'long' }) : '';
  },
  hora: (hora?: string): string => hora || '—',
  numero: (n?: number | null): string => (n == null ? '—' : String(n)),
  moneda: (n?: number | null): string =>
    n == null ? '—' : `$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`,
};

/** Convierte una fila UnifiedTransporte a Fila del motor de informes. */
export function aFila(r: UnifiedTransporte): Fila {
  return {
    created_at: r.createdAt || '',
    llave: r.llave,
    transporte: r.transporte || '',
    denominacion: r.denominacion || '',
    cita_cargue: r.citaCargue || '',
    cajas: r.cajas ?? 0,
    transportadora: r.transportadora || '',
    cuadrilla: r.cuadrilla || '',
    hora_inicio_cargue: r.horaInicioCargue || '',
    hora_fin_cargue: r.horaFinCargue || '',
    muelle_asignado: r.muelleAsignado || '',
    tiempo_muelle_minutos: diffMinutos(r.horaInicioCargue, r.horaFinCargue),
    llegada_minutos: _c(r.horaLlegadaPorteria),
    inicio_minutos: _c(r.horaInicioCargue),
    fin_minutos: _c(r.horaFinCargue),
    turno: turnoDeHora(r.horaInicioCargue),
    costo_diario_ccl: CONSTANTES.COSTO_DIARIO_CCL,
  };
}

// ===========================================================================
// FASE 3 — Preparación de filas para el motor de informes
// ===========================================================================

/** Fila lista para la tabla detalle: demora en minutos y su nivel. */
export interface FilaTabla extends Fila {
  demoraMin: number | null;
  nivelDemora: DemoraNivel;
}

/** Filtra el rango [desde, hasta] (YYYY-MM-DD) sobre la FECHA HORA CITA (cita_cargue) y proyecta a Fila[]. */
export function filasPorRango(rows: UnifiedTransporte[], desde: string, hasta: string): Fila[] {
  return rows
    .filter((r) => {
      const clave = formatearFechaClave(r.citaCargue);
      return clave !== '' && clave >= desde && clave <= hasta;
    })
    .map(aFila);
}

/** Enriquece las filas con la demora (tiempo en muelle − SLA) y su clasificación. */
export function filasParaTabla(filas: Fila[]): FilaTabla[] {
  return filas.map((f) => {
    const demoraMin =
      f.tiempo_muelle_minutos == null
        ? null
        : f.tiempo_muelle_minutos - CONSTANTES.SLA_MINUTOS;
    return { ...f, demoraMin, nivelDemora: clasificacionDemora(demoraMin) };
  });
}

// ===========================================================================
// FASE 4 — Determinación horaria por cuadrilla y export
// ===========================================================================

export interface DetalleTurno {
  turno: string;
  unidades: number;
  horas: number;
}

export interface DeterminacionGrupo {
  grupo: GrupoCuadrilla;
  unidades: number;
  horas: number;
  /** Costo estimado: flota CCL (interna) usa costo_diario_ccl; terceros = 0. */
  costoEstimado: number;
  porTurno: DetalleTurno[];
}

export interface Determinacion {
  totalUnidades: number;
  totalHoras: number;
  costoEstimado: number;
  grupos: DeterminacionGrupo[];
}

const TURNOS_ORDEN: string[] = ['T1', 'T2', 'T3'];

/**
 * Agrupa las filas atendidas (con hora de inicio de cargue) por grupo de
 * cuadrilla y turno. La unidad equivale a una llave; las horas son la suma
 * del tiempo en muelle (minutos → horas con 1 decimal).
 */
export function determinacionHoraria(filas: Fila[]): Determinacion {
  const atendidas = filas.filter((f) => f.inicio_minutos != null);

  const gruposMap = new Map<GrupoCuadrilla, DeterminacionGrupo>();
  for (const g of ['CCL', 'SLA', 'LTSA'] as GrupoCuadrilla[]) {
    gruposMap.set(g, { grupo: g, unidades: 0, horas: 0, costoEstimado: 0, porTurno: TURNOS_ORDEN.map((t) => ({ turno: t, unidades: 0, horas: 0 })) });
  }

  for (const f of atendidas) {
    const grupo = tipoGrupo(f.cuadrilla);
    const turno = f.turno || 'T1';
    const horas = (f.tiempo_muelle_minutos ?? 0) / 60;
    const det = gruposMap.get(grupo)!;
    det.unidades += 1;
    det.horas += horas;
    det.costoEstimado += grupo === 'CCL' ? f.costo_diario_ccl : 0;
    const turnoDet = det.porTurno.find((t) => t.turno === turno)!;
    turnoDet.unidades += 1;
    turnoDet.horas += horas;
  }

  const grupos = [...gruposMap.values()].filter((g) => g.unidades > 0);
  const redondea1 = (n: number) => Math.round(n * 10) / 10;
  for (const g of grupos) {
    g.horas = redondea1(g.horas);
    g.porTurno.forEach((t) => { t.horas = redondea1(t.horas); });
  }

  return {
    totalUnidades: grupos.reduce((a, g) => a + g.unidades, 0),
    totalHoras: redondea1(grupos.reduce((a, g) => a + g.horas, 0)),
    costoEstimado: grupos.reduce((a, g) => a + g.costoEstimado, 0),
    grupos,
  };
}

/** Filas AOA listas para exportar la determinación a Excel. */
export function filasExportDeterminacion(det: Determinacion): { headers: string[]; data: (string | number)[][] } {
  const headers = ['GRUPO', 'TURNO', 'UNIDADES', 'HORAS', 'COSTO ESTIMADO'];
  const data: (string | number)[][] = [];
  for (const g of det.grupos) {
    g.porTurno.forEach((t) => {
      data.push([g.grupo, t.turno, t.unidades, `${t.horas}h`, g.grupo === 'CCL' ? formatos.moneda(g.costoEstimado / Math.max(1, g.porTurno.length)) : '$0' ]);
    });
    data.push([g.grupo, 'TOTAL', g.unidades, `${g.horas}h`, formatos.moneda(g.costoEstimado)]);
  }
  data.push(['TOTAL', '—', det.totalUnidades, `${det.totalHoras}h`, formatos.moneda(det.costoEstimado)]);
  return { headers, data };
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
    const estado = getEstadoPorteria(r);
    mapa.set(estado, (mapa.get(estado) || 0) + 1);
  }
  return ESTADOS_FLUJO.map((e) => ({ estado: e, count: mapa.get(e) || 0 }));
}

/** Conteo de llaves por tipo de vehículo (siempre incluye los 4 tipos). */
export function porTipo(rows: UnifiedTransporte[]): ValorConteo[] {
  const mapa = new Map<TipoVehiculo, number>(TIPOS_VEHICULO.map((t) => [t, 0]));
  for (const r of rows) {
    const t = r.vehiculoTipo;
    if (mapa.has(t)) mapa.set(t, (mapa.get(t) || 0) + 1);
  }
  return TIPOS_VEHICULO.map((t) => ({ name: t, value: mapa.get(t) || 0 }));
}

/** Llaves por transportadora (top N, ordenadas descendente). */
export function porTransportadora(rows: UnifiedTransporte[], topN = 8): ValorConteo[] {
  const mapa = new Map<string, number>();
  for (const r of rows) {
    const nombre = r.transportadora?.trim();
    if (!nombre) continue;
    mapa.set(nombre, (mapa.get(nombre) || 0) + 1);
  }
  return [...mapa.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
}

/** Número de llaves por día (YYYY-MM-DD) según la FECHA HORA CITA, ascendente. */
export function volumenPorDia(rows: UnifiedTransporte[]): ValorConteo[] {
  const mapa = new Map<string, number>();
  for (const r of rows) {
    const dia = String(r.citaCargue || '').slice(0, 10);
    if (!dia) continue;
    mapa.set(dia, (mapa.get(dia) || 0) + 1);
  }
  return [...mapa.entries()]
    .map(([dia, count]) => ({ name: dia, value: count }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
    cur.cajas += r.cajas ?? 0;
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
export function rentabilidadCuadrillas(rows: UnifiedTransporte[], desde: string, hasta: string): RentabilidadBucket[] {
  const movimiento = new Set<string>();
  for (const r of rows) {
    const dia = String(r.citaCargue || '').slice(0, 10);
    if (dia) movimiento.add(dia);
  }

  const buckets = new Map<string, RentabilidadBucket>();
  for (const dia of generarDias(desde, hasta)) {
    if (movimiento.has(dia)) buckets.set(dia, { name: dia, costoCCL: CONSTANTES.COSTO_DIARIO_CCL, ingresoSLA: 0 });
  }

  // Ingreso de cuadrillas SLA según las cajas de cada día (LTSA no se incluye en este gráfico).
  // Las llaves sin cuadrilla asignada no se consideran operación de terceros.
  for (const r of rows) {
    const dia = String(r.citaCargue || '').slice(0, 10);
    const bucket = buckets.get(dia);
    if (!bucket) continue;
    if (!String(r.cuadrilla || '').trim()) continue;
    const grupo = tipoGrupo(r.cuadrilla);
    if (grupo === 'SLA') {
      bucket.ingresoSLA += (r.cajas ?? 0) * CONSTANTES.INGRESO_CAJA_SLA;
    }
  }

  return [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Cajas registradas por día (YYYY-MM-DD) según la FECHA HORA CITA, ascendente. */
export function cajasPorDia(rows: UnifiedTransporte[]): ValorConteo[] {
  const mapa = new Map<string, number>();
  for (const r of rows) {
    const dia = String(r.citaCargue || '').slice(0, 10);
    if (!dia) continue;
    mapa.set(dia, (mapa.get(dia) || 0) + (r.cajas ?? 0));
  }
  return [...mapa.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Distribución de cajas por tipo de cuadrilla (CCL/SLA/LTSA). Las llaves sin cuadrilla no se asignan a LTSA. */
export function cajasPorCuadrilla(rows: UnifiedTransporte[]): ValorConteo[] {
  const mapa = new Map<GrupoCuadrilla, number>();
  for (const r of rows) {
    const grupo = tipoGrupo(r.cuadrilla);
    if (grupo === 'LTSA' && !String(r.cuadrilla || '').trim()) continue;
    mapa.set(grupo, (mapa.get(grupo) || 0) + (r.cajas ?? 0));
  }
  return (['CCL', 'SLA', 'LTSA'] as GrupoCuadrilla[]).map((g) => ({ name: g, value: mapa.get(g) || 0 }));
}

/** Cajas cargadas por hora-hombre de las cuadrillas CCL y SLA (LTSA no cuenta).
 *  Solo participan las llaves con hora de inicio y fin de cargue válidas;
 *  el tiempo de cargue (minutos) de cada llave se multiplica por la tripulación
 *  de la cuadrilla (HOMBRES_POR_CUADRILLA) para obtener las horas-hombre. */
export interface ResultadoHoraHombre {
  cajas: number;
  horasHombre: number;
  indice: number;
}

export function horaHombre(rows: UnifiedTransporte[]): ResultadoHoraHombre {
  let cajas = 0;
  let horasHombre = 0;
  for (const r of rows) {
    const grupo = tipoGrupo(r.cuadrilla);
    if (grupo !== 'CCL' && grupo !== 'SLA') continue;
    const mins = diffMinutos(r.horaInicioCargue, r.horaFinCargue);
    if (mins == null || mins <= 0) continue;
    cajas += r.cajas ?? 0;
    horasHombre += (mins / 60) * CONSTANTES.HOMBRES_POR_CUADRILLA;
  }
  const indice = horasHombre > 0 ? cajas / horasHombre : 0;
  return { cajas, horasHombre, indice };
}

// ===========================================================================
// TIEMPOS DE PORTERÍA POR ETAPA
// ---------------------------------------------------------------------------
// Segmentos de la secuencia operativa de una llave, desde que llega a portería
// hasta que sale. Cada etapa mide el tiempo entre DOS hitos de hora ya
// registrados (formato 'HH:MM'); se cuentan solo las llaves con AMBAS horas.
// ===========================================================================

/** Campo de hora de inicio/fin de una etapa (existe en UnifiedTransporte). */
type CampoHoraPorteria = 'horaLlegadaPorteria' | 'horaMuelleAsignado' | 'horaIngreso' | 'horaInicioCargue' | 'horaFinCargue' | 'horaSalida';

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

/** Rango de demora de una etapa: [min, max) en minutos; el último rango es abierto [480, ∞). */
export interface RangoDemora {
  id: string;
  label: string;
  min: number;
  max: number;
}

/** Los 6 rangos de demora que agrupan la duración de cada etapa en el gráfico de distribución. */
export const RANGOS_DEMORA: RangoDemora[] = [
  { id: '0-30min', label: '0-30 min', min: 0, max: 30 },
  { id: '30-60min', label: '30-60 min', min: 30, max: 60 },
  { id: '1-2h', label: '1-2 h', min: 60, max: 120 },
  { id: '2-4h', label: '2-4 h', min: 120, max: 240 },
  { id: '4-8h', label: '4-8 h', min: 240, max: 480 },
  { id: '>8h', label: '>8 h', min: 480, max: Number.POSITIVE_INFINITY },
];

/**
 * Conteo de llaves por rango de demora y por etapa: para cada llave y cada
 * etapa, su duración (min) cae en uno de los RANGOS_DEMORA y suma +1 a la
 * barra de ese estado. Devuelve { rangoId: { etapaId: conteo } } con las 5
 * etapas de cada rango inicializadas en 0.
 */
export function distribucionRangos(
  rows: UnifiedTransporte[]
): Record<string, Record<string, number>> {
  const base = Object.fromEntries(ETAPAS_PORTERIA.map((e) => [e.id, 0]));
  const res: Record<string, Record<string, number>> = {};
  for (const rg of RANGOS_DEMORA) res[rg.id] = { ...base };

  for (const r of rows) {
    for (const etapa of ETAPAS_PORTERIA) {
      const d = duracionEtapa(etapa, r);
      if (d == null) continue; // sin ambas horas o inconsistente: no aporta
      const rg = RANGOS_DEMORA.find((b) => d >= b.min && d < b.max);
      if (rg) res[rg.id][etapa.id] += 1;
    }
  }
  return res;
}

// ===========================================================================
// FASE 7 — Mapa de calor de posicionamiento (matriz Fecha × Hora)
// ===========================================================================

/** Meses abreviados en español para las etiquetas de fecha del heatmap. */
export const MESES_ABREV = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
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

/** Resultado de agrupar las operaciones por fecha y hora del inicio de cargue. */
export interface MapaPosicionamiento {
  celdas: Map<string, CeldaPosicion>; // clave "DD-mmm___HH:00"
  fechas: FechaPosicion[];            // ascendente (la más antigua arriba)
  horas: string[];                    // eje "HH:00" desde el inicio de jornada hasta las 23:00
  totalFilas: number;
}

/**
 * Agrupa las operaciones en una matriz Fecha × Hora para el mapa de calor de
 * posicionamiento. Cada fila se ubica por la hora real de inicio de cargue
 * (hora_inicio_cargue; si falta, se usa la hora de la cita) y se clasifica
 * contra la cita: <60 min a tiempo, 60-179 min leve, ≥180 min crítico.
 */
export function mapaPosicionamiento(rows: UnifiedTransporte[]): MapaPosicionamiento {
  const celdas = new Map<string, CeldaPosicion>();
  const fechasMap = new Map<string, Date>();
  const horasSet = new Set<number>();

  const agregar = (fechaLabel: string, fecha: Date, horaMins: number, clasif: ClasificacionCita) => {
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
    const fechaSrc = (r.citaCargue || '').trim() ? r.citaCargue : r.createdAt;
    const citaD = parsearFecha(fechaSrc);
    if (!citaD) continue;
    const fechaLabel = `${String(citaD.getDate()).padStart(2, '0')}-${MESES_ABREV[citaD.getMonth()]}`;
    const horaRaw = (r.horaInicioCargue || '').trim() ? r.horaInicioCargue : r.citaCargue;
    const mins = minutosHora(horaRaw);
    if (mins == null) continue; // sin hora de inicio ni de cita: no ubica en el mapa

    const citaMins = minutosHora(r.citaCargue);
    const inicioMins = minutosHora(r.horaInicioCargue);
    const demoraMins =
      citaMins != null && inicioMins != null && inicioMins > citaMins ? inicioMins - citaMins : 0;
    const clasif =
      citaMins == null || inicioMins == null || demoraMins < 60 ? 'aTiempo' : clasificarCita(demoraMins);
    agregar(fechaLabel, citaD, mins, clasif);
  }

  const fechas = [...fechasMap.entries()]
    .map(([label, fecha]) => ({ label, fecha }))
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  // La jornada inicia como mínimo a las 06:00 am; si hay cargues antes, el eje baja.
  const horasPresentes = [...horasSet];
  const minHora = horasPresentes.length ? Math.min(6, ...horasPresentes) : 6;
  const horas = Array.from({ length: 24 - minHora }, (_, i) =>
    `${String(minHora + i).padStart(2, '0')}:00`
  );

  return { celdas, fechas, horas, totalFilas: rows.length };
}