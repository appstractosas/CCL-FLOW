import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { PlaneacionModule } from '../components/modules/PlaneacionModule';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useAuthStore } from '../store/useAuthStore';

function setAdmin() {
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
}

describe('PlaneacionModule', () => {
  beforeEach(() => {
    useLogisticsStore.setState({ nextLlaveSeq: 60533, transportes: [], messages: [] });
    setAdmin();
  });

  it('muestra la acción NUEVA LLAVE para ADMIN y la tabla con CAJAS', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });

    render(<PlaneacionModule />);

    expect(screen.getByText('NUEVA LLAVE')).toBeInTheDocument();
    expect(screen.getByText('LL-60533')).toBeInTheDocument();
    // El ADMIN puede editar/cancelar → la columna de acciones existe.
    expect(screen.getByText('ACCIONES')).toBeInTheDocument();
  });

  it('abre el modal de nueva llave al pulsar el botón', () => {
    render(<PlaneacionModule />);
    fireEvent.click(screen.getByText('NUEVA LLAVE'));
    expect(screen.getByText('+ Nueva Llave')).toBeInTheDocument();
  });

  it('un rol sin edición NO ve el botón NUEVA LLAVE', () => {
    useAuthStore.setState({
      roles: [],
      currentUser: {
        id: 'USER_MON',
        name: 'Monitor',
        cedula: '1000000005',
        tipoUsuario: 'monitor',
        roleId: 'ROLE_MONITOREO',
        roleName: 'MONITOREO',
      },
    });
    render(<PlaneacionModule />);
    expect(screen.queryByText('NUEVA LLAVE')).not.toBeInTheDocument();
  });

  it('crea la llave sin ESTATUS por defecto', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });
    expect(useLogisticsStore.getState().transportes[0].estadoTransporte).toBeNull();
  });

  it('permite editar las observaciones desde el modal de detalle', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });

    render(<PlaneacionModule />);
    fireEvent.click(screen.getByText('LL-60533'));

    const observaciones = screen.getByTitle('Observaciones del pedido');
    fireEvent.change(observaciones, { target: { value: 'Llamar al cliente' } });
    fireEvent.blur(observaciones);

    expect(useLogisticsStore.getState().transportes[0].observaciones).toBe('Llamar al cliente');
  });

  it('muestra Observaciones en solo lectura si la llave ya no es editable', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });
    const row = useLogisticsStore.getState().transportes[0];
    useLogisticsStore.setState({
      transportes: [{ ...row, horaLlegadaPorteria: '08:00' }],
    });

    render(<PlaneacionModule />);
    fireEvent.click(screen.getByText('LL-60533'));

    expect(screen.queryByTitle('Observaciones del pedido')).not.toBeInTheDocument();
    expect(screen.getByText('Observaciones')).toBeInTheDocument();
  });
});
