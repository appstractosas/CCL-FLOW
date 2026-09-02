import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { HistorialMovimiento } from '../types';

const TABLE = 'historial_movimientos';

/** Convierte un movimiento de la BD al formato frontend. */
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

/**
 * Obtiene el historial de movimientos más recientes.
 * @param limit - Cantidad máxima de registros (default: 200).
 */
export async function fetchHistorial(limit = 200): Promise<HistorialMovimiento[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapMovimientoFromDB);
}

/**
 * Registra un movimiento de auditoría via RPC `ccl_create_movimiento`.
 * Se llama automáticamente al crear/editar/eliminar transportes, usuarios, etc.
 * @returns El movimiento creado, o null si está en modo demo.
 */
export async function createMovimiento(
  item: HistorialMovimiento,
): Promise<HistorialMovimiento | null> {
  if (!isSupabaseConfigured) return null;
  const payload: Record<string, any> = {
    usuario: item.usuario,
    tipo_usuario: item.tipoUsuario,
    cedula: item.cedula || null,
    accion: item.accion,
    modulo: item.modulo,
    detalle: item.detalle || null,
    llave_relacionada: item.llaveRelacionada || null,
    created_at: item.createdAt,
  };
  const { data, error } = await supabase.rpc('ccl_create_movimiento', { p_data: payload });
  if (error) throw error;
  return mapMovimientoFromDB(data);
}
