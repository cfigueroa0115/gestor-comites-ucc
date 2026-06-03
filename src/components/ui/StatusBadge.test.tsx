/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';
import type { EstadoActa } from '@/types';

describe('StatusBadge - Color mapping (Req 5.4)', () => {
  const cases: { estado: EstadoActa; label: string; bgClass: string; textClass: string; dotClass: string }[] = [
    { estado: 'Borrador', label: 'Borrador', bgClass: 'bg-gray-100', textClass: 'text-gray-800', dotClass: 'bg-gray-500' },
    { estado: 'Generada', label: 'Generada', bgClass: 'bg-green-100', textClass: 'text-green-800', dotClass: 'bg-green-500' },
    { estado: 'Descargada', label: 'Descargada', bgClass: 'bg-blue-100', textClass: 'text-blue-800', dotClass: 'bg-blue-500' },
    { estado: 'Error_generacion', label: 'Error generacion', bgClass: 'bg-red-100', textClass: 'text-red-800', dotClass: 'bg-red-500' },
    { estado: 'En_procesamiento', label: 'En procesamiento', bgClass: 'bg-orange-100', textClass: 'text-orange-800', dotClass: 'bg-orange-500' },
  ];

  cases.forEach(({ estado, label, bgClass, textClass, dotClass }) => {
    describe(`${estado}`, () => {
      it(`renders human-readable label "${label}"`, () => {
        render(<StatusBadge estado={estado} />);
        expect(screen.getByText(label)).toBeInTheDocument();
      });

      it(`applies correct background class (${bgClass})`, () => {
        const { container } = render(<StatusBadge estado={estado} />);
        const badge = container.querySelector('span');
        expect(badge?.className).toContain(bgClass);
      });

      it(`applies correct text class (${textClass})`, () => {
        const { container } = render(<StatusBadge estado={estado} />);
        const badge = container.querySelector('span');
        expect(badge?.className).toContain(textClass);
      });

      it(`renders a colored dot with class ${dotClass}`, () => {
        const { container } = render(<StatusBadge estado={estado} />);
        const dot = container.querySelector('span span[aria-hidden="true"]');
        expect(dot?.className).toContain(dotClass);
      });
    });
  });

  describe('Badge structure', () => {
    it('renders with rounded-full pill styling', () => {
      const { container } = render(<StatusBadge estado="Borrador" />);
      const badge = container.querySelector('span');
      expect(badge?.className).toContain('rounded-full');
    });

    it('renders with text-xs and font-medium classes', () => {
      const { container } = render(<StatusBadge estado="Borrador" />);
      const badge = container.querySelector('span');
      expect(badge?.className).toContain('text-xs');
      expect(badge?.className).toContain('font-medium');
    });

    it('renders with correct padding (px-2.5 py-0.5)', () => {
      const { container } = render(<StatusBadge estado="Borrador" />);
      const badge = container.querySelector('span');
      expect(badge?.className).toContain('px-2.5');
      expect(badge?.className).toContain('py-0.5');
    });

    it('includes a dot element for visual clarity', () => {
      const { container } = render(<StatusBadge estado="Generada" />);
      const dot = container.querySelector('span span[aria-hidden="true"]');
      expect(dot).toBeInTheDocument();
      expect(dot?.className).toContain('h-2');
      expect(dot?.className).toContain('w-2');
      expect(dot?.className).toContain('rounded-full');
    });
  });
});
