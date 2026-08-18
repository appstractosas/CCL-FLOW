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

  it('el DESPACHADOR puede editar el número de cajas desde el detalle', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999', cajas: 500 });

    render(<DespachosModule />);
    fireEvent.click(screen.getByText('LL-60533'));

    const inputCajas = screen.getByTitle('Editar número de cajas');
    expect(inputCajas).toBeInTheDocument();
    expect(inputCajas).toHaveValue(500);
    fireEvent.change(inputCajas, { target: { value: '721' } });
    expect(useLogisticsStore.getState().transportes[0].cajas).toBe(721);
  });

  it('H. Fin Cargue solo se habilita cuando hay cuadrilla seleccionada', async () => {
    await useLogisticsStore.getState().addTransporte({ placa: 'XYZ-999', muelleAsignado: 'Muelle 1' });
    const { llave, id } = useLogisticsStore.getState().transportes[0];
    // Portería ya registró sus dos pasos y despachos inició el cargue.
    useLogisticsStore.getState().updatePorteriaHora(id, 'horaLlegadaPorteria', '2026-08-18 08:00');
    useLogisticsStore.getState().updatePorteriaHora(id, 'horaIngreso', '2026-08-18 08:10');
    useLogisticsStore.getState().updatePorteriaHora(id, 'horaInicioCargue', '2026-08-18 08:30');

    render(<DespachosModule />);
    fireEvent.click(screen.getByText(llave));

    const finCargue = screen.getByText('H. Fin Cargue').closest('label')!;
    // Sin cuadrilla aún no se puede marcar H. Fin Cargue.
    expect(finCargue.querySelector('input')).toBeDisabled();

    const selectCuadrilla = screen.getByTitle('Seleccionar cuadrilla de cargue');
    fireEvent.change(selectCuadrilla, { target: { value: 'CCL' } });
    expect(finCargue.querySelector('input')).not.toBeDisabled();
  });
});