/**
 * Acta Service Layer (Read Operations)
 *
 * Provides read-only operations for actas management:
 * - Paginated acta listing with multi-criteria filtering
 * - Single acta retrieval by ID
 * - Acta retrieval with attachments relation
 *
 * Default sort: fecha_generacion DESC (most recent first)
 * Default pagination: 10 per page (PAGINATION.ACTAS_PER_PAGE)
 *
 * Validates: Requirements 5.2, 5.3
 */

import { prisma } from '@/lib/db/prisma';
import { PAGINATION } from '@/lib/utils/constants';
import type { ActionResult, EstadoActa } from '@/types';
import type { Acta, Attachment } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Filters for listing actas. All fields are optional. */
export interface ActaFilters {
  /** Partial match on número de acta (uses Prisma contains). */
  numeroActa?: string;
  /** Start date for fecha_generacion range filter (inclusive). */
  fechaDesde?: Date;
  /** End date for fecha_generacion range filter (inclusive). */
  fechaHasta?: Date;
  /** Exact match on tipo_comite. */
  tipoComite?: string;
  /** Exact match on estado. */
  estado?: EstadoActa;
}

/** Acta with the elaboradoPor user relation included. */
export interface ActaWithElaboradoPor extends Acta {
  elaboradoPor: {
    id: string;
    nombreCompleto: string;
  };
}

/** Acta with both elaboradoPor and attachments relations. */
export interface ActaWithAttachments extends ActaWithElaboradoPor {
  attachments: Attachment[];
}

/** Paginated result for acta listing. */
export interface PaginatedActas {
  actas: ActaWithElaboradoPor[];
  total: number;
  page: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fields to include from the elaboradoPor (User) relation. */
const ELABORADO_POR_SELECT = {
  id: true,
  nombreCompleto: true,
} as const;

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Lists actas with pagination and optional filters.
 * Returns 10 actas per page by default (PAGINATION.ACTAS_PER_PAGE).
 * Sorted by fecha_generacion DESC (most recent first).
 *
 * Supports filters:
 * - numeroActa: partial match (contains, case-insensitive)
 * - fechaDesde/fechaHasta: date range on fecha_generacion
 * - tipoComite: exact match
 * - estado: exact match
 *
 * Validates: Requirements 5.2, 5.3
 */
export async function listActas(
  filters: ActaFilters = {},
  page: number = 1,
  pageSize: number = PAGINATION.ACTAS_PER_PAGE,
): Promise<ActionResult<PaginatedActas>> {
  const where = buildWhereClause(filters);
  const skip = (page - 1) * pageSize;

  const [actas, total] = await Promise.all([
    prisma.acta.findMany({
      where,
      include: {
        elaboradoPor: { select: ELABORADO_POR_SELECT },
      },
      orderBy: { fechaGeneracion: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.acta.count({ where }),
  ]);

  return {
    success: true,
    data: {
      actas: actas as ActaWithElaboradoPor[],
      total,
      page,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Retrieves a single acta by ID with elaboradoPor relation.
 * Returns NOT_FOUND error if the acta does not exist.
 */
export async function getActaById(
  id: string,
): Promise<ActionResult<ActaWithElaboradoPor>> {
  const acta = await prisma.acta.findUnique({
    where: { id },
    include: {
      elaboradoPor: { select: ELABORADO_POR_SELECT },
    },
  });

  if (!acta) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Acta no encontrada.' },
    };
  }

  return { success: true, data: acta as ActaWithElaboradoPor };
}

/**
 * Retrieves a single acta by ID with both elaboradoPor and attachments relations.
 * Returns NOT_FOUND error if the acta does not exist.
 */
export async function getActaWithAttachments(
  id: string,
): Promise<ActionResult<ActaWithAttachments>> {
  const acta = await prisma.acta.findUnique({
    where: { id },
    include: {
      elaboradoPor: { select: ELABORADO_POR_SELECT },
      attachments: true,
    },
  });

  if (!acta) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Acta no encontrada.' },
    };
  }

  return { success: true, data: acta as ActaWithAttachments };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds the Prisma `where` clause from the provided filters.
 * Only includes conditions for filters that are defined.
 */
function buildWhereClause(filters: ActaFilters) {
  const where: Record<string, unknown> = {};

  // Partial match on número de acta (case-insensitive contains)
  if (filters.numeroActa) {
    where.numeroActa = {
      contains: filters.numeroActa,
      mode: 'insensitive',
    };
  }

  // Date range filter on fecha_generacion
  if (filters.fechaDesde || filters.fechaHasta) {
    const fechaFilter: Record<string, Date> = {};
    if (filters.fechaDesde) {
      fechaFilter.gte = filters.fechaDesde;
    }
    if (filters.fechaHasta) {
      fechaFilter.lte = filters.fechaHasta;
    }
    where.fechaGeneracion = fechaFilter;
  }

  // Exact match on tipo_comite
  if (filters.tipoComite) {
    where.tipoComite = filters.tipoComite;
  }

  // Exact match on estado
  if (filters.estado) {
    where.estado = filters.estado;
  }

  return where;
}
