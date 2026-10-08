import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { InformesGerenciaModule } from '../components/modules/InformesGerenciaModule';
import { useLogisticsStore } from '../store/useLogisticsStore';
import type { UnifiedTransporte } from '../types';

const fecha = new Date();
const hoy = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
const fechaHoraHoy = `${hoy} 09:00`;

function makeTransporte(
  id: string,
  llave: string,
  over: Partial<UnifiedTransporte> = {},
): UnifiedTransporte {
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
  };
}

describe('InformesGerenciaModule (modo demo)', () => {
  beforeEach(() => {
    useLogisticsStore.setState({
      transportes: [
        makeTransporte('T-1', 'LL-60533'),
        makeTransporte('T-2', 'LL-60534', { placa: 'ABC-123', cuadrilla: 'SLA', cajas: 5 }),
      ],
    });
  });

  it('muestra los 5 indicadores de inversión del periodo', async () => {
    render(<InformesGerenciaModule />);
    expect(await screen.findByText('CCL (inversión)')).toBeInTheDocument();
    expect(screen.getByText('SLA (inversión)')).toBeInTheDocument();
    expect(screen.getByText('HORA/HOMBRE')).toBeInTheDocument();
    expect(screen.getByText('Cajas del periodo')).toBeInTheDocument();
    expect(screen.getByText('Inversión total del periodo')).toBeInTheDocument();
    // 1 día del preset Día × $1.432.000.
    expect(screen.getByText(/días × \$1\.432\.000/)).toBeInTheDocument();
  });

  it('suma las cajas del periodo por cuadrilla (10 CCL + 5 SLA)', async () => {
    render(<InformesGerenciaModule />);
    await screen.findByText('Cajas del periodo');
    const card = screen.getByText('Cajas del periodo').closest('div')!;
    expect(within(card).getByText('15')).toBeInTheDocument();
    // Inversión SLA = 5 cajas × $140.
    const slaCard = screen.getByText('SLA (inversión)').closest('div')!;
    expect(within(slaCard).getByText('$700')).toBeInTheDocument();
  });

  it('muestra el panel de rentabilidad por cuadrilla', async () => {
    render(<InformesGerenciaModule />);
    expect(await screen.findByText('Rentabilidad por Cuadrilla')).toBeInTheDocument();
  });

  it('muestra los presets de rango sin botón de Exportar Excel', async () => {
    render(<InformesGerenciaModule />);
    await screen.findByText('CCL (inversión)');
    expect(screen.getByText('Día')).toBeInTheDocument();
    expect(screen.getByText('Semana')).toBeInTheDocument();
    expect(screen.getByText('Mes')).toBeInTheDocument();
    expect(screen.getByText('Año')).toBeInTheDocument();
    expect(screen.queryByText('Exportar Excel')).not.toBeInTheDocument();
  });

  it('cambia el preset de rango a Semana', async () => {
    render(<InformesGerenciaModule />);
    await screen.findByText('CCL (inversión)');
    fireEvent.click(screen.getByText('Semana'));
    expect(screen.getByText('Semana')).toBeInTheDocument();
    // Semana → al menos 7 días si hoy es domingo; mínimo 1 día desde el lunes.
    expect(screen.getByText(/días × \$1\.432\.000/)).toBeInTheDocument();
  });
});
