import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Cliente, Ciudad } from '../types';

const CLIENTES_TABLE = 'clientes';
const CIUDADES_TABLE = 'ciudades';

function isOnline(): boolean {
  return isSupabaseConfigured;
}

export async function fetchClientes(): Promise<Cliente[]> {
  if (!isOnline()) return [];
  const { data, error } = await supabase.from(CLIENTES_TABLE).select('*').order('denominacion');
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    codigoShipTo: r.codigo_ship_to,
    denominacion: r.denominacion,
  }));
}

export async function fetchCiudades(): Promise<Ciudad[]> {
  if (!isOnline()) return [];
  const { data, error } = await supabase.from(CIUDADES_TABLE).select('*').order('ciudad');
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    ciudad: r.ciudad,
  }));
}
