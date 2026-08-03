import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ChatMessage } from '../types';

const TABLE = 'chat_messages';

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

export async function fetchMessages(): Promise<ChatMessage[]> {
  if (!isOnline()) return [];
  const { data, error } = await supabase.from(TABLE).select('*').order('timestamp', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapMessageFromDB);
}

export async function sendMessage(item: ChatMessage): Promise<ChatMessage> {
  const { data, error } = await supabase.from(TABLE).insert(mapMessageToDB(item)).select().single();
  if (error) throw error;
  return mapMessageFromDB(data);
}

export type RealtimeCallback<T> = (payload: T) => void;

let activeUnsubscribe: (() => void) | null = null;

export function subscribeToMessages(callback: RealtimeCallback<ChatMessage>): () => void {
  if (!isOnline()) return () => {};

  // Si ya hay una suscripción activa, se elimina primero para no volver a usar
  // el mismo canal tras subscribe() (evita el error de realtime y las duplicadas).
  if (activeUnsubscribe) {
    activeUnsubscribe();
  }

  const channel = supabase
    .channel('chat_messages_realtime')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLE },
      (payload) => {
        callback(mapMessageFromDB(payload.new));
      }
    )
    .subscribe();

  activeUnsubscribe = () => {
    supabase.removeChannel(channel);
    activeUnsubscribe = null;
  };

  return activeUnsubscribe;
}
