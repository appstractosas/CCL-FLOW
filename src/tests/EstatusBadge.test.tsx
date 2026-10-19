import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EstatusBadge } from '../components/common/EstadoBadge';

describe('EstatusBadge', () => {
  it('muestra — cuando no hay ESTATUS', () => {
    render(<EstatusBadge estado={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('muestra el ESTATUS en minúsculas', () => {
    render(<EstatusBadge estado="ALISTADO" />);
    expect(screen.getByText(/alistado/)).toBeInTheDocument();
  });
});
