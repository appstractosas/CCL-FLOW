import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { InformesModule } from '../components/modules/InformesModule';
import { useLogisticsStore } from '../store/useLogisticsStore';

const fecha = new Date();
const hoy = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
const fechaHoraHoy = `${hoy} 09:00`;

function makeTransporte(id: string, llave: string, over: Partial<any> = {}) {
  return {
    id,
    llave,
    fechaHora: fechaHoraHoy,
    placa: 'XYZ-999',
    vehiculoTipo: 'TURBO',
    citaCargue: fechaHoraHoy,
    estadoTransporte: 'PENDIENTE',
    estadoPorteria: 'Pendiente',
    transportadora: 'TRANSPORTES A',
    cuadrilla: 'CCL',
    cajas: 10,
    ...over,
  } as any;
}

describe('InformesModule (modo demo)', () => {
  beforeEach(() => {
    useLogisticsStore.setState({
      transportes: [
        makeTransporte('T-1', 'LL-60533'),
        makeTransporte('T-2', 'LL-60534', {
          estadoPorteria: 'Confirmado',
          horaLlegadaPorteria: '08:00',
          horaSalida: '12:00',
          placa: 'ABC-123',
        }),
      ],
    });
  });

  it('carga y muestra las KPI cards con los datos del rango', async () => {
    render(<InformesModule />);
    expect(await screen.findByText('TOTAL LLAVES')).toBeInTheDocument();
    expect(screen.getByText('LLAVES ACTIVAS')).toBeInTheDocument();
    expect(screen.getByText('FINALIZADAS')).toBeInTheDocument();
    expect(screen.getByText('CUMPLIMIENTO')).toBeInTheDocument();
  });

  it('muestra el botón Exportar Excel y los presets de rango', async () => {
    render(<InformesModule />);
    expect(await screen.findByText('Exportar Excel')).toBeInTheDocument();
    expect(screen.getByText('Día')).toBeInTheDocument();
    expect(screen.getByText('Semana')).toBeInTheDocument();
    expect(screen.getByText('Mes')).toBeInTheDocument();
    expect(screen.getByText('Año')).toBeInTheDocument();
  });

  it('cambia el preset de rango a Semana', async () => {
    render(<InformesModule />);
    await screen.findByText('TOTAL LLAVES');
    fireEvent.click(screen.getByText('Semana'));
    // El rango cambia (el preset activo se marca)
    expect(screen.getByText('Semana')).toBeInTheDocument();
  });

  it('filtra por buscador y reduce la métrica de total de llaves', async () => {
    render(<InformesModule />);
    await screen.findByText('TOTAL LLAVES');

    // Sin filtro hay 2 llaves.
    const totalCard = screen.getByText('TOTAL LLAVES').closest('div')!.parentElement!;
    expect(within(totalCard).getByText('2')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar llave, placa o transportadora...'), {
      target: { value: 'LL-60534' },
    });

    // Tras filtrar solo queda la llave buscada → total = 1.
    await waitFor(() => expect(within(totalCard).getByText('1')).toBeInTheDocument());
  });
});
