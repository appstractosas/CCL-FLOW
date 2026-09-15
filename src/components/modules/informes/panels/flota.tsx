import React from 'react';
import { COLOR_FLOTA, type ValorConteo } from '../../../../utils/informes';
import { type SegmentoDonut } from './helpers';
import { ChartHeader, DonutSvg, PanelEmpty } from './shared';

/** Flota por tipo (donut) con etiquetas, sombra y total al centro. */
export const FlotaPanel: React.FC<{ data: ValorConteo[]; sinDatos: boolean }> = ({
  data,
  sinDatos,
}) => {
  const segments: SegmentoDonut[] = data.map((d) => ({
    label: d.name,
    value: d.value,
    color: COLOR_FLOTA[d.name] ?? '#3b82f6',
  }));
  return (
    <div className="lg:col-span-3 bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
      <ChartHeader title="Flota por Tipo de Vehículo" subtitle="Composición del rango" />
      {sinDatos ? (
        <PanelEmpty />
      ) : (
        <div className="flex-1 min-h-[260px]">
          <DonutSvg segments={segments} centroLabel="Vehículos Totales" />
        </div>
      )}
    </div>
  );
};
