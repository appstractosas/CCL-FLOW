import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  ReferenceLine,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
} from 'recharts';
import { CONSTANTES, type ValorConteo } from '../../../../utils/informes';
import { TOOLTIP_STYLE, dotPorDia, ticksEjeY, tickYDestacado } from './helpers';
import { ChartHeader, PanelEmpty } from './shared';

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