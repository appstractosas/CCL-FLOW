import React from 'react';
import { Inbox } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
  Legend,
  LabelList,
} from 'recharts';
import {
  COLOR_FLOTA,
  COLOR_EMBUDO,
  CONSTANTES,
  tipoGrupo,
  type EstadoConteo,
  type ValorConteo,
  type MuelleUso,
  type RentabilidadBucket,
  type FilaTabla,
  type TiempoEtapaResumen,
  ETAPAS_PORTERIA,
  RANGOS_DEMORA,
} from '../../../utils/informes';

export const COLOR_DEMORA: Record<string, string> = {
  aTiempo: 'text-emerald-400',
  leve: 'text-amber-400',
  critico: 'text-rose-400',
};

const COLOR_GRUPO: Record<string, string> = {
  CCL: '#3b82f6',
  SLA: '#10b981',
  LTSA: '#8b5cf6',
};

/** True si la fecha YYYY-MM-DD cae en domingo. */
function esDomingo(fecha: string): boolean {
  return new Date(`${fecha}T00:00:00`).getDay() === 0;
}

/**
 * Formatea valores del eje Y en miles de pesos: 1432000 → "1.432 k".
 */
function fmtEje(v: number): string {
  if (!Number.isFinite(v)) return '';
  return `${Math.round(v / 1000).toLocaleString('es-CO')} k`;
}

/**
 * Punto (dot) de una línea: los domingos se pintan de rojo, el resto del color base.
 */
export function dotPorDia(base: string, esDomingoCheck: (fecha: string) => boolean = esDomingo) {
  return (props: { cx?: number; cy?: number; payload?: { name?: string } }) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const fecha = payload?.name ?? '';
    const domingo = esDomingoCheck(fecha);
    return <circle cx={cx} cy={cy} r={domingo ? 3.5 : 2.5} fill={domingo ? '#ef4444' : base} />;
  };
}

/**
 * Punto con etiqueta de valor solo en el último punto de la serie. Útil para
 * costos fijos (Costo CCL) que se repiten cada día: evita repetir la misma
 * etiqueta y la sitúa sobre el punto, alineada con el eje Y.
 */
export function dotUltimoConEtiqueta(base: string, ultimaFecha: string, formatear: (n: number) => string) {
  return (props: { cx?: number; cy?: number; payload?: { name?: string; value?: number } }) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const fecha = payload?.name ?? '';
    const domingo = esDomingo(fecha);
    const esUltimo = fecha === ultimaFecha;
    return (
      <g>
        <circle cx={cx} cy={cy} r={domingo ? 3.5 : 2.5} fill={domingo ? '#ef4444' : base} />
        {esUltimo ? (
          <text
            x={cx}
            y={cy - 8}
            fill="#93c5fd"
            fontSize={9}
            fontFamily="monospace"
            textAnchor="middle"
            stroke="#0b0f19"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {formatear(payload?.value ?? 0)}
          </text>
        ) : null}
      </g>
    );
  };
}

const TOOLTIP_STYLE = {
  backgroundColor: '#121726',
  borderColor: '#27272a',
  borderRadius: '12px',
  color: '#fff',
  fontSize: '11px',
};

export function PanelEmpty() {
  return (
    <div className="h-full min-h-[220px] flex flex-col items-center justify-center gap-2 text-zinc-500 py-8">
      <Inbox className="w-6 h-6 text-zinc-600" />
      <p className="text-xs text-center">Sin datos en el rango seleccionado.</p>
    </div>
  );
}

function ChartHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <p className="text-[11px] text-zinc-400">{subtitle}</p>
    </div>
  );
}

