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
  /** Costo diario por vehículo de la flota CCL (reporte de determinación horaria). */
  COSTO_DIARIO_CCL: 1_000_000,
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
  INGRESO_CAJA_SLA: 350,
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
  return [...mapa.values()].sort((a, b) => b.despachos - a.despachos);
}

/** Operaciones (llaves) por cliente/denominación, descendente, top N. */
export function operacionesPorCliente(rows: UnifiedTransporte[], topN = 10): ValorConteo[] {
  const mapa = new Map<string, number>();
  for (const r of rows) {
    const cliente = r.denominacion?.trim();
    if (!cliente) continue;
    mapa.set(cliente, (mapa.get(cliente) || 0) + 1);
  }
  return [...mapa.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
}

/** Bucket mensual/quincenal de rentabilidad: costo CCL vs ingreso SLA. */
export interface RentabilidadBucket {
  name: string;
  costoCCL: number;
  ingresoSLA: number;
}

/**
 * Rentabilidad por cuadrilla agrupada cada 5 días.
 * Costo CCL = cajas CCL × COSTO_CAJA_CCL; ingreso SLA/LTSA = cajas × INGRESO_CAJA_SLA.
 */
export function rentabilidadCuadrillas(rows: UnifiedTransporte[]): RentabilidadBucket[] {
  const bucketMin = 5;
  const keys = [...new Set(rows.map((r) => String(r.citaCargue || '').slice(0, 10)).filter(Boolean))].sort();
  const buckets = new Map<number, RentabilidadBucket>();
  keys.forEach((dia) => {
    const t = new Date(`${dia}T00:00:00`).getTime();
    const idx = Math.floor(t / (bucketMin * 86_400_000));
    if (!buckets.has(idx)) {
      buckets.set(idx, { name: dia, costoCCL: 0, ingresoSLA: 0 });
    }
  });
  for (const r of rows) {
    const dia = String(r.citaCargue || '').slice(0, 10);
    if (!dia) continue;
    const t = new Date(`${dia}T00:00:00`).getTime();
    const idx = Math.floor(t / (bucketMin * 86_400_000));
    const bucket = buckets.get(idx);
    if (!bucket) continue;
    const cajas = r.cajas ?? 0;
    const grupo = tipoGrupo(r.cuadrilla);
    if (grupo === 'CCL') bucket.costoCCL += cajas * CONSTANTES.COSTO_CAJA_CCL;
    else bucket.ingresoSLA += cajas * CONSTANTES.INGRESO_CAJA_SLA;
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

/** Distribución de cajas por tipo de cuadrilla (CCL/SLA/LTSA). */
export function cajasPorCuadrilla(rows: UnifiedTransporte[]): ValorConteo[] {
  const mapa = new Map<GrupoCuadrilla, number>();
  for (const r of rows) {
    const grupo = tipoGrupo(r.cuadrilla);
    mapa.set(grupo, (mapa.get(grupo) || 0) + (r.cajas ?? 0));
  }
  return (['CCL', 'SLA', 'LTSA'] as GrupoCuadrilla[]).map((g) => ({ name: g, value: mapa.get(g) || 0 }));
}