import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { HistorialView } from '../components/rbac/HistorialView';
import { useAuthStore } from '../store/useAuthStore';
import { HistorialMovimiento } from '../types';
import { todayStr } from '../lib/dateUtils';

describe('HistorialView', () => {
  beforeEach(() => {
    useAuthStore.setState({
      historial: [
        {
          id: 'H-1',
          usuario: 'Ana Pérez',
          tipoUsuario: 'admin',
          cedula: '000',
          accion: 'CREAR_TRANSPORTE',
          modulo: 'planeacion',
          detalle: 'Se creó la llave LL-60533',
          llaveRelacionada: 'LL-60533',
          createdAt: `${todayStr()}T10:00:00.000Z`,
        },
        {
          id: 'H-2',
          usuario: 'Luis Mora',
          tipoUsuario: 'supervisor',
          cedula: '0001',
          accion: 'CAMBIO_ESTADO_PORTERIA',
          modulo: 'porteria',
          detalle: 'Vehículo llegó a portería',
          llaveRelacionada: 'LL-60534',
          createdAt: `${todayStr()}T08:00:00.000Z`,
        },
      ] as HistorialMovimiento[],
    });
  });

  it('muestra el contador y los movimientos', () => {
    render(<HistorialView />);
    expect(screen.getByText('2 de 2 movimientos')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('LL-60533')).toBeInTheDocument();
  });

  it('formatea la acción con espacios en lugar de guiones bajos', () => {
    render(<HistorialView />);
    expect(screen.getByText('CREAR TRANSPORTE')).toBeInTheDocument();
  });

  it('muestra vacío cuando no hay movimientos', () => {
    useAuthStore.setState({ historial: [] });
    render(<HistorialView />);
    expect(screen.getByText(/Aún no hay movimientos registrados/i)).toBeInTheDocument();
  });
});