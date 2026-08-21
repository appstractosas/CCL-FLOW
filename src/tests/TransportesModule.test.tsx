import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { TransportesModule } from '../components/modules/TransportesModule';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useAuthStore } from '../store/useAuthStore';
import { todayStr } from '../lib/dateUtils';
import { UnifiedTransporte } from '../types';

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

describe('TransportesModule', () => {
  beforeEach(() => {
    useLogisticsStore.setState({ nextLlaveSeq: 60533, transportes: [], messages: [] });
    setAdmin();
  });

  it('NO muestra el botón NUEVA LLAVE pero sí permite editar la placa', async () => {
    const base: Omit<UnifiedTransporte, 'llave' | 'placa'> = {
      id: '',
      fechaHora: `${todayStr()} 08:00`,
      vehiculoTipo: 'TURBO',
      citaCargue: `${todayStr()} 07:00`,
      estadoTransporte: 'DESPACHADO',
      estadoPorteria: 'Pendiente',
    };
    useLogisticsStore.setState({
      transportes: [{ ...base, id: 'TR-TEST-1', llave: 'LL-60533', placa: 'TLX-842' }] as UnifiedTransporte[],
    });

    render(<TransportesModule />);

    expect(screen.getByText('LL-60533')).toBeInTheDocument();
    expect(screen.queryByText('NUEVA LLAVE')).not.toBeInTheDocument();

    // Header renombrado: PLACA (no PLACA REMOLQUE) y ESTATUS entre CAJAS y ESTADO.
    expect(screen.getByText('PLACA')).toBeInTheDocument();
    expect(screen.queryByText('PLACA REMOLQUE')).not.toBeInTheDocument();
    expect(screen.getByText('• DESPACHADO')).toBeInTheDocument();

    // FECHA se muestra solo con la fecha (sin la hora).
    expect(screen.getByText(todayStr())).toBeInTheDocument();
    expect(screen.queryByText(`${todayStr()} 08:00`)).not.toBeInTheDocument();

    // El ADMIN puede editar → existe la acción de editar.
    fireEvent.click(screen.getByTitle('Editar transporte'));

    // El modal en modo "solo placa" deja habilitada la placa y bloquea el resto.
    const placa = screen.getByDisplayValue('TLX-842');
    expect(placa).not.toBeDisabled();
    expect(screen.getByDisplayValue('LL-60533')).toBeDisabled();
    screen.getByText('Guardar Placa');
  });
});