import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList,
} from 'recharts';
import { COLOR_FLOTA, type TiempoCargueTipo } from '../../../../utils/informes';
import { TOOLTIP_STYLE } from './helpers';
import { ChartHeader, PanelEmpty } from './shared';

/** Tiempo de cargue promedio por tipo de vehículo (barras horizontales, fin − inicio de cargue). */
export const TiempoCarguePanel: React.FC<{ data: TiempoCargueTipo[]; sinDatos: boolean }> = ({
  data,
  sinDatos,
}) => {
  // Solo tipos con mediciones, ordenados de mayor a menor promedio (arriba → abajo).
  const visibles = [...data]
    .filter((d) => d.conteo > 0)
    .sort((a, b) => b.promedio - a.promedio);
  return (
    <div className="lg:col-span-6 bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
      <ChartHeader
        title="Tiempo de Cargue por Tipo de Vehículo"
        subtitle="Promedio de hora fin − inicio de cargue (min)"
      />
      {sinDatos || visibles.length === 0 ? (
        <PanelEmpty />
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visibles} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 8 }}>
              <YAxis
                type="category"
                dataKey="name"
                width={92}
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <XAxis type="number" hide />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: '#1c2233' }}
                formatter={(value) => [`${value} min`, 'Promedio']}
              />
              <Bar dataKey="promedio" name="Promedio" radius={[0, 6, 6, 0]} barSize={16} isAnimationActive={false}>
                {visibles.map((entry) => (
                  <Cell key={entry.name} fill={COLOR_FLOTA[entry.name] ?? '#3b82f6'} />
                ))}
                <LabelList
                  dataKey="promedio"
                  position="right"
                  formatter={(value) => `${value} min`}
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