import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from 'recharts';
import type { TiempoEtapaResumen } from '../../../../utils/informes';
import { ChartHeader, PanelEmpty, TiempoEtapaTooltip } from './shared';

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