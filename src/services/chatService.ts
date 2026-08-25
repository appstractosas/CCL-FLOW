import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ChatMessage } from '../types';

const TABLE = 'chat_messages';

/** Convierte un mensaje del formato frontend al formato BD (snake_case). */
function mapMessageToDB(item: ChatMessage): Record<string, any> {
  return {
    sender_role: item.senderRole,
    sender_name: item.senderName,
    sender_module: item.senderModule,
    llave_relacionada: item.llaveRelacionada || null,
    muelle_sugerido: item.muelleSugerido || null,
    content: item.content,
    timestamp: item.timestamp,
    is_read: item.isRead ?? false,
  };
}

/** Convierte un mensaje de la BD al formato frontend. */
function mapMessageFromDB(item: Record<string, any>): ChatMessage {
  return {
    id: item.id,
    senderRole: item.sender_role,
    senderName: item.sender_name,
    senderModule: item.sender_module,
    llaveRelacionada: item.llave_relacionada || undefined,
    muelleSugerido: item.muelle_sugerido || undefined,
    content: item.content,
    timestamp: item.timestamp,
    isRead: item.is_read,
  };
}

function isOnline(): boolean {
  return isSupabaseConfigured;
}

/** Obtiene todos los mensajes del chat ordenados por timestamp ascendente. */
export async function fetchMessages(): Promise<ChatMessage[]> {
  if (!isOnline()) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('timestamp', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapMessageFromDB);
}

/**
 * Envía un mensaje nuevo al chat via RPC `ccl_send_message`.
 * Retorna el mensaje creado con el ID generado por la BD.
 */
export async function sendMessage(item: ChatMessage): Promise<ChatMessage> {
  const { data, error } = await supabase.rpc('ccl_send_message', { p_data: mapMessageToDB(item) });
  if (error) throw error;
  return mapMessageFromDB(data);
}

export type RealtimeCallback<T> = (payload: T) => void;

let activeUnsubscribe: (() => void) | null = null;

/**
 * Se suscribe a mensajes nuevos del chat via Supabase Realtime.
 * Solo escucha eventos INSERT (no UPDATE/DELETE).
 * Limpia la suscripción previa automáticamente.
 * @returns Función para desuscribirse.
 */
export function subscribeToMessages(callback: RealtimeCallback<ChatMessage>): () => void {
  if (!isOnline()) return () => {};

  // Si ya hay una suscripción activa, se elimina primero para no volver a usar
  // el mismo canal tras subscribe() (evita el error de realtime y las duplicadas).
  if (activeUnsubscribe) {
    activeUnsubscribe();
  }

  const channel = supabase
    .channel('chat_messages_realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE }, (payload) => {
      callback(mapMessageFromDB(payload.new));
    })
    .subscribe();

  activeUnsubscribe = () => {
    supabase.removeChannel(channel);
    activeUnsubscribe = null;
  };

  return activeUnsubscribe;
}
