import { describe, it, expect, beforeEach } from 'vitest';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useAuthStore } from '../store/useAuthStore';
import { getEstadoPorteria } from '../utils/porteria';

describe('useLogisticsStore (Modelo Unificado)', () => {
  beforeEach(() => {
    useLogisticsStore.setState({
      nextLlaveSeq: 60533,
      transportes: [],
      messages: [],
    });
  });

  it('should autogenerate LLAVE starting from LL-60533 and mark CONFIRMADO when placa is set', async () => {
    const store = useLogisticsStore.getState();

    const newOrder = await store.addTransporte({
      fechaHora: '2026-07-29 10:00',
      placa: 'XYZ-999',
    });

    expect(newOrder.llave).toBe('LL-60533');
    expect(newOrder.estadoPorteria).toBe('Confirmado');

    const nextOrder = await store.addTransporte({
      fechaHora: '2026-07-29 10:15',
      placa: 'ABC-123',
    });

    expect(nextOrder.llave).toBe('LL-60534');
    expect(nextOrder.estadoPorteria).toBe('Confirmado');
  });

  it('should mark PENDIENTE when created without placa (placa opcional)', async () => {
    const store = useLogisticsStore.getState();

    const row = await store.addTransporte({
      fechaHora: '2026-07-29 10:30',
    });

    expect(row.llave).toBe('LL-60533');
    expect(row.placa).toBe('');
    expect(row.estadoPorteria).toBe('Pendiente');
  });

  it('should reject duplicate LLAVES', async () => {
    const store = useLogisticsStore.getState();
    await store.addTransporte({ placa: 'XYZ-999', llave: 'LL-50000' });

    await expect(
      store.addTransporte({ placa: 'ABC-123', llave: 'LL-50000' })
    ).rejects.toThrow(/ya existe/i);
  });

  it('should advance estadoPorteria when logging a porteria hora', async () => {
    const store = useLogisticsStore.getState();

    const row = await store.addTransporte({
      placa: 'XYZ-999',
    });

    expect(row.estadoPorteria).toBe('Confirmado');

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

  it('should cancel the llave (CANCELADO) instead of deleting and block further edits', async () => {
    const store = useLogisticsStore.getState();

    const row = await store.addTransporte({
      placa: 'XYZ-999',
    });

    store.cancelTransporte(row.id);
    let currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow).toBeDefined();
    expect(currentRow?.estadoPorteria).toBe('CANCELADO');

    // Cancelado: ya no se puede modificar
    store.updateMuelleAsignado(row.id, 'Muelle 8');
    store.updatePorteriaHora(row.id, 'horaLlegadaPorteria', '09:00');
    store.updateCuadrilla(row.id, 'CCL');
    currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.muelleAsignado).not.toBe('Muelle 8');
    expect(currentRow?.horaLlegadaPorteria).not.toBe('09:00');
    expect(currentRow?.cuadrilla).not.toBe('CCL');
  });

  it('should record H. Asignación Muelle only for muelles 1..12, not MUELLE CERO', async () => {
    const store = useLogisticsStore.getState();

    const row = await store.addTransporte({ placa: 'XYZ-999' });

    // MUELLE CERO: no se registra hora de asignación.
    store.updateMuelleAsignado(row.id, 'MUELLE CERO');
    let currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.muelleAsignado).toBe('MUELLE CERO');
    expect(currentRow?.horaMuelleAsignado).toBeFalsy();

    // Muelles 1..12: sí se registra la hora de asignación automáticamente.
    store.updateMuelleAsignado(row.id, 'Muelle 1');
    currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.muelleAsignado).toBe('Muelle 1');
    expect(currentRow?.horaMuelleAsignado).toBeTruthy();

    store.updateMuelleAsignado(row.id, 'Muelle 12');
    currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.muelleAsignado).toBe('Muelle 12');
    expect(currentRow?.horaMuelleAsignado).toBeTruthy();

    store.updateMuelleHora(row.id, '09:15');
    currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.horaMuelleAsignado).toBe('09:15');

    store.updateCuadrilla(row.id, 'LTSA (Éxito)');
    currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.cuadrilla).toBe('LTSA (Éxito)');
  });

  it('should advance estadoPorteria for each action of the app sequence', async () => {
    const store = useLogisticsStore.getState();
    const row = await store.addTransporte({ placa: 'XYZ-999' });
    const find = () => useLogisticsStore.getState().transportes.find((t) => t.id === row.id)!;

    expect(find().estadoPorteria).toBe('Confirmado');

    store.updatePorteriaHora(row.id, 'horaLlegadaPorteria', '08:00');
    expect(find().estadoPorteria).toBe('LLEGO A PORTERIA');
    expect(getEstadoPorteria(find())).toBe('LLEGO A PORTERIA');

    store.updatePorteriaHora(row.id, 'horaIngreso', '08:05');
    expect(find().estadoPorteria).toBe('INGRESO A MUELLE');
    expect(getEstadoPorteria(find())).toBe('INGRESO A MUELLE');

    store.updatePorteriaHora(row.id, 'horaInicioCargue', '08:10');
    expect(find().estadoPorteria).toBe('CARGANDO');
    expect(getEstadoPorteria(find())).toBe('CARGANDO');

    store.updatePorteriaHora(row.id, 'horaFinCargue', '09:00');
    expect(find().estadoPorteria).toBe('FINALIZO CARGUE');
    expect(getEstadoPorteria(find())).toBe('FINALIZO CARGUE');

    store.updatePorteriaHora(row.id, 'horaSalida', '09:15');
    expect(find().estadoPorteria).toBe('SALIO DE PORTERIA');
    expect(getEstadoPorteria(find())).toBe('SALIO DE PORTERIA');
  });

  it('should let PLANEADOR cancel a llave still in PENDIENTE/CONFIRMADO', async () => {
    useAuthStore.setState({
      currentUser: {
        id: 'USER_PLAN',
        name: 'Ana Gómez',
        cedula: '1000000003',
        tipoUsuario: 'planeador',
        roleId: 'ROLE_PLANEADOR',
        roleName: 'PLANEADOR',
      },
    });

    const store = useLogisticsStore.getState();
    const row = await store.addTransporte({ placa: 'XYZ-999' });
    expect(row.estadoPorteria).toBe('Confirmado');

    store.cancelTransporte(row.id);
    const currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.estadoPorteria).toBe('CANCELADO');
  });

  it('should prevent PLANEADOR from cancelling a llave that already advanced', async () => {
    useAuthStore.setState({
      currentUser: {
        id: 'USER_PLAN',
        name: 'Ana Gómez',
        cedula: '1000000003',
        tipoUsuario: 'planeador',
        roleId: 'ROLE_PLANEADOR',
        roleName: 'PLANEADOR',
      },
    });

    const store = useLogisticsStore.getState();
    const row = await store.addTransporte({ placa: 'XYZ-999' });
    store.updatePorteriaHora(row.id, 'horaLlegadaPorteria', '08:00');
    let currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.estadoPorteria).toBe('LLEGO A PORTERIA');

    store.cancelTransporte(row.id);
    currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.estadoPorteria).not.toBe('CANCELADO');
  });

  it('should let ADMIN cancel a llave even in an advanced state', async () => {
    useAuthStore.setState({
      currentUser: {
        id: 'USER_ADMIN',
        name: 'ADMIN',
        cedula: '0000000000',
        tipoUsuario: 'admin',
        roleId: 'ROLE_ADMIN',
        roleName: 'ADMIN',
      },
    });

    const store = useLogisticsStore.getState();
    const row = await store.addTransporte({ placa: 'XYZ-999' });
    store.updatePorteriaHora(row.id, 'horaLlegadaPorteria', '08:00');
    let currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.estadoPorteria).toBe('LLEGO A PORTERIA');

    store.cancelTransporte(row.id);
    currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.estadoPorteria).toBe('CANCELADO');
  });
});
