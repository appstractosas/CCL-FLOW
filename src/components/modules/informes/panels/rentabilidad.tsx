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
import { CONSTANTES, type RentabilidadBucket } from '../../../../utils/informes';
import {
  TOOLTIP_STYLE,
  dotPorDia,
  dotUltimoConEtiqueta,
  ticksEjeY,
  tickYDestacado,
} from './helpers';
import { ChartHeader, PanelEmpty } from './shared';

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
        <>
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
        <div className="flex flex-wrap gap-3 items-center justify-center pt-2 text-[10px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#3b82f6' }} />
            Costo CCL
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
            Costo SLA
          </span>
        </div>
        </>
      )}
    </div>
  );
};