/** Embudo operativo (BarChart vertical): llaves por estado del flujo. */
export const EmbudoPanel: React.FC<{ data: EstadoConteo[]; sinDatos: boolean }> = ({ data, sinDatos }) => (
  <div className="lg:col-span-5 bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
    <ChartHeader title="Embudo Operativo" subtitle="Llaves por estado del flujo" />
    {sinDatos ? (
      <PanelEmpty />
    ) : (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 8 }}>
            <YAxis
              type="category"
              dataKey="estado"
              width={112}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <XAxis type="number" hide />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1c2233' }} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={14} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.estado} fill={COLOR_EMBUDO[entry.estado] ?? '#3b82f6'} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                style={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

/** Flota por tipo (donut) con leyenda y total al centro. */
export const FlotaPanel: React.FC<{ data: ValorConteo[]; sinDatos: boolean }> = ({ data, sinDatos }) => {
  const total = data.reduce((acc, f) => acc + f.value, 0);
  return (
    <div className="lg:col-span-3 bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
      <ChartHeader title="Flota por Tipo de Vehículo" subtitle="Composición del rango" />
      {sinDatos ? (
        <PanelEmpty />
      ) : (
        <>
          <div className="h-48 relative my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={COLOR_FLOTA[entry.name] ?? '#3b82f6'} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="outside"
                    style={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
                  />
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-white">{total}</span>
              <span className="text-[10px] text-zinc-400 font-medium uppercase">vehículos</span>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-zinc-800/80 max-h-48 overflow-y-auto">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs font-medium">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_FLOTA[item.name] }} />
                  <span className="text-zinc-300">{item.name}</span>
                </div>
                <div className="space-x-2 font-mono">
                  <span className="text-white font-bold">{item.value}</span>
                  <span className="text-zinc-500">
                    ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/** Llaves por transportadora (top N). */
export const TransportadorasPanel: React.FC<{ data: ValorConteo[]; sinDatos: boolean }> = ({ data, sinDatos }) => (
  <div className="lg:col-span-4 bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
    <ChartHeader title="Llaves por Transportadora" subtitle="Top 8 del rango" />
    {sinDatos ? (
      <PanelEmpty />
    ) : (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#71717a', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-32}
              textAnchor="end"
              height={64}
            />
            <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1c2233' }} />
            <Bar dataKey="value" fill="#0284c7" radius={[6, 6, 0, 0]} barSize={18} isAnimationActive={false}>
              <LabelList
                dataKey="value"
                position="top"
                style={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

/** Volumen de llaves por día (área). */
export const VolumenPanel: React.FC<{ data: ValorConteo[]; sinDatos: boolean }> = ({ data, sinDatos }) => (
  <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 space-y-4">
    <ChartHeader title="Volumen de Llaves por Día" subtitle="Entradas programadas en el rango" />
    {sinDatos ? (
      <PanelEmpty />
    ) : (
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 18, right: 0, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="fillVolumen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
            <XAxis
              dataKey="name"
              tickFormatter={(v: string) => v.slice(5)}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="value" name="Llaves" fill="#10b981" fillOpacity={0.35} radius={[4, 4, 0, 0]} barSize={16} isAnimationActive={false} />
            <Area type="monotone" dataKey="value" name="Llaves" stroke="#10b981" strokeWidth={2} fill="url(#fillVolumen)" isAnimationActive={false}>
              <LabelList
                dataKey="value"
                position="top"
                style={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
              />
            </Area>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

/** Uso y ocupación de muelles (barras apiladas llaves/cajas). */
export const MuellesPanel: React.FC<{ data: MuelleUso[]; sinDatos: boolean }> = ({ data, sinDatos }) => (
  <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 space-y-4">
    <ChartHeader title="Uso y Ocupación de Muelles" subtitle="Número de llaves y cajas por muelle (más cajas arriba, menos cajas abajo)" />
    {sinDatos ? (
      <PanelEmpty />
    ) : (
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 34, bottom: 0, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
            <XAxis type="number" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1c2233' }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="despachos" name="Llaves" fill="#0284c7" radius={[0, 6, 6, 0]} barSize={12} isAnimationActive={false}>
              <LabelList dataKey="despachos" position="right" style={{ fill: '#93c5fd', fontSize: 10, fontFamily: 'monospace' }} />
            </Bar>
            <Bar dataKey="cajas" name="Cajas" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={12} isAnimationActive={false}>
              <LabelList dataKey="cajas" position="right" style={{ fill: '#fcd34d', fontSize: 10, fontFamily: 'monospace' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

/** Rentabilidad por cuadrilla (áreas sombreadas costo CCL vs ingresos SLA, domingos en rojo). */
export const RentabilidadPanel: React.FC<{ data: RentabilidadBucket[]; sinDatos: boolean }> = ({ data, sinDatos }) => (
  <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 space-y-4">
    <ChartHeader
      title="Rentabilidad por Cuadrilla"
      subtitle={`Costo CCL: ${CONSTANTES.COSTO_DIARIO_CCL.toLocaleString('es-CO')} por día · Ingresos SLA: cajas del día × ${CONSTANTES.INGRESO_CAJA_SLA.toLocaleString('es-CO')}`}
    />
    {sinDatos ? (
      <PanelEmpty />
    ) : (
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 18, right: 10, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="gradCostoCCL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gradIngresoSLA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
            <XAxis
              dataKey="name"
              tickFormatter={(v: string) => v.slice(5)}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tickFormatter={(v: number) => fmtEje(v)}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="ingresoSLA" name="Ingresos SLA" fill="#22c55e" fillOpacity={0.4} radius={[4, 4, 0, 0]} barSize={10} isAnimationActive={false} />
            <Area
              type="monotone"
              dataKey="costoCCL"
              name="Costo CCL"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#gradCostoCCL)"
              dot={dotUltimoConEtiqueta('#3b82f6', data[data.length - 1]?.name ?? '', (v) => v.toLocaleString('es-CO'))}
              activeDot={{ r: 4, fill: '#3b82f6' }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="ingresoSLA"
              name="Ingresos SLA"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#gradIngresoSLA)"
              dot={dotPorDia('#22c55e')}
              activeDot={{ r: 4, fill: '#22c55e' }}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="ingresoSLA"
                position="top"
                formatter={(v: unknown) =>
                  String(v).length > 0 && Number(v) > 0 ? Number(v).toLocaleString('es-CO') : ''
                }
                style={{ fill: '#86efac', fontSize: 9, fontFamily: 'monospace' }}
              />
            </Area>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

/** Cajas diarias con meta punteada. */
export const CajasDiariasPanel: React.FC<{ data: ValorConteo[]; sinDatos: boolean }> = ({ data, sinDatos }) => (
  <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 space-y-4">
    <ChartHeader
      title="Cajas Diarias"
      subtitle={`Cantidad de cajas registradas por día — meta diaria ${CONSTANTES.META_CAJAS_DIARIAS.toLocaleString('es-CO')}`}
    />
    {sinDatos ? (
      <PanelEmpty />
    ) : (
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 18, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
            <XAxis
              dataKey="name"
              tickFormatter={(v: string) => v.slice(5)}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              domain={[0, (dataMax: number) => Math.max(dataMax * 1.05, CONSTANTES.META_CAJAS_DIARIAS)]}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <ReferenceLine
              y={CONSTANTES.META_CAJAS_DIARIAS}
              stroke="#ef4444"
              strokeDasharray="2 5"
              strokeWidth={2}
              label={{ value: 'Meta', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }}
            />
            <Bar dataKey="value" name="Cajas" fill="#f59e0b" fillOpacity={0.4} radius={[4, 4, 0, 0]} barSize={16} isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="value"
              name="Cajas"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={dotPorDia('#f59e0b')}
              activeDot={{ r: 4, fill: '#f59e0b' }}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v: unknown) =>
                  String(v).length > 0 ? Number(v).toLocaleString('es-CO') : ''
                }
                style={{ fill: '#fcd34d', fontSize: 9, fontFamily: 'monospace' }}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

/** Cajas cargadas por cuadrilla (donut + leyenda). Solo muestra grupos con cajas. */
export const CajasGrupoPanel: React.FC<{ data: ValorConteo[]; sinDatos: boolean }> = ({ data, sinDatos }) => {
  const conDatos = data.filter((d) => d.value > 0);
  const total = conDatos.reduce((acc, c) => acc + c.value, 0);
  return (
    <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
      <ChartHeader title="Cajas Cargadas por Cuadrilla" subtitle="Distribución porcentual por tipo de cuadrilla" />
      {sinDatos || conDatos.length === 0 ? (
        <PanelEmpty />
      ) : (
        <>
          <div className="h-52 relative my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={conDatos}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {conDatos.map((entry) => (
                    <Cell key={entry.name} fill={COLOR_GRUPO[entry.name] ?? '#3b82f6'} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="outside"
                    style={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
                  />
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-white">
                {total.toLocaleString('es-CO')}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium uppercase">cajas</span>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-zinc-800/80">
            {conDatos.map((item) => {
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div key={item.name} className="flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_GRUPO[item.name] }} />
                    <span className="text-zinc-300">{item.name}</span>
                  </div>
                  <div className="space-x-2 font-mono">
                    <span className="text-white font-bold">{item.value.toLocaleString('es-CO')}</span>
                    <span className="text-zinc-500">({pct}%)</span>
                </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

/** Etapa de portería: descripción, promedio/mín/máx y llaves medidas. */
const TiempoEtapaTooltip: React.FC<{ active?: boolean; payload?: { payload: TiempoEtapaResumen }[] }> = ({
  active,
  payload,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const e = payload[0].payload;
  return (
    <div className="bg-[#121726] border border-zinc-700 rounded-xl px-3 py-2 text-[11px] text-white shadow-xl">
      <p className="font-bold mb-1">{e.descripcion}</p>
      <div className="space-y-0.5 font-mono">
        <p>
          Promedio: <span className="text-emerald-400 font-bold">{e.promedio} min</span>
        </p>
        <p>
          Mín: {e.minimo} min · Máx: {e.maximo} min
        </p>
        <p className="text-zinc-400">{e.conteo} llaves medidas</p>
      </div>
    </div>
  );
};

/**
 * Barras horizontales: tiempo promedio (minutos) de cada etapa de portería.
 * Revela el "cuello de botella" del flujo entre dos hitos de hora.
 */
export const TiemposEtapaPanel: React.FC<{ data: TiempoEtapaResumen[]; sinDatos: boolean }> = ({ data, sinDatos }) => {
  const conDatos = data.some((d) => d.conteo > 0);
  return (
    <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
      <ChartHeader
        title="Tiempo promedio por etapa"
        subtitle="Minutos promedio entre el registro de cada hito de portería (por llave)"
      />
      {sinDatos || !conDatos ? (
        <PanelEmpty />
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }}>
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <XAxis type="number" hide />
              <Tooltip content={<TiempoEtapaTooltip />} cursor={{ fill: '#1c2233' }} />
              <Bar dataKey="promedio" name="Promedio" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false}>
                {data.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="promedio"
                  position="right"
                  formatter={(v) => `${v} min`}
                  style={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

/** Tooltip del diagrama de dispersión: muestra las 5 etapas (con color) y el total del rango. */
const RangoEtapasTooltip: React.FC<{
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; value?: number; color?: string }[];
}> = ({ active, label, payload }) => {
  if (!active || !payload) return null;
  const total = payload.reduce((acc, p) => acc + (p.value ?? 0), 0);
  return (
    <div className="bg-[#121726] border border-zinc-700 rounded-xl px-3 py-2 text-[11px] text-white shadow-xl min-w-[160px]">
      <p className="font-bold mb-1">{label}</p>
      <div className="space-y-0.5 font-mono">
        {payload.map((p) => (
          <p key={p.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span>{p.name}</span>
            </span>
            <span className="text-white font-bold">{p.value ?? 0} llaves</span>
          </p>
        ))}
        {total > 0 && (
          <p className="pt-1 mt-1 border-t border-zinc-700 text-zinc-400">Total: {total} llaves</p>
        )}
      </div>
    </div>
  );
};

/**
 * Histograma agrupado por rango de demora: 6 rangos en el eje X (0-30 min, ...,
 * >8 h) y, dentro de CADA rango, 5 barras — una por etapa de portería — con el
 * color de su estado. Muestra en cuántas llaves cada etapa duró dentro del rango.
 */
export const TiemposDistribucionPanel: React.FC<{
  data: Record<string, Record<string, number>>;
  sinDatos: boolean;
}> = ({ data, sinDatos }) => {
  const chartData = RANGOS_DEMORA.map((rg) => ({
    rango: rg.label,
    ...(data[rg.id] ?? {}),
  }));
  const conDatos = ETAPAS_PORTERIA.some((e) => chartData.some((d) => (d[e.id] ?? 0) > 0));
  const llavesMedidas = RANGOS_DEMORA.reduce((acc, rg) => {
    const fila = data[rg.id];
    if (!fila) return acc;
    let suma = 0;
    for (const etapa of ETAPAS_PORTERIA) suma += fila[etapa.id] || 0;
    return acc + suma;
  }, 0);

  return (
    <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col space-y-4">
      <ChartHeader
        title="Distribución de tiempos por etapa"
        subtitle="Llaves por rango de demora según la duración de cada etapa (5 estados por rango)"
      />
      <div className="flex flex-wrap gap-1.5">
        {ETAPAS_PORTERIA.map((e) => (
          <span
            key={e.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-zinc-800/90 text-zinc-300"
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
            {e.label}
          </span>
        ))}
      </div>
      {sinDatos || !conDatos ? (
        <PanelEmpty />
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -14 }}>
              <XAxis
                dataKey="rango"
                tick={{ fill: '#71717a', fontSize: 10 }}
                height={30}
                interval={0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <CartesianGrid vertical={false} stroke="#1c2233" strokeDasharray="3 3" />
              <Tooltip content={<RangoEtapasTooltip />} cursor={{ fill: '#1c2233' }} />
              {ETAPAS_PORTERIA.map((etapa) => (
                <Bar
                  key={etapa.id}
                  dataKey={etapa.id}
                  name={etapa.label}
                  fill={etapa.color}
                  radius={[3, 3, 0, 0]}
                  barSize={8}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {!sinDatos && conDatos && (
        <p className="text-[10px] text-zinc-500 font-mono">
          Totales: {llavesMedidas} llaves medidas
        </p>
      )}
    </div>
  );
};

/** Tabla detalle del rango (demora contra SLA). */
export const DetalleTabla: React.FC<{ filas: FilaTabla[] }> = ({ filas }) => (
  <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 space-y-4">
    <div>
      <h3 className="text-sm font-bold text-white">Detalle del Rango</h3>
      <p className="text-[11px] text-zinc-400">
        {filas.length} llaves — transporte, denominación, cajas y demora en muelle
      </p>
    </div>
    {filas.length === 0 ? (
      <PanelEmpty />
    ) : (
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0b0f19] z-10">
            <tr className="border-b border-zinc-800 text-left text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="py-2 pr-3 font-bold">Llave</th>
              <th className="py-2 pr-3 font-bold">Transporte</th>
              <th className="py-2 pr-3 font-bold">Denominación</th>
              <th className="py-2 pr-3 font-bold text-right">Cajas</th>
              <th className="py-2 pr-3 font-bold">Cuadrilla</th>
              <th className="py-2 pr-3 font-bold">H. Inicio</th>
              <th className="py-2 pr-3 font-bold">H. Fin</th>
              <th className="py-2 pr-3 font-bold text-right">Tiempo muelle</th>
              <th className="py-2 pr-3 font-bold text-right">Demora (SLA)</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.llave} className="border-b border-zinc-800/40 hover:bg-zinc-800/20">
                <td className="py-2 pr-3 font-mono font-bold text-white">{f.llave}</td>
                <td className="py-2 pr-3 font-mono text-zinc-300">{f.transporte || '—'}</td>
                <td className="py-2 pr-3 text-zinc-300">{f.denominacion || '—'}</td>
                <td className="py-2 pr-3 text-right font-mono text-white font-bold">{f.cajas || 0}</td>
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_GRUPO[tipoGrupo(f.cuadrilla)] }} />
                    <span className="text-zinc-300">{f.cuadrilla || '—'}</span>
                  </span>
                </td>
                <td className="py-2 pr-3 font-mono text-zinc-400">{f.hora_inicio_cargue || '—'}</td>
                <td className="py-2 pr-3 font-mono text-zinc-400">{f.hora_fin_cargue || '—'}</td>
                <td className="py-2 pr-3 text-right font-mono text-zinc-300">
                  {f.tiempo_muelle_minutos != null ? `${f.tiempo_muelle_minutos} min` : '—'}
                </td>
                <td className={`py-2 pr-3 text-right font-mono font-bold ${COLOR_DEMORA[f.nivelDemora]}`}>
                  {f.demoraMin != null ? `${f.demoraMin > 0 ? '+' : ''}${f.demoraMin} min` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
