import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FloatingChatWidget } from '../components/chat/FloatingChatWidget';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useAuthStore } from '../store/useAuthStore';
import { PRESET_ROLES } from '../services/rbacService';
import type { UnifiedTransporte, UserSession } from '../types';

const transporteActivo: UnifiedTransporte = {
  id: 'T-1',
  llave: 'LL-60533',
  fechaHora: '2026-08-13 09:00',
  placa: 'XYZ-999',
  vehiculoTipo: 'TURBO',
  citaCargue: '2026-08-13 09:00',
  estadoTransporte: 'PENDIENTE',
  estadoPorteria: 'Pendiente',
};

const transporteSalido: UnifiedTransporte = {
  ...transporteActivo,
  id: 'T-2',
  llave: 'LL-60534',
  estadoPorteria: 'Pendiente',
  horaSalida: '13:00',
};

const portero = {
  id: 'USER_PORTERO',
  name: 'Ramiro',
  cedula: '1000000002',
  tipoUsuario: 'portero' as const,
  roleId: 'ROLE_PORTERO',
  roleName: 'PORTERO',
};

function setupStore(user: UserSession = portero) {
  useAuthStore.setState({ currentUser: user, roles: PRESET_ROLES });
  useLogisticsStore.setState({
    transportes: [transporteActivo, transporteSalido],
    messages: [],
    unreadChatCount: 2,
  });
}

describe('FloatingChatWidget (chat operativo)', () => {
  beforeEach(() => setupStore());
  afterEach(() => cleanup());

  it('muestra el contador de no leídos al estar cerrado', () => {
    render(<FloatingChatWidget />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Chat Operativo')).toBeInTheDocument();
  });

  it('abre el panel maximizado al pulsar el botón de Chat Operativo', () => {
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByText('Chat Operativo'));
    expect(
      screen.getByPlaceholderText('Escribe un mensaje de coordinación...'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Minimizar chat')).toBeInTheDocument();
  });

  it('permite cerrar el chat pulsando el botón de minimizar', () => {
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByText('Chat Operativo'));
    expect(
      screen.getByPlaceholderText('Escribe un mensaje de coordinación...'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Minimizar chat'));
    expect(
      screen.queryByPlaceholderText('Escribe un mensaje de coordinación...'),
    ).not.toBeInTheDocument();
  });

  it('el PORTERO puede enviar un mensaje de coordinación', () => {
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByText('Chat Operativo'));
    const input = screen.getByPlaceholderText('Escribe un mensaje de coordinación...');
    fireEvent.change(input, { target: { value: 'Vehiculo llegando' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    const msgs = useLogisticsStore.getState().messages;
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toBe('Vehiculo llegando');
    expect(msgs[0].senderModule).toBe('Portería');
  });

  it('muestra banner cuando el chat está deshabilitado por rol sin permiso', () => {
    useAuthStore.setState({
      currentUser: {
        id: 'USER_PLAN',
        name: 'Ana',
        cedula: '1000000003',
        tipoUsuario: 'planeador' as const,
        roleId: 'ROLE_PLANEADOR',
        roleName: 'PLANEADOR',
      },
      roles: PRESET_ROLES,
    });
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByText('Chat Operativo'));
    expect(screen.getByText(/Chat deshabilitado para tu rol/)).toBeInTheDocument();
  });

  it('muestra banner cuando no hay llaves activas en operación', () => {
    useLogisticsStore.setState({
      transportes: [transporteSalido],
      messages: [],
      unreadChatCount: 0,
    });
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByText('Chat Operativo'));
    expect(screen.getByText(/Chat deshabilitado: todas las llaves están en SALIO DE PORTERIA/)).toBeInTheDocument();
  });
});
