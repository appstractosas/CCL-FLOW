import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { UnifiedTransporte } from '../types';

const TABLE = 'transportes';

function mapTransporteToDB(item: UnifiedTransporte): Record<string, any> {
  return {
    llave: item.llave,
    fecha_hora: item.fechaHora,
    placa: item.placa,
    vehiculo_tipo: item.vehiculoTipo,
    cita_cargue: item.citaCargue || null,
    transportadora: item.transportadora || '',
    estado_transporte: item.estadoTransporte,
    estado_porteria: item.estadoPorteria,
    muelle_asignado: item.muelleAsignado || null,
    cuadrilla: item.cuadrilla || null,
    hora_muelle_asignado: item.horaMuelleAsignado || null,
    hora_ingreso: item.horaIngreso || null,
    hora_salida: item.horaSalida || null,
    hora_llegada_porteria: item.horaLlegadaPorteria || null,
    hora_inicio_cargue: item.horaInicioCargue || null,
    hora_fin_cargue: item.horaFinCargue || null,
    observaciones: item.observaciones || null,
  };
}

function mapTransporteFromDB(item: Record<string, any>): UnifiedTransporte {
  return {
    id: item.id,
    llave: item.llave,
    fechaHora: item.fecha_hora,
    placa: item.placa || '',
    vehiculoTipo: item.vehiculo_tipo,
    citaCargue: item.cita_cargue || '',
    transportadora: item.transportadora || '',
    estadoTransporte: item.estado_transporte,
    estadoPorteria: item.estado_porteria || 'Pendiente',
    muelleAsignado: item.muelle_asignado || undefined,
    cuadrilla: item.cuadrilla || undefined,
    horaMuelleAsignado: item.hora_muelle_asignado || undefined,
    horaIngreso: item.hora_ingreso || undefined,
    horaSalida: item.hora_salida || undefined,
    horaLlegadaPorteria: item.hora_llegada_porteria || undefined,
    horaInicioCargue: item.hora_inicio_cargue || undefined,
    horaFinCargue: item.hora_fin_cargue || undefined,
    observaciones: item.observaciones || undefined,
  };
}

function isOnline(): boolean {
  return isSupabaseConfigured;
}

export async function fetchTransportes(): Promise<UnifiedTransporte[]> {
  if (!isOnline()) return [];
  const { data, error } = await supabase.from(TABLE).select('*').order('fecha_hora', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapTransporteFromDB);
}

/** Consulta la tabla TRANSPORTES de la BD acotada al rango [fechaDesde, fechaHasta] (YYYY-MM-DD, hora local). */
export async function fetchTransportesByRango(fechaDesde: string, fechaHasta: string): Promise<UnifiedTransporte[]> {
  if (!isOnline()) return [];
  const desde = new Date(`${fechaDesde}T00:00:00`).toISOString();
  const hasta = new Date(`${fechaHasta}T23:59:59.999`).toISOString();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .gte('fecha_hora', desde)
    .lte('fecha_hora', hasta)
    .order('fecha_hora', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapTransporteFromDB);
}

export async function createTransporte(item: UnifiedTransporte): Promise<UnifiedTransporte> {
  const { data, error } = await supabase.from(TABLE).insert(mapTransporteToDB(item)).select().single();
  if (error) throw error;
  return mapTransporteFromDB(data);
}

export async function updateTransporte(id: string, updates: Partial<UnifiedTransporte>): Promise<void> {
  const dbUpdates: Record<string, any> = {};
  if (updates.fechaHora !== undefined) dbUpdates.fecha_hora = updates.fechaHora;
  if (updates.placa !== undefined) dbUpdates.placa = updates.placa;
  if (updates.vehiculoTipo !== undefined) dbUpdates.vehiculo_tipo = updates.vehiculoTipo;
  if (updates.citaCargue !== undefined) dbUpdates.cita_cargue = updates.citaCargue;
  if (updates.transportadora !== undefined) dbUpdates.transportadora = updates.transportadora;
  if (updates.estadoTransporte !== undefined) dbUpdates.estado_transporte = updates.estadoTransporte;
  if (updates.estadoPorteria !== undefined) dbUpdates.estado_porteria = updates.estadoPorteria;
  if (updates.muelleAsignado !== undefined) dbUpdates.muelle_asignado = updates.muelleAsignado;
  if (updates.cuadrilla !== undefined) dbUpdates.cuadrilla = updates.cuadrilla;
  if (updates.horaMuelleAsignado !== undefined) dbUpdates.hora_muelle_asignado = updates.horaMuelleAsignado;
  if (updates.horaIngreso !== undefined) dbUpdates.hora_ingreso = updates.horaIngreso;
  if (updates.horaSalida !== undefined) dbUpdates.hora_salida = updates.horaSalida;
  if (updates.horaLlegadaPorteria !== undefined) dbUpdates.hora_llegada_porteria = updates.horaLlegadaPorteria;
  if (updates.horaInicioCargue !== undefined) dbUpdates.hora_inicio_cargue = updates.horaInicioCargue;
  if (updates.horaFinCargue !== undefined) dbUpdates.hora_fin_cargue = updates.horaFinCargue;
  if (updates.observaciones !== undefined) dbUpdates.observaciones = updates.observaciones;
  const { error } = await supabase.from(TABLE).update(dbUpdates).eq('id', id);
  if (error) throw error;
}
