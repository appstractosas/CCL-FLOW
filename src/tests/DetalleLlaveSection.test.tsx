import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DetalleLlaveSection } from '../components/modules/DetalleLlaveSection';
import type { DetalleLlave } from '../types';

const linea = (i: number): DetalleLlave => ({
  denominacion: `CLIENTE ${i}`,
  destino: `DESTINO ${i}`,
  citaEntrega: `2026-10-0${i} 08:00`,
});

describe('DetalleLlaveSection', () => {
  it('no renderiza nada si no hay líneas', () => {
    const { container } = render(<DetalleLlaveSection lineas={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra los 3 encabezados y los valores de cada línea', () => {
    render(<DetalleLlaveSection lineas={[linea(1)]} />);
    expect(screen.getByText('Denominación')).toBeInTheDocument();
    expect(screen.getByText('Destino')).toBeInTheDocument();
    expect(screen.getByText('Cita de entrega')).toBeInTheDocument();
    expect(screen.getByText('CLIENTE 1')).toBeInTheDocument();
    expect(screen.getByText('DESTINO 1')).toBeInTheDocument();
  });

  it('muestra "—" en los campos vacíos', () => {
    render(<DetalleLlaveSection lineas={[{ denominacion: '', destino: undefined }]} />);
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('sin scroll hasta 7 líneas y con scroll desde 8', () => {
    const { container, unmount } = render(
      <DetalleLlaveSection lineas={[1, 2, 3, 4, 5, 6, 7].map(linea)} />,
    );
    expect(container.querySelector('.overflow-y-auto')).toBeNull();
    unmount();

    const { container: containerScroll } = render(
      <DetalleLlaveSection lineas={[1, 2, 3, 4, 5, 6, 7, 8].map(linea)} />,
    );
    expect(containerScroll.querySelector('.overflow-y-auto')).not.toBeNull();
  });
});