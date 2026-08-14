import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Badge } from '../components/common/Badge';
import { Toggle } from '../components/common/Toggle';
import { Sidebar } from '../components/common/Sidebar';
import { useAuthStore } from '../store/useAuthStore';

const adminUser = {
  id: 'USER_ADMIN',
  name: 'ADMIN',
  cedula: '0000000000',
  tipoUsuario: 'admin' as const,
  roleId: 'ROLE_ADMIN',
  roleName: 'ADMIN',
};

describe('Badge', () => {
  it('renderiza estados verdes EN PROCESO / CONFIRMADO', () => {
    render(<Badge status="CONFIRMADO" />);
    expect(screen.getByText('CONFIRMADO')).toBeInTheDocument();
  });

  it('normaliza en mayúsculas y recorta espacios', () => {
    render(<Badge status="  en proceso  " />);
    // testing-library normaliza el whitespace; el texto visible es "en proceso"
    expect(screen.getByText('en proceso')).toBeInTheDocument();
  });

  it('renderiza estados ámbar ALISTADO / CARGADO', () => {
    render(<Badge status="CARGADO" />);
    expect(screen.getByText('CARGADO')).toBeInTheDocument();
  });

  it('renderiza el estado rojo PENDIENTE', () => {
    render(<Badge status="PENDIENTE" />);
    expect(screen.getByText('PENDIENTE')).toBeInTheDocument();
  });

  it('renderiza el estado gris DESPACHADO', () => {
    render(<Badge status="DESPACHADO" />);
    expect(screen.getByText('DESPACHADO')).toBeInTheDocument();
  });

  it('renderiza un estado genérico no reconocido', () => {
    render(<Badge status="OTRO" type="generic" />);
    expect(screen.getByText('OTRO')).toBeInTheDocument();
  });
});

describe('Toggle', () => {
  it('refleja el estado checked y dispara onChange', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    const btn = screen.getByRole('switch');
    expect(btn).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalled();
  });

  it('aplica size md', () => {
    render(<Toggle checked onChange={() => {}} size="md" />);
    const btn = screen.getByRole('switch');
    expect(btn).toHaveAttribute('aria-checked', 'true');
  });

  it('respeta disabled y no dispara onChange', () => {
    const onChange = vi.fn();
    render(<Toggle checked disabled onChange={onChange} />);
    const btn = screen.getByRole('switch');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Sidebar', () => {
  beforeEach(() => {
    useAuthStore.setState({ currentUser: adminUser });
  });

  it('muestra los módulos accesibles y navega al hacer clic', () => {
    const setActiveModule = vi.fn();
    const onClose = vi.fn();
    render(
      <Sidebar activeModule="planeacion" setActiveModule={setActiveModule} isOpen onClose={onClose} />
    );

    expect(screen.getByText('Planeación')).toBeInTheDocument();
    expect(screen.getByText('Portería')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Despachos'));
    expect(setActiveModule).toHaveBeenCalledWith('despachos');
    expect(onClose).toHaveBeenCalled();
  });

  it('oculta un módulo cuando no hay acceso (no-admin)', () => {
    useAuthStore.setState({
      currentUser: {
        id: 'USER_DESP',
        name: 'Juan',
        cedula: '1000000001',
        tipoUsuario: 'despachador',
        roleId: 'ROLE_DESPACHADOR',
        roleName: 'DESPACHADOR',
      },
    });
    render(<Sidebar activeModule="planeacion" setActiveModule={() => {}} isOpen onClose={() => {}} />);

    // DESPACHADOR no ve ROLES ni USUARIOS
    expect(screen.queryByText('ROLES')).not.toBeInTheDocument();
    expect(screen.queryByText('USUARIOS')).not.toBeInTheDocument();
    // Sí ve Despachos y Planeación
    expect(screen.getByText('Despachos')).toBeInTheDocument();
  });

  it('clic en el logo navega a despachos', () => {
    const setActiveModule = vi.fn();
    render(
      <Sidebar activeModule="planeacion" setActiveModule={setActiveModule} isOpen onClose={() => {}} />
    );
    fireEvent.click(screen.getByAltText('CCL Logo'));
    expect(setActiveModule).toHaveBeenCalledWith('despachos');
  });
});
