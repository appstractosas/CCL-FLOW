import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock, FileDown, Loader2, Truck } from 'lucide-react';
import { ModuleToolbar } from '../common/ModuleToolbar';
import { todayStr } from '../../lib/dateUtils';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { fetchTransportesByRango } from '../../services/transportesService';
import { fetchInformesRango } from '../../services/informesService';
import { subscribeToTransportes } from '../../services/transportesService';
import { getEstadoPorteria } from '../../utils/porteria';
import {
  calcularKPIs,
  embudoEstados,
  porTipo,
  porTransportadora,
  volumenPorDia,
  filasPorRango,
  filasParaTabla,
  tipoGrupo,
  usoPorMuelle,
  rentabilidadCuadrillas,
  cajasPorDia,
  cajasPorCuadrilla,
  tiemposPorteria,
  distribucionRangos,
} from '../../utils/informes';
import type { UnifiedTransporte } from '../../types';
import {
  EmbudoPanel,
  FlotaPanel,
  TransportadorasPanel,
  VolumenPanel,
  MuellesPanel,
  RentabilidadPanel,
  CajasDiariasPanel,
  CajasGrupoPanel,
  DetalleTabla,
  TiemposEtapaPanel,
  TiemposDistribucionPanel,
} from './informes/panels';

