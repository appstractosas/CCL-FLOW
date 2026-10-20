import React from 'react';
import type { ValorConteo } from '../../../../utils/informes';
import { type SegmentoDonut } from './helpers';
import { ChartHeader, DonutSvg, PanelEmpty } from './shared';

const COLOR_GRUPO: Record<string, string> = {
  CCL: '#3b82f6',
  SLA: '#10b981',
  LTSA: '#8b5cf6',
};

/** Cajas cargadas por cuadrilla (donut). Solo muestra grupos con cajas. */
export const CajasGrupoPanel: React.FC<{ data: ValorConteo[]; sinDatos: boolean }> = ({
  data,
  sinDatos,
}) => {
  const conDatos = data.filter((d) => d.value > 0);
  const segments: SegmentoDonut[] = conDatos.map((d) => ({
    label: d.name,
    value: d.value,
    color: COLOR_GRUPO[d.name] ?? '#3b82f6',
  }));
  return (
    <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
      <ChartHeader
        title="Cajas Cargadas por Cuadrilla"
        subtitle="Distribución porcentual por tipo de cuadrilla"
      />
      {sinDatos || conDatos.length === 0 ? (
        <PanelEmpty />
      ) : (
        <div className="flex-1 min-h-[220px]">
          <DonutSvg segments={segments} centroLabel="Cajas Totales" />
        </div>
      )}
    </div>
  );
};