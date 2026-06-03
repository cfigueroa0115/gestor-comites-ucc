/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttendeesTable } from './AttendeesTable';
import type { Attendee, AttendeesErrors } from './AttendeesTable';

describe('AttendeesTable', () => {
  const defaultRow: Attendee = { nombre: '', cargo: '' };

  describe('Rendering', () => {
    it('renders a table with column headers', () => {
      render(<AttendeesTable value={[defaultRow]} onChange={() => {}} />);

      expect(screen.getByText('#')).toBeInTheDocument();
      expect(screen.getByText('Nombre completo')).toBeInTheDocument();
      expect(screen.getByText('Cargo')).toBeInTheDocument();
      expect(screen.getByText('Acciones')).toBeInTheDocument();
    });

    it('renders one row per attendee', () => {
      const attendees: Attendee[] = [
        { nombre: 'Carlos', cargo: 'Docente' },
        { nombre: 'Maria', cargo: 'Decana' },
      ];
      render(<AttendeesTable value={attendees} onChange={() => {}} />);

      expect(screen.getByDisplayValue('Carlos')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Docente')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Maria')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Decana')).toBeInTheDocument();
    });

    it('displays the row count indicator', () => {
      const attendees: Attendee[] = [
        { nombre: 'A', cargo: 'B' },
        { nombre: 'C', cargo: 'D' },
      ];
      render(<AttendeesTable value={attendees} onChange={() => {}} />);

      expect(screen.getByText('2 de 50 asistentes')).toBeInTheDocument();
    });
  });

  describe('Add row (Req 6.5)', () => {
    it('calls onChange with a new empty row when "Agregar asistente" is clicked', () => {
      const onChange = vi.fn();
      render(<AttendeesTable value={[{ nombre: 'A', cargo: 'B' }]} onChange={onChange} />);

      fireEvent.click(screen.getByText('+ Agregar asistente'));

      expect(onChange).toHaveBeenCalledWith([
        { nombre: 'A', cargo: 'B' },
        { nombre: '', cargo: '' },
      ]);
    });

    it('disables "Agregar asistente" button when at 50 rows', () => {
      const fiftyRows = Array.from({ length: 50 }, (_, i) => ({
        nombre: `Nombre ${i}`,
        cargo: `Cargo ${i}`,
      }));
      render(<AttendeesTable value={fiftyRows} onChange={() => {}} />);

      const addButton = screen.getByText('+ Agregar asistente');
      expect(addButton).toBeDisabled();
    });

    it('enables "Agregar asistente" button when below 50 rows', () => {
      render(<AttendeesTable value={[defaultRow]} onChange={() => {}} />);

      const addButton = screen.getByText('+ Agregar asistente');
      expect(addButton).not.toBeDisabled();
    });
  });

  describe('Remove row (Req 6.5)', () => {
    it('calls onChange without the removed row when "Eliminar" is clicked', () => {
      const onChange = vi.fn();
      const attendees: Attendee[] = [
        { nombre: 'A', cargo: 'B' },
        { nombre: 'C', cargo: 'D' },
      ];
      render(<AttendeesTable value={attendees} onChange={onChange} />);

      const removeButtons = screen.getAllByText('Eliminar');
      fireEvent.click(removeButtons[0]);

      expect(onChange).toHaveBeenCalledWith([{ nombre: 'C', cargo: 'D' }]);
    });

    it('disables "Eliminar" button when only 1 row remains', () => {
      render(<AttendeesTable value={[defaultRow]} onChange={() => {}} />);

      const removeButton = screen.getByText('Eliminar');
      expect(removeButton).toBeDisabled();
    });

    it('enables "Eliminar" buttons when more than 1 row exists', () => {
      const attendees: Attendee[] = [
        { nombre: 'A', cargo: 'B' },
        { nombre: 'C', cargo: 'D' },
      ];
      render(<AttendeesTable value={attendees} onChange={() => {}} />);

      const removeButtons = screen.getAllByText('Eliminar');
      removeButtons.forEach((btn) => {
        expect(btn).not.toBeDisabled();
      });
    });
  });

  describe('Edit rows (Req 6.5)', () => {
    it('calls onChange with updated nombre when typing in nombre field', () => {
      const onChange = vi.fn();
      render(
        <AttendeesTable value={[{ nombre: 'A', cargo: 'B' }]} onChange={onChange} />,
      );

      const nombreInput = screen.getByDisplayValue('A');
      fireEvent.change(nombreInput, { target: { value: 'Carlos' } });

      expect(onChange).toHaveBeenCalledWith([{ nombre: 'Carlos', cargo: 'B' }]);
    });

    it('calls onChange with updated cargo when typing in cargo field', () => {
      const onChange = vi.fn();
      render(
        <AttendeesTable value={[{ nombre: 'A', cargo: 'B' }]} onChange={onChange} />,
      );

      const cargoInput = screen.getByDisplayValue('B');
      fireEvent.change(cargoInput, { target: { value: 'Decano' } });

      expect(onChange).toHaveBeenCalledWith([{ nombre: 'A', cargo: 'Decano' }]);
    });

    it('respects maxLength on nombre input (150 chars)', () => {
      render(<AttendeesTable value={[defaultRow]} onChange={() => {}} />);

      const nombreInput = screen.getByPlaceholderText('Nombre completo');
      expect(nombreInput).toHaveAttribute('maxLength', '150');
    });

    it('respects maxLength on cargo input (100 chars)', () => {
      render(<AttendeesTable value={[defaultRow]} onChange={() => {}} />);

      const cargoInput = screen.getByPlaceholderText('Cargo');
      expect(cargoInput).toHaveAttribute('maxLength', '100');
    });
  });

  describe('Validation errors (Req 6.9)', () => {
    it('displays nombre error message below the nombre field', () => {
      const errors: AttendeesErrors = {
        0: { nombre: 'El nombre es obligatorio' },
      };
      render(
        <AttendeesTable
          value={[defaultRow]}
          onChange={() => {}}
          errors={errors}
        />,
      );

      expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    });

    it('displays cargo error message below the cargo field', () => {
      const errors: AttendeesErrors = {
        0: { cargo: 'El cargo es obligatorio' },
      };
      render(
        <AttendeesTable
          value={[defaultRow]}
          onChange={() => {}}
          errors={errors}
        />,
      );

      expect(screen.getByText('El cargo es obligatorio')).toBeInTheDocument();
    });

    it('shows errors on specific rows only', () => {
      const attendees: Attendee[] = [
        { nombre: 'Valid', cargo: 'Valid' },
        { nombre: '', cargo: '' },
      ];
      const errors: AttendeesErrors = {
        1: { nombre: 'Nombre requerido', cargo: 'Cargo requerido' },
      };
      render(
        <AttendeesTable value={attendees} onChange={() => {}} errors={errors} />,
      );

      expect(screen.getByText('Nombre requerido')).toBeInTheDocument();
      expect(screen.getByText('Cargo requerido')).toBeInTheDocument();
      // Only 2 error messages should be in the DOM
      expect(screen.queryAllByText(/requerido/)).toHaveLength(2);
    });

    it('applies error styling (red border) to invalid inputs', () => {
      const errors: AttendeesErrors = {
        0: { nombre: 'Error' },
      };
      render(
        <AttendeesTable
          value={[defaultRow]}
          onChange={() => {}}
          errors={errors}
        />,
      );

      const nombreInput = screen.getByPlaceholderText('Nombre completo');
      expect(nombreInput).toHaveAttribute('aria-invalid', 'true');
      expect(nombreInput.className).toContain('border-red-500');
    });

    it('does not show errors when errors prop is not provided', () => {
      render(<AttendeesTable value={[defaultRow]} onChange={() => {}} />);

      const nombreInput = screen.getByPlaceholderText('Nombre completo');
      expect(nombreInput).toHaveAttribute('aria-invalid', 'false');
      expect(nombreInput.className).not.toContain('border-red-500');
    });
  });

  describe('Accessibility', () => {
    it('has accessible labels for inputs', () => {
      render(<AttendeesTable value={[defaultRow]} onChange={() => {}} />);

      expect(
        screen.getByLabelText('Nombre completo del asistente 1'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('Cargo del asistente 1'),
      ).toBeInTheDocument();
    });

    it('has accessible label for remove button', () => {
      render(<AttendeesTable value={[defaultRow]} onChange={() => {}} />);

      expect(
        screen.getByLabelText('Eliminar asistente 1'),
      ).toBeInTheDocument();
    });
  });
});
