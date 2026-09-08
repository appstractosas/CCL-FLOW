import React, { useEffect, useRef, useState } from 'react';
import { Inbox } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
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
  type EstadoConteo,
  type ValorConteo,
  type MuelleUso,
  type RentabilidadBucket,
  type TiempoEtapaResumen,
  type MapaPosicionamiento,
  type CeldaPosicion,
  ETAPAS_PORTERIA,
  RANGOS_DEMORA,
} from '../../../utils/informes';

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

/** Ticks del eje Y (0, ¼, ½, ¾, top, redondeados a miles) más el valor destacado (costo/meta fijo). */
function ticksEjeY(top: number, destacado: number): number[] {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((top * f) / 1000) * 1000);
  ticks.push(destacado);
  return [...new Set(ticks)].sort((a, b) => a - b);
}

/** Render del tick del eje Y: el valor destacado se pinta en color y negrita, el resto igual a los demás. */
function tickYDestacado(destacado: number, color: string) {
  return (props: { x?: number; y?: number; payload?: { value?: number | string } }) => {
    const valor = Number(props.payload?.value ?? 0);
    const es = valor === destacado;
    return (
      <text
        x={props.x ?? 0}
        y={props.y ?? 0}
        dy={7}
        textAnchor="end"
        fill={es ? color : '#71717a'}
        fontSize={10}
        fontWeight={es ? 700 : 400}
      >
        {fmtEje(valor)}
      </text>
    );
  };
}

/**
 * Punto (dot) de una línea: los domingos se pintan de rojo, el resto del color base.
 */
