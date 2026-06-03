/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActaActions, NuevaActaButton } from './ActaActions';
import type { EstadoActa, Rol } from '@/types';

// Mock window.location and window.open
const mockLocation = { href: '' };
const mockOpen = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'location', {
    value: mockLocation,
    writable: true,
  });
  Object.defineProperty(window, 'open', {
    value: mockOpen,
    writable: true,
  });
  mockLocation.href = '';
  mockOpen.mockReset();
});

describe('ActaActions', () => {
  describe('Administrador role', () => {
    const userRole: Rol = 'Administrador';

    it('shows all action buttons for a normal estado', () => {
      render(
        <ActaActions actaId="acta-1" estado="Generada" userRole={userRole} />,
      );

      expect(screen.getByTitle('Ver detalle')).toBeInTheDocument();
      expect(screen.getByTitle('Descargar')).toBeInTheDocument();
      expect(screen.getByTitle('Consultar soportes')).toBeInTheDocument();
      expect(screen.getByTitle('Ver estado')).toBeInTheDocument();
      // Reintentar should NOT be shown for non-error estados
      expect(screen.queryByTitle('Reintentar')).not.toBeInTheDocument();
    });

    it('shows "reintentar" button when estado is Error_generacion', () => {
      render(
        <ActaActions actaId="acta-1" estado="Error_generacion" userRole={userRole} />,
      );

      expect(screen.getByTitle('Reintentar')).toBeInTheDocument();
    });

    it('does not show "reintentar" for Borrador estado', () => {
      render(
        <ActaActions actaId="acta-1" estado="Borrador" userRole={userRole} />,
      );

      expect(screen.queryByTitle('Reintentar')).not.toBeInTheDocument();
    });
  });

  describe('Usuario_Gestor role', () => {
    const userRole: Rol = 'Usuario_Gestor';

    it('shows all action buttons for a normal estado', () => {
      render(
        <ActaActions actaId="acta-1" estado="Descargada" userRole={userRole} />,
      );

      expect(screen.getByTitle('Ver detalle')).toBeInTheDocument();
      expect(screen.getByTitle('Descargar')).toBeInTheDocument();
      expect(screen.getByTitle('Consultar soportes')).toBeInTheDocument();
      expect(screen.getByTitle('Ver estado')).toBeInTheDocument();
    });

    it('shows "reintentar" button when estado is Error_generacion', () => {
      render(
        <ActaActions actaId="acta-1" estado="Error_generacion" userRole={userRole} />,
      );

      expect(screen.getByTitle('Reintentar')).toBeInTheDocument();
    });
  });

  describe('Consulta role', () => {
    const userRole: Rol = 'Consulta';

    it('shows only ver detalle, consultar soportes, ver estado', () => {
      render(
        <ActaActions actaId="acta-1" estado="Generada" userRole={userRole} />,
      );

      expect(screen.getByTitle('Ver detalle')).toBeInTheDocument();
      expect(screen.getByTitle('Consultar soportes')).toBeInTheDocument();
      expect(screen.getByTitle('Ver estado')).toBeInTheDocument();
      // Descargar and Reintentar should NOT be visible for Consulta
      expect(screen.queryByTitle('Descargar')).not.toBeInTheDocument();
    });

    it('hides "reintentar" even when estado is Error_generacion', () => {
      render(
        <ActaActions actaId="acta-1" estado="Error_generacion" userRole={userRole} />,
      );

      expect(screen.queryByTitle('Reintentar')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Descargar')).not.toBeInTheDocument();
    });
  });

  describe('all estados without Error_generacion', () => {
    const nonErrorEstados: EstadoActa[] = [
      'Borrador',
      'Generada',
      'Descargada',
      'En_procesamiento',
    ];

    it.each(nonErrorEstados)(
      'does not show "reintentar" for estado %s',
      (estado) => {
        render(
          <ActaActions actaId="acta-1" estado={estado} userRole="Administrador" />,
        );

        expect(screen.queryByTitle('Reintentar')).not.toBeInTheDocument();
      },
    );
  });
});

describe('NuevaActaButton', () => {
  it('renders for Administrador role', () => {
    const onClick = vi.fn();
    render(<NuevaActaButton userRole="Administrador" onClick={onClick} />);

    const button = screen.getByRole('button', { name: /nueva acta/i });
    expect(button).toBeInTheDocument();
  });

  it('renders for Usuario_Gestor role', () => {
    const onClick = vi.fn();
    render(<NuevaActaButton userRole="Usuario_Gestor" onClick={onClick} />);

    const button = screen.getByRole('button', { name: /nueva acta/i });
    expect(button).toBeInTheDocument();
  });

  it('does NOT render for Consulta role', () => {
    const onClick = vi.fn();
    render(<NuevaActaButton userRole="Consulta" onClick={onClick} />);

    expect(screen.queryByRole('button', { name: /nueva acta/i })).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<NuevaActaButton userRole="Administrador" onClick={onClick} />);

    screen.getByRole('button', { name: /nueva acta/i }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
