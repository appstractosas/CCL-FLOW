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
});