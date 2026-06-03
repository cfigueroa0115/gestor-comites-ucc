'use client';

import { useCallback } from 'react';

/** Represents a single attendee row. */
export interface Attendee {
  nombre: string;
  cargo: string;
}

/** Row-level validation errors for the attendees table. */
export type AttendeesErrors = Record<number, { nombre?: string; cargo?: string }>;

interface AttendeesTableProps {
  value: Attendee[];
  onChange: (attendees: Attendee[]) => void;
  errors?: AttendeesErrors;
}

/** Maximum number of attendee rows allowed. */
const MAX_ROWS = 50;

/** Maximum character lengths per field. */
const MAX_NOMBRE = 150;
const MAX_CARGO = 100;

/**
 * AttendeesTable – Editable table for managing committee attendees.
 *
 * Features:
 * - Add/remove attendee rows (min 1, max 50)
 * - Inline editing of nombre completo and cargo
 * - Row-level validation error display
 * - Green add button, red remove button
 * - Inputs fill their cells with border and placeholders
 *
 * Validates: Requirements 6.5, 6.9
 */
export function AttendeesTable({ value, onChange, errors }: AttendeesTableProps) {
  const canAdd = value.length < MAX_ROWS;
  const canRemove = value.length > 1;

  const handleFieldChange = useCallback(
    (index: number, field: keyof Attendee, fieldValue: string) => {
      const updated = value.map((row, i) =>
        i === index ? { ...row, [field]: fieldValue } : row,
      );
      onChange(updated);
    },
    [value, onChange],
  );

  const handleAddRow = useCallback(() => {
    if (!canAdd) return;
    onChange([...value, { nombre: '', cargo: '' }]);
  }, [value, onChange, canAdd]);

  const handleRemoveRow = useCallback(
    (index: number) => {
      if (!canRemove) return;
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange, canRemove],
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
                #
              </th>
              <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
                Nombre completo
              </th>
              <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
                Cargo
              </th>
              <th className="px-3 py-2 text-center text-sm font-semibold text-gray-700">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {value.map((row, index) => {
              const rowErrors = errors?.[index];
              return (
                <tr key={index} className="border-t border-gray-200">
                  <td className="px-3 py-2 text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2">
                    <div>
                      <input
                        type="text"
                        value={row.nombre}
                        onChange={(e) =>
                          handleFieldChange(index, 'nombre', e.target.value)
                        }
                        maxLength={MAX_NOMBRE}
                        placeholder="Nombre completo"
                        aria-label={`Nombre completo del asistente ${index + 1}`}
                        aria-invalid={!!rowErrors?.nombre}
                        className={`w-full rounded border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 ${
                          rowErrors?.nombre
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-300 focus:border-ucc-green'
                        }`}
                      />
                      {rowErrors?.nombre && (
                        <p className="mt-1 text-xs text-red-600">
                          {rowErrors.nombre}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div>
                      <input
                        type="text"
                        value={row.cargo}
                        onChange={(e) =>
                          handleFieldChange(index, 'cargo', e.target.value)
                        }
                        maxLength={MAX_CARGO}
                        placeholder="Cargo"
                        aria-label={`Cargo del asistente ${index + 1}`}
                        aria-invalid={!!rowErrors?.cargo}
                        className={`w-full rounded border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 ${
                          rowErrors?.cargo
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-300 focus:border-ucc-green'
                        }`}
                      />
                      {rowErrors?.cargo && (
                        <p className="mt-1 text-xs text-red-600">
                          {rowErrors.cargo}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(index)}
                      disabled={!canRemove}
                      aria-label={`Eliminar asistente ${index + 1}`}
                      className="rounded bg-red-500 px-3 py-1 text-xs font-medium text-white transition-colors duration-200 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add row button */}
      <button
        type="button"
        onClick={handleAddRow}
        disabled={!canAdd}
        className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        + Agregar asistente
      </button>

      {/* Row count indicator */}
      <p className="text-xs text-gray-500">
        {value.length} de {MAX_ROWS} asistentes
      </p>
    </div>
  );
}
