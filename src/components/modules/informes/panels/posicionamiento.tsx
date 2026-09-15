import React from 'react';
import type { MapaPosicionamiento, CeldaPosicion } from '../../../../utils/informes';
import { ChartHeader, PanelEmpty } from './shared';

/**
 * Mapa de calor de posicionamiento: matriz Fecha × Hora (TABLA HTML, sin SVG).
 * Cada celda agrupa los vehículos por el inicio real de cargue y se pinta según
 * el cumplimiento de la cita: verde a tiempo, amarillo demora leve, azul demora
 * crítica, rojo/gris tiempo muerto (sin operación).
 */
export const PosicionamientoPanel: React.FC<{
  data: MapaPosicionamiento;
  sinDatos: boolean;
}> = ({ data, sinDatos }) => {
  const { celdas, fechas, horas } = data;

  const totalesPorHora = horas.map((h) =>
    fechas.reduce((acc, f) => acc + (celdas.get(`${f.label}___${h}`)?.count ?? 0), 0),
  );
  const totalGeneral = totalesPorHora.reduce((a, b) => a + b, 0);
  const hayDatos = !sinDatos && fechas.length > 0 && totalGeneral > 0;

  const celdasVacias: Record<string, [string, string]> = {
    verde: ['#064e3b', '#a7f3d0'],
    amarillo: ['#713f12', '#fef08a'],
    azul: ['#1e3a5f', '#93c5fd'],
    gris: ['#7f1d1d', '#fecaca'],
  };

  /** Fondo/texto de una celda según la prioridad: verde > azul > amarillo. */
  const estiloCelda = (c: CeldaPosicion | undefined): [string, string] => {
    if (!c || c.count === 0) return celdasVacias.gris; // tiempo muerto
    if (c.aTiempo > 0) return celdasVacias.verde;
    if (c.masDe3h > 0) return celdasVacias.azul;
    if (c.entre1y3h > 0) return celdasVacias.amarillo;
    return celdasVacias.verde;
  };

  return (
    <div className="bg-[#0b0f19] border border-zinc-800/90 rounded-2xl p-5 space-y-4">
      <ChartHeader
        title="Mapa de Calor de Posicionamiento"
        subtitle="Vehículos por fecha y hora de llegada a portería según el cumplimiento de la cita"
      />
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['A tiempo (<1h)', celdasVacias.verde[0]],
            ['Demora leve (1h a 2:59h)', celdasVacias.amarillo[0]],
            ['Demora crítica (≥3h)', celdasVacias.azul[0]],
            ['Tiempo Muerto', celdasVacias.gris[0]],
          ] as const
        ).map(([label, bg]) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-zinc-800/90 text-zinc-300"
          >
            <span
              className="w-2.5 h-2.5 rounded-full border border-white/10"
              style={{ backgroundColor: bg }}
            />
            {label}
          </span>
        ))}
      </div>
      {!hayDatos ? (
        <PanelEmpty />
      ) : (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="text-[8.5px]" style={{ borderSpacing: 1 }}>
            <thead className="sticky top-0 z-20 bg-[#0b0f19]">
              <tr>
                <th className="sticky left-0 z-30 bg-[#0b0f19] px-1 py-1 text-left text-[8px] font-bold uppercase tracking-wider text-zinc-500">
                  Fecha
                </th>
                {horas.map((h) => (
                  <th
                    key={h}
                    className="px-0.5 py-1 text-center text-[8px] font-mono font-bold text-zinc-500"
                  >
                    {h}
                  </th>
                ))}
                <th className="px-1 py-1 text-right text-[8px] font-bold uppercase tracking-wider text-zinc-400">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {fechas.map((f) => {
                const esDom = f.fecha.getDay() === 0;
                const totalDia = horas.reduce(
                  (acc, h) => acc + (celdas.get(`${f.label}___${h}`)?.count ?? 0),
                  0,
                );
                return (
                  <tr key={f.label}>
                    <td
                      className={`sticky left-0 z-10 bg-[#0b0f19] px-1 py-0.5 whitespace-nowrap text-[9px] font-bold ${
                        esDom ? 'text-rose-400' : 'text-zinc-300'
                      }`}
                    >
                      {f.label}
                    </td>
                    {horas.map((h) => {
                      const c = celdas.get(`${f.label}___${h}`);
                      const n = c?.count ?? 0;
                      const [bg, fg] = estiloCelda(c);
                      return (
                        <td
                          key={h}
                          title={`${f.label} a las ${h}: ${n} ${n === 1 ? 'vehículo' : 'vehículos'}`}
                          className={`relative text-center font-mono font-bold rounded-[3px] hover:scale-110 hover:z-10 hover:shadow-lg transition-transform duration-100 ${
                            n > 0 ? '' : 'text-transparent'
                          }`}
                          style={{
                            backgroundColor: bg,
                            color: n > 0 ? fg : 'transparent',
                            padding: 2,
                            minWidth: 14,
                          }}
                        >
                          {n > 0 ? n : ''}
                        </td>
                      );
                    })}
                    <td className="px-1 py-0.5 text-right text-[9px] font-mono font-bold text-white border-l border-zinc-800/70">
                      {totalDia}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-800">
                <td className="sticky left-0 z-10 bg-[#0b0f19] px-1 py-1 text-[8px] font-bold uppercase tracking-wider text-zinc-400">
                  Total gen
                </td>
                {totalesPorHora.map((t, i) => (
                  <td
                    key={i}
                    className="px-0.5 py-1 text-center text-[8.5px] font-mono font-bold text-zinc-300"
                  >
                    {t > 0 ? t : ''}
                  </td>
                ))}
                <td className="px-1 py-1 text-right text-[9px] font-mono font-bold text-white">
                  {totalGeneral}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {hayDatos && (
        <p className="text-[10px] text-zinc-500 font-mono">
          {totalGeneral} vehículos posicionados en el rango
        </p>
      )}
    </div>
  );
};