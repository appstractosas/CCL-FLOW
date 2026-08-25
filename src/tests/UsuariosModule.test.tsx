import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { UsuariosModule } from '../components/modules/UsuariosModule';
import { useAuthStore } from '../store/useAuthStore';
import { UserRecord } from '../types';

function setAdminState() {
  useAuthStore.setState({
    roles: [],
    currentUser: {
      id: 'USER_ADMIN',
      name: 'ADMIN',
      cedula: '0000000000',
      tipoUsuario: 'admin',
      roleId: 'ROLE_ADMIN',
      roleName: 'ADMIN',
    },
    users: [
      {
        id: 'U-1',
        nombre: 'Ana Pérez',
        cedula: '1000000001',
        clave: 'clave-secreta',
        tipoUsuario: 'despachador',
        roleId: 'ROLE_DESPACHADOR',
        roleName: 'DESPACHADOR',
      },
    ] as UserRecord[],
    historial: [],
  });
}

describe('UsuariosModule', () => {
  beforeEach(() => {
    setAdminState();
  });

  it('muestra la lista de usuarios', () => {
    render(<UsuariosModule />);
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('1000000001')).toBeInTheDocument();
  });

  it('enmascara la clave de acceso (no la muestra en claro)', () => {
    render(<UsuariosModule />);
    expect(screen.queryByText('clave-secreta')).not.toBeInTheDocument();
  });

  it('permite abrir el modal de nuevo usuario', () => {
    render(<UsuariosModule />);
    fireEvent.click(screen.getByText('+ NUEVO USUARIO'));
    expect(screen.getByText('+ Nuevo Usuario')).toBeInTheDocument();
  });

  it('bloquea el módulo para roles sin permiso de administración', () => {
    useAuthStore.setState({
      currentUser: {
        id: 'USER_MON',
        name: 'Monitor',
        cedula: '1000000005',
        tipoUsuario: 'monitor',
        roleId: 'ROLE_MONITOREO',
        roleName: 'MONITOREO',
      },
    });
    render(<UsuariosModule />);
    expect(screen.getByText(/puede administrar usuarios\./)).toBeInTheDocument();
  });
});
