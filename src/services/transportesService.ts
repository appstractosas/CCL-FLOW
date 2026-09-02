import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { UnifiedTransporte } from '../types';

const TABLE = 'transportes';

/**
 * Convierte un registro del formato frontend (camelCase) al formato BD (snake_case).
 * Se usa para inserts y updates via RPC.
 */
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
    region: item.region || null,
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

/** Convierte un registro de la BD (snake_case) al formato frontend (camelCase). */
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
    cajasManual: item.cajas_manual ?? undefined,
    destino: item.destino || undefined,
    region: item.region || undefined,
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

/**
 * Obtiene todos los transportes ordenados por fecha descendente.
 * En modo demo retorna array vacío.
 */
export async function fetchTransportes(): Promise<UnifiedTransporte[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('fecha_hora', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapTransporteFromDB);
}

/** Consulta la tabla TRANSPORTES de la BD acotada al rango [fechaDesde, fechaHasta] (YYYY-MM-DD, hora local)
 *  según la columna cita_cargue (FECHA HORA CITA). Es VARCHAR y admite formatos
 *  "YYYY-MM-DD HH:MM" (app) y "YYYY-MM-DDTHH:MM" (sync ISO). Los límites se comparan
 *  como texto: desde = día + espacio, hasta = día + 'Z' (carácter mayor que T y
 *  que el espacio; el '~' falla en PostgREST al combinarse con gte). */
export async function fetchTransportesByRango(
  fechaDesde: string,
  fechaHasta: string,
): Promise<UnifiedTransporte[]> {
  if (!isSupabaseConfigured) return [];
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

/** Igual que fetchTransportesByRango pero devuelve las filas CRUDAS de la BD:
 *  todas las columnas existentes, sin mapear a UnifiedTransporte. La usa el
 *  export de Informes para volcar la tabla TRANSPORTES completa, sin importar
 *  qué columnas tenga ni qué datos contenga. */
export async function fetchTransportesRawByRango(
  fechaDesde: string,
  fechaHasta: string,
): Promise<Record<string, any>[]> {
  if (!isSupabaseConfigured) return [];
  const desde = `${fechaDesde} `;
  const hasta = `${fechaHasta}Z`;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .gte('cita_cargue', desde)
    .lte('cita_cargue', hasta)
    .order('cita_cargue', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createTransporte(item: UnifiedTransporte): Promise<UnifiedTransporte> {
  const { data, error } = await supabase.rpc('ccl_create_transporte', {
    p_data: mapTransporteToDB(item),
  });
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
  if (!isSupabaseConfigured) return () => {};

  // Si ya hay una suscripción activa, se elimina primero para no volver a usar
  // el mismo canal tras subscribe() (evita el error de realtime y las duplicadas).
  if (activeRealtimeUnsubscribe) {
    activeRealtimeUnsubscribe();
  }

  const channel = supabase
    .channel('transportes_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
      void onChange();
    })
    .subscribe();

  activeRealtimeUnsubscribe = () => {
    supabase.removeChannel(channel);
    activeRealtimeUnsubscribe = null;
  };

  return activeRealtimeUnsubscribe;
}

/**
 * Actualiza campos específicos de un transporte existente.
 * Llama a la RPC `ccl_update_transporte` (SECURITY DEFINER).
 * Si la BD no afecta ninguna fila, lanza un error explícito.
 */
export async function updateTransporte(
  id: string,
  updates: Partial<UnifiedTransporte>,
): Promise<void> {
  const dbUpdates: Record<string, any> = {};
  if (updates.fechaHora !== undefined) dbUpdates.fecha_hora = updates.fechaHora;
  if (updates.placa !== undefined) dbUpdates.placa = updates.placa;
  if (updates.vehiculoTipo !== undefined) dbUpdates.vehiculo_tipo = updates.vehiculoTipo;
  if (updates.citaCargue !== undefined) dbUpdates.cita_cargue = updates.citaCargue;
  if (updates.transporte !== undefined) dbUpdates.transporte = updates.transporte;
  if (updates.denominacion !== undefined) dbUpdates.denominacion = updates.denominacion;
  if (updates.cajas !== undefined) dbUpdates.cajas = updates.cajas;
  if (updates.cajasManual !== undefined) dbUpdates.cajas_manual = updates.cajasManual;
  if (updates.destino !== undefined) dbUpdates.destino = updates.destino;
  if (updates.region !== undefined) dbUpdates.region = updates.region;
  if (updates.transportadora !== undefined) dbUpdates.transportadora = updates.transportadora;
  if (updates.estadoTransporte !== undefined)
    dbUpdates.estado_transporte = updates.estadoTransporte;
  if (updates.estadoPorteria !== undefined) dbUpdates.estado_porteria = updates.estadoPorteria;
  if (updates.muelleAsignado !== undefined) dbUpdates.muelle_asignado = updates.muelleAsignado;
  if (updates.cuadrilla !== undefined) dbUpdates.cuadrilla = updates.cuadrilla;
  if (updates.horaMuelleAsignado !== undefined)
    dbUpdates.hora_muelle_asignado = updates.horaMuelleAsignado;
  if (updates.horaIngreso !== undefined) dbUpdates.hora_ingreso = updates.horaIngreso;
  if (updates.horaSalida !== undefined) dbUpdates.hora_salida = updates.horaSalida;
  if (updates.horaLlegadaPorteria !== undefined)
    dbUpdates.hora_llegada_porteria = updates.horaLlegadaPorteria;
  if (updates.horaInicioCargue !== undefined)
    dbUpdates.hora_inicio_cargue = updates.horaInicioCargue;
  if (updates.horaFinCargue !== undefined) dbUpdates.hora_fin_cargue = updates.horaFinCargue;
  if (updates.observaciones !== undefined) dbUpdates.observaciones = updates.observaciones;
  const { error } = await supabase.rpc('ccl_update_transporte', { p_id: id, p_data: dbUpdates });
  if (error) throw error;
}
