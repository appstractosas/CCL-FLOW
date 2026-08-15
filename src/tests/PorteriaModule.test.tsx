import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { PorteriaModule } from '../components/modules/PorteriaModule';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useAuthStore } from '../store/useAuthStore';
import { PRESET_ROLES } from '../services/rbacService';
import { UnifiedTransporte } from '../types';
import { todayStr } from '../lib/dateUtils';

describe('PorteriaModule Component (Shared Unified Table)', () => {
  beforeEach(() => {
    // Setup Admin role with edit permissions
    useAuthStore.setState({
      roles: PRESET_ROLES,
      users: [],
      currentUser: {
        id: 'USER_TEST',
        name: 'Tester Admin',
        cedula: '000',
        tipoUsuario: 'admin',
        roleId: 'ROLE_ADMIN',
        roleName: 'ADMIN',
      },
      historial: [],
    });

    const base: Omit<UnifiedTransporte, 'llave' | 'placa'> = {
      id: '',
      fechaHora: `${todayStr()} 08:00`,
      vehiculoTipo: 'TURBO',
      citaCargue: `${todayStr()} 07:00`,
      estadoTransporte: 'DESPACHADO',
      estadoPorteria: 'Pendiente',
      muelleAsignado: 'Muelle 4',
    };

    // Rows joined by LLAVE in the single unified table
    useLogisticsStore.setState({
      transportes: [
        { ...base, id: 'TR-TEST-1', llave: 'LL-60533', placa: 'TLX-842' },
        { ...base, id: 'TR-TEST-2', llave: 'LL-60534', placa: 'WNK-591' },
        {
          ...base,
          id: 'TR-TEST-3',
          llave: 'LL-60535',
          placa: 'KLR-104',
          horaLlegadaPorteria: '07:40',
          horaIngreso: '07:45',
          horaInicioCargue: '08:00',
          horaFinCargue: '08:35',
          horaSalida: '08:40',
        },
      ] as UnifiedTransporte[],
    });
  });

  it('renders unified rows without ACCIONES column (no estado selector) and shows the portería state', () => {
    render(<PorteriaModule />);

    // The shared table shows the joined transportes (one per LLAVE)
    expect(screen.getByText('LL-60533')).toBeInTheDocument();
    expect(screen.getByText('LL-60534')).toBeInTheDocument();

    // Portería does NOT render the ACCIONES column → no combobox in the table
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);

    // The ESTADO column shows the unified estado_porteria state
    expect(screen.getAllByText(/Pendiente/).length).toBeGreaterThan(0);

    // Con el filtro por defecto en "Activas" la llave ya salida no aparece;
    // al cambiar a "Todas" se muestra SALIO DE PORTERIA.
    expect(screen.queryByText(/SALIO DE PORTERIA/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Todas'));
    expect(screen.getByText(/SALIO DE PORTERIA/)).toBeInTheDocument();
  });
});
