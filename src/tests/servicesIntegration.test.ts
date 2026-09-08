import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UnifiedTransporte, ChatMessage, Notificacion } from '../types';

// ===== Mock de Supabase: builder encadenable para SELECT + RPC para writes =====

type MemoryRow = Record<string, unknown>;
type MemoryTable = MemoryRow[];
const mem: { [table: string]: MemoryTable } = {
  transportes: [],
  chat_messages: [],
  notificaciones: [],
  historial_movimientos: [],
};

const orderBy = (rows: MemoryTable, col: string, asc: boolean) =>
  [...rows].sort((a, b) => {
    const av = a[col];
    const bv = b[col];
    if (av == null || bv == null) return 0;
    return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

type QueryBuilder = {
  select: (cols?: string) => QueryBuilder;
  order: (col: string, opts?: { ascending?: boolean }) => QueryBuilder;
  limit: (n: number) => QueryBuilder;
  gte: (col: string, val: string) => QueryBuilder;
  lte: (col: string, val: string) => QueryBuilder;
  eq: (col: string, val: string) => QueryBuilder;
  single: () => QueryBuilder;
  then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
};

function makeQuery(table: string): QueryBuilder {
  const state = {
    base: mem[table] || [],
    orderCol: '',
    orderAsc: true,
    isSingle: false,
    limitVal: Infinity,
    filters: [] as { col: string; op: 'gte' | 'lte' | 'eq'; val: string }[],
    error: null as Error | null,
  };

  const materialize = () => {
    let rows = mem[table] || [];
    if (state.error) return { data: null, error: state.error };
    if (state.orderCol) rows = orderBy(rows, state.orderCol, state.orderAsc);
    if (Number.isFinite(state.limitVal)) rows = rows.slice(0, state.limitVal);
    for (const f of state.filters) {
      if (f.op === 'eq') rows = rows.filter((r) => r[f.col] === f.val);
      else if (f.op === 'gte') rows = rows.filter((r) => (r[f.col] ?? '') >= f.val);
      else if (f.op === 'lte') rows = rows.filter((r) => (r[f.col] ?? '') <= f.val);
    }
    return { data: state.isSingle ? rows[0] : rows, error: null };
  };

  const q: QueryBuilder = {
    select: vi.fn((_cols?: string) => q),
    order: vi.fn((col: string, { ascending = true } = {}) => {
      state.orderCol = col;
      state.orderAsc = ascending;
      return q;
    }),
    limit: vi.fn((n: number) => {
      state.limitVal = n;
      return q;
    }),
    gte: vi.fn((col: string, val: string) => {
      state.filters.push({ col, op: 'gte', val });
      return q;
    }),
    lte: vi.fn((col: string, val: string) => {
      state.filters.push({ col, op: 'lte', val });
      return q;
    }),
    eq: vi.fn((col: string, val: string) => {
      state.filters.push({ col, op: 'eq', val });
      return q;
    }),
    single: vi.fn(() => {
      state.isSingle = true;
      return q;
    }),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(materialize()).then(resolve, reject),
  };

  return q;
}

const chan = {
  on: vi.fn(() => chan),
  subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
};

function routeRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: MemoryRow | null; error: Error | null }> {
  const data = (args?.p_data as MemoryRow | undefined) || {};

  if (fn === 'ccl_create_transporte') {
    const row = { id: `T-${Date.now()}`, ...data };
    mem.transportes.push(row);
    return Promise.resolve({ data: row, error: null });
  }
  if (fn === 'ccl_update_transporte') {
    const pId = args?.p_id;
    const row = mem.transportes.find((r) => r.id === pId);
    if (!row)
      return Promise.resolve({
        data: null,
        error: new Error('La BD no actualizó ninguna fila (id=' + pId + '). La fila no existe.'),
      });
    Object.assign(row, data);
    return Promise.resolve({ data: null, error: null });
  }
  if (fn === 'ccl_send_message') {
    const row = { id: `MSG-${Date.now()}`, ...data };
    mem.chat_messages.push(row);
    return Promise.resolve({ data: row, error: null });
  }
  if (fn === 'ccl_create_notificacion') {
    const row = { id: `N-${Date.now()}`, ...data };
    mem.notificaciones.push(row);
    return Promise.resolve({ data: row, error: null });
  }
  if (fn === 'ccl_mark_notifs_read') {
    for (const r of mem.notificaciones) r.leida = true;
    return Promise.resolve({ data: null, error: null });
  }
  if (fn === 'ccl_create_movimiento') {
    const row = { id: `H-${Date.now()}`, ...data };
    mem.historial_movimientos.push(row);
    return Promise.resolve({ data: row, error: null });
  }

  return Promise.resolve({ data: null, error: null });
}

const supabaseMock = {
  from: vi.fn((table: string) => makeQuery(table)),
  channel: vi.fn(() => chan),
  removeChannel: vi.fn(),
  rpc: vi.fn((fn: string, args?: Record<string, unknown>) => routeRpc(fn, args || {})),
};

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: supabaseMock,
}));

