import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Notificacion, TipoNotificacion } from '../types';

const TABLE = 'notificaciones';

/** Convierte una notificación de la BD al formato frontend. */
function mapNotifFromDB(item: Record<string, any>): Notificacion {
  return {
    id: item.id,
    tipo: item.tipo as TipoNotificacion,
    titulo: item.titulo,
    mensaje: item.mensaje,
    llaveRelacionada: item.llave_relacionada || undefined,
    leida: item.leida ?? false,
    createdAt: item.created_at,
  };
}

function mapNotifToDB(item: Omit<Notificacion, 'id' | 'leida' | 'createdAt'>): Record<string, any> {
  return {
    tipo: item.tipo,
    titulo: item.titulo,
    mensaje: item.mensaje,
    llave_relacionada: item.llaveRelacionada || null,
  };
}

function isOnline(): boolean {
  return isSupabaseConfigured;
}

/**
 * Obtiene las notificaciones más recientes.
 * @param limit - Cantidad máxima de notificaciones (default: 50).
 */
export async function fetchNotificaciones(limit = 50): Promise<Notificacion[]> {
  if (!isOnline()) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapNotifFromDB);
}

/**
 * Crea una notificación via RPC `ccl_create_notificacion`.
 * Las notificaciones se propagan a todos los usuarios via Realtime.
 */
export async function createNotificacion(
  payload: Omit<Notificacion, 'id' | 'leida' | 'createdAt'>,
): Promise<Notificacion> {
  if (!isOnline()) throw new Error('Notificaciones deshabilitadas en MODO DEMO');
  const { data, error } = await supabase.rpc('ccl_create_notificacion', {
    p_data: mapNotifToDB(payload),
  });
  if (error) throw error;
  return mapNotifFromDB(data);
}

/** Marca todas las notificaciones como leídas via RPC `ccl_mark_notifs_read`. */
export async function markAllNotificacionesLeidas(): Promise<void> {
  if (!isOnline()) return;
  const { error } = await supabase.rpc('ccl_mark_notifs_read');
  if (error) throw error;
}

export type RealtimeNotificacionCallback = (payload: Notificacion) => void;

let activeUnsubscribe: (() => void) | null = null;

/**
 * Se suscribe a notificaciones nuevas via Supabase Realtime.
 * Solo escucha eventos INSERT. Limpia la suscripción previa automáticamente.
 * @returns Función para desuscribirse.
 */
export function subscribeToNotificaciones(callback: RealtimeNotificacionCallback): () => void {
  if (!isOnline()) return () => {};

  if (activeUnsubscribe) {
    activeUnsubscribe();
  }

  const channel = supabase
    .channel('notificaciones_realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE }, (payload) => {
      callback(mapNotifFromDB(payload.new));
    })
    .subscribe();

  activeUnsubscribe = () => {
    supabase.removeChannel(channel);
    activeUnsubscribe = null;
  };

  return activeUnsubscribe;
}
