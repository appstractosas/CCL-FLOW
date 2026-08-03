import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../store/useAuthStore';
import { PRESET_ROLES, PRESET_USERS } from '../services/rbacService';

describe('useAuthStore (Usuarios, Matriz de Permisos y Sesión)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      roles: PRESET_ROLES,
      users: PRESET_USERS,
      currentUser: {
        id: 'USER_ADMIN',
        name: 'ADMIN',
        cedula: '0000000000',
        tipoUsuario: 'admin',
        roleId: 'ROLE_ADMIN',
        roleName: 'ADMIN',
      },
      historial: [],
    });
  });

  it('debería tener los roles predefinidos ADMIN, DESPACHADOR, PORTERO, PLANEADOR y SUPERVISOR', () => {
    const state = useAuthStore.getState();
    expect(state.roles.length).toBeGreaterThanOrEqual(5);
    const names = state.roles.map((r) => r.name);
    expect(names).toContain('ADMIN');
    expect(names).toContain('DESPACHADOR');
    expect(names).toContain('PORTERO');
    expect(names).toContain('PLANEADOR');
    expect(names).toContain('SUPERVISOR');
  });

  it('debería hacer login por cédula y clave y respetar la matriz de permisos del tipo de usuario', async () => {
    const store = useAuthStore.getState();

    // Credenciales incorrectas no ingresan
    expect(await store.login('1000000002', 'clave-incorrecta')).toBe(false);
    expect(useAuthStore.getState().currentUser?.name).toBe('ADMIN');

    // PORTERO (cedula 1000000002 / clave 1234)
    expect(await store.login('1000000002', '1234')).toBe(true);
    expect(useAuthStore.getState().currentUser?.roleName).toBe('PORTERO');
    expect(useAuthStore.getState().hasModuleAccess('porteria')).toBe(true);
    expect(useAuthStore.getState().hasModuleEdit('porteria')).toBe(true);
    expect(useAuthStore.getState().hasModuleAccess('despachos')).toBe(true);
    expect(useAuthStore.getState().hasModuleEdit('despachos')).toBe(false);
    expect(useAuthStore.getState().hasModuleAccess('admin_roles')).toBe(false);
    expect(useAuthStore.getState().hasModuleAccess('usuarios')).toBe(false);

    // PLANEADOR (cedula 1000000003 / clave 1234)
    expect(await store.login('1000000003', '1234')).toBe(true);
    expect(useAuthStore.getState().hasModuleAccess('planeacion')).toBe(true);
    expect(useAuthStore.getState().hasModuleEdit('planeacion')).toBe(true);
    expect(useAuthStore.getState().hasModuleAccess('porteria')).toBe(false);

    // El ADMIN por defecto tiene acceso a ROLES y USUARIOS
    store.logout();
    expect(await store.login('0000000000', 'admin')).toBe(true);
    expect(useAuthStore.getState().hasModuleAccess('admin_roles')).toBe(true);
    expect(useAuthStore.getState().hasModuleAccess('usuarios')).toBe(true);
  });

  it('debería permitir activar módulos en la matriz y registrarlo en el historial', async () => {
    const store = useAuthStore.getState();

    // PORTERO no tiene acceso a informes
    await store.login('1000000002', '1234');
    expect(useAuthStore.getState().hasModuleAccess('informes')).toBe(false);

    // El ADMIN activa el módulo informes para el rol PORTERO
    store.updateRolePermissions('ROLE_PORTERO', 'informes', true);
    expect(useAuthStore.getState().hasModuleAccess('informes')).toBe(true);

    const historial = useAuthStore.getState().historial;
    expect(historial.some((h) => h.accion === 'ACTUALIZAR_PERMISOS')).toBe(true);
  });

  it('debería crear un usuario nuevo que puede iniciar sesión con sus credenciales', async () => {
    const store = useAuthStore.getState();

    const created = await store.createUser({
      nombre: 'Nuevo Portero',
      cedula: '2000000001',
      clave: '4321',
      tipoUsuario: 'portero',
    });

    expect(created.roleId).toBe('ROLE_PORTERO');
    expect(created.roleName).toBe('PORTERO');
    expect(useAuthStore.getState().users.map((u) => u.cedula)).toContain('2000000001');

    // Se puede iniciar sesión con el nuevo usuario
    store.logout();
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(await store.login('2000000001', '4321')).toBe(true);
    expect(useAuthStore.getState().currentUser?.name).toBe('Nuevo Portero');
  });
});
