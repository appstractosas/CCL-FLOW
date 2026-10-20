import React from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import type { MuelleUso } from '../../../../utils/informes';
import { TOOLTIP_STYLE } from './helpers';
import { ChartHeader, PanelEmpty } from './shared';

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
      <>
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
            <Tooltip
              cursor={{ fill: '#1c2233' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as MuelleUso | undefined;
                if (!d) return null;
                return (
                  <div style={TOOLTIP_STYLE}>
                    <p className="font-semibold">{d.name}</p>
                    <p className="font-mono text-sky-400">Llaves: {d.despachos}</p>
                    <p className="font-mono text-amber-400">Cajas: {d.cajas}</p>
                  </div>
                );
              }}
            />
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
              <LabelList
                dataKey="despachos"
                position="right"
                fill="#0284c7"
                fontSize={10}
                fontFamily="monospace"
                formatter={(v) => (v === 0 ? '' : v)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 items-center justify-center pt-2 text-[10px] text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#0284c7' }} />
          Llaves
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />
          Cajas
        </span>
      </div>
      </>
    )}
  </div>
);