import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { AeropuertoBoard } from '../components/modules/AeropuertoBoard';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useAuthStore } from '../store/useAuthStore';

describe('AeropuertoBoard (Tablero)', () => {
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

  it('muestra las llaves en filas tipo tablero con su estado', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });
    await useLogisticsStore.getState().addTransporte({ placa: 'ABC-123' });

    render(<AeropuertoBoard />);

    expect(screen.getByText('LL-60533')).toBeInTheDocument();
    expect(screen.getByText('LL-60534')).toBeInTheDocument();
    expect(screen.getAllByText(/• CONFIRMADO/i)).toHaveLength(2);
  });

  it('muestra las llaves ACTIVAS por defecto (filtro inicial ACTIVAS)', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });
    await useLogisticsStore.getState().addTransporte({ placa: 'ABC-123' });
    const cancelada = useLogisticsStore.getState().transportes.find((t) => t.placa === 'XYZ-999')!;
    useLogisticsStore.getState().cancelTransporte(cancelada.id);

    render(<AeropuertoBoard />);

    expect(screen.queryByText(/• CANCELADO/)).not.toBeInTheDocument();
    expect(screen.getByText(/• CONFIRMADO/i)).toBeInTheDocument();
  });

  it('permite filtrar por estado desde el selector', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });
    await useLogisticsStore.getState().addTransporte({ placa: 'ABC-123' });
    const cancelada = useLogisticsStore.getState().transportes.find((t) => t.placa === 'XYZ-999')!;
    useLogisticsStore.getState().cancelTransporte(cancelada.id);

    render(<AeropuertoBoard />);
    fireEvent.click(screen.getByText('Canceladas'));

    expect(screen.getByText(/• CANCELADO/)).toBeInTheDocument();
    expect(screen.queryByText(/• CONFIRMADO/i)).not.toBeInTheDocument();
  });

  it('permite buscar por llave', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });
    await useLogisticsStore.getState().addTransporte({ placa: 'ABC-123' });

    render(<AeropuertoBoard />);
    fireEvent.change(screen.getByPlaceholderText('Buscar llave o placa...'), {
      target: { value: 'LL-60534' },
    });

    expect(screen.getByText('LL-60534')).toBeInTheDocument();
    expect(screen.queryByText('LL-60533')).not.toBeInTheDocument();
  });
});
