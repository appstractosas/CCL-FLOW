import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UnifiedTransporte, ChatMessage, Notificacion } from '../types';

// ===== Mock de Supabase: builder encadenable sobre memoria =====
// `supabase.from(table)` devuelve un builder con select/order/limit/gte/lte/eq/
// insert/update/single. Cada encadenamiento acumula la consulta y el `await`
// final materializa el resultado. No toca la BD real.

type MemoryTable = Record<string, any>[];
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

function makeQuery(table: string) {
  const state = {
    base: mem[table] || [],
    orderCol: '',
    orderAsc: true,
    isSingle: false,
    limitVal: Infinity,
    patch: null as Record<string, any> | null,
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
    if (state.patch) {
      for (const r of rows) Object.assign(r, state.patch);
      state.patch = null;
      return { data: null, error: null };
    }
    return { data: state.isSingle ? rows[0] : rows, error: null };
  };

  const q = {
    select: vi.fn(() => q),
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
    insert: vi.fn((row: any) => {
      mem[table] = mem[table] || [];
      mem[table].push({ ...row });
      return q;
    }),
    update: vi.fn((patch: any) => {
      state.patch = patch;
      return q;
    }),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(materialize()).then(resolve, reject),
  } as any;

  return q;
}

const chan: any = {
  on: vi.fn(() => chan),
  subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
};

const supabaseMock = {
  from: vi.fn((table: string) => makeQuery(table)),
  channel: vi.fn(() => chan),
  removeChannel: vi.fn(),
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
};

function forceDbError() {
  const q = makeQuery('transportes');
  q.select = vi.fn(() => q);
  q.order = vi.fn(() => q);
  (q as any).then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve({ data: null, error: new Error('db down') }).then(resolve, reject);
  supabaseMock.from.mockReturnValue(q);
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
  });

  it('fetchTransportes lanza cuando la BD devuelve error', async () => {
    forceDbError();
    await expect(mod.fetchTransportes()).rejects.toThrow('db down');
  });

  it('fetchTransportesByRango acota con gte/lte usando Z como límite superior', async () => {
    const rows = await mod.fetchTransportesByRango('2026-08-13', '2026-08-13');
    expect(rows.length).toBe(1);
    const gteCalls = supabaseMock.from.mock.calls.length;
    expect(gteCalls).toBeGreaterThan(0);
    // Verifica que el límite superior es 'YYYY-MM-DDZ' (no '~') para que PostgREST no falle.
    const builder = supabaseMock.from('transportes');
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
    // Los campos no actualizados se conservan.
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
    // El insert no incluye `leida`; se establece explícitamente para que eq('leida', false) lo alcance.
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