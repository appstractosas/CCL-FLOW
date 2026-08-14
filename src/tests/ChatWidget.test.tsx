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

const admin = {
  id: 'USER_ADMIN',
  name: 'ADMIN',
  cedula: '0000000000',
  tipoUsuario: 'admin' as const,
  roleId: 'ROLE_ADMIN',
  roleName: 'ADMIN',
};

const supervisor = {
  id: 'USER_SUP',
  name: 'Luis',
  cedula: '1000000004',
  tipoUsuario: 'supervisor' as const,
  roleId: 'ROLE_SUPERVISOR',
  roleName: 'SUPERVISOR',
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

  it('abre el panel con el selector de llaves al pulsar el botón', () => {
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByText('Chat Operativo'));
    expect(screen.getByText('Chat Operativo Muelle & Portería')).toBeInTheDocument();
    // Solo aparecen llaves activas (la salida de portería queda fuera)
    expect(screen.getAllByText(/LL-60533/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/LL-60534/)).not.toBeInTheDocument();
  });

  it('el PORTERO ve el botón de solicitud de muelle habilitado y el de confirmación deshabilizado', () => {
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByText('Chat Operativo'));
    const btnSolicitud = screen.getByText(/\+ Solicitud Muelle/);
    expect(btnSolicitud).toBeEnabled();
    const btnConfirmar = screen.getByText(/\+ Confirmar Muelle/);
    expect(btnConfirmar).toBeDisabled();
  });

  it('el SUPERVISOR ve el botón de confirmación de muelle', () => {
    setupStore(supervisor);
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByText('Chat Operativo'));
    // El SUPERVISOR no puede seleccionar llaves ni escribir, pero sí confirmar muelle
    const btnConf = screen.getByText(/\+ Confirmar Muelle/);
    expect(btnConf).toBeEnabled();
  });

  it('el PORTERO puede enviar un mensaje de coordenación', () => {
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

  it('el PORTERO emite una solicitud de muelle que aparece en el chat', () => {
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByText('Chat Operativo'));
    fireEvent.click(screen.getByText(/\+ Solicitud Muelle/));
    const msgs = useLogisticsStore.getState().messages;
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toContain('Solicitud de muelle para la LLAVE LL-60533');
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
});
