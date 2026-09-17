import React from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import type { ValorConteo } from '../../../../utils/informes';
import { TOOLTIP_STYLE } from './helpers';
import { ChartHeader, PanelEmpty } from './shared';

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
      <div className="h-64">
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
