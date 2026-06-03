/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardContent } from './DashboardContent';

// Mock next/link to render as anchor
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

describe('DashboardContent - Role-based UI elements', () => {
  describe('Admin button visibility (Req 4.5, 4.6)', () => {
    it('shows administration button when rol is Administrador', () => {
      render(<DashboardContent rol="Administrador" nombreCompleto="Admin User" />);
      
      const adminLink = screen.getByRole('link', { name: /administración/i });
      expect(adminLink).toBeInTheDocument();
    });

    it('hides administration button when rol is Usuario_Gestor', () => {
      render(<DashboardContent rol="Usuario_Gestor" nombreCompleto="Gestor User" />);
      
      const adminLink = screen.queryByRole('link', { name: /administración/i });
      expect(adminLink).not.toBeInTheDocument();
    });

    it('hides administration button when rol is Consulta', () => {
      render(<DashboardContent rol="Consulta" nombreCompleto="Consulta User" />);
      
      const adminLink = screen.queryByRole('link', { name: /administración/i });
      expect(adminLink).not.toBeInTheDocument();
    });
  });

  describe('Admin button navigation (Req 4.7)', () => {
    it('navigates to /admin/usuarios when admin button is clicked', () => {
      render(<DashboardContent rol="Administrador" nombreCompleto="Admin User" />);
      
      const adminLink = screen.getByRole('link', { name: /administración/i });
      expect(adminLink).toHaveAttribute('href', '/admin/usuarios');
    });
  });

  describe('Admin button styling (Req 4.5)', () => {
    it('has animate-pulse class for repeating pulse animation', () => {
      render(<DashboardContent rol="Administrador" nombreCompleto="Admin User" />);
      
      const adminLink = screen.getByRole('link', { name: /administración/i });
      expect(adminLink.className).toContain('animate-pulse');
    });
  });

  describe('Module cards rendering (Req 4.2)', () => {
    it('renders three module cards with correct titles', () => {
      render(<DashboardContent rol="Consulta" nombreCompleto="Test User" />);
      
      expect(screen.getByText('Gestionar actas')).toBeInTheDocument();
      expect(screen.getByText('Gestionar solicitudes')).toBeInTheDocument();
      expect(screen.getByText('Gestionar otras')).toBeInTheDocument();
    });

    it('shows "Módulo en construcción" modal when clicking non-active cards', () => {
      render(<DashboardContent rol="Consulta" nombreCompleto="Test User" />);
      
      // Click "Gestionar solicitudes" (has null href, opens modal)
      const solicitudesButton = screen.getByText('Gestionar solicitudes').closest('button');
      expect(solicitudesButton).toBeInTheDocument();
      fireEvent.click(solicitudesButton!);
      
      expect(screen.getByText('Módulo en construcción')).toBeInTheDocument();
    });

    it('closes the modal when clicking Cerrar button', () => {
      render(<DashboardContent rol="Consulta" nombreCompleto="Test User" />);
      
      // Open modal
      const solicitudesButton = screen.getByText('Gestionar solicitudes').closest('button');
      fireEvent.click(solicitudesButton!);
      
      expect(screen.getByText('Módulo en construcción')).toBeInTheDocument();
      
      // Close modal
      fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
      
      expect(screen.queryByText('Módulo en construcción')).not.toBeInTheDocument();
    });
  });
});