export const InformesModule: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [rangoPreset, setRangoPreset] = useState<'dia' | 'semana' | 'mes' | 'anio'>('dia');
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<UnifiedTransporte[]>([]);
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Fecha local "YYYY-MM-DD" desplazada n días desde hoy. */
  const shiftDate = useCallback((days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  /** Aplica el rango del botón: semana/mes/año (siempre terminando en hoy). */
  const aplicarRango = useCallback(
    (preset: 'dia' | 'semana' | 'mes' | 'anio') => {
      setRangoPreset(preset);
      const hoy = todayStr();
      if (preset === 'dia') {
        setDateFrom(hoy);
        setDateTo(hoy);
      } else if (preset === 'semana') {
        setDateFrom(shiftDate(-6));
        setDateTo(hoy);
      } else if (preset === 'mes') {
        setDateFrom(shiftDate(-29));
        setDateTo(hoy);
      } else {
        setDateFrom(shiftDate(-364));
        setDateTo(hoy);
      }
    },
    [shiftDate]
  );

  const load = useCallback(async (fs: string, ft: string) => {
    setError(null);
    try {
      const data = await fetchInformesRango(fs, ft);
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
    void load(dateFrom, dateTo);
  }, [dateFrom, dateTo, load]);

  // Refresco en vivo: cuando la operación cambia (Sheets, portería, etc.) se recalculan las métricas.
  // Con DEBOUNCE: el sync del Sheets dispara muchos eventos seguidos y refrescar cada uno
  // haría parpadear las filas; se agrupan y se refresca una sola vez por ráfaga.
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
      [r.llave, r.placa, r.transportadora].some((v) => String(v || '').toLowerCase().includes(s))
    );
  }, [rows, s]);

  const kpis = useMemo(() => calcularKPIs(rowsFiltradas), [rowsFiltradas]);
  const embudo = useMemo(() => embudoEstados(rowsFiltradas), [rowsFiltradas]);
  const flota = useMemo(() => porTipo(rowsFiltradas), [rowsFiltradas]);
  const transportadoras = useMemo(() => porTransportadora(rowsFiltradas, 8), [rowsFiltradas]);
  const volumen = useMemo(() => volumenPorDia(rowsFiltradas), [rowsFiltradas]);

  // Fase 3: filas detalle del rango (demora contra SLA).
  const filasTabla = useMemo(
    () => filasParaTabla(filasPorRango(rowsFiltradas, dateFrom, dateTo)),
    [rowsFiltradas, dateFrom, dateTo]
  );

  // Nuevos gráficos (según el rango seleccionado).
  const usoMuelle = useMemo(() => usoPorMuelle(rowsFiltradas), [rowsFiltradas]);
  const rentabilidad = useMemo(
    () => rentabilidadCuadrillas(rowsFiltradas, dateFrom, dateTo),
    [rowsFiltradas, dateFrom, dateTo]
  );
  const cajasDia = useMemo(() => cajasPorDia(rowsFiltradas), [rowsFiltradas]);
  const cajasGrupo = useMemo(() => cajasPorCuadrilla(rowsFiltradas), [rowsFiltradas]);

  // Tiempos de portería: promedio por etapa + distribución por rango de demora.
  const tiemposEtapas = useMemo(() => tiemposPorteria(rowsFiltradas), [rowsFiltradas]);
  const distribucionRangosData = useMemo(() => distribucionRangos(rowsFiltradas), [rowsFiltradas]);

  // Inversiones del periodo según el rango de fechas.
  const { diasRango, inversionCCL, inversionSLA, cajasPeriodo, inversionTotal } = useMemo(() => {
    // Nº de días del rango (inclusivo).
    const t0 = new Date(`${dateFrom}T00:00:00`).getTime();
    const t1 = new Date(`${dateTo}T00:00:00`).getTime();
    const dias = t1 >= t0 ? Math.floor((t1 - t0) / 86_400_000) + 1 : 0;

    const cajasCCL = rowsFiltradas.filter((r) => tipoGrupo(r.cuadrilla) === 'CCL').reduce((a, r) => a + (r.cajas ?? 0), 0);
    const cajasSLA = rowsFiltradas.filter((r) => tipoGrupo(r.cuadrilla) === 'SLA').reduce((a, r) => a + (r.cajas ?? 0), 0);
    const cajasTodas = rowsFiltradas.reduce((a, r) => a + (r.cajas ?? 0), 0);

    const inversionCCL = dias * 1_432_000;
    const inversionSLA = cajasSLA * 140;
    return {
      diasRango: dias,
      inversionCCL,
      inversionSLA,
      cajasPeriodo: cajasTodas,
      inversionTotal: inversionCCL + inversionSLA,
      cajasCCL,
    };
  }, [rowsFiltradas, dateFrom, dateTo]);

  const sinDatos = rowsFiltradas.length === 0;

  const handleExportExcel = async () => {
    if (exporting || !dateFrom || !dateTo) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      let dataRows: UnifiedTransporte[];
      if (isSupabaseConfigured) {
        dataRows = await fetchTransportesByRango(dateFrom, dateTo);
      } else {
        dataRows = useLogisticsStore.getState().transportes.filter((t) => {
          const d = String(t.citaCargue || '').slice(0, 10);
          return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
        });
      }

      if (dataRows.length === 0) {
        alert('No hay transportes registrados en el rango de fechas seleccionado.');
        return;
      }

      const headers = [
        'LLAVE', 'FECHA', 'PLACA REMOLQUE', 'TIPO VEHÍCULO', 'CITA CARGUE', 'TRANSPORTE', 'DENOMINACIÓN', 'CAJAS',
        'TRANSPORTADORA', 'ESTADO TRANSPORTE', 'ESTADO', 'MUELLE', 'CUADRILLA', 'H. ASIGNACIÓN MUELLE',
        'H. LLEGADA PORTERÍA', 'H. INGRESO', 'H. INICIO CARGUE', 'H. FIN CARGUE', 'H. SALIDA',
        'OBSERVACIONES',
      ];
      const data = dataRows.map((r) => [
        r.llave, r.fechaHora, r.placa, r.vehiculoTipo, r.citaCargue, r.transporte || '', r.denominacion || '', r.cajas ?? '',
        r.transportadora, r.estadoTransporte, getEstadoPorteria(r), r.muelleAsignado || '', r.cuadrilla || '',
        r.horaMuelleAsignado || '', r.horaLlegadaPorteria || '', r.horaIngreso || '',
        r.horaInicioCargue || '', r.horaFinCargue || '', r.horaSalida || '', r.observaciones || '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      ws['!cols'] = headers.map((_, i) => ({
        wch: Math.min(
          40,
          Math.max(
            headers[i].length,
            ...data.slice(0, 200).map((row) => String(row[i] ?? '').length)
          ) + 2
        ),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'TRANSPORTES');
      XLSX.writeFile(wb, `TRANSPORTES_${dateFrom}_a_${dateTo}.xlsx`);
    } catch (err) {
      console.error('Error exportando a Excel:', err);
      alert('No se pudo exportar a Excel. Revisa la conexión con la base de datos.');
    } finally {
      setExporting(false);
    }
  };

  const kpiCards = [
    {
      label: 'TOTAL LLAVES',
      value: kpis.total,
      sub: 'En el rango seleccionado',
      icon: <Truck className="w-4 h-4 text-blue-400" />,
      accent: 'text-white',
    },
    {
      label: 'LLAVES ACTIVAS',
      value: kpis.activas,
      sub: 'En operación ahora',
      icon: <Activity className="w-4 h-4 text-emerald-400" />,
      accent: 'text-emerald-400',
    },
    {
      label: 'FINALIZADAS',
      value: kpis.finalizadas,
      sub: 'Salieron de portería',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      accent: 'text-white',
    },
    {
      label: 'CUMPLIMIENTO',
      value: kpis.total > 0 ? `${kpis.cumplimientoPct}%` : '—',
      sub: 'Finalizadas / total',
      icon: <Clock className="w-4 h-4 text-amber-400" />,
      accent: 'text-amber-400',
    },
  ];

  return (
    <div className="space-y-6">
      <ModuleToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar llave, placa o transportadora..."
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        rightContent={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl bg-zinc-900 border border-zinc-800 p-0.5">
              {(
                [
                  ['dia', 'Día'],
                  ['semana', 'Semana'],
                  ['mes', 'Mes'],
                  ['anio', 'Año'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => aplicarRango(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    rangoPreset === key
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="w-4 h-4" />
              <span>{exporting ? 'Exportando...' : 'Exportar Excel'}</span>
            </button>
          </div>
        }
      />

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Tags de inversión del periodo (una sola fila en PC, cascada en móvil) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0e1320] border border-blue-500/20 rounded-2xl px-4 py-3 flex flex-col gap-1">
              <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">CCL (inversión)</p>
              <p className="text-[10px] text-zinc-500 font-mono">{diasRango} días × $1.432.000</p>
              <p className="text-xl font-black text-white">${inversionCCL.toLocaleString('es-CO')}</p>
            </div>

            <div className="bg-[#0e1320] border border-emerald-500/20 rounded-2xl px-4 py-3 flex flex-col gap-1">
              <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">SLA (inversión)</p>
              <p className="text-[10px] text-zinc-500 font-mono">
                {inversionSLA > 0 ? `${inversionSLA / 140} cajas SLA × $140` : 'sin cajas SLA en el rango'}
              </p>
              <p className="text-xl font-black text-white">${inversionSLA.toLocaleString('es-CO')}</p>
            </div>

            <div className="bg-[#0e1320] border border-amber-500/20 rounded-2xl px-4 py-3 flex flex-col gap-1">
              <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Cajas del periodo</p>
              <p className="text-[10px] text-zinc-500 font-mono">Suma de cajas de todas las cuadrillas</p>
              <p className="text-xl font-black text-white">{cajasPeriodo.toLocaleString('es-CO')}</p>
            </div>

            <div className="bg-[#0e1320] border border-violet-500/20 rounded-2xl px-4 py-3 flex flex-col gap-1">
              <p className="text-[11px] font-bold text-violet-400 uppercase tracking-wider">Inversión total del periodo</p>
              <p className="text-[10px] text-zinc-500 font-mono">CCL + SLA</p>
              <p className="text-xl font-black text-white">${inversionTotal.toLocaleString('es-CO')}</p>
            </div>
          </div>

          {/* 4 KPI Cards (datos reales del rango) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((k) => (
              <div
                key={k.label}
                className="bg-[#0e1320] border border-zinc-800/80 rounded-2xl px-4 py-2 flex items-center justify-between gap-3"
              >
                <div className="flex flex-col">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{k.label}</p>
                  <p className="text-[9px] text-zinc-500 font-mono">{k.sub}</p>
                </div>
                <p className={`text-lg font-black ${k.accent}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Cajas diarias (75%) + Cajas cargadas por cuadrilla (25%) — PC en fila, móvil apilado */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <CajasDiariasPanel data={cajasDia} sinDatos={sinDatos} />
            </div>
            <CajasGrupoPanel data={cajasGrupo} sinDatos={sinDatos} />
          </div>

          {/* Embudo de estados + Flota donut + Transportadoras */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <EmbudoPanel data={embudo} sinDatos={sinDatos} />
            <FlotaPanel data={flota} sinDatos={sinDatos} />
            <TransportadorasPanel data={transportadoras} sinDatos={sinDatos} />
          </div>

          {/* Volumen de llaves por día */}
          <VolumenPanel data={volumen} sinDatos={sinDatos} />

          {/* Tiempos de portería: promedio por etapa (5 barras según hito) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TiemposEtapaPanel data={tiemposEtapas} sinDatos={sinDatos} />
            <TiemposDistribucionPanel data={distribucionRangosData} sinDatos={sinDatos} />
          </div>

          {/* Uso y Ocupación de Muelles */}
          <MuellesPanel data={usoMuelle} sinDatos={sinDatos} />

          {/* Rentabilidad cuadrillas */}
          <RentabilidadPanel data={rentabilidad} sinDatos={sinDatos} />

          {/* Fase 3+5: Tabla detalle del rango */}
          <DetalleTabla filas={filasTabla} />
        </>
      )}
    </div>
  );
};
