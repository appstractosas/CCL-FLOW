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
    transporte: item.transporte || null,
    denominacion: item.denominacion || null,
    cajas: item.cajas ?? null,
    destino: item.destino || null,
    kg: item.kg ?? null,
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
    transporte: item.transporte || undefined,
    denominacion: item.denominacion || undefined,
    cajas: item.cajas ?? undefined,
    destino: item.destino || undefined,
    kg: item.kg ?? undefined,
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
    createdAt: item.created_at || undefined,
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

/** Consulta la tabla TRANSPORTES de la BD acotada al rango [fechaDesde, fechaHasta] (YYYY-MM-DD, hora local)
 *  según la columna cita_cargue (FECHA HORA CITA). Es VARCHAR y admite formatos
 *  "YYYY-MM-DD HH:MM" (app) y "YYYY-MM-DDTHH:MM" (sync ISO). Los límites se comparan
 *  como texto: desde = día + espacio, hasta = día + 'Z' (carácter mayor que T y
 *  que el espacio; el '~' falla en PostgREST al combinarse con gte). */
export async function fetchTransportesByRango(fechaDesde: string, fechaHasta: string): Promise<UnifiedTransporte[]> {
  if (!isOnline()) return [];
  const desde = `${fechaDesde} `;
  const hasta = `${fechaHasta}Z`;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .gte('cita_cargue', desde)
    .lte('cita_cargue', hasta)
    .order('cita_cargue', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapTransporteFromDB);
}

export async function createTransporte(item: UnifiedTransporte): Promise<UnifiedTransporte> {
  const { data, error } = await supabase.from(TABLE).insert(mapTransporteToDB(item)).select().single();
  if (error) throw error;
  return mapTransporteFromDB(data);
}

let activeRealtimeUnsubscribe: (() => void) | null = null;

/**
 * Se suscribe a cambios (INSERT/UPDATE/DELETE) en la tabla TRANSPORTES
 * para que la app se refresque en tiempo real cuando otra fuente (p.ej. el
 * App Script del Sheets) modifique la BD.
 */
export function subscribeToTransportes(onChange: () => void): () => void {
  if (!isOnline()) return () => {};

  // Si ya hay una suscripción activa, se elimina primero para no volver a usar
  // el mismo canal tras subscribe() (evita el error de realtime y las duplicadas).
  if (activeRealtimeUnsubscribe) {
    activeRealtimeUnsubscribe();
  }

  const channel = supabase
    .channel('transportes_realtime')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        void onChange();
      }
    )
    .subscribe();

  activeRealtimeUnsubscribe = () => {
    supabase.removeChannel(channel);
    activeRealtimeUnsubscribe = null;
  };

  return activeRealtimeUnsubscribe;
}

export async function updateTransporte(id: string, updates: Partial<UnifiedTransporte>): Promise<void> {
  const dbUpdates: Record<string, any> = {};
  if (updates.fechaHora !== undefined) dbUpdates.fecha_hora = updates.fechaHora;
  if (updates.placa !== undefined) dbUpdates.placa = updates.placa;
  if (updates.vehiculoTipo !== undefined) dbUpdates.vehiculo_tipo = updates.vehiculoTipo;
  if (updates.citaCargue !== undefined) dbUpdates.cita_cargue = updates.citaCargue;
  if (updates.transporte !== undefined) dbUpdates.transporte = updates.transporte;
  if (updates.denominacion !== undefined) dbUpdates.denominacion = updates.denominacion;
  if (updates.cajas !== undefined) dbUpdates.cajas = updates.cajas;
  if (updates.destino !== undefined) dbUpdates.destino = updates.destino;
  if (updates.kg !== undefined) dbUpdates.kg = updates.kg;
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
