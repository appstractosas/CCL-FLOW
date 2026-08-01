import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, FileDown } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ModuleToolbar } from '../common/ModuleToolbar';
import { todayStr } from '../../lib/dateUtils';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { fetchTransportesByRango } from '../../services/transportesService';
import type { UnifiedTransporte } from '../../types';

export const InformesModule: React.FC = () => {
  const fleetData = [
    { name: 'Sencillo', value: 52, percentage: '42%', color: '#3b82f6' },
    { name: 'Turbo', value: 35, percentage: '28%', color: '#10b981' },
    { name: 'LUV', value: 22, percentage: '18%', color: '#f59e0b' },
    { name: 'Minimula', value: 15, percentage: '12%', color: '#8b5cf6' },
  ];

  const cuadrillasData = [
    { name: 'Cuadrilla 1', trabajadas: 180, capacidad: 200 },
    { name: 'Cuadrilla 2', trabajadas: 195, capacidad: 200 },
    { name: 'Cuadrilla 3', trabajadas: 160, capacidad: 180 },
    { name: 'Cuadrilla 4', trabajadas: 210, capacidad: 220 },
    { name: 'Cuadrilla 5', trabajadas: 175, capacidad: 190 },
  ];

  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const zones = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8', 'Z9', 'Z10', 'Z11', 'Z12'];

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if (exporting || !dateFrom || !dateTo) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      let rows: UnifiedTransporte[];
      if (isSupabaseConfigured) {
        rows = await fetchTransportesByRango(dateFrom, dateTo);
      } else {
        rows = useLogisticsStore.getState().transportes.filter((t) => {
          const d = String(t.fechaHora || '').split(' ')[0];
          return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
        });
      }

      if (rows.length === 0) {
        alert('No hay transportes registrados en el rango de fechas seleccionado.');
        return;
      }

      const headers = [
        'LLAVE', 'FECHA', 'PLACA', 'N° PEDIDO', 'TIPO VEHÍCULO', 'CLIENTE',
        'DESTINO', 'CITA CARGUE', 'TRANSPORTADORA', 'ESTADO TRANSPORTE',
        'ESTADO DESPACHO', 'ESTADO PORTERÍA', 'MUELLE', 'H. LLEGADA PORTERÍA',
        'H. INGRESO', 'H. INICIO CARGUE', 'H. FIN CARGUE', 'H. SALIDA', 'OBSERVACIONES',
      ];
      const data = rows.map((r) => [
        r.llave, r.fechaHora, r.placa, r.numeroPedido, r.vehiculoTipo,
        r.denominacionCliente, r.destino, r.citaCargue, r.transportadora,
        r.estadoTransporte, r.estadoDespacho, r.estadoPorteria, r.muelleAsignado || '',
        r.horaLlegadaPorteria || '', r.horaIngreso || '', r.horaInicioCargue || '',
        r.horaFinCargue || '', r.horaSalida || '', r.observaciones || '',
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

  const s = searchTerm.trim().toLowerCase();
  const filteredFleet = useMemo(
    () => (s ? fleetData.filter((d) => d.name.toLowerCase().includes(s)) : fleetData),
    [s, fleetData]
  );
  const filteredCuadrillas = useMemo(
    () => (s ? cuadrillasData.filter((d) => d.name.toLowerCase().includes(s)) : cuadrillasData),
    [s, cuadrillasData]
  );

  return (
    <div className="space-y-6">
      <ModuleToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar flota o cuadrilla..."
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        rightContent={
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-4 h-4" />
            <span>{exporting ? 'Exportando...' : 'Exportar Excel'}</span>
          </button>
        }
      />

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0e1320] border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">TOTAL PEDIDOS</p>
            <span className="text-emerald-400 text-[10px] font-bold">+12.4%</span>
          </div>
          <p className="text-3xl font-black text-white">1,247</p>
          <p className="text-[10px] text-zinc-500 font-mono">vs mes anterior</p>
        </div>

        <div className="bg-[#0e1320] border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">CUMPLIMIENTO CCL</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-emerald-400">94.2%</p>
          <p className="text-[10px] text-zinc-500 font-mono">+2.1 PTS meta 92%</p>
        </div>

        <div className="bg-[#0e1320] border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">TIEMPO MUERTO</p>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-black text-amber-400">187 hrs</p>
          <p className="text-[10px] text-zinc-500 font-mono">+8.3% vs mes anterior</p>
        </div>

        <div className="bg-[#0e1320] border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">CARGAS ACTIVAS</p>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <p className="text-3xl font-black text-blue-400">38</p>
          <p className="text-[10px] text-zinc-500 font-mono">en tránsito ahora</p>
        </div>
      </div>

      {/* Middle Grid: Heatmap Left + Donut Chart Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Heatmap Panel (8 cols) */}
        <div className="lg:col-span-8 bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div>
              <h3 className="text-sm font-bold text-white">Mapa de Calor · Posicionamiento y Demoras</h3>
              <p className="text-[11px] text-zinc-400">Distribución de vehículos por zona y estado</p>
            </div>

            <div className="flex items-center space-x-3 text-[10px] font-bold">
              <span className="flex items-center space-x-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>A tiempo</span>
              </span>
              <span className="flex items-center space-x-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Demora 1-3h</span>
              </span>
              <span className="flex items-center space-x-1 text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                <span>&gt;3h</span>
              </span>
              <span className="flex items-center space-x-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>Tiempo muerto</span>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="bg-zinc-900 text-zinc-300 font-bold px-3 py-1 rounded-full border border-zinc-800">
              CEDI CALI
            </span>
            <span className="text-zinc-500 font-mono text-[11px]">
              CALI · Vie · A tiempo
            </span>
          </div>

          {/* Matrix Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[500px] space-y-2">
              <div className="grid grid-cols-13 text-[10px] text-zinc-500 font-mono text-center">
                <span>DÍA</span>
                {zones.map((z) => <span key={z}>{z}</span>)}
              </div>

              {days.map((day, idx) => (
                <div key={day} className="grid grid-cols-13 items-center text-xs">
                  <span className="font-bold text-zinc-400 font-mono text-[11px]">{day}</span>
                  {zones.map((z, zIdx) => {
                    const isGreen = (idx + zIdx) % 3 === 0;
                    const isYellow = (idx + zIdx) % 5 === 0;
                    const isRose = (idx + zIdx) % 7 === 0;

                    const colorClass = isRose
                      ? 'bg-rose-500/80 hover:bg-rose-400'
                      : isYellow
                      ? 'bg-amber-500/80 hover:bg-amber-400'
                      : isGreen
                      ? 'bg-emerald-500/80 hover:bg-emerald-400'
                      : 'bg-blue-500/80 hover:bg-blue-400';

                    return (
                      <div
                        key={z}
                        className={`h-7 mx-0.5 rounded-lg transition-transform hover:scale-105 cursor-pointer ${colorClass}`}
                        title={`${day} - ${z}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-zinc-500 font-mono text-right border-t border-zinc-800/80 pt-2">
            Última actualización: hace 4 min
          </p>
        </div>

        {/* Donut Chart Panel (4 cols) */}
        <div className="lg:col-span-4 bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Flota por Tipo de Vehículo</h3>
            <p className="text-[11px] text-zinc-400">Composición actual</p>

            <div className="h-48 relative my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredFleet}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {filteredFleet.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#121726', borderColor: '#27272a', borderRadius: '12px', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-white">124</span>
                <span className="text-[10px] text-zinc-400 font-medium uppercase">vehículos</span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              {filteredFleet.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-300">{item.name}</span>
                  </div>
                  <div className="space-x-2 font-mono">
                    <span className="text-white font-bold">{item.value}</span>
                    <span className="text-zinc-500">({item.percentage})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar Chart Panel */}
      <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div>
            <h3 className="text-sm font-bold text-white">Horas Trabajadas vs Capacidad de Cuadrillas</h3>
            <p className="text-[11px] text-zinc-400">Comparativo semanal por cuadrilla</p>
          </div>

          <div className="flex items-center space-x-4 text-xs font-semibold">
            <span className="flex items-center space-x-1.5 text-sky-400">
              <span className="w-3 h-3 rounded bg-sky-500"></span>
              <span>Trabajadas</span>
            </span>
            <span className="flex items-center space-x-1.5 text-zinc-400">
              <span className="w-3 h-3 rounded bg-zinc-700"></span>
              <span>Capacidad</span>
            </span>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredCuadrillas} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#121726', borderColor: '#27272a', borderRadius: '12px', color: '#fff' }}
              />
              <Bar dataKey="trabajadas" fill="#0284c7" radius={[6, 6, 0, 0]} />
              <Bar dataKey="capacidad" fill="#3f3f46" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
