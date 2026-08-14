import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationsBell } from '../components/notifications/NotificationsBell';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { Notificacion } from '../types';

const n = (id: string, leida: boolean): Notificacion => ({
  id,
  tipo: 'MUELLE_ASIGNADO',
  titulo: 'Muelle asignado',
  mensaje: `Se asignó el muelle para la llave LL-6053${id.slice(-1)}.`,
  llaveRelacionada: `LL-6053${id.slice(-1)}`,
  leida,
  createdAt: new Date().toISOString(),
});

describe('NotificationsBell', () => {
  beforeEach(() => {
    useLogisticsStore.setState({ notificaciones: [], unreadNotifCount: 0 });
  });

  it('muestra vacío y sin contador cuando no hay notificaciones', () => {
    render(<NotificationsBell />);
    fireEvent.click(screen.getByTitle('Notificaciones'));
    expect(screen.getByText('Sin notificaciones por ahora')).toBeInTheDocument();
  });

  it('muestra el badge de no leídas y la lista al abrir', () => {
    const items = [n('1', false), n('2', true)];
    useLogisticsStore.setState({ notificaciones: items, unreadNotifCount: 1 });

    render(<NotificationsBell />);
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Notificaciones'));
    expect(screen.getByText('LL-60531')).toBeInTheDocument();
    expect(screen.getByText('LL-60532')).toBeInTheDocument();
  });

  it('marca todo como leído al abrir cuando hay no leídas', () => {
    useLogisticsStore.setState({ notificaciones: [n('1', false)], unreadNotifCount: 1 });

    render(<NotificationsBell />);
    fireEvent.click(screen.getByTitle('Notificaciones'));

    expect(useLogisticsStore.getState().unreadNotifCount).toBe(0);
    expect(useLogisticsStore.getState().notificaciones[0].leida).toBe(true);
  });
});