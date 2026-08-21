import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFiltrosTransportes } from '../hooks/useFiltrosTransportes';
import { addDaysStr } from '../lib/dateUtils';
import { UnifiedTransporte } from '../types';

function row(id: string, cita: string, horaSalida = '--:--', estadoPorteria?: UnifiedTransporte['estadoPorteria']): UnifiedTransporte {
  return {
    id,
    llave: `LL-${id}`,
    fechaHora: '2026-08-06 08:00',
    placa: 'XYZ-123',
    vehiculoTipo: 'SENCILLO',
    citaCargue: cita,
    estadoTransporte: 'ALISTADO',
    estadoPorteria: estadoPorteria ?? 'Pendiente',
    horaLlegadaPorteria: '--:--',
    horaIngreso: '--:--',
    horaInicioCargue: '--:--',
    horaFinCargue: '--:--',
    horaSalida,
  };
}

describe('useFiltrosTransportes — vista ACTIVAS (regla de fechas)', () => {
  const rows = [
    row('1', `${addDaysStr(-30)} 07:00`),                          // pasado → incluida
    row('2', `${addDaysStr(0)} 07:00`),                            // hoy → incluida
    row('3', `${addDaysStr(1)} 07:00`),                            // mañana → incluida
    row('4', `${addDaysStr(2)} 07:00`),                            // pasado mañana → excluida
    row('5', `${addDaysStr(10)} 07:00`),                           // futuro lejano → excluida
    row('6', `${addDaysStr(0)} 07:00`, '09:15'),                   // SALIO DE PORTERIA → excluida
    row('7', `${addDaysStr(0)} 07:00`, '--:--', 'CANCELADO'),      // CANCELADO → excluida
    row('8', ''),                                                  // sin cita → excluida
  ];

  it('muestra pasado+hoy+mañana activas y excluye +2, cerradas y sin cita', () => {
    const { result } = renderHook(() => useFiltrosTransportes(rows));
    expect(result.current.rowsFiltradas.map((r) => r.id).sort()).toEqual(['1', '2', '3']);
  });

  it('ignora el rango manual Desde/Hasta cuando ACTIVAS está seleccionado', () => {
    const { result } = renderHook(() => useFiltrosTransportes(rows));
    act(() => {
      result.current.setDateFrom('1990-01-01');
      result.current.setDateTo('1990-01-02');
    });
    expect(result.current.rowsFiltradas.map((r) => r.id).sort()).toEqual(['1', '2', '3']);
  });

  it('las demás vistas siguen limitando por el rango del toolbar', () => {
    const { result } = renderHook(() => useFiltrosTransportes(rows));
    act(() => {
      result.current.setEstadoFiltro('todas');
      result.current.setDateFrom(addDaysStr(0));
      result.current.setDateTo(addDaysStr(1));
    });
    // Hoy y mañana, de cualquier estado (incluye SALIO DE PORTERIA, CANCELADO y sin cita).
    expect(result.current.rowsFiltradas.map((r) => r.id).sort()).toEqual(['2', '3', '6', '7', '8']);
  });

  it('la vista FINALIZADAS filtra por la fecha de SALIO DE PORTERIA (horaSalida)', () => {
    const testRows = [
      row('f1', `${addDaysStr(-5)} 07:00`, `${addDaysStr(0)} 15:30`, 'SALIO DE PORTERIA'),
      row('f2', `${addDaysStr(0)} 07:00`, `${addDaysStr(-5)} 10:00`, 'SALIO DE PORTERIA'),
    ];

    const { result } = renderHook(() => useFiltrosTransportes(testRows));
    act(() => {
      result.current.setEstadoFiltro('finalizadas');
      result.current.setDateFrom(addDaysStr(0));
      result.current.setDateTo(addDaysStr(0));
    });

    expect(result.current.rowsFiltradas.map((r) => r.id)).toEqual(['f1']);
  });
});