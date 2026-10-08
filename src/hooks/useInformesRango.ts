import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { todayStr, inicioSemanaStr, inicioMesStr, inicioAnioStr } from '../lib/dateUtils';
import { isSupabaseConfigured } from '../lib/supabase';
import { fetchInformesRango } from '../services/informesService';
import { subscribeToTransportes } from '../services/transportesService';
import { primeraFechaDatos } from '../utils/informes';
import type { UnifiedTransporte } from '../types';

export type RangoPreset = 'dia' | 'semana' | 'mes' | 'anio';

/**
 * Rango de fechas + búsqueda + carga de filas de informes (fetch por rango y
 * refresco en vivo con debounce). Compartido por InformesModule e
 * InformesGerenciaModule para no duplicar la lógica de carga.
 */
export function useInformesRango() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [rangoPreset, setRangoPreset] = useState<RangoPreset>('dia');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<UnifiedTransporte[]>([]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rangoPresetRef = useRef<RangoPreset>('dia');

  /** Aplica el rango del botón: día hoy→hoy; semana desde el lunes; mes desde el día 1;
   *  año desde el 1-ene (luego se ajusta al primer día con datos). Siempre termina en hoy. */
  const aplicarRango = useCallback((preset: RangoPreset) => {
    rangoPresetRef.current = preset;
    setRangoPreset(preset);
    const hoy = todayStr();
    if (preset === 'dia') {
      setDateFrom(hoy);
      setDateTo(hoy);
    } else if (preset === 'semana') {
      setDateFrom(inicioSemanaStr());
      setDateTo(hoy);
    } else if (preset === 'mes') {
      setDateFrom(inicioMesStr());
      setDateTo(hoy);
    } else {
      setDateFrom(inicioAnioStr());
      setDateTo(hoy);
    }
  }, []);

  const load = useCallback(async (fs: string, ft: string) => {
    setError(null);
    try {
      const data = await fetchInformesRango(fs, ft);
      // Año: el rango inicia el día más antiguo con datos (p. ej. 25-jul si no hay en enero).
      if (rangoPresetRef.current === 'anio') {
        const primera = primeraFechaDatos(data);
        if (primera && primera > fs) setDateFrom(primera);
      }
      setRows(data);
    } catch (err) {
      console.error('Error cargando informes:', err);
      setError('No se pudo cargar la información. Revisa la conexión con la base de datos.');
      setRows([]);
    } finally {
      // Solo la carga inicial muestra el spinner; los refrescos (realtime, cambio
      // de rango) actualizan en segundo plano sin parpadeo.
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de métricas del rango (fetch + state async)
    void load(dateFrom, dateTo);
  }, [dateFrom, dateTo, load]);

  // Refresco en vivo: cuando la operación cambia (Sheets, portería, etc.) se recalculan las métricas.
  // Con DEBOUNCE: el sync del Sheets dispara muchos eventos seguidos y refrescar cada uno
  // haría parpadear las filas; se agrupan y se refrescan una sola vez por ráfaga.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const unsubscribe = subscribeToTransportes(() => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        void load(dateFrom, dateTo);
      }, 350);
    });
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      unsubscribe();
    };
  }, [dateFrom, dateTo, load]);

  const s = searchTerm.trim().toLowerCase();
  const rowsFiltradas = useMemo(() => {
    if (!s) return rows;
    return rows.filter((r) =>
      [r.llave, r.placa, r.transportadora].some((v) =>
        String(v || '')
          .toLowerCase()
          .includes(s),
      ),
    );
  }, [rows, s]);

  return {
    searchTerm,
    setSearchTerm,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    rangoPreset,
    aplicarRango,
    loading,
    error,
    rowsFiltradas,
    sinDatos: rowsFiltradas.length === 0,
  };
}