// El mock de Supabase debe estar registrado antes de importar los servicios.
const mod = await import('../services/transportesService');
const chatMod = await import('../services/chatService');
const notifMod = await import('../services/notificacionesService');
const histMod = await import('../services/historialService');

const afiliado = {
  id: 'T-1',
  llave: 'LL-60533',
  fecha_hora: '2026-08-13T13:00:00.000Z',
  cita_cargue: '2026-08-13T09:00:00',
  placa: 'XYZ-999',
  vehiculo_tipo: 'TURBO',
  estado_transporte: 'DESPACHADO',
  estado_porteria: 'Pendiente',
  destino: 'NEIVA',
};

function forceFromDbError() {
  const brokenQuery: QueryBuilder = {
    select: vi.fn(() => brokenQuery) as QueryBuilder['select'],
    order: vi.fn((_col: string, _opts?: { ascending?: boolean }) => brokenQuery) as QueryBuilder['order'],
    limit: vi.fn((_n: number) => brokenQuery) as QueryBuilder['limit'],
    gte: vi.fn((_col: string, _val: string) => brokenQuery) as QueryBuilder['gte'],
    lte: vi.fn((_col: string, _val: string) => brokenQuery) as QueryBuilder['lte'],
    eq: vi.fn((_col: string, _val: string) => brokenQuery) as QueryBuilder['eq'],
    single: vi.fn(() => brokenQuery) as QueryBuilder['single'],
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: new Error('db down') }).then(resolve, reject),
  };
  supabaseMock.from.mockReturnValueOnce(brokenQuery);
}

describe('transportesService (integración Supabase mockeado)', () => {
  beforeEach(() => {
    mem.transportes = [{ ...afiliado }];
    vi.clearAllMocks();
    supabaseMock.from.mockImplementation((table: string) => makeQuery(table));
  });

  it('fetchTransportes devuelve los transportes mapeados desde la BD', async () => {
    const rows = await mod.fetchTransportes();
    expect(rows.length).toBe(1);
    expect(rows[0].llave).toBe('LL-60533');
    expect(rows[0].placa).toBe('XYZ-999');
    expect(rows[0].estadoPorteria).toBe('Pendiente');
    expect(rows[0].destino).toBe('NEIVA');
  });

  it('fetchTransportes lanza cuando la BD devuelve error', async () => {
    forceFromDbError();
    await expect(mod.fetchTransportes()).rejects.toThrow('db down');
  });

  it('fetchTransportesByRango acota con gte/lte usando Z como límite superior', async () => {
    const rows = await mod.fetchTransportesByRango('2026-08-13', '2026-08-13');
    expect(rows.length).toBe(1);
    expect(supabaseMock.from).toHaveBeenCalled();
    expect(mem.transportes.length).toBeGreaterThan(0);
  });

  it('fetchTransportesByRango no filtra fuera del rango (probando Z vs ~)', async () => {
    mem.transportes = [
      { ...afiliado, cita_cargue: '2026-08-13T09:00:00' },
      { ...afiliado, llave: 'LL-999', cita_cargue: '2026-08-14T09:00:00' },
    ];
    const rows = await mod.fetchTransportesByRango('2026-08-13', '2026-08-13');
    expect(rows.length).toBe(1);
    expect(rows[0].llave).toBe('LL-60533');
  });

  it('fetchTransportesRawByRango devuelve filas CRUDAS con TODAS las columnas de la BD', async () => {
    mem.transportes = [
      { ...afiliado, created_at: '2026-08-13T08:00:00Z', updated_at: '2026-08-13T10:00:00Z' },
      { ...afiliado, id: 'T-2', cita_cargue: '2026-08-14T09:00:00' },
    ];
    const rows = await mod.fetchTransportesRawByRango('2026-08-13', '2026-08-13');
    expect(rows.length).toBe(1);
    expect(rows[0].created_at).toBe('2026-08-13T08:00:00Z');
    expect(rows[0].updated_at).toBe('2026-08-13T10:00:00Z');
    expect(rows[0].estado_transporte).toBe('DESPACHADO');
    const todas = await mod.fetchTransportesRawByRango('2026-08-01', '2026-08-31');
    expect(todas.length).toBe(2);
  });

  it('createTransporte inserta y devuelve la fila mapeada', async () => {
    mem.transportes = [];
    const nuevo = {
      llave: 'LL-60534',
      fechaHora: '2026-08-14 09:00',
      placa: 'ABC-123',
      vehiculoTipo: 'SENCILLO' as const,
      estadoTransporte: 'PENDIENTE' as const,
      estadoPorteria: 'Pendiente',
    } as UnifiedTransporte;
    const creado = await mod.createTransporte(nuevo);
    expect(creado.llave).toBe('LL-60534');
    expect(mem.transportes.length).toBe(1);
  });

  it('updateTransporte aplica solo los campos provistos', async () => {
    await mod.updateTransporte('T-1', { muelleAsignado: 'Muelle 3' });
    expect(mem.transportes[0].muelle_asignado).toBe('Muelle 3');
    expect(mem.transportes[0].placa).toBe('XYZ-999');
  });

  it('updateTransporte persiste cajas en la columna cajas de la BD', async () => {
    await mod.updateTransporte('T-1', { cajas: 721 });
    expect(mem.transportes[0].cajas).toBe(721);
  });

  it('updateTransporte LANZA cuando ninguna fila coincide (id inexistente o RLS)', async () => {
    await expect(mod.updateTransporte('ID-INEXISTENTE', { cajas: 5 })).rejects.toThrow(
      /no actualizó ninguna fila/,
    );
    expect(mem.transportes[0].placa).toBe('XYZ-999');
  });
});

