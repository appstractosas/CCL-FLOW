import { describe, it, expect, beforeEach } from 'vitest';
import { useLogisticsStore } from '../store/useLogisticsStore';

describe('useLogisticsStore (Modelo Unificado)', () => {
  beforeEach(() => {
    useLogisticsStore.setState({
      nextLlaveSeq: 60533,
      nextPedidoSeq: 3000576478,
      transportes: [],
      messages: [],
    });
  });

  it('should autogenerate LLAVE starting from LL-60533 and consecutive order numbers', async () => {
    const store = useLogisticsStore.getState();

    const newOrder = await store.addTransporte({
      fechaHora: '2026-07-29 10:00',
      placa: 'XYZ-999',
      estado: 'ALISTADO',
    });

    expect(newOrder.llave).toBe('LL-60533');
    expect(newOrder.numeroPedido).toBe('3000576478');
    expect(newOrder.estadoDespacho).toBe('ALISTADO');
    expect(newOrder.estadoPorteria).toBe('Pendiente');

    const nextOrder = await store.addTransporte({
      fechaHora: '2026-07-29 10:15',
      placa: 'ABC-123',
      estado: 'DESPACHADO',
    });

    expect(nextOrder.llave).toBe('LL-60534');
    expect(nextOrder.numeroPedido).toBe('3000576479');
    expect(nextOrder.estadoDespacho).toBe('DESPACHADO');
  });

  it('should advance estadoPorteria when logging a porteria hora', async () => {
    const store = useLogisticsStore.getState();

    const row = await store.addTransporte({
      placa: 'XYZ-999',
    });

    expect(row.estadoDespacho).toBe('PTE ALISTAR');
    expect(row.estadoPorteria).toBe('Pendiente');

    store.updatePorteriaHora(row.id, 'horaLlegadaPorteria', '08:00');
    let currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.horaLlegadaPorteria).toBe('08:00');
    expect(currentRow?.estadoPorteria).toBe('LLEGO A PORTERIA');
  });

  it('should close the llave at SALIO DE PORTERIA and block further edits', async () => {
    const store = useLogisticsStore.getState();

    const row = await store.addTransporte({
      placa: 'XYZ-999',
    });

    store.updateMuelleAsignado(row.id, 'Muelle 7');
    let currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.muelleAsignado).toBe('Muelle 7');

    store.updatePorteriaHora(row.id, 'horaSalida', '12:00');
    currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.estadoPorteria).toBe('SALIO DE PORTERIA');

    // Llave cerrada: ya no se puede modificar en ningún módulo
    store.updateMuelleAsignado(row.id, 'Muelle 8');
    store.updatePorteriaHora(row.id, 'horaFinCargue', '11:00');
    store.updateTransporte(row.id, { placa: 'ABC-000' });
    currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.muelleAsignado).toBe('Muelle 7');
    expect(currentRow?.horaFinCargue).not.toBe('11:00');
    expect(currentRow?.placa).toBe('XYZ-999');
  });
});
