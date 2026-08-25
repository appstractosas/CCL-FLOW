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
      <TransporteDetailPanel
        row={makeRow({ muelleAsignado: 'Muelle 3' })}
        onClose={onClose}
        checklistOwner="porteria"
        onPorteriaHora={() => {}}
      />,
    );

    // Sin horas registradas: se habilita la primera (H. Llegada) y la siguiente queda bloqueada.
    expect(screen.getByLabelText('H. Llegada Portería')).toBeEnabled();
    expect(screen.getByLabelText('H. Ingreso a Muelle')).toBeDisabled();

    // Con H. Llegada registrada: H. Llegada queda marcada/bloqueada y se habilita H. Ingreso.
    rerender(
      <TransporteDetailPanel
        row={makeRow({ horaLlegadaPorteria: '08:00', muelleAsignado: 'Muelle 3' })}
        onClose={onClose}
        checklistOwner="porteria"
        onPorteriaHora={() => {}}
      />,
    );
    expect(screen.getByLabelText('H. Llegada Portería')).toBeDisabled();
    expect(screen.getByLabelText('H. Ingreso a Muelle')).toBeEnabled();
  });

  it('H. Ingreso a Muelle exige muelle asignado (PORTERÍA, no solo DESPACHOS)', () => {
    const { rerender } = render(
      <TransporteDetailPanel
        row={makeRow({ horaLlegadaPorteria: '08:00' })}
        onClose={onClose}
        checklistOwner="porteria"
        onPorteriaHora={() => {}}
      />,
    );

    // Con H. Llegada pero SIN muelle asignado: H. Ingreso queda bloqueado.
    expect(screen.getByLabelText('H. Llegada Portería')).toBeDisabled();
    expect(screen.getByLabelText('H. Ingreso a Muelle')).toBeDisabled();

    // Al asignar muelle, se habilita H. Ingreso.
    rerender(
      <TransporteDetailPanel
        row={makeRow({ horaLlegadaPorteria: '08:00', muelleAsignado: 'Muelle 7' })}
        onClose={onClose}
        checklistOwner="porteria"
        onPorteriaHora={() => {}}
      />,
    );
    expect(screen.getByLabelText('H. Ingreso a Muelle')).toBeEnabled();
  });

  it('ubica Muelle Asignado + H. Asignación entre H. Llegada y H. Ingreso', () => {
    const { container } = render(
      <TransporteDetailPanel
        row={makeRow()}
        onClose={onClose}
        onAsignarMuelle={() => {}}
        onMuelleHora={() => {}}
      />,
    );
    const llegada = screen.getByText('H. Llegada Portería');
    const muelle = screen.getByText('Muelle Asignado');
    const ingreso = screen.getByText('H. Ingreso a Muelle');
    const enOrden = (a: HTMLElement, b: HTMLElement) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(enOrden(llegada, muelle)).toBeTruthy();
    expect(enOrden(muelle, ingreso)).toBeTruthy();
    expect(container).not.toBeNull();
  });

  it('muestra los checkbox únicamente del módulo correspondiente', () => {
    // PORTERÍA: 2 checkbox (H. Llegada + H. Ingreso)
    const porteria = render(
      <TransporteDetailPanel
        row={makeRow()}
        onClose={onClose}
        checklistOwner="porteria"
        onPorteriaHora={() => {}}
      />,
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(() => screen.getByLabelText('H. Inicio Cargue')).toThrow();
    expect(() => screen.getByLabelText('H. Salida Portería')).toThrow();
    porteria.unmount();

    // DESPACHOS: 2 checkbox (H. Inicio Cargue + H. Fin Cargue)
    const despachos = render(
      <TransporteDetailPanel
        row={makeRow({
          horaLlegadaPorteria: '08:00',
          horaIngreso: '08:05',
          muelleAsignado: 'Muelle 3',
        })}
        onClose={onClose}
        checklistOwner="despachos"
        onPorteriaHora={() => {}}
      />,
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
      />,
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByLabelText('H. Salida Portería')).toBeEnabled();
  });

  it('bloquea el inicio de portería en llaves PENDIENTE (solo CONFIRMADO puede iniciar)', () => {
    // Llave sin placa (PENDIENTE): PORTERÍA no puede iniciar el proceso.
    const pendiente = render(
      <TransporteDetailPanel
        row={makeRow({ estadoPorteria: 'Pendiente' })}
        onClose={onClose}
        checklistOwner="porteria"
        onPorteriaHora={() => {}}
      />,
    );
    expect(screen.getByLabelText('H. Llegada Portería')).toBeDisabled();
    expect(screen.getByLabelText('H. Ingreso a Muelle')).toBeDisabled();
    pendiente.unmount();

    // Llave CONFIRMADA: sí puede iniciar (H. Llegada habilitada).
    render(
      <TransporteDetailPanel
        row={makeRow({ estadoPorteria: 'Confirmado' })}
        onClose={onClose}
        checklistOwner="porteria"
        onPorteriaHora={() => {}}
      />,
    );
    expect(screen.getByLabelText('H. Llegada Portería')).toBeEnabled();
  });

  it('muestra el badge ESTATUS entre "Control de Tiempos" y el estado de portería (showEstatus)', () => {
    render(<TransporteDetailPanel row={makeRow()} onClose={onClose} showEstatus />);
    const control = screen.getByText('Control de Tiempos');
    const estatus = screen.getByText('• alistado');
    const porteria = screen.getByText('• CONFIRMADO');
    const enOrden = (a: HTMLElement, b: HTMLElement) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(enOrden(control, estatus)).toBeTruthy();
    expect(enOrden(estatus, porteria)).toBeTruthy();
  });

  it('sin showEstatus NO muestra el badge ESTATUS del detalle', () => {
    render(<TransporteDetailPanel row={makeRow()} onClose={onClose} />);
    expect(screen.queryByText('• alistado')).not.toBeInTheDocument();
  });

  it('muestra transportadora y región en el encabezado sin títulos, y Kg bajo H. Salida', () => {
    const { container } = render(
      <TransporteDetailPanel
        row={makeRow({
          transporte: '3000214899',
          denominacion: 'GLOBAL DISTR',
          destino: 'NEIVA',
          region: 'BOGOTA',
          kg: 8500,
        })}
        onClose={onClose}
      />,
    );

    // Encabezado: transportadora y región, SIN títulos.
    expect(screen.getByText('ICOLTRANS')).toBeInTheDocument();
    expect(screen.getByText('BOGOTA')).toBeInTheDocument();
    expect(screen.queryByText('Transportadora')).not.toBeInTheDocument();
    expect(screen.queryByText('Región')).not.toBeInTheDocument();

    // Kg queda bajo H. Salida Portería.
    const enOrden = (a: HTMLElement, b: HTMLElement) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    const salida = screen.getByText('H. Salida Portería');
    const kg = screen.getByText('8.500');
    expect(enOrden(salida, kg)).toBeTruthy();
    expect(screen.queryByText('Observaciones')).not.toBeInTheDocument();
    expect(container).not.toBeNull();
  });

  it('permite asignar muelle en cualquier momento, sin depender de las horas previas', () => {
    // Llave recién creada (ninguna hora registrada): el select de muelle ya está habilitado.
    render(
      <TransporteDetailPanel
        row={makeRow()}
        onClose={onClose}
        onAsignarMuelle={() => {}}
        onMuelleHora={() => {}}
      />,
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
      />,
    );
    expect(screen.getByLabelText('H. Inicio Cargue')).toBeDisabled();

    rerender(
      <TransporteDetailPanel
        row={makeRow({
          horaLlegadaPorteria: '08:00',
          horaIngreso: '08:05',
          muelleAsignado: 'Muelle 7',
        })}
        onClose={onClose}
        checklistOwner="despachos"
        onPorteriaHora={() => {}}
      />,
    );
    expect(screen.getByLabelText('H. Inicio Cargue')).toBeEnabled();
  });

  it('P3: al activar un checkbox, el anterior queda con hora en texto y el recién activado editable (PORTERÍA)', () => {
    const { rerender } = render(
      <TransporteDetailPanel
        row={makeRow({ horaLlegadaPorteria: '08:00', muelleAsignado: 'Muelle 3' })}
        onClose={onClose}
        checklistOwner="porteria"
        onPorteriaHora={() => {}}
      />,
    );

    // H. Llegada recién activada: su hora sigue editable (input de hora habilitado).
    expect(screen.getByTitle('Editar H. Llegada Portería')).toBeEnabled();
    // H. Ingreso (siguiente paso) aún no tiene hora: se muestra "—", sin input.
    expect(screen.queryByTitle('Editar H. Ingreso a Muelle')).not.toBeInTheDocument();

    // Se activa H. Ingreso: H. Llegada pasa a mostrar la hora como TEXTO (sin
    // input) y H. Ingreso conserva la hora editable.
    rerender(
      <TransporteDetailPanel
        row={makeRow({
          horaLlegadaPorteria: '08:00',
          horaIngreso: '08:15',
          muelleAsignado: 'Muelle 3',
        })}
        onClose={onClose}
        checklistOwner="porteria"
        onPorteriaHora={() => {}}
      />,
    );
    expect(screen.queryByTitle('Editar H. Llegada Portería')).not.toBeInTheDocument();
    expect(screen.getByTitle('Editar H. Ingreso a Muelle')).toBeEnabled();
  });

  it('P2: Editar/Cancelar del footer solo aparecen en PENDIENTE/CONFIRMADO', () => {
    const { rerender } = render(
      <TransporteDetailPanel
        row={makeRow({ horaLlegadaPorteria: '08:00' })}
        onClose={onClose}
        showEdit
        showDelete
        onEdit={() => {}}
        onDelete={() => {}}
        canCancel={() => true}
      />,
    );
    // LLEGO A PORTERIA: ya no se puede editar ni cancelar la llave.
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelar')).not.toBeInTheDocument();

    // En CONFIRMADO (sin horas): sí aparecen.
    rerender(
      <TransporteDetailPanel
        row={makeRow()}
        onClose={onClose}
        showEdit
        showDelete
        onEdit={() => {}}
        onDelete={() => {}}
        canCancel={() => true}
      />,
    );
    expect(screen.getByText('Editar')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });
});
