import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { DespachosModule } from '../components/modules/DespachosModule';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useAuthStore } from '../store/useAuthStore';

function setDespachador() {
  useAuthStore.setState({
    currentUser: {
      id: 'USER_DESP',
      name: 'Despachador',
      cedula: '1000000002',
      tipoUsuario: 'despachador',
      roleId: 'ROLE_DESPACHADOR',
      roleName: 'DESPACHADOR',
    },
  });
}

describe('DespachosModule', () => {
  beforeEach(() => {
    useLogisticsStore.setState({ nextLlaveSeq: 60533, transportes: [], messages: [] });
    setDespachador();
  });

  it('muestra la tabla unificada con CAJAS', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });

    render(<DespachosModule />);

    expect(screen.getByText('LL-60533')).toBeInTheDocument();
    expect(screen.getByText('CAJAS')).toBeInTheDocument();
  });

  it('el DESPACHADOR puede editar la cuadrilla desde el detalle', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999' });

    render(<DespachosModule />);
    fireEvent.click(screen.getByText('LL-60533'));

    const selectCuadrilla = screen.getByTitle('Seleccionar cuadrilla de cargue');
    expect(selectCuadrilla).toBeInTheDocument();
    fireEvent.change(selectCuadrilla, { target: { value: 'CCL' } });
    expect(useLogisticsStore.getState().transportes[0].cuadrilla).toBe('CCL');
  });
});