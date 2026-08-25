import { isSupabaseConfigured } from '../lib/supabase';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { fetchTransportesByRango } from './transportesService';
import type { UnifiedTransporte } from '../types';

/** Carga los transportes del rango [fechaDesde, fechaHasta] (YYYY-MM-DD).
 *  El rango responde a la columna FECHA HORA CITA (cita_cargue).
 *  En MODO DEMO (sin Supabase) filtra el estado local del store, igual que el Export Excel. */
export async function fetchInformesRango(
  fechaDesde: string,
  fechaHasta: string,
): Promise<UnifiedTransporte[]> {
  if (isSupabaseConfigured) {
    return fetchTransportesByRango(fechaDesde, fechaHasta);
  }
  const rows = useLogisticsStore.getState().transportes;
  return rows.filter((t) => {
    const d = String(t.citaCargue || '').slice(0, 10);
    return (!fechaDesde || d >= fechaDesde) && (!fechaHasta || d <= fechaHasta);
  });
}
