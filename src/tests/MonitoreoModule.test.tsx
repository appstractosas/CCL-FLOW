import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MonitoreoModule } from '../components/modules/MonitoreoModule';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useAuthStore } from '../store/useAuthStore';

describe('MonitoreoModule', () => {
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

  it('muestra la tabla sin columna de acciones (solo lectura)', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });

    render(<MonitoreoModule />);

    expect(screen.getByText('LL-60533')).toBeInTheDocument();
    expect(screen.queryByText(/ACCIONES/)).not.toBeInTheDocument();
  });

  it('el ADMIN puede registrar la salida de portería desde el detalle', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });
    // MONITOREO controla el último paso (H. Salida Portería): los 4 anteriores deben estar registrados.
    const row = useLogisticsStore.getState().transportes[0];
    useLogisticsStore.setState({
      transportes: [
        {
          ...row,
          horaLlegadaPorteria: '07:00',
          horaIngreso: '07:10',
          horaInicioCargue: '07:30',
          horaFinCargue: '08:00',
        },
      ],
    });

    render(<MonitoreoModule />);
    fireEvent.click(screen.getByText('LL-60533'));

    expect(screen.getByText('H. Salida Portería')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    // Modal de confirmación → Sí registra la hora.
    expect(screen.getByText(/¿Seguro que el vehículo salió de portería?/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sí'));
    expect(useLogisticsStore.getState().transportes[0].horaSalida).toBeTruthy();
  });
});