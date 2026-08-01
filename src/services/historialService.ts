import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { HistorialMovimiento } from '../types';

const TABLE = 'historial_movimientos';

function mapMovimientoFromDB(item: Record<string, any>): HistorialMovimiento {
  return {
    id: item.id,
    usuario: item.usuario,
    tipoUsuario: item.tipo_usuario,
    cedula: item.cedula || '',
    accion: item.accion,
    modulo: item.modulo || 'general',
    detalle: item.detalle || undefined,
    llaveRelacionada: item.llave_relacionada || undefined,
    createdAt: item.created_at || item.createdAt || new Date().toISOString(),
  };
}

function isOnline(): boolean {
  return isSupabaseConfigured;
}

export async function fetchHistorial(limit = 200): Promise<HistorialMovimiento[]> {
  if (!isOnline()) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapMovimientoFromDB);
}

export async function createMovimiento(item: HistorialMovimiento): Promise<HistorialMovimiento | null> {
  if (!isOnline()) return null;
  // Nota: NO se envía `id` de cliente; la columna es UUID y el insert fallaba con ids tipo "HIS-...".
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      usuario: item.usuario,
      tipo_usuario: item.tipoUsuario,
      cedula: item.cedula || null,
      accion: item.accion,
      modulo: item.modulo,
      detalle: item.detalle || null,
      llave_relacionada: item.llaveRelacionada || null,
      created_at: item.createdAt,
    })
    .select()
    .single();
  if (error) throw error;
  return mapMovimientoFromDB(data);
}
