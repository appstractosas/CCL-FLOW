import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Role, UserRecord } from '../types';

// ===== Mock de Supabase: builder para SELECT + RPC para writes =====

type MemoryTable = Record<string, any>[];

// vi.hoisted ensures these are available before vi.mock is hoisted
const { mem, simulateRpc, supabaseMock, getConfigured, setConfigured } = vi.hoisted(() => {
  const mem: { [table: string]: MemoryTable } = {
    roles: [],
    users: [],
  };

  let _configured = true;

  function simulateRpc(fn: string, args: any): Promise<{ data: any; error: any }> {
    if (fn === 'ccl_create_role') {
      const row = { ...args.p_data };
      mem.roles.push(row);
      return Promise.resolve({ data: row, error: null });
    }
    if (fn === 'ccl_update_role') {
      const row = mem.roles.find((r) => r.id === args.p_id);
      if (row) {
        if (args.p_name !== undefined) row.name = args.p_name;
        if (args.p_description !== undefined) row.description = args.p_description;
        if (args.p_permissions !== undefined) row.permissions = args.p_permissions;
      }
      return Promise.resolve({ data: null, error: null });
    }
    if (fn === 'ccl_delete_role') {
      mem.roles = mem.roles.filter((r) => r.id !== args.p_id);
      return Promise.resolve({ data: null, error: null });
    }
    if (fn === 'ccl_create_user') {
      const row = { ...args.p_data };
      mem.users.push(row);
      return Promise.resolve({ data: row, error: null });
    }
    if (fn === 'ccl_update_user') {
      const row = mem.users.find((r) => r.id === args.p_id);
      if (row && args.p_data) Object.assign(row, args.p_data);
      return Promise.resolve({ data: null, error: null });
    }
    if (fn === 'ccl_delete_user') {
      mem.users = mem.users.filter((r) => r.id !== args.p_id);
      return Promise.resolve({ data: null, error: null });
    }
    if (fn === 'ccl_seed_initial_data') {
      // Simulate the SECURITY DEFINER RPC that seeds roles + users
      const PRESET_ROLES_DATA = [
        {
          id: 'ROLE_ADMIN',
          name: 'ADMIN',
          description: 'Acceso total al sistema y gestión de roles, usuarios e historial.',
          is_preset: true,
        },
        {
          id: 'ROLE_DESPACHADOR',
          name: 'DESPACHADOR',
          description: 'Gestión de despachos y planeación.',
          is_preset: true,
        },
        {
          id: 'ROLE_PORTERO',
          name: 'PORTERO',
          description: 'Control de puerta, muelles y estados de portería.',
          is_preset: true,
        },
        {
          id: 'ROLE_PLANEADOR',
          name: 'PLANEADOR',
          description: 'Planeación de transporte y vista de despachos.',
          is_preset: true,
        },
        {
          id: 'ROLE_SUPERVISOR',
          name: 'SUPERVISOR',
          description: 'Observación global de la operación e informes.',
          is_preset: true,
        },
        {
          id: 'ROLE_MONITOREO',
          name: 'MONITOREO',
          description: 'Monitoreo de la operación y registro de salida de portería.',
          is_preset: true,
        },
        {
          id: 'ROLE_TRANSPORTES',
          name: 'TRANSPORTES',
          description: 'Registro y edición de placas de transportes.',
          is_preset: true,
        },
      ];
      const PRESET_USERS_DATA = [
        {
          id: 'USER_ADMIN',
          nombre: 'ADMIN',
          cedula: '0000000000',
          clave: 'Admin1234',
          tipo_usuario: 'admin',
          role_id: 'ROLE_ADMIN',
          role_name: 'ADMIN',
        },
        {
          id: 'USER_DESP',
          nombre: 'Juan Pérez',
          cedula: '1000000001',
          clave: 'Despa1234',
          tipo_usuario: 'despachador',
          role_id: 'ROLE_DESPACHADOR',
          role_name: 'DESPACHADOR',
        },
        {
          id: 'USER_PORTERO',
          nombre: 'Ramiro Torres',
          cedula: '1000000002',
          clave: 'Porte1234',
          tipo_usuario: 'portero',
          role_id: 'ROLE_PORTERO',
          role_name: 'PORTERO',
        },
        {
          id: 'USER_PLAN',
          nombre: 'Ana Gómez',
          cedula: '1000000003',
          clave: 'Plane1234',
          tipo_usuario: 'planeador',
          role_id: 'ROLE_PLANEADOR',
          role_name: 'PLANEADOR',
        },
        {
          id: 'USER_SUP',
          nombre: 'Luis Mora',
          cedula: '1000000004',
          clave: 'Super1234',
          tipo_usuario: 'supervisor',
          role_id: 'ROLE_SUPERVISOR',
          role_name: 'SUPERVISOR',
        },
        {
          id: 'USER_MONITOREO',
          nombre: 'Carlos Montero',
          cedula: '1000000005',
          clave: 'Monit1234',
          tipo_usuario: 'monitor',
          role_id: 'ROLE_MONITOREO',
          role_name: 'MONITOREO',
        },
        {
          id: 'USER_TRANSPORTES',
          nombre: 'Diana Ríos',
          cedula: '1000000006',
          clave: 'Trans1234',
          tipo_usuario: 'transportes',
          role_id: 'ROLE_TRANSPORTES',
          role_name: 'TRANSPORTES',
        },
        {
          id: 'USER_TABLERO',
          nombre: 'Consultor Tablero',
          cedula: '1000000007',
          clave: 'Tablero1234',
          tipo_usuario: 'tablero',
          role_id: 'ROLE_TABLERO',
          role_name: 'TABLERO',
        },
        {
          id: 'USER_INFORMES',
          nombre: 'Consultor Informes',
          cedula: '1000000008',
          clave: 'Inform1234',
          tipo_usuario: 'informes',
          role_id: 'ROLE_INFORMES',
          role_name: 'INFORMES',
        },
      ];
      for (const r of PRESET_ROLES_DATA) {
        if (!mem.roles.find((x) => x.id === r.id)) mem.roles.push({ ...r, permissions: {} });
      }
      for (const u of PRESET_USERS_DATA) {
        if (!mem.users.find((x) => x.id === u.id)) mem.users.push({ ...u });
      }
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  const supabaseMock = {
    from: vi.fn((_table: string) => ({ then: () => Promise.resolve({ data: [], error: null }) })),
    rpc: vi.fn((fn: string, args?: any) => simulateRpc(fn, args)),
  };

  return {
    mem,
    simulateRpc,
    supabaseMock,
    getConfigured: () => _configured,
    setConfigured: (v: boolean) => {
      _configured = v;
    },
  };
});

function makeQuery(table: string) {
  const state = {
    isSingle: false,
    filters: [] as { col: string; op: 'eq'; val: string }[],
    orderCol: '',
    orderAsc: true,
  };

  const materialize = () => {
    let rows = mem[table] || [];
    for (const f of state.filters) rows = rows.filter((r) => r[f.col] === f.val);
    if (state.orderCol) {
      rows = [...rows].sort((a, b) => {
        const av = a[state.orderCol];
        const bv = b[state.orderCol];
        if (av == null || bv == null) return 0;
        return state.orderAsc
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }
    return { data: state.isSingle ? rows[0] : rows, count: rows.length, error: null };
  };

  const q: any = {
    select: vi.fn(() => q),
    order: vi.fn((col: string, { ascending = true } = {}) => {
      state.orderCol = col;
      state.orderAsc = ascending;
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

vi.mock('../lib/supabase', () => ({
  get isSupabaseConfigured() {
    return getConfigured();
  },
  supabase: supabaseMock,
}));

const rbacMod = await import('../services/rbacService');
const authMod = await import('../services/authService');

let configured = true;

describe('rbacService', () => {
  beforeEach(() => {
    mem.roles = [];
    mem.users = [];
    configured = true;
    setConfigured(true);
    vi.clearAllMocks();
    supabaseMock.from.mockImplementation((table: string) => makeQuery(table));
    supabaseMock.rpc.mockImplementation((fn: string, args?: any) => simulateRpc(fn, args));
  });

  it('devuelve PRESET_ROLES offline cuando no está configurado', async () => {
    setConfigured(false);
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
    expect(creado.name).toBe('TEST');
    expect(mem.roles.length).toBe(1);

    await rbacMod.updateRole('ROLE_TEST', 'TEST2', 'd2', {});
    expect(mem.roles[0].name).toBe('TEST2');

    await rbacMod.deleteRole('ROLE_TEST');
    expect(mem.roles.length).toBe(0);
  });

  it('devuelve PRESET_USERS cuando la BD está vacía y crea usuarios', async () => {
    configured = true;
    const users = await rbacMod.fetchUsers();
    expect(users.length).toBeGreaterThanOrEqual(5);

    const nuevo: UserRecord = {
      id: 'USER_T',
      nombre: 'Test',
      cedula: '3000000001',
      clave: 'Teste1234',
      tipoUsuario: 'portero',
      roleId: 'ROLE_PORTERO',
      roleName: 'PORTERO',
    };
    const creado = await rbacMod.createUser(nuevo);
    expect(creado.nombre).toBe('Test');
    expect(mem.users.length).toBe(1);

    await rbacMod.updateUser('USER_T', { nombre: 'Test2', cedula: '3000000002' });
    expect(mem.users[0].nombre).toBe('Test2');

    await rbacMod.deleteUser('USER_T');
    expect(mem.users.length).toBe(0);
  });

  it('mapea roleForUserType a rol/rol por tipo', () => {
    const r = rbacMod.roleForUserType('despachador');
    expect(r.roleId).toBe('ROLE_DESPACHADOR');
    expect(r.roleName).toBe('DESPACHADOR');
  });

  it('seedInitialData inserta roles y usuarios cuando las tablas están vacías', async () => {
    setConfigured(true);
    configured = true;
    const ok = await rbacMod.seedInitialData();
    expect(ok).toBe(true);
    expect(mem.roles.length).toBeGreaterThan(0);
    expect(mem.users.length).toBeGreaterThan(0);
  });

  it('seedInitialData devuelve false offline', async () => {
    setConfigured(false);
    configured = false;
    const ok = await rbacMod.seedInitialData();
    expect(ok).toBe(false);
  });
});

describe('authService', () => {
  beforeEach(() => {
    configured = true;
    setConfigured(true);
    vi.clearAllMocks();
    supabaseMock.rpc.mockImplementation((fn: string, args?: any) => simulateRpc(fn, args));
  });

  it('cclLogin devuelve ok:false offline', async () => {
    setConfigured(false);
    configured = false;
    const r = await authMod.cclLogin('0', 'x');
    expect(r.ok).toBe(false);
  });

  it('cclLogin resuelve una sesión válida desde rpc', async () => {
    setConfigured(true);
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
    setConfigured(true);
    configured = true;
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'bad' } });
    const r = await authMod.cclLogin('1', 'x');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('bad');
  });

  it('cclValidateSession valida un token y devuelve el usuario', async () => {
    setConfigured(true);
    configured = true;
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        ok: true,
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
    const r = await authMod.cclValidateSession('tok');
    expect(r.ok).toBe(true);
    expect(r.user?.cedula).toBe('1');
  });

  it('cclLogout no falla y es idempotente offline', async () => {
    setConfigured(false);
    configured = false;
    await expect(authMod.cclLogout('tok')).resolves.not.toThrow();
  });
});
