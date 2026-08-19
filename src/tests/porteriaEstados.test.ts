import { describe, it, expect } from 'vitest';
import { getEstadoPorteria, isLlaveCerrada, cumpleFiltroActivas } from '../utils/porteria';
import { addDaysStr } from '../lib/dateUtils';
import { UnifiedTransporte } from '../types';

function row(overrides: Partial<UnifiedTransporte> = {}): UnifiedTransporte {
  return {
    id: 'TR-TEST',
    llave: 'LL-60533',
    fechaHora: '2026-08-06 08:00',
    placa: '',
    vehiculoTipo: 'SENCILLO',
    citaCargue: '2026-08-06 07:00',
    estadoTransporte: 'ALISTADO',
    estadoPorteria: 'Pendiente',
    horaLlegadaPorteria: '--:--',
    horaIngreso: '--:--',
    horaInicioCargue: '--:--',
    horaFinCargue: '--:--',
    horaSalida: '--:--',
    ...overrides,
  };
}

describe('getEstadoPorteria (secuencia de estados de la app)', () => {
  it('devuelve CONFIRMADO con placa asignada y PENDIENTE sin placa', () => {
    expect(getEstadoPorteria(row({ estadoPorteria: 'Confirmado' }))).toBe('Confirmado');
    expect(getEstadoPorteria(row({ estadoPorteria: 'Pendiente' }))).toBe('Pendiente');
  });

  it('avanza el estado de portería por cada acción (hora) registrada', () => {
    expect(getEstadoPorteria(row({ horaLlegadaPorteria: '08:00' }))).toBe('LLEGO A PORTERIA');
    expect(
      getEstadoPorteria(row({ horaLlegadaPorteria: '08:00', horaIngreso: '08:05' }))
    ).toBe('INGRESO A MUELLE');
    expect(
      getEstadoPorteria(row({ horaLlegadaPorteria: '08:00', horaIngreso: '08:05', horaInicioCargue: '08:10' }))
    ).toBe('CARGANDO');
    expect(
      getEstadoPorteria(
        row({ horaLlegadaPorteria: '08:00', horaIngreso: '08:05', horaInicioCargue: '08:10', horaFinCargue: '09:00' })
      )
    ).toBe('FINALIZO CARGUE');
    expect(
      getEstadoPorteria(
        row({
          horaLlegadaPorteria: '08:00',
          horaIngreso: '08:05',
          horaInicioCargue: '08:10',
          horaFinCargue: '09:00',
          horaSalida: '09:15',
        })
      )
    ).toBe('SALIO DE PORTERIA');
  });

  it('conserva CANCELADO aunque existan horas registradas', () => {
    expect(getEstadoPorteria(row({ estadoPorteria: 'CANCELADO' }))).toBe('CANCELADO');
    expect(getEstadoPorteria(row({ estadoPorteria: 'CANCELADO', horaSalida: '09:15' }))).toBe('CANCELADO');
  });

  it('marca la llave como cerrada solo en SALIO DE PORTERIA o CANCELADO', () => {
    expect(isLlaveCerrada(row({ estadoPorteria: 'Confirmado' }))).toBe(false);
    expect(isLlaveCerrada(row({ horaLlegadaPorteria: '08:00' }))).toBe(false);
    expect(isLlaveCerrada(row({ horaSalida: '09:15' }))).toBe(true);
    expect(isLlaveCerrada(row({ estadoPorteria: 'CANCELADO' }))).toBe(true);
  });
});

describe('cumpleFiltroActivas (regla de fechas de la vista ACTIVAS)', () => {
  it('incluye pasado, hoy y mañana; excluye pasado mañana en adelante', () => {
    expect(cumpleFiltroActivas(row({ citaCargue: `${addDaysStr(-30)} 07:00` }))).toBe(true);
    expect(cumpleFiltroActivas(row({ citaCargue: `${addDaysStr(0)} 07:00` }))).toBe(true);
    expect(cumpleFiltroActivas(row({ citaCargue: `${addDaysStr(1)} 07:00` }))).toBe(true);
    expect(cumpleFiltroActivas(row({ citaCargue: `${addDaysStr(2)} 07:00` }))).toBe(false);
    expect(cumpleFiltroActivas(row({ citaCargue: `${addDaysStr(10)} 07:00` }))).toBe(false);
  });

  it('excluye SALIO DE PORTERIA y CANCELADO aunque la fecha esté en la ventana', () => {
    expect(cumpleFiltroActivas(row({ citaCargue: `${addDaysStr(0)} 07:00`, horaSalida: '09:15' }))).toBe(false);
    expect(cumpleFiltroActivas(row({ citaCargue: `${addDaysStr(0)} 07:00`, estadoPorteria: 'CANCELADO' }))).toBe(false);
  });

  it('excluye llaves activas sin fecha programada', () => {
    expect(cumpleFiltroActivas(row({ citaCargue: '' }))).toBe(false);
  });

  it('incluye llaves activas en cualquier etapa dentro de la ventana', () => {
    expect(cumpleFiltroActivas(row({ citaCargue: `${addDaysStr(0)} 07:00`, horaLlegadaPorteria: '08:00' }))).toBe(true);
    expect(
      cumpleFiltroActivas(row({ citaCargue: `${addDaysStr(0)} 07:00`, horaIngreso: '08:05', horaInicioCargue: '08:10' }))
    ).toBe(true);
  });
});
