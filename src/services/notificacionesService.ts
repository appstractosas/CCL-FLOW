import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Notificacion, TipoNotificacion } from '../types';

const TABLE = 'notificaciones';

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

export async function createNotificacion(
  payload: Omit<Notificacion, 'id' | 'leida' | 'createdAt'>
): Promise<Notificacion> {
  if (!isOnline()) throw new Error('Notificaciones deshabilitadas en MODO DEMO');
  const { data, error } = await supabase.rpc('ccl_create_notificacion', { p_data: mapNotifToDB(payload) });
  if (error) throw error;
  return mapNotifFromDB(data);
}

export async function markAllNotificacionesLeidas(): Promise<void> {
  if (!isOnline()) return;
  const { error } = await supabase.rpc('ccl_mark_notifs_read');
  if (error) throw error;
}

export type RealtimeNotificacionCallback = (payload: Notificacion) => void;

let activeUnsubscribe: (() => void) | null = null;

export function subscribeToNotificaciones(callback: RealtimeNotificacionCallback): () => void {
  if (!isOnline()) return () => {};

  if (activeUnsubscribe) {
    activeUnsubscribe();
  }

  const channel = supabase
    .channel('notificaciones_realtime')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLE },
      (payload) => {
        callback(mapNotifFromDB(payload.new));
      }
    )
    .subscribe();

  activeUnsubscribe = () => {
    supabase.removeChannel(channel);
    activeUnsubscribe = null;
  };

  return activeUnsubscribe;
}