describe('chatService (integración)', () => {
  beforeEach(() => {
    mem.chat_messages = [];
    vi.clearAllMocks();
  });

  it('sendMessage inserta y fetchMessages devuelve el mensaje mapeado', async () => {
    const msg: ChatMessage = {
      id: 'C-1',
      senderRole: 'despachador',
      senderName: 'Luis',
      senderModule: 'Despachos',
      content: 'Hola',
      timestamp: '2026-08-13T10:00:00Z',
      isRead: false,
    };
    await chatMod.sendMessage(msg);
    const rows = await chatMod.fetchMessages();
    expect(rows.length).toBe(1);
    expect(rows[0].content).toBe('Hola');
    expect(rows[0].senderName).toBe('Luis');
  });
});

describe('notificacionesService (integración)', () => {
  beforeEach(() => {
    mem.notificaciones = [];
    vi.clearAllMocks();
  });

  it('createNotificacion inserta y fetchNotificaciones devuelve la lista', async () => {
    await notifMod.createNotificacion({
      tipo: 'MUELLE_ASIGNADO',
      titulo: 'Muelle 4',
      mensaje: 'Asignación',
      llaveRelacionada: 'LL-60533',
    });
    const items: Notificacion[] = await notifMod.fetchNotificaciones();
    expect(items.length).toBe(1);
    expect(items[0].tipo).toBe('MUELLE_ASIGNADO');
    expect(items[0].llaveRelacionada).toBe('LL-60533');
  });

  it('markAllNotificacionesLeidas actualiza con eq', async () => {
    await notifMod.createNotificacion({ tipo: 'LLEGO_PORTERIA', titulo: 't', mensaje: 'm' });
    mem.notificaciones[0].leida = false;
    await notifMod.markAllNotificacionesLeidas();
    const items: Notificacion[] = await notifMod.fetchNotificaciones();
    expect(items[0].leida ?? false).toBe(true);
  });
});

describe('historialService (integración)', () => {
  beforeEach(() => {
    mem.historial_movimientos = [];
    vi.clearAllMocks();
  });

  it('createMovimiento inserta y fetchHistorial devuelve el movimiento mapeado', async () => {
    await histMod.createMovimiento({
      id: 'H-1',
      usuario: 'Ana',
      tipoUsuario: 'admin',
      cedula: '000',
      accion: 'CREAR_TRANSPORTE',
      modulo: 'planeacion',
      detalle: 'creada',
      createdAt: '2026-08-13T10:00:00Z',
    });
    const rows = await histMod.fetchHistorial();
    expect(rows[0].usuario).toBe('Ana');
    expect(rows[0].accion).toBe('CREAR_TRANSPORTE');
  });
});
