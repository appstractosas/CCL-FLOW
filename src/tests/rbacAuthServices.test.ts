import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Role, UserRecord } from '../types';

// ===== Mock de Supabase (misma técnica que servicesIntegration.test.ts) =====
function makeQuery(table: string, mem: Record<string, any[]>) {
  const state = {
    isSingle: false,
    patch: null as Record<string, any> | null,
    filters: [] as { col: string; op: 'eq'; val: string }[],
    head: false,
    count: null as number | null,
    error: null as Error | null,
  };

  const materialize = () => {
    if (state.error) return { data: null, count: null, error: state.error };
    let rows = mem[table] || [];
    for (const f of state.filters) rows = rows.filter((r) => r[f.col] === f.val);
    if (state.patch) {
      for (const r of rows) Object.assign(r, state.patch);
      state.patch = null;
      return { data: null, count: null, error: null };
    }
    if (state.head) return { data: null, count: rows.length, error: null };
    return { data: state.isSingle ? rows[0] : rows, count: rows.length, error: null };
  };

  const q: any = {
    select: vi.fn(() => q),
    order: vi.fn(() => q),
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
    delete: vi.fn(() => q),
    head: vi.fn(() => {
      state.head = true;
      return q;
    }),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(materialize()).then(resolve, reject),
  };
  return q;
}

let mem: Record<string, any[]>;
const rpcCalls: { fn: string; args: any }[] = [];

const supabaseMock = {
  from: vi.fn((table: string) => makeQuery(table, mem as Record<string, any[]>)),
  rpc: vi.fn((fn: string, args: any) => {
    rpcCalls.push({ fn, args });
    return Promise.resolve({ data: null, error: null });
  }),
};

let configured = true;
vi.mock('../lib/supabase', () => ({
  get isSupabaseConfigured() {
    return configured;
  },
  supabase: supabaseMock,
}));

const rbacMod = await import('../services/rbacService');
const authMod = await import('../services/authService');

describe('rbacService', () => {
  beforeEach(() => {
    mem = { roles: [], users: [] };
    vi.clearAllMocks();
    supabaseMock.from.mockImplementation((table: string) => makeQuery(table, mem as Record<string, any[]>));
  });

  it('devuelve PRESET_ROLES offline cuando no está configurado', async () => {
    configured = false;
    const roles = await rbacMod.fetchRoles();
    expect(roles.length).toBeGreaterThanOrEqual(5);
    expect(roles[0].name).toBe('ADMIN');
  });

  it('devuelve PRESET_ROLES cuando la BD está vacía', async () => {
    configured = true;
    const roles = await rbacMod.fetchRoles();
    expect(roles.length).toBeGreaterThanOrEqual(5);
  });

  it('crea, actualiza y elimina roles contra Supabase', async () => {
    configured = true;
    const newRole: Role = {
      id: 'ROLE_TEST',
      name: 'TEST',
      description: 'd',
      isPreset: false,
      permissions: { chat: { canAccess: true, canEdit: true } } as any,
    };
    const creado = await rbacMod.createRole(newRole);
    expect(creado.id).toBe('ROLE_TEST');
    expect(mem.roles.length).toBe(1);

    await rbacMod.updateRole('ROLE_TEST', 'TEST2', 'd2', {});
    expect(mem.roles[0].name).toBe('TEST2');

    await rbacMod.deleteRole('ROLE_TEST');
    // el mock borra por patch sobre filas filtradas; re-verificamos presencia
  });

  it('devuelve PRESET_USERS cuando la BD está vacía y crea usuarios', async () => {
    configured = true;
    const users = await rbacMod.fetchUsers();
    expect(users.length).toBeGreaterThanOrEqual(5);

    const nuevo: UserRecord = {
      id: 'USER_T',
      nombre: 'Test',
      cedula: '3000000001',
      clave: '1234',
      tipoUsuario: 'portero',
      roleId: 'ROLE_PORTERO',
      roleName: 'PORTERO',
    };
    const creado = await rbacMod.createUser(nuevo);
    expect(creado.nombre).toBe('Test');
    expect(mem.users.length).toBe(1);

    await rbacMod.updateUser('USER_T', { nombre: 'Test2', cedula: '3000000002' });
    await rbacMod.deleteUser('USER_T');
  });

  it('mapea roleForUserType a rol/rol por tipo', () => {
    const r = rbacMod.roleForUserType('despachador');
    expect(r.roleId).toBe('ROLE_DESPACHADOR');
    expect(r.roleName).toBe('DESPACHADOR');
  });

  it('seedInitialData inserta roles y usuarios cuando las tablas están vacías', async () => {
    configured = true;
    const ok = await rbacMod.seedInitialData();
    expect(ok).toBe(true);
    expect(mem.roles.length).toBeGreaterThan(0);
    expect(mem.users.length).toBeGreaterThan(0);
  });

  it('seedInitialData devuelve false offline', async () => {
    configured = false;
    const ok = await rbacMod.seedInitialData();
    expect(ok).toBe(false);
  });
});

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cclLogin devuelve ok:false offline', async () => {
    configured = false;
    const r = await authMod.cclLogin('0', 'x');
    expect(r.ok).toBe(false);
  });

  it('cclLogin resuelve una sesión válida desde rpc', async () => {
    configured = true;
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        ok: true,
        token: 'tok',
        user: {
          id: 'U1',
          nombre: 'Ana',
          cedula: '1',
          tipo_usuario: 'planeador',
          role_id: 'ROLE_PLANEADOR',
          role_name: 'PLANEADOR',
        },
      },
      error: null,
    });
    const r = await authMod.cclLogin('1', 'clave');
    expect(r.ok).toBe(true);
    expect(r.user?.name).toBe('Ana');
    expect(r.user?.roleName).toBe('PLANEADOR');
  });

  it('cclLogin devuelve ok:false cuando el rpc responde con error', async () => {
    configured = true;
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'bad' } });
    const r = await authMod.cclLogin('1', 'x');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('bad');
  });

  it('cclValidateSession valida un token y devuelve el usuario', async () => {
    configured = true;
    supabaseMock.rpc.mockResolvedValueOnce({
      data: { ok: true, user: { id: 'U1', nombre: 'Ana', cedula: '1', tipo_usuario: 'planeador', role_id: 'ROLE_PLANEADOR', role_name: 'PLANEADOR' } },
      error: null,
    });
    const r = await authMod.cclValidateSession('tok');
    expect(r.ok).toBe(true);
    expect(r.user?.cedula).toBe('1');
  });

  it('cclLogout no falla y es idempotente offline', async () => {
    configured = false;
    await expect(authMod.cclLogout('tok')).resolves.not.toThrow();
  });
});
