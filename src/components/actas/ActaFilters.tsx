'use client';

import { useState } from 'react';
import { COMMITTEE_TYPES } from '@/lib/utils/constants';
import type { EstadoActa } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Filter values emitted via onFilter callback. */
export interface ActaFilterValues {
  numeroActa?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  tipoComite?: string;
  estado?: EstadoActa;
}

interface ActaFiltersProps {
  onFilter: (filters: ActaFilterValues) => void;
  onClear: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Available Estado dropdown options matching EstadoActa enum. */
const ESTADO_OPTIONS: { value: EstadoActa; label: string }[] = [
  { value: 'Borrador', label: 'Borrador' },
  { value: 'Generada', label: 'Generada' },
  { value: 'Descargada', label: 'Descargada' },
  { value: 'Error_generacion', label: 'Error generación' },
  { value: 'En_procesamiento', label: 'En procesamiento' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ActaFilters – Client component with search filters for the actas list.
 *
 * Fields:
 * - Número acta (text, max 20 chars)
 * - Fecha desde (date picker)
 * - Fecha hasta (date picker)
 * - Tipo comité (dropdown: Curricular, Investigación, Decanatura, Otro)
 * - Estado (dropdown: Borrador, Generada, Descargada, Error_generacion, En_procesamiento)
 *
 * Buttons:
 * - "Buscar" – applies filters via onFilter callback
 * - "Limpiar filtros" – resets all fields and triggers onClear callback
 *
 * Validates: Requirements 5.2, 5.9
 */
export function ActaFilters({ onFilter, onClear }: ActaFiltersProps) {
  const [numeroActa, setNumeroActa] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipoComite, setTipoComite] = useState('');
  const [estado, setEstado] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const filters: ActaFilterValues = {};

    if (numeroActa.trim()) {
      filters.numeroActa = numeroActa.trim();
    }
    if (fechaDesde) {
      filters.fechaDesde = fechaDesde;
    }
    if (fechaHasta) {
      filters.fechaHasta = fechaHasta;
    }
    if (tipoComite) {
      filters.tipoComite = tipoComite;
    }
    if (estado) {
      filters.estado = estado as EstadoActa;
    }

    onFilter(filters);
  }

  function handleClear() {
    setNumeroActa('');
    setFechaDesde('');
    setFechaHasta('');
    setTipoComite('');
    setEstado('');
    onClear();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      aria-label="Filtros de búsqueda de actas"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* Número de acta */}
        <div>
          <label
            htmlFor="filter-numero-acta"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Número de acta
          </label>
          <input
            id="filter-numero-acta"
            type="text"
            maxLength={20}
            value={numeroActa}
            onChange={(e) => setNumeroActa(e.target.value)}
            placeholder="Ej: ACTA-CUR-2025"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-ucc-green focus:outline-none focus:ring-1 focus:ring-ucc-green"
          />
        </div>

        {/* Fecha desde */}
        <div>
          <label
            htmlFor="filter-fecha-desde"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Fecha desde
          </label>
          <input
            id="filter-fecha-desde"
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-ucc-green focus:outline-none focus:ring-1 focus:ring-ucc-green"
          />
        </div>

        {/* Fecha hasta */}
        <div>
          <label
            htmlFor="filter-fecha-hasta"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Fecha hasta
          </label>
          <input
            id="filter-fecha-hasta"
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-ucc-green focus:outline-none focus:ring-1 focus:ring-ucc-green"
          />
        </div>

        {/* Tipo comité */}
        <div>
          <label
            htmlFor="filter-tipo-comite"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Tipo comité
          </label>
          <select
            id="filter-tipo-comite"
            value={tipoComite}
            onChange={(e) => setTipoComite(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-ucc-green focus:outline-none focus:ring-1 focus:ring-ucc-green"
          >
            <option value="">Todos</option>
            {COMMITTEE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Estado */}
        <div>
          <label
            htmlFor="filter-estado"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Estado
          </label>
          <select
            id="filter-estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-ucc-green focus:outline-none focus:ring-1 focus:ring-ucc-green"
          >
            <option value="">Todos</option>
            {ESTADO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-ucc-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-ucc-green-dark focus:outline-none focus:ring-2 focus:ring-ucc-green/50"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          Buscar
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          Limpiar filtros
        </button>
      </div>
    </form>
  );
}
