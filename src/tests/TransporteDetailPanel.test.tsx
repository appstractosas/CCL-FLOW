import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TransporteDetailPanel } from '../components/modules/TransporteDetailPanel';
import { UnifiedTransporte } from '../types';

function makeRow(overrides: Partial<UnifiedTransporte> = {}): UnifiedTransporte {
  return {
    id: 'TR-TEST',
    llave: 'LL-60533',
    fechaHora: '2026-08-06 08:00',
    placa: 'XYZ-999',
    vehiculoTipo: 'SENCILLO',
    citaCargue: '2026-08-06 07:00',
    transportadora: 'ICOLTRANS',
    estadoTransporte: 'ALISTADO',
    estadoPorteria: 'Confirmado',
    muelleAsignado: '',
    cuadrilla: '',
    horaLlegadaPorteria: '--:--',
    horaIngreso: '--:--',
    horaInicioCargue: '--:--',
    horaFinCargue: '--:--',
    horaSalida: '--:--',
    ...overrides,
  };
}

const onClose = () => {};

describe('TransporteDetailPanel (Control de Tiempos por módulo)', () => {
  it('habilita cada hora solo si la anterior ya fue ejecutada (PORTERÍA)', () => {
    const { rerender } = render(
      <TransporteDetailPanel row={makeRow()} onClose={onClose} checklistOwner="porteria" onPorteriaHora={() => {}} />
    );

    // Sin horas registradas: se habilita la primera (H. Llegada) y la siguiente queda bloqueada.
    expect(screen.getByLabelText('H. Llegada Portería')).toBeEnabled();
    expect(screen.getByLabelText('H. Ingreso a Muelle')).toBeDisabled();

    // Con H. Llegada registrada: H. Llegada queda marcada/bloqueada y se habilita H. Ingreso.
    rerender(
      <TransporteDetailPanel
        row={makeRow({ horaLlegadaPorteria: '08:00' })}
        onClose={onClose}
        checklistOwner="porteria"
        onPorteriaHora={() => {}}
      />
    );
    expect(screen.getByLabelText('H. Llegada Portería')).toBeDisabled();
    expect(screen.getByLabelText('H. Ingreso a Muelle')).toBeEnabled();
  });

  it('muestra los checkbox únicamente del módulo correspondiente', () => {
    // PORTERÍA: 2 checkbox (H. Llegada + H. Ingreso)
    const porteria = render(
      <TransporteDetailPanel row={makeRow()} onClose={onClose} checklistOwner="porteria" onPorteriaHora={() => {}} />
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(() => screen.getByLabelText('H. Inicio Cargue')).toThrow();
    expect(() => screen.getByLabelText('H. Salida Portería')).toThrow();
    porteria.unmount();

    // DESPACHOS: 2 checkbox (H. Inicio Cargue + H. Fin Cargue)
    const despachos = render(
      <TransporteDetailPanel
        row={makeRow({ horaLlegadaPorteria: '08:00', horaIngreso: '08:05', muelleAsignado: 'Muelle 3' })}
        onClose={onClose}
        checklistOwner="despachos"
        onPorteriaHora={() => {}}
      />
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByLabelText('H. Inicio Cargue')).toBeEnabled();
    expect(screen.getByLabelText('H. Fin Cargue')).toBeDisabled();
    expect(() => screen.getByLabelText('H. Llegada Portería')).toThrow();
    despachos.unmount();

    // MONITOREO: 1 checkbox (H. Salida Portería)
    render(
      <TransporteDetailPanel
        row={makeRow({
          horaLlegadaPorteria: '08:00',
          horaIngreso: '08:05',
          horaInicioCargue: '08:10',
          horaFinCargue: '09:00',
        })}
        onClose={onClose}
        checklistOwner="monitoreo"
        onPorteriaHora={() => {}}
      />
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByLabelText('H. Salida Portería')).toBeEnabled();
  });

  it('permite asignar muelle en cualquier momento, sin depender de las horas previas', () => {
    // Llave recién creada (ninguna hora registrada): el select de muelle ya está habilitado.
    render(
      <TransporteDetailPanel row={makeRow()} onClose={onClose} onAsignarMuelle={() => {}} onMuelleHora={() => {}} />
    );
    const selectMuelle = screen.getByRole('combobox');
    expect(selectMuelle).toBeEnabled();
    expect(selectMuelle).toHaveDisplayValue('Sin asignar');
  });

  it('en DESPACHOS requiere muelle asignado para habilitar H. Inicio Cargue', () => {
    const { rerender } = render(
      <TransporteDetailPanel
        row={makeRow({ horaLlegadaPorteria: '08:00', horaIngreso: '08:05' })}
        onClose={onClose}
        checklistOwner="despachos"
        onPorteriaHora={() => {}}
      />
    );
    expect(screen.getByLabelText('H. Inicio Cargue')).toBeDisabled();

    rerender(
      <TransporteDetailPanel
        row={makeRow({ horaLlegadaPorteria: '08:00', horaIngreso: '08:05', muelleAsignado: 'Muelle 7' })}
        onClose={onClose}
        checklistOwner="despachos"
        onPorteriaHora={() => {}}
      />
    );
    expect(screen.getByLabelText('H. Inicio Cargue')).toBeEnabled();
  });
});
