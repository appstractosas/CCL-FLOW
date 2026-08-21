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

  it('guarda transporte, denominacion, cajas, destino y kg al crear la llave', async () => {
    const store = useLogisticsStore.getState();

    const row = await store.addTransporte({
      fechaHora: '2026-07-29 11:00',
      placa: 'ABC-123',
      transporte: '3000214899',
      denominacion: 'GLOBAL DISTR',
      cajas: 579,
      destino: 'NEIVA',
      kg: 8500,
    });

    expect(row.transporte).toBe('3000214899');
    expect(row.denominacion).toBe('GLOBAL DISTR');
    expect(row.cajas).toBe(579);
    expect(row.destino).toBe('NEIVA');
    expect(row.kg).toBe(8500);
  });

  it('should reject the duplicate pair (llave, placa) but allow the same llave with a different placa', async () => {
    const store = useLogisticsStore.getState();
    const a = await store.addTransporte({ placa: 'XYZ-999', llave: 'LL-50000' });

    // Misma llave + MISMA placa (aunque se escriba en minúsculas) → rechazado.
    await expect(
      store.addTransporte({ placa: 'xyz-999', llave: 'LL-50000' })
    ).rejects.toThrow(/ya existe/i);

    // Misma llave + OTRA placa → crea su PROPIA fila (una fila por placa).
    const b = await store.addTransporte({ placa: 'ABC-123', llave: 'LL-50000' });
    const rows = useLogisticsStore.getState().transportes.filter((t) => t.llave === 'LL-50000');
    expect(rows).toHaveLength(2);
    expect(rows[0].id).not.toBe(rows[1].id);
    expect(b.llave).toBe('LL-50000');
    expect(b.placa).toBe('ABC-123');
  });

  it('debería rechazar un TRANSPORTE duplicado al crear (un transporte solo pertenece a una llave)', async () => {
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
    await store.addTransporte({ placa: 'XYZ-999', llave: 'LL-50000' });
    useLogisticsStore.setState({
      transportes: useLogisticsStore.getState().transportes.map((t) =>
        t.llave === 'LL-50000' ? { ...t, transporte: '3000000001' } : t
      ),
    });

    await expect(
      store.addTransporte({ placa: 'ABC-123', llave: 'LL-50001', transporte: '3000000001' })
    ).rejects.toThrow(/ya está asociado a otra llave/i);
  });

  it('debería bloquear un TRANSPORTE duplicado al editar', async () => {
    const store = useLogisticsStore.getState();
    const a = await store.addTransporte({ placa: 'XYZ-999', llave: 'LL-60533' });
    const b = await store.addTransporte({ placa: 'ABC-123', llave: 'LL-60534' });
    useLogisticsStore.setState({
      transportes: useLogisticsStore.getState().transportes.map((t) =>
        t.id === a.id ? { ...t, transporte: '3000000001' } : t
      ),
    });

    await store.updateTransporte(b.id, { transporte: '3000000001' });
    const bAfter = useLogisticsStore.getState().transportes.find((t) => t.id === b.id);
    expect(bAfter?.transporte).toBeUndefined();
  });

  it('debería bloquear guardar un par (llave, placa) duplicado al editar otra fila', async () => {
    const store = useLogisticsStore.getState();
    const a = await store.addTransporte({ placa: 'XYZ-999', llave: 'LL-60533' });
    const b = await store.addTransporte({ placa: 'ABC-123', llave: 'LL-60534' });

    await store.updateTransporte(b.id, { llave: 'LL-60533', placa: 'XYZ-999' });
    const bAfter = useLogisticsStore.getState().transportes.find((t) => t.id === b.id);
    expect(bAfter?.llave).toBe('LL-60534'); // bloqueado: la llave no cambió
    expect(bAfter?.placa).toBe('ABC-123');
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
    store.updateMuelleHora(row.id, '10:00');
    store.updateCuadrilla(row.id, 'CCL');
    currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.muelleAsignado).toBe('Muelle 7');
    expect(currentRow?.horaFinCargue).not.toBe('11:00');
    expect(currentRow?.placa).toBe('XYZ-999');
    expect(currentRow?.horaMuelleAsignado).not.toBe('10:00');
    expect(currentRow?.cuadrilla).not.toBe('CCL');
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

  it('should prevent ADMIN from cancelling once the llave passed CONFIRMADO (P2)', async () => {
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
    expect(currentRow?.estadoPorteria).not.toBe('CANCELADO');
  });

  it('should block updateTransporte after LLEGO A PORTERIA (PLANEACIÓN solo PENDIENTE/CONFIRMADO)', async () => {
    const store = useLogisticsStore.getState();
    const row = await store.addTransporte({ placa: 'XYZ-999' });

    store.updatePorteriaHora(row.id, 'horaLlegadaPorteria', '08:00'); // LLEGO A PORTERIA
    let currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.estadoPorteria).toBe('LLEGO A PORTERIA');

    store.updateTransporte(row.id, { placa: 'ABC-000' });
    currentRow = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(currentRow?.placa).toBe('XYZ-999');

    // En CONFIRMADO sí se puede editar.
    const otra = await store.addTransporte({ placa: 'ABC-123' });
    store.updateTransporte(otra.id, { placa: 'ABC-456' });
    const otraActual = useLogisticsStore.getState().transportes.find((t) => t.id === otra.id);
    expect(otraActual?.placa).toBe('ABC-456');
  });

  it('debería enviar mensajes de chat y no incrementar no leídos propios', () => {
    const store = useLogisticsStore.getState();
    const unreadBefore = useLogisticsStore.getState().unreadChatCount;
    store.sendMessage({
      senderRole: 'portero',
      senderName: 'Ramiro (Portería)',
      senderModule: 'Portería',
      content: 'Llegando a portería',
      llaveRelacionada: 'LL-60533',
    });
    const msgs = useLogisticsStore.getState().messages;
    expect(msgs.length).toBe(1);
    expect(msgs[0].senderModule).toBe('Portería');
    expect(msgs[0].llaveRelacionada).toBe('LL-60533');
    // El propio emisor ve su mensaje como leído (no incrementa no leídos).
    expect(msgs[0].isRead).toBe(true);
    expect(useLogisticsStore.getState().unreadChatCount).toBe(unreadBefore);
  });

  it('debería marcar el chat como leído (unreadChatCount=0)', () => {
    const store = useLogisticsStore.getState();
    store.sendMessage({ senderRole: 'portero', senderName: 'R', senderModule: 'Portería', content: 'Hola' });
    store.markChatRead();
    expect(useLogisticsStore.getState().unreadChatCount).toBe(0);
    expect(useLogisticsStore.getState().messages.every((m) => m.isRead)).toBe(true);
  });

  it('debería marcar las notificaciones como leídas', () => {
    useLogisticsStore.setState({
      notificaciones: [
        { id: 'N-1', tipo: 'LLEGO_PORTERIA', titulo: 't', mensaje: 'm', leida: false, createdAt: 'x' },
      ],
      unreadNotifCount: 1,
    });
    useLogisticsStore.getState().markNotifRead();
    expect(useLogisticsStore.getState().unreadNotifCount).toBe(0);
    expect(useLogisticsStore.getState().notificaciones[0].leida).toBe(true);
  });

  it('debería calcular KPIs desde los transportes', async () => {
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
    store.updatePorteriaHora(row.id, 'horaSalida', '12:00');
    await store.addTransporte({ placa: 'ABC-123' });

    const kpis = useLogisticsStore.getState().getKPIs();
    expect(kpis.totalPedidos).toBe(2);
    expect(kpis.cumplimientoSLA).toBe(50); // 1 cerrada / 2 total
    expect(kpis.cargasActivas).toBe(1);
  });

  it('debería poder actualizar la hora del muelle', async () => {
    const store = useLogisticsStore.getState();
    const row = await store.addTransporte({ placa: 'XYZ-999' });
    store.updateMuelleHora(row.id, '10:30');
    const current = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(current?.horaMuelleAsignado).toBe('10:30');
  });

  it('debería actualizar las cajas de un transporte activo', async () => {
    const store = useLogisticsStore.getState();
    const row = await store.addTransporte({ placa: 'XYZ-999', cajas: 100 });
    await store.updateCajas(row.id, 250);
    const current = useLogisticsStore.getState().transportes.find((t) => t.id === row.id);
    expect(current?.cajas).toBe(250);
  });
});
