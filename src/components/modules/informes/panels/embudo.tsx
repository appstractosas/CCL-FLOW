import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from 'recharts';
import { COLOR_EMBUDO, type EstadoConteo } from '../../../../utils/informes';
import { TOOLTIP_STYLE } from './helpers';
import { ChartHeader, PanelEmpty } from './shared';

/** Embudo operativo (BarChart vertical): llaves por estado del flujo. */
export const EmbudoPanel: React.FC<{ data: EstadoConteo[]; sinDatos: boolean }> = ({
  data,
  sinDatos,
}) => (
  <div className="lg:col-span-6 bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
    <ChartHeader title="Embudo Operativo" subtitle="Llaves por estado del flujo" />
    {sinDatos ? (
      <PanelEmpty />
    ) : (
      <div className="h-60">
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
