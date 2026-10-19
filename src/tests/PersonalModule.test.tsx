import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { PersonalModule } from '../components/modules/PersonalModule';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useAuthStore } from '../store/useAuthStore';

describe('PersonalModule (módulo Supervisor)', () => {
  beforeEach(() => {
    useLogisticsStore.setState({ nextLlaveSeq: 60533, transportes: [], messages: [] });
    useAuthStore.setState({
      currentUser: {
        id: 'USER_SUP',
        name: 'Luis Mora',
        cedula: '1000000004',
        tipoUsuario: 'supervisor',
        roleId: 'ROLE_SUPERVISOR',
        roleName: 'SUPERVISOR',
      },
    });
  });

  it('muestra el select de muelles para el SUPERVISOR al abrir el detalle de una llave', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });

    render(<PersonalModule />);

    const fila = screen.getByText('LL-60533');
    fireEvent.click(fila);

    const selectMuelle = screen.getByTitle('Asignar muelle (incluye MUELLE CERO)');
    expect(selectMuelle).toBeInTheDocument();
    expect(selectMuelle).toBeEnabled();
    expect(selectMuelle).toHaveDisplayValue('Sin asignar');

    fireEvent.change(selectMuelle, { target: { value: 'Muelle 5' } });
    expect(screen.getByTitle('Asignar muelle (incluye MUELLE CERO)')).toHaveDisplayValue('Muelle 5');
    expect(useLogisticsStore.getState().transportes[0].muelleAsignado).toBe('Muelle 5');

    const inputHora = screen.getByTitle(
      'Editar hora de asignación del muelle (permite horas programadas)',
    );
    expect(inputHora).toBeEnabled();
  });

  it('NO muestra el select de muelles para un rol distinto de SUPERVISOR', async () => {
    useAuthStore.setState({
      currentUser: {
        id: 'USER_MON',
        name: 'Carlos Montero',
        cedula: '1000000005',
        tipoUsuario: 'monitor',
        roleId: 'ROLE_MONITOREO',
        roleName: 'MONITOREO',
      },
    });

    await useLogisticsStore.getState().addTransporte({ placa: 'ABC-123' });

    render(<PersonalModule />);
    fireEvent.click(screen.getByText('LL-60533'));

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Muelle Asignado')).toBeInTheDocument();
  });

  it('ADMIN también puede asignar muelle y editar su hora', async () => {
    useAuthStore.setState({
      currentUser: {
        id: 'USER_ADMIN',
        name: 'ADMIN',
        cedula: '0000000000',
        tipoUsuario: 'admin',
        roleId: 'ROLE_ADMIN',
        roleName: 'ADMIN',
      },
    });

    await useLogisticsStore.getState().addTransporte({ placa: 'ZZZ-000' });

    render(<PersonalModule />);
    fireEvent.click(screen.getByText('LL-60533'));

    const selectMuelle = screen.getByTitle('Asignar muelle (incluye MUELLE CERO)');
    expect(selectMuelle).toBeEnabled();
    fireEvent.change(selectMuelle, { target: { value: 'MUELLE CERO' } });
    expect(screen.getByTitle('Asignar muelle (incluye MUELLE CERO)')).toHaveDisplayValue('MUELLE CERO');
    expect(useLogisticsStore.getState().transportes[0].muelleAsignado).toBe('MUELLE CERO');

    const inputHora = screen.getByTitle(
      'Editar hora de asignación del muelle (permite horas programadas)',
    );
    expect(inputHora).toBeEnabled();
  });

  it('el SUPERVISOR puede cambiar el ESTATUS desde la columna ESTATUS', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });

    render(<PersonalModule />);

    const selectEstatus = screen.getByTitle('Cambiar ESTATUS (solo supervisor)');
    fireEvent.change(selectEstatus, { target: { value: 'DESPACHADO' } });

    expect(useLogisticsStore.getState().transportes[0].estadoTransporte).toBe('DESPACHADO');
  });

  it('el SUPERVISOR puede dejar el ESTATUS sin dato', async () => {
    await useLogisticsStore.getState().addTransporte({
      placa: 'XYZ-999',
      estadoTransporte: 'DESPACHADO',
    });

    render(<PersonalModule />);

    const selectEstatus = screen.getByTitle('Cambiar ESTATUS (solo supervisor)');
    expect(selectEstatus).toHaveDisplayValue('despachado');
    fireEvent.change(selectEstatus, { target: { value: '' } });

    expect(useLogisticsStore.getState().transportes[0].estadoTransporte).toBeNull();
  });

  it('el SUPERVISOR puede editar observaciones desde el detalle', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });

    render(<PersonalModule />);
    fireEvent.click(screen.getByText('LL-60533'));

    const observaciones = screen.getByTitle('Observaciones del pedido');
    fireEvent.change(observaciones, { target: { value: 'Revisar documento' } });
    fireEvent.blur(observaciones);

    expect(useLogisticsStore.getState().transportes[0].observaciones).toBe('Revisar documento');
  });
});
