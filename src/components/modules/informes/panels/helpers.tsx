import { esDomingo } from '../../../../utils/informes';

export const TOOLTIP_STYLE = {
  backgroundColor: '#121726',
  borderColor: '#27272a',
  borderRadius: '12px',
  color: '#fff',
  fontSize: '11px',
};

/**
 * Formatea valores del eje Y en miles de pesos: 1432000 → "1.432 k".
 */
export function fmtEje(v: number): string {
  if (!Number.isFinite(v)) return '';
  return `${Math.round(v / 1000).toLocaleString('es-CO')} k`;
}

/** Ticks del eje Y (0, ¼, ½, ¾, top, redondeados a miles) más el valor destacado (costo/meta fijo). */
export function ticksEjeY(top: number, destacado: number): number[] {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((top * f) / 1000) * 1000);
  ticks.push(destacado);
  return [...new Set(ticks)].sort((a, b) => a - b);
}

/** Render del tick del eje Y: el valor destacado se pinta en color y negrita, el resto igual a los demás. */
export function tickYDestacado(destacado: number, color: string) {
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
export function dotPorDia(base: string) {
  return (props: { cx?: number; cy?: number; payload?: { name?: string } }) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const fecha = payload?.name ?? '';
    const domingo = esDomingo(fecha);
    return <circle cx={cx} cy={cy} r={domingo ? 3.5 : 2.5} fill={domingo ? '#ef4444' : base} />;
  };
}

/**
 * Punto con etiqueta de valor solo en el último punto de la serie. Útil para
 * costos fijos (Costo CCL) que se repiten cada día: evita repetir la misma
 * etiqueta y la sitúa sobre el punto, alineada con el eje Y.
 */
export function dotUltimoConEtiqueta(
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

/** Segmento del donut: etiqueta, valor numérico y color (paleta del panel, no se redefine aquí). */
export interface SegmentoDonut {
  label: string;
  value: number;
  color: string;
  /** Fuerza el lado donde se coloca la etiqueta ('izquierda'/'derecha'); por defecto se calcula por el ángulo. */
  labelAnchor?: 'izquierda' | 'derecha';
}

/** Formato de miles usado por las etiquetas del donut (es-CO). */
export const fmtMiles = (n: number): string => n.toLocaleString('es-CO');