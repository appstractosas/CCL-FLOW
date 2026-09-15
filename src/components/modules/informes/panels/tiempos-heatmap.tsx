import React from 'react';
import { ETAPAS_PORTERIA, RANGOS_DEMORA } from '../../../../utils/informes';
import { hexToRgba } from './helpers';
import { ChartHeader, PanelEmpty } from './shared';

/**
 * Heatmap de tiempos por etapa: filas = etapas de portería, columnas = rangos de
 * demora (0-30 min ... >8 h). Cada celda se intensifica con el color de su etapa
 * según cuántas llaves cayeron en ese rango: la celda más intensa es el mayor
 * cuello de botella. Complementa al panel de promedios revelando LA DISPERSIÓN:
 * un promedio bajo puede esconder llaves paradas 4-8 h en "ASIGNACIÓN MUELLE".
 */
export const TiemposHeatmapPanel: React.FC<{
  data: Record<string, Record<string, number>>;
  sinDatos: boolean;
}> = ({ data, sinDatos }) => {
  const maxCount = RANGOS_DEMORA.reduce(
    (acc, rg) => ETAPAS_PORTERIA.reduce((m, e) => Math.max(m, data[rg.id]?.[e.id] ?? 0), acc),
    0,
  );
  const conDatos = RANGOS_DEMORA.some((rg) =>
    ETAPAS_PORTERIA.some((e) => (data[rg.id]?.[e.id] ?? 0) > 0),
  );
  const totalLlaves = RANGOS_DEMORA.reduce(
    (acc, rg) => acc + ETAPAS_PORTERIA.reduce((s, e) => s + (data[rg.id]?.[e.id] ?? 0), 0),
    0,
  );

  return (
    <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
      <ChartHeader
        title="Distribución de tiempos por etapa"
        subtitle="Heatmap: etapas vs. rango de demora — la celda más intensa es el mayor cuello de botella"
      />
      {sinDatos || !conDatos || maxCount === 0 ? (
        <PanelEmpty />
      ) : (
        <div className="flex-1 flex flex-col justify-center gap-1.5">
          <div
            className="grid items-center"
            style={{ gridTemplateColumns: '132px repeat(6, minmax(0, 1fr))', gap: 4 }}
          >
            <div />
            {RANGOS_DEMORA.map((rg) => (
              <div
                key={rg.id}
                title={rg.label}
                className="text-center text-[9px] font-mono text-zinc-500 font-bold uppercase tracking-wide truncate"
              >
                {rg.label}
              </div>
            ))}
          </div>
          {ETAPAS_PORTERIA.map((etapa) => {
            const alpha = (count: number) => (count > 0 ? 0.08 + (count / maxCount) * 0.82 : 0);
            return (
              <div
                key={etapa.id}
                className="grid items-center"
                style={{ gridTemplateColumns: '132px repeat(6, minmax(0, 1fr))', gap: 4 }}
              >
                <span className="flex items-center gap-1.5 pr-1 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: etapa.color }}
                  />
                  <span className="text-[9px] font-bold text-zinc-300 leading-tight truncate">
                    {etapa.label}
                  </span>
                </span>
                {RANGOS_DEMORA.map((rg) => {
                  const count = data[rg.id]?.[etapa.id] ?? 0;
                  const a = alpha(count);
                  return (
                    <div
                      key={rg.id}
                      title={`${etapa.descripcion}: ${count} llaves en ${rg.label}`}
                      className={`py-2 rounded-md text-center font-mono text-[11px] font-bold ${
                        count > 0 && a > 0.5 ? 'text-white' : 'text-zinc-500'
                      }`}
                      style={{
                        backgroundColor:
                          count > 0 ? hexToRgba(etapa.color, a) : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      {count > 0 ? count : '·'}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      {!sinDatos && conDatos && maxCount > 0 && (
        <p className="text-[10px] text-zinc-500 font-mono">
          {totalLlaves} llaves medidas · celda más intensa = {maxCount} llaves (cuello de botella)
        </p>
      )}
    </div>
  );
};