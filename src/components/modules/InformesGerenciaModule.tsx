import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { ModuleToolbar } from '../common/ModuleToolbar';
import { useInformesRango } from '../../hooks/useInformesRango';
import { horaHombre, rentabilidadCuadrillas, tipoGrupo } from '../../utils/informes';
import { RentabilidadPanel } from './informes/panels';

/**
 * Informes de Gerencia: indicadores financieros del periodo (inversión CCL/SLA,
 * hora/hombre, cajas e inversión total) y rentabilidad por cuadrilla.
 * La carga de datos y el rango de fechas los comparte con InformesModule vía
 * useInformesRango.
 */
export const InformesGerenciaModule: React.FC = () => {
  const {
    searchTerm,
    setSearchTerm,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    rangoPreset,
    aplicarRango,
    loading,
    error,
    rowsFiltradas,
    sinDatos,
  } = useInformesRango();

  const rentabilidad = useMemo(
    () => rentabilidadCuadrillas(rowsFiltradas, dateFrom, dateTo),
    [rowsFiltradas, dateFrom, dateTo],
  );
  const horaHombreData = useMemo(() => horaHombre(rowsFiltradas), [rowsFiltradas]);

  // Inversiones del periodo según el rango de fechas.
  const { diasRango, inversionCCL, inversionSLA, cajasPeriodo, inversionTotal } = useMemo(() => {
    // Nº de días del rango (inclusivo).
    const t0 = new Date(`${dateFrom}T00:00:00`).getTime();
    const t1 = new Date(`${dateTo}T00:00:00`).getTime();
    const dias = t1 >= t0 ? Math.floor((t1 - t0) / 86_400_000) + 1 : 0;

    const cajasSLA = rowsFiltradas
      .filter((r) => tipoGrupo(r.cuadrilla) === 'SLA')
      .reduce((a, r) => a + (r.cajas ?? 0), 0);
    const cajasTodas = rowsFiltradas.reduce((a, r) => a + (r.cajas ?? 0), 0);

    const inversionCCL = dias * 1_432_000;
    const inversionSLA = cajasSLA * 140;
    return {
      diasRango: dias,
      inversionCCL,
      inversionSLA,
      cajasPeriodo: cajasTodas,
      inversionTotal: inversionCCL + inversionSLA,
    };
  }, [rowsFiltradas, dateFrom, dateTo]);

  return (
    <div className="space-y-6 mt-[-6px] sm:mt-[-14px] lg:mt-[-22px]">
      <ModuleToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar llave, placa o transportadora..."
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        rightContent={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl bg-zinc-900 border border-zinc-800 p-0.5">
              {(
                [
                  ['dia', 'Día'],
                  ['semana', 'Semana'],
                  ['mes', 'Mes'],
                  ['anio', 'Año'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => aplicarRango(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    rangoPreset === key
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Tags de inversión del periodo (una sola fila en PC, cascada en móvil) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-[#0e1320] border border-blue-500/20 rounded-2xl px-4 py-3 flex flex-col gap-1">
              <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                CCL (inversión)
              </p>
              <p className="text-[10px] text-zinc-500 font-mono">{diasRango} días × $1.432.000</p>
              <p className="text-xl font-black text-white">
                ${inversionCCL.toLocaleString('es-CO')}
              </p>
            </div>

            <div className="bg-[#0e1320] border border-emerald-500/20 rounded-2xl px-4 py-3 flex flex-col gap-1">
              <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                SLA (inversión)
              </p>
              <p className="text-[10px] text-zinc-500 font-mono">
                {inversionSLA > 0
                  ? `${inversionSLA / 140} cajas SLA × $140`
                  : 'sin cajas SLA en el rango'}
              </p>
              <p className="text-xl font-black text-white">
                ${inversionSLA.toLocaleString('es-CO')}
              </p>
            </div>

            <div className="bg-[#0e1320] border border-cyan-500/20 rounded-2xl px-4 py-3 flex flex-col gap-1">
              <p className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                HORA/HOMBRE
              </p>
              <p className="text-[10px] text-zinc-500 font-mono">
                Cajas por hora-hombre (CCL + SLA)
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                    Promedio
                  </span>
                  <span className="text-lg font-black text-white">
                    {horaHombreData.horasHombre > 0
                      ? horaHombreData.indice.toLocaleString('es-CO', { maximumFractionDigits: 1 })
                      : '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">
                    H/H CCL
                  </span>
                  <span className="text-lg font-black text-white">
                    {horaHombreData.ccl.horasHombre > 0
                      ? horaHombreData.ccl.indice.toLocaleString('es-CO', {
                          maximumFractionDigits: 1,
                        })
                      : '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                    H/H SLA
                  </span>
                  <span className="text-lg font-black text-white">
                    {horaHombreData.sla.horasHombre > 0
                      ? horaHombreData.sla.indice.toLocaleString('es-CO', {
                          maximumFractionDigits: 1,
                        })
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#0e1320] border border-amber-500/20 rounded-2xl px-4 py-3 flex flex-col gap-1">
              <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                Cajas del periodo
              </p>
              <p className="text-[10px] text-zinc-500 font-mono">
                Suma de cajas de todas las cuadrillas
              </p>
              <p className="text-xl font-black text-white">
                {cajasPeriodo.toLocaleString('es-CO')}
              </p>
            </div>

            <div className="bg-[#0e1320] border border-violet-500/20 rounded-2xl px-4 py-3 flex flex-col gap-1">
              <p className="text-[11px] font-bold text-violet-400 uppercase tracking-wider">
                Inversión total del periodo
              </p>
              <p className="text-[10px] text-zinc-500 font-mono">CCL + SLA</p>
              <p className="text-xl font-black text-white">
                ${inversionTotal.toLocaleString('es-CO')}
              </p>
            </div>
          </div>

          {/* Rentabilidad cuadrillas */}
          <RentabilidadPanel data={rentabilidad} sinDatos={sinDatos} />
        </>
      )}
    </div>
  );
};
