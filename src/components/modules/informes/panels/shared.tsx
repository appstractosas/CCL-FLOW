import React, { useEffect, useRef, useState } from 'react';
import { Inbox } from 'lucide-react';
import { type TiempoEtapaResumen } from '../../../../utils/informes';
import { fmtMiles, type SegmentoDonut } from './helpers';

export function PanelEmpty() {
  return (
    <div className="h-full min-h-[220px] flex flex-col items-center justify-center gap-2 text-zinc-500 py-8">
      <Inbox className="w-6 h-6 text-zinc-600" />
      <p className="text-xs text-center">Sin datos en el rango seleccionado.</p>
    </div>
  );
}

export function ChartHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <p className="text-[11px] text-zinc-400">{subtitle}</p>
    </div>
  );
}

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
          const izquierda =
            p.labelAnchor !== undefined
              ? p.labelAnchor === 'izquierda'
              : mid > Math.PI * 0.5 && mid < Math.PI * 1.5;
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

/** Etapa de portería: descripción, promedio/mín/máx y llaves medidas. */
export const TiempoEtapaTooltip: React.FC<{
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