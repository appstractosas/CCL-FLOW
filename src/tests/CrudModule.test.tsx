import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { CrudModule } from '../components/common/CrudModule';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useAuthStore } from '../store/useAuthStore';

describe('CrudModule (esqueleto compartido)', () => {
  beforeEach(() => {
    useLogisticsStore.setState({ nextLlaveSeq: 60533, transportes: [], messages: [] });
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
  });

  it('renderiza el buscador y las llaves existentes', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });

    render(<CrudModule searchPlaceholder="Buscar placa, llave..." />);

    expect(screen.getByPlaceholderText('Buscar placa, llave...')).toBeInTheDocument();
    expect(screen.getByText('LL-60533')).toBeInTheDocument();
    expect(screen.getByText('XYZ-999')).toBeInTheDocument();
  });

  it('filtra por el buscador', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });
    await useLogisticsStore.getState().addTransporte({ placa: 'ABC-123' });

    render(<CrudModule searchPlaceholder="Buscar..." />);
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'ABC-123' } });

    expect(screen.getByText('ABC-123')).toBeInTheDocument();
    expect(screen.queryByText('XYZ-999')).not.toBeInTheDocument();
  });

  it('filtra por estado: Canceladas', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });
    const row = useLogisticsStore.getState().transportes[0];
    useLogisticsStore.getState().cancelTransporte(row.id);

    render(<CrudModule searchPlaceholder="Buscar..." />);
    fireEvent.click(screen.getByText('Canceladas'));

    expect(screen.getByText(/CANCELADO/)).toBeInTheDocument();
  });

  it('pasa rightContent para acciones del módulo', () => {
    render(
      <CrudModule searchPlaceholder="Buscar..." rightContent={<button>+ NUEVA LLAVE</button>} />,
    );
    expect(screen.getByText('+ NUEVA LLAVE')).toBeInTheDocument();
  });
});
