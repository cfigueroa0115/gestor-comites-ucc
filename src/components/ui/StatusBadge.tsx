'use client';

import type { EstadoActa } from '@/types';

interface StatusBadgeProps {
  estado: EstadoActa;
}

/**
 * Color mapping for each EstadoActa value.
 * Each entry defines the background, text, and dot colors for the badge.
 */
const colorMap: Record<
  EstadoActa,
  { bg: string; text: string; dot: string }
> = {
  Borrador: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    dot: 'bg-gray-500',
  },
  Generada: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    dot: 'bg-green-500',
  },
  Descargada: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
  },
  Error_generacion: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    dot: 'bg-red-500',
  },
  En_procesamiento: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    dot: 'bg-orange-500',
  },
};

/**
 * Converts an EstadoActa enum value to a human-readable label.
 * Replaces underscores with spaces and capitalizes the first letter.
 */
function formatLabel(estado: EstadoActa): string {
  const raw = estado.replace(/_/g, ' ');
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/**
 * StatusBadge displays a color-coded pill badge indicating the current
 * state of an acta. Includes a small colored dot for extra visual clarity.
 *
 * Color mapping:
 * - Borrador → gray
 * - Generada → green
 * - Descargada → blue
 * - Error_generacion → red
 * - En_procesamiento → orange
 */
export function StatusBadge({ estado }: StatusBadgeProps) {
  const colors = colorMap[estado];
  const label = formatLabel(estado);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${colors.dot}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
