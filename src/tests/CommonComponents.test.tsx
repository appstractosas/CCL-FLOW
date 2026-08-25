import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Pagination } from '../components/common/Pagination';
import { ModuleToolbar } from '../components/common/ModuleToolbar';
import { EstadoFilter } from '../components/common/EstadoFilter';
import { FiltroEstadoId } from '../utils/porteria';

describe('Pagination', () => {
  it('no se renderiza cuando hay una sola página', () => {
    render(<Pagination page={1} totalPages={1} totalItems={3} onPageChange={() => {}} />);
    expect(screen.queryByText(/Página/)).not.toBeInTheDocument();
  });

  it('muestra resumen de página y deshabilita Anterior en la primera', () => {
    render(<Pagination page={1} totalPages={3} totalItems={55} onPageChange={() => {}} />);
    expect(screen.getByText('Página 1 de 3 · 55 registros')).toBeInTheDocument();
    expect(screen.getByText('← Anterior')).toBeDisabled();
    expect(screen.getByText('Siguiente →')).toBeEnabled();
  });

  it('navega a la página solicitada', () => {
    const spy = vi.fn();
    render(<Pagination page={1} totalPages={3} totalItems={55} onPageChange={spy} />);
    fireEvent.click(screen.getByText('3'));
    expect(spy).toHaveBeenCalledWith(3);
  });

  it('colapsa páginas lejanas con elipsis en lugar de renderizar todas', () => {
    render(<Pagination page={10} totalPages={40} totalItems={800} onPageChange={() => {}} />);
    // Ventana: 1 … 9 10 11 … 40 → 6 botones + 2 elipsis, no 40 botones.
    const buttons = screen.getAllByRole('button').filter((b) => /^\d+$/.test(b.textContent || ''));
    expect(buttons.length).toBeLessThan(40);
    expect(screen.getAllByText('…').length).toBe(2);
  });
});

describe('ModuleToolbar', () => {
  const baseProps = {
    searchTerm: '',
    onSearchChange: () => {},
  };

  it('renders el buscador y las fechas cuando se proveen', () => {
    render(
      <ModuleToolbar
        {...baseProps}
        dateFrom="2026-08-01"
        dateTo="2026-08-31"
        onDateFromChange={() => {}}
        onDateToChange={() => {}}
        searchPlaceholder="Buscar llave..."
      />,
    );
    expect(screen.getByPlaceholderText('Buscar llave...')).toBeInTheDocument();
  });

  it('no muestra el rango de fechas si faltan dateFrom/dateTo', () => {
    render(<ModuleToolbar {...baseProps} />);
    // El DateRangeFilter muestra el título "RANGO DE FECHAS" (fecha a fecha).
    expect(screen.queryByText(/RANGO DE FECHAS/i)).not.toBeInTheDocument();
  });

  it('muestra el contador cuando se provee', () => {
    render(<ModuleToolbar {...baseProps} counter="5 de 12 movimientos" />);
    expect(screen.getByText('5 de 12 movimientos')).toBeInTheDocument();
  });
});

describe('EstadoFilter', () => {
  it('marca como activo el filtro seleccionado', () => {
    let current: FiltroEstadoId = 'todas';
    render(<EstadoFilter value={current} onChange={(v) => (current = v)} />);
    const todas = screen.getByText('Todas');
    const activas = screen.getByText('Activas');
    expect(todas).toBeInTheDocument();
    expect(activas).toBeInTheDocument();
    expect(screen.getByText('Finalizadas')).toBeInTheDocument();
    expect(screen.getByText('Canceladas')).toBeInTheDocument();
  });

  it('llama onChange con el id correcto', () => {
    const spy = vi.fn();
    render(<EstadoFilter value="todas" onChange={spy} />);
    fireEvent.click(screen.getByText('Canceladas'));
    expect(spy).toHaveBeenCalledWith('canceladas');
  });
});
