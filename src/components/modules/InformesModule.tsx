import React, { useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock, FileDown, Loader2, Truck } from 'lucide-react';
import { ModuleToolbar } from '../common/ModuleToolbar';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { fetchTransportesRawByRango } from '../../services/transportesService';
import { useInformesRango } from '../../hooks/useInformesRango';
import {
  calcularKPIs,
  embudoEstados,
  porTipo,
  porTransportadora,
  volumenPorDia,
  usoPorMuelle,
  cajasPorDia,
  cajasPorCuadrilla,
  tiemposPorteria,
  mapaPosicionamiento,
  tiempoCarguePorTipo,
} from '../../utils/informes';
import {
  EmbudoPanel,
  FlotaPanel,
  TransportadorasPanel,
  VolumenPanel,
  MuellesPanel,
  CajasDiariasPanel,
  CajasGrupoPanel,
  TiempoCarguePanel,
  TiemposEtapaPanel,
  PosicionamientoPanel,
} from './informes/panels';

export const InformesModule: React.FC = () => {
  const {
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
    sinDatos,
  } = useInformesRango();
  const [exporting, setExporting] = useState(false);

  const kpis = useMemo(() => calcularKPIs(rowsFiltradas), [rowsFiltradas]);
  const embudo = useMemo(() => embudoEstados(rowsFiltradas), [rowsFiltradas]);
  const flota = useMemo(() => porTipo(rowsFiltradas), [rowsFiltradas]);
  const transportadoras = useMemo(() => porTransportadora(rowsFiltradas, 8), [rowsFiltradas]);
  const volumen = useMemo(() => volumenPorDia(rowsFiltradas), [rowsFiltradas]);

  const usoMuelle = useMemo(() => usoPorMuelle(rowsFiltradas), [rowsFiltradas]);
  const cajasDia = useMemo(() => cajasPorDia(rowsFiltradas), [rowsFiltradas]);
  const cajasGrupo = useMemo(() => cajasPorCuadrilla(rowsFiltradas), [rowsFiltradas]);

  // Tiempos de portería: promedio por etapa.
  const tiemposEtapas = useMemo(() => tiemposPorteria(rowsFiltradas), [rowsFiltradas]);

  // Tiempo de cargue promedio por tipo de vehículo.
  const tiempoCargue = useMemo(() => tiempoCarguePorTipo(rowsFiltradas), [rowsFiltradas]);

  // Mapa de calor de posicionamiento: matriz fecha × hora (llegada a portería vs cita).
  const posicionamiento = useMemo(() => mapaPosicionamiento(rowsFiltradas), [rowsFiltradas]);

  const handleExportExcel = async () => {
    if (exporting || !dateFrom || !dateTo) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      // Export TABLA COMPLETA: filas CRUDAS de la BD (todas las columnas que
      // existan), acotadas al rango de fechas. Los encabezados se derivan de los
      // datos reales, así el export no se desactualiza si la tabla cambia.
      let rawRows: Record<string, unknown>[];
      if (isSupabaseConfigured) {
        rawRows = await fetchTransportesRawByRango(dateFrom, dateTo);
      } else {
        rawRows = useLogisticsStore.getState().transportes.filter((t) => {
          const d = String(t.citaCargue || '').slice(0, 10);
          return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
        }) as unknown as Record<string, unknown>[];
      }

      if (rawRows.length === 0) {
        alert('No hay transportes registrados en el rango de fechas seleccionado.');
        return;
      }

      const headers = Array.from(
        rawRows.reduce<Set<string>>((set, row) => {
          Object.keys(row).forEach((k) => set.add(k));
          return set;
        }, new Set<string>()),
      );
      const data = rawRows.map((row) =>
        headers.map((h) => {
          const v = row[h];
          return v === null || v === undefined ? '' : v;
        }),
      );

      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      ws['!cols'] = headers.map((_, i) => ({
        wch: Math.min(
          40,
          Math.max(
            headers[i].length,
            ...data.slice(0, 200).map((row) => String(row[i] ?? '').length),
          ) + 2,
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
    <div className="space-y-6 mt-[-6px] sm:mt-[-14px] lg:mt-[-22px]">
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
          {/* 4 KPI Cards (datos reales del rango) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((k) => (
              <div
                key={k.label}
                className="bg-[#0e1320] border border-zinc-800/80 rounded-2xl px-4 py-2 flex items-center justify-between gap-3"
              >
                <div className="flex flex-col">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    {k.label}
                  </p>
                  <p className="text-[9px] text-zinc-500 font-mono">{k.sub}</p>
                </div>
                <p className={`text-lg font-black ${k.accent}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Cajas diarias: fila completa de la pantalla (PC), apilado en móvil */}
          <CajasDiariasPanel data={cajasDia} sinDatos={sinDatos} />

          {/* Volumen de llaves por día */}
          <VolumenPanel data={volumen} sinDatos={sinDatos} />

          {/* Tiempo de cargue por tipo de vehículo + Flota (50%-50%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <TiempoCarguePanel data={tiempoCargue} sinDatos={sinDatos} />
            <FlotaPanel data={flota} sinDatos={sinDatos} />
          </div>

          {/* Embudo de estados + Uso y Ocupación de Muelles + Llaves por Transportadora (33.33% c/u) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <EmbudoPanel data={embudo} sinDatos={sinDatos} />
            <MuellesPanel data={usoMuelle} sinDatos={sinDatos} />
            <TransportadorasPanel data={transportadoras} sinDatos={sinDatos} />
          </div>

          {/* Tiempo promedio por etapa (50%) + Cajas cargadas por cuadrilla (50%) — PC en fila, móvil apilado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TiemposEtapaPanel data={tiemposEtapas} sinDatos={sinDatos} />
            <CajasGrupoPanel data={cajasGrupo} sinDatos={sinDatos} />
          </div>

          {/* Mapa de Calor de Posicionamiento */}
          <PosicionamientoPanel data={posicionamiento} sinDatos={sinDatos} />
        </>
      )}
    </div>
  );
};
