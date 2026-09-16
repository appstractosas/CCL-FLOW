import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
} from 'recharts';
import type { ValorConteo } from '../../../../utils/informes';
import { TOOLTIP_STYLE, dotPorDia } from './helpers';
import { ChartHeader, PanelEmpty } from './shared';

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
              dot={dotPorDia('#10b981')}
              activeDot={{ r: 4, fill: '#10b981' }}
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