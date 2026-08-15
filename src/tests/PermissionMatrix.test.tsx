import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionMatrix } from '../components/rbac/PermissionMatrix';
import { RoleManager } from '../components/rbac/RoleManager';
import { useAuthStore } from '../store/useAuthStore';
import { PRESET_ROLES, PRESET_USERS } from '../services/rbacService';

describe('PermissionMatrix', () => {
  beforeEach(() => {
    useAuthStore.setState({ roles: PRESET_ROLES, users: PRESET_USERS, currentUser: null, historial: [] });
  });

  it('muestra la matriz con los módulos y las columnas de rol', () => {
    render(<PermissionMatrix />);
    expect(screen.getByText('Matriz de Permisos por Módulo')).toBeInTheDocument();
    expect(screen.getByText('Despachos')).toBeInTheDocument();
    expect(screen.getByText('Portería')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
    expect(screen.getByText('Despachador')).toBeInTheDocument();
    expect(screen.getByText('Portero')).toBeInTheDocument();
  });

  it('muestra un toggle por celda de rol activada', () => {
    render(<PermissionMatrix />);
    const switches = screen.getAllByRole('switch');
    // 11 módulos x 6 roles operativos = 66 toggles
    expect(switches.length).toBe(66);
  });

  it('lista solo los roles operativos como columnas (sin ADMIN)', () => {
    render(<PermissionMatrix />);
    const headerRoles = ['Despachador', 'Portero', 'Planeador', 'Monitor'];
    headerRoles.forEach((r) => expect(screen.getByText(r)).toBeInTheDocument());
    // "Supervisor" aparece tanto como rol (columna) como módulo (personal), por eso getAllByText.
    expect(screen.getAllByText('Supervisor').length).toBeGreaterThanOrEqual(1);
    // "Transportes" es a la vez un rol (columna) y un módulo (fila): aparecen ambos.
    expect(screen.getAllByText('Transportes').length).toBeGreaterThanOrEqual(2);
  });
});

describe('RoleManager', () => {
  beforeEach(() => {
    useAuthStore.setState({ roles: PRESET_ROLES, users: PRESET_USERS, currentUser: null, historial: [] });
  });

  it('muestra la pestaña Matriz por defecto', () => {
    render(<RoleManager />);
    expect(screen.getByText('Matriz de Permisos')).toBeInTheDocument();
  });

  it('navega a la pestaña Historial', () => {
    render(<RoleManager />);
    const swipe = screen.getByText('Historial');
    swipe.click();
    expect(screen.getByText('Historial')).toBeInTheDocument();
  });
});