function dotPorDia(base: string, esDomingoCheck: (fecha: string) => boolean = esDomingo) {
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
function dotUltimoConEtiqueta(
  base: string,
  ultimaFecha: string,
  formatear: (n: number) => string,
) {
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
export const EmbudoPanel: React.FC<{ data: EstadoConteo[]; sinDatos: boolean }> = ({
  data,
  sinDatos,
}) => (
  <div className="lg:col-span-5 bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
    <ChartHeader title="Embudo Operativo" subtitle="Llaves por estado del flujo" />
    {sinDatos ? (
      <PanelEmpty />
    ) : (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 28, bottom: 0, left: 8 }}
          >
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

/** Segmento del donut: etiqueta, valor numérico y color (paleta del panel, no se redefine aquí). */
export interface SegmentoDonut {
  label: string;
  value: number;
  color: string;
}

/** Formato de miles usado por las etiquetas del donut (es-CO). */
const fmtMiles = (n: number): string => n.toLocaleString('es-CO');

/** Mide el contenedor del donut para ajustar su geometría al espacio real disponible. */
function useContainerSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

/**
 * Donut SVG (anillo) con gradientes por segmento, anillo de sombra gris y
 * etiquetas de datos con línea guía, punto y porcentaje; el total va al centro.
 * La geometría se calcula del tamaño real del contenedor (ResizeObserver) para
 * que el anillo llene el espacio asignado. Los colores llegan desde el panel
 * (se conserva la paleta del tablero).
 */
export const DonutSvg: React.FC<{
  segments: SegmentoDonut[];
  centroLabel: string;
}> = ({ segments, centroLabel }) => {
  const { ref, size } = useContainerSize();
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  if (total <= 0) {
    return (
      <div className="h-full w-full min-h-[200px] flex items-center justify-center text-xs text-zinc-500">
        No hay datos en el periodo seleccionado.
      </div>
    );
  }

  // Vista previa 500×250 mientras el ResizeObserver no ha reportado el tamaño real.
  const W = size?.width ?? 500;
  const H = size?.height ?? 250;
  const CX = W / 2;
  const CY = H / 2;
  const radio = Math.min(W, H) / 2;
  const OUTER = radio * 0.82; // el anillo no toca los bordes (deja espacio a etiquetas)
  const INNER = OUTER * 0.58; // grosor del anillo ≈ 42% del radio exterior
  const grosor = OUTER - INNER;
  // Las etiquetas quedan fuera del anillo pero DOS celdas no exceden el contenedor.
  const labelDist = Math.min(OUTER + Math.max(30, OUTER * 0.35), radio - 12);
  const escala = OUTER / 95; // escala de fuentes y puntos respecto a la geometría base

  const partes = segments
    .filter((s) => s.value > 0)
    .reduce(
      (acc, s) => {
        const start = acc.length > 0 ? acc[acc.length - 1].end : -Math.PI / 2;
        const portion = s.value / total;
        const angle = portion * 2 * Math.PI;
        return [...acc, { ...s, portion, angle, start, end: start + angle }];
      },
      [] as Array<SegmentoDonut & { portion: number; angle: number; start: number; end: number }>,
    );

  const pt = (r: number, a: number) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];

  return (
    <div ref={ref} className="w-full h-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ overflow: 'visible' }}>
        <defs>
          {partes.map((p, i) => (
            <linearGradient key={i} id={`donutGrad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={p.color} stopOpacity={1} />
              <stop offset="100%" stopColor={p.color} stopOpacity={0.8} />
            </linearGradient>
          ))}
        </defs>

        {/* Anillo de sombra gris (debajo de todos los segmentos) */}
        <circle
          cx={CX}
          cy={CY}
          r={OUTER}
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={grosor}
        />

        {partes.map((p, i) => {
          const [x1o, y1o] = pt(OUTER, p.start);
          const [x2o, y2o] = pt(OUTER, p.end);
          const [x2i, y2i] = pt(INNER, p.end);
          const [x1i, y1i] = pt(INNER, p.start);
          const large = p.angle > Math.PI ? 1 : 0;
          const d = `M ${x1o} ${y1o} A ${OUTER} ${OUTER} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${INNER} ${INNER} 0 ${large} 0 ${x1i} ${y1i} Z`;

          const mid = p.start + p.angle / 2;
          const labelX = CX + labelDist * Math.cos(mid);
          const labelY = CY + labelDist * Math.sin(mid);
          const izquierda = mid > Math.PI * 0.5 && mid < Math.PI * 1.5;
          const anchor = izquierda ? 'end' : 'start';
          const offX = izquierda ? -8 : 8;
          const pct = Math.round(p.portion * 100 * 10) / 10;
          const radioPunto = 3 * escala;
          const fontSizeLabel = 13 * escala;
          const fontSizeValor = 11 * escala;

          return (
            <g key={i}>
              <title>{`${p.label}: ${fmtMiles(p.value)} (${pct}%)`}</title>
              <path
                d={d}
                fill={`url(#donutGrad-${i})`}
                stroke="#172033"
                strokeWidth={2}
                style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
              />
              <line
                x1={CX + (OUTER + 4) * Math.cos(mid)}
                y1={CY + (OUTER + 4) * Math.sin(mid)}
                x2={labelX}
                y2={labelY}
                stroke={p.color}
                strokeWidth={1.5}
                opacity={0.6}
              />
              <circle cx={labelX} cy={labelY} r={radioPunto} fill={p.color} />
              <text
                x={labelX + offX}
                y={labelY - fontSizeValor * 0.4}
                fontSize={fontSizeLabel}
                fontWeight={700}
                fill="#ffffff"
                textAnchor={anchor}
              >
                {p.label}
              </text>
              <text
                x={labelX + offX}
                y={labelY + fontSizeValor * 1.1}
                fontSize={fontSizeValor}
                fill="#ffffff"
                textAnchor={anchor}
              >
                {`${fmtMiles(p.value)} (${pct}%)`}
              </text>
            </g>
          );
        })}

        {/* Centro del donut: total + etiqueta */}
        <circle
          cx={CX}
          cy={CY}
          r={INNER - 2}
          fill="#172033"
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))' }}
        />
        <text
          x={CX}
          y={CY - 3 * escala}
          textAnchor="middle"
          fontSize={17 * escala}
          fontWeight={800}
          fill="#ffffff"
        >
          {fmtMiles(total)}
        </text>
        <text
          x={CX}
          y={CY + 15 * escala}
          textAnchor="middle"
          fontSize={10 * escala}
          fontWeight={600}
          fill="#a1a1aa"
        >
          {centroLabel}
        </text>
      </svg>
    </div>
  );
};

/** Flota por tipo (donut) con etiquetas, sombra y total al centro. */
export const FlotaPanel: React.FC<{ data: ValorConteo[]; sinDatos: boolean }> = ({
  data,
  sinDatos,
}) => {
  const segments: SegmentoDonut[] = data.map((d) => ({
    label: d.name,
    value: d.value,
    color: COLOR_FLOTA[d.name] ?? '#3b82f6',
  }));
  return (
    <div className="lg:col-span-3 bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
      <ChartHeader title="Flota por Tipo de Vehículo" subtitle="Composición del rango" />
      {sinDatos ? (
        <PanelEmpty />
      ) : (
        <div className="flex-1 min-h-[260px]">
          <DonutSvg segments={segments} centroLabel="Vehículos Totales" />
        </div>
      )}
    </div>
  );
};

/** Llaves por transportadora (top N). */
export const TransportadorasPanel: React.FC<{ data: ValorConteo[]; sinDatos: boolean }> = ({
  data,
  sinDatos,
}) => (
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
            <YAxis
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1c2233' }} />
            <Bar
              dataKey="value"
              fill="#0284c7"
              radius={[6, 6, 0, 0]}
              barSize={18}
              isAnimationActive={false}
            >
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
export const VolumenPanel: React.FC<{ data: ValorConteo[]; sinDatos: boolean }> = ({
  data,
  sinDatos,
}) => (
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
            <YAxis
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar
              dataKey="value"
              name="Llaves"
              fill="#10b981"
              fillOpacity={0.35}
              radius={[4, 4, 0, 0]}
              barSize={16}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="value"
              name="Llaves"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#fillVolumen)"
              isAnimationActive={false}
            >
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
export const MuellesPanel: React.FC<{ data: MuelleUso[]; sinDatos: boolean }> = ({
  data,
  sinDatos,
}) => (
  <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 space-y-4">
    <ChartHeader
      title="Uso y Ocupación de Muelles"
      subtitle="Número de llaves y cajas por muelle (más cajas arriba, menos cajas abajo)"
    />
    {sinDatos ? (
      <PanelEmpty />
    ) : (
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 34, bottom: 0, left: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
            <XAxis
              type="number"
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1c2233' }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar
              dataKey="despachos"
              name="Llaves"
              fill="#0284c7"
              radius={[0, 6, 6, 0]}
              barSize={12}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="despachos"
                position="insideEnd"
                fill="#ffffff"
                fontSize={10}
                fontFamily="monospace"
                formatter={(v) => (v === 0 ? '' : v)}
              />
            </Bar>
            <Bar
              dataKey="cajas"
              name="Cajas"
              fill="#f59e0b"
              radius={[0, 6, 6, 0]}
              barSize={12}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="cajas"
                position="insideEnd"
                fill="#ffffff"
                fontSize={10}
                fontFamily="monospace"
                formatter={(v) => (v === 0 ? '' : v)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

/** Rentabilidad por cuadrilla (áreas sombreadas costo CCL vs ingresos SLA, domingos en rojo). */
export const RentabilidadPanel: React.FC<{ data: RentabilidadBucket[]; sinDatos: boolean }> = ({
  data,
  sinDatos,
}) => {
  const ccl = CONSTANTES.COSTO_DIARIO_CCL;
  const top = Math.max(1.05 * data.reduce((m, b) => Math.max(m, b.ingresoSLA, b.costoCCL), 0), ccl);
  return (
    <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 space-y-4">
      <ChartHeader
        title="Rentabilidad por Cuadrilla"
        subtitle={`Costo CCL: ${CONSTANTES.COSTO_DIARIO_CCL.toLocaleString('es-CO')} por día · Costo SLA: cajas del día × ${CONSTANTES.INGRESO_CAJA_SLA.toLocaleString('es-CO')}`}
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
                domain={[0, top]}
                ticks={ticksEjeY(top, ccl)}
                tick={tickYDestacado(ccl, '#3b82f6')}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                interval={0}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar
                dataKey="ingresoSLA"
                name="Costo SLA"
                fill="#22c55e"
                fillOpacity={0.4}
                radius={[4, 4, 0, 0]}
                barSize={10}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="costoCCL"
                name="Costo CCL"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#gradCostoCCL)"
                dot={dotUltimoConEtiqueta('#3b82f6', data[data.length - 1]?.name ?? '', (v) =>
                  v.toLocaleString('es-CO'),
                )}
                activeDot={{ r: 4, fill: '#3b82f6' }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="ingresoSLA"
                name="Costo SLA"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#gradIngresoSLA)"
                dot={dotPorDia('#22c55e')}
                activeDot={{ r: 4, fill: '#22c55e' }}
                legendType="none"
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
};

/** Cajas diarias con meta punteada. */
export const CajasDiariasPanel: React.FC<{ data: ValorConteo[]; sinDatos: boolean }> = ({
  data,
  sinDatos,
}) => {
  const meta = CONSTANTES.META_CAJAS_DIARIAS;
  const top = Math.max(data.reduce((m, d) => Math.max(m, d.value), 0) * 1.05, meta);
  return (
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
                domain={[0, top]}
                ticks={ticksEjeY(top, meta)}
                tick={tickYDestacado(meta, '#ef4444')}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <ReferenceLine
                y={CONSTANTES.META_CAJAS_DIARIAS}
                stroke="#ef4444"
                strokeDasharray="2 5"
                strokeWidth={2}
                label={{
                  value: 'Meta',
                  fill: '#ef4444',
                  fontSize: 10,
                  fontWeight: 700,
                  position: 'insideTopRight',
                }}
              />
              <Bar
                dataKey="value"
                name="Cajas"
                fill="#f59e0b"
                fillOpacity={0.4}
                radius={[4, 4, 0, 0]}
                barSize={16}
                isAnimationActive={false}
              />
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
};

/** Cajas cargadas por cuadrilla (donut). Solo muestra grupos con cajas. */
export const CajasGrupoPanel: React.FC<{ data: ValorConteo[]; sinDatos: boolean }> = ({
  data,
  sinDatos,
}) => {
  const conDatos = data.filter((d) => d.value > 0);
  const segments: SegmentoDonut[] = conDatos.map((d) => ({
    label: d.name,
    value: d.value,
    color: COLOR_GRUPO[d.name] ?? '#3b82f6',
  }));
  return (
    <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
      <ChartHeader
        title="Cajas Cargadas por Cuadrilla"
        subtitle="Distribución porcentual por tipo de cuadrilla"
      />
      {sinDatos || conDatos.length === 0 ? (
        <PanelEmpty />
      ) : (
        <div className="flex-1 min-h-[220px]">
          <DonutSvg segments={segments} centroLabel="Cajas Totales" />
        </div>
      )}
    </div>
  );
};

/** Etapa de portería: descripción, promedio/mín/máx y llaves medidas. */
const TiempoEtapaTooltip: React.FC<{
  active?: boolean;
  payload?: { payload: TiempoEtapaResumen }[];
}> = ({ active, payload }) => {
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
export const TiemposEtapaPanel: React.FC<{ data: TiempoEtapaResumen[]; sinDatos: boolean }> = ({
  data,
  sinDatos,
}) => {
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
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 40, bottom: 0, left: 8 }}
            >
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
              <Bar
                dataKey="promedio"
                name="Promedio"
                radius={[0, 6, 6, 0]}
                barSize={18}
                isAnimationActive={false}
              >
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

/** Convierte un color hex (#rrggbb) a rgba con la opacidad indicada. */
function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Heatmap de tiempos por etapa: filas = etapas de portería, columnas = rangos de
 * demora (0-30 min ... >8 h). Cada celda se intensifica con el color de su etapa
 * según cuántas llaves cayeron en ese rango: la celda más intensa es el mayor
 * cuello de botella. Complementa al panel de promedios revelando LA DISPERSIÓN:
 * un promedio bajo puede esconder llaves paradas 4-8 h en "ASIGNACIÓN MUELLE".
 */
export const TiemposHeatmapPanel: React.FC<{
  data: Record<string, Record<string, number>>;
  sinDatos: boolean;
}> = ({ data, sinDatos }) => {
  const maxCount = RANGOS_DEMORA.reduce(
    (acc, rg) => ETAPAS_PORTERIA.reduce((m, e) => Math.max(m, data[rg.id]?.[e.id] ?? 0), acc),
    0,
  );
  const conDatos = RANGOS_DEMORA.some((rg) =>
    ETAPAS_PORTERIA.some((e) => (data[rg.id]?.[e.id] ?? 0) > 0),
  );
  const totalLlaves = RANGOS_DEMORA.reduce(
    (acc, rg) => acc + ETAPAS_PORTERIA.reduce((s, e) => s + (data[rg.id]?.[e.id] ?? 0), 0),
    0,
  );

  return (
    <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
      <ChartHeader
        title="Distribución de tiempos por etapa"
        subtitle="Heatmap: etapas vs. rango de demora — la celda más intensa es el mayor cuello de botella"
      />
      {sinDatos || !conDatos || maxCount === 0 ? (
        <PanelEmpty />
      ) : (
        <div className="flex-1 flex flex-col justify-center gap-1.5">
          <div
            className="grid items-center"
            style={{ gridTemplateColumns: '132px repeat(6, minmax(0, 1fr))', gap: 4 }}
          >
            <div />
            {RANGOS_DEMORA.map((rg) => (
              <div
                key={rg.id}
                title={rg.label}
                className="text-center text-[9px] font-mono text-zinc-500 font-bold uppercase tracking-wide truncate"
              >
                {rg.label}
              </div>
            ))}
          </div>
          {ETAPAS_PORTERIA.map((etapa) => {
            const alpha = (count: number) => (count > 0 ? 0.08 + (count / maxCount) * 0.82 : 0);
            return (
              <div
                key={etapa.id}
                className="grid items-center"
                style={{ gridTemplateColumns: '132px repeat(6, minmax(0, 1fr))', gap: 4 }}
              >
                <span className="flex items-center gap-1.5 pr-1 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: etapa.color }}
                  />
                  <span className="text-[9px] font-bold text-zinc-300 leading-tight truncate">
                    {etapa.label}
                  </span>
                </span>
                {RANGOS_DEMORA.map((rg) => {
                  const count = data[rg.id]?.[etapa.id] ?? 0;
                  const a = alpha(count);
                  return (
                    <div
                      key={rg.id}
                      title={`${etapa.descripcion}: ${count} llaves en ${rg.label}`}
                      className={`py-2 rounded-md text-center font-mono text-[11px] font-bold ${
                        count > 0 && a > 0.5 ? 'text-white' : 'text-zinc-500'
                      }`}
                      style={{
                        backgroundColor:
                          count > 0 ? hexToRgba(etapa.color, a) : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      {count > 0 ? count : '·'}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      {!sinDatos && conDatos && maxCount > 0 && (
        <p className="text-[10px] text-zinc-500 font-mono">
          {totalLlaves} llaves medidas · celda más intensa = {maxCount} llaves (cuello de botella)
        </p>
      )}
    </div>
  );
};

/**
 * Mapa de calor de posicionamiento: matriz Fecha × Hora (TABLA HTML, sin SVG).
 * Cada celda agrupa los vehículos por el inicio real de cargue y se pinta según
 * el cumplimiento de la cita: verde a tiempo, amarillo demora leve, azul demora
 * crítica, rojo/gris tiempo muerto (sin operación).
 */
export const PosicionamientoPanel: React.FC<{
  data: MapaPosicionamiento;
  sinDatos: boolean;
}> = ({ data, sinDatos }) => {
  const { celdas, fechas, horas } = data;

  const totalesPorHora = horas.map((h) =>
    fechas.reduce((acc, f) => acc + (celdas.get(`${f.label}___${h}`)?.count ?? 0), 0),
  );
  const totalGeneral = totalesPorHora.reduce((a, b) => a + b, 0);
  const hayDatos = !sinDatos && fechas.length > 0 && totalGeneral > 0;

  const celdasVacias: Record<string, [string, string]> = {
    verde: ['#064e3b', '#a7f3d0'],
    amarillo: ['#713f12', '#fef08a'],
    azul: ['#1e3a5f', '#93c5fd'],
    gris: ['#7f1d1d', '#fecaca'],
  };

  /** Fondo/texto de una celda según la prioridad: verde > azul > amarillo. */
  const estiloCelda = (c: CeldaPosicion | undefined): [string, string] => {
    if (!c || c.count === 0) return celdasVacias.gris; // tiempo muerto
    if (c.aTiempo > 0) return celdasVacias.verde;
    if (c.masDe3h > 0) return celdasVacias.azul;
    if (c.entre1y3h > 0) return celdasVacias.amarillo;
    return celdasVacias.verde;
  };

  return (
    <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 space-y-4">
      <ChartHeader
        title="Mapa de Calor de Posicionamiento"
        subtitle="Vehículos por fecha y hora de llegada a portería según el cumplimiento de la cita"
      />
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['A tiempo (<1h)', celdasVacias.verde[0]],
            ['Demora leve (1h a 2:59h)', celdasVacias.amarillo[0]],
            ['Demora crítica (≥3h)', celdasVacias.azul[0]],
            ['Tiempo Muerto', celdasVacias.gris[0]],
          ] as const
        ).map(([label, bg]) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-zinc-800/90 text-zinc-300"
          >
            <span
              className="w-2.5 h-2.5 rounded-full border border-white/10"
              style={{ backgroundColor: bg }}
            />
            {label}
          </span>
        ))}
      </div>
      {!hayDatos ? (
        <PanelEmpty />
      ) : (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="text-[8.5px]" style={{ borderSpacing: 1 }}>
            <thead className="sticky top-0 z-20 bg-[#0b0f19]">
              <tr>
                <th className="sticky left-0 z-30 bg-[#0b0f19] px-1 py-1 text-left text-[8px] font-bold uppercase tracking-wider text-zinc-500">
                  Fecha
                </th>
                {horas.map((h) => (
                  <th
                    key={h}
                    className="px-0.5 py-1 text-center text-[8px] font-mono font-bold text-zinc-500"
                  >
                    {h}
                  </th>
                ))}
                <th className="px-1 py-1 text-right text-[8px] font-bold uppercase tracking-wider text-zinc-400">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {fechas.map((f) => {
                const esDom = f.fecha.getDay() === 0;
                const totalDia = horas.reduce(
                  (acc, h) => acc + (celdas.get(`${f.label}___${h}`)?.count ?? 0),
                  0,
                );
                return (
                  <tr key={f.label}>
                    <td
                      className={`sticky left-0 z-10 bg-[#0b0f19] px-1 py-0.5 whitespace-nowrap text-[9px] font-bold ${
                        esDom ? 'text-rose-400' : 'text-zinc-300'
                      }`}
                    >
                      {f.label}
                    </td>
                    {horas.map((h) => {
                      const c = celdas.get(`${f.label}___${h}`);
                      const n = c?.count ?? 0;
                      const [bg, fg] = estiloCelda(c);
                      return (
                        <td
                          key={h}
                          title={`${f.label} a las ${h}: ${n} ${n === 1 ? 'vehículo' : 'vehículos'}`}
                          className={`relative text-center font-mono font-bold rounded-[3px] hover:scale-110 hover:z-10 hover:shadow-lg transition-transform duration-100 ${
                            n > 0 ? '' : 'text-transparent'
                          }`}
                          style={{
                            backgroundColor: bg,
                            color: n > 0 ? fg : 'transparent',
                            padding: 2,
                            minWidth: 14,
                          }}
                        >
                          {n > 0 ? n : ''}
                        </td>
                      );
                    })}
                    <td className="px-1 py-0.5 text-right text-[9px] font-mono font-bold text-white border-l border-zinc-800/70">
                      {totalDia}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-800">
                <td className="sticky left-0 z-10 bg-[#0b0f19] px-1 py-1 text-[8px] font-bold uppercase tracking-wider text-zinc-400">
                  Total gen
                </td>
                {totalesPorHora.map((t, i) => (
                  <td
                    key={i}
                    className="px-0.5 py-1 text-center text-[8.5px] font-mono font-bold text-zinc-300"
                  >
                    {t > 0 ? t : ''}
                  </td>
                ))}
                <td className="px-1 py-1 text-right text-[9px] font-mono font-bold text-white">
                  {totalGeneral}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {hayDatos && (
        <p className="text-[10px] text-zinc-500 font-mono">
          {totalGeneral} vehículos posicionados en el rango
        </p>
      )}
    </div>
  );
};
