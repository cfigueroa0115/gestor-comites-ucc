/**
 * Sequence Service - Transactional sequential numbering for actas.
 *
 * Generates unique sequential numbers per committee code and year using
 * row-level locking (SELECT ... FOR UPDATE) within Prisma interactive
 * transactions to guarantee uniqueness under concurrent access.
 *
 * Format: ACTA-{PREFIX}-{YEAR}-{0-padded 4-digit SEQ}
 * Example: ACTA-CUR-2026-0001
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { prisma } from '@/lib/db/prisma';
import { MAX_SEQUENCE_NUMBER, SEQUENCE_MAX_RETRIES, APP_TIMEZONE } from '@/lib/utils/constants';
import type { ISequenceService, SequenceResult } from '@/types';

interface SequenceRow {
  id: string;
  committee_code: string;
  year: number;
  last_number: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Delays execution for the specified number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gets the current year based on America/Bogota timezone.
 */
export function getCurrentYearInBogota(): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
  });
  return parseInt(formatter.format(now), 10);
}

/**
 * Formats a sequence number into the standard acta numbering format.
 *
 * @param committeeCode - Committee prefix (CUR, INV, DEC, OTR)
 * @param year - Four-digit year
 * @param sequence - Sequence number (1-9999)
 * @returns Formatted string e.g. "ACTA-CUR-2026-0001"
 */
export function formatSequenceNumber(
  committeeCode: string,
  year: number,
  sequence: number
): string {
  const paddedSeq = String(sequence).padStart(4, '0');
  return `ACTA-${committeeCode}-${year}-${paddedSeq}`;
}

/**
 * Determines if an error is a lock contention or serialization error
 * that warrants a retry.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // PostgreSQL error codes for lock contention / serialization failures
    return (
      message.includes('could not serialize') ||
      message.includes('deadlock') ||
      message.includes('lock') ||
      message.includes('concurrent') ||
      message.includes('unique constraint') ||
      message.includes('p2034') || // Prisma transaction conflict
      message.includes('p2002') // Prisma unique constraint violation
    );
  }
  return false;
}

/**
 * Core sequence generation logic executed within a Prisma interactive transaction.
 *
 * Uses SELECT ... FOR UPDATE to acquire a row-level lock on the sequence row,
 * preventing concurrent access from generating duplicate numbers.
 */
async function generateSequenceInTransaction(
  committeeCode: string,
  year: number
): Promise<SequenceResult> {
  return await prisma.$transaction(async (tx) => {
    // Attempt to lock existing row with SELECT ... FOR UPDATE
    const existingRows = await tx.$queryRaw<SequenceRow[]>`
      SELECT id, committee_code, year, last_number, created_at, updated_at
      FROM sequences
      WHERE committee_code = ${committeeCode} AND year = ${year}
      FOR UPDATE
    `;

    let nextNumber: number;

    if (existingRows.length === 0) {
      // New year/committee combination: create row with lastNumber = 1
      nextNumber = 1;

      await tx.$executeRaw`
        INSERT INTO sequences (id, committee_code, year, last_number, created_at, updated_at)
        VALUES (gen_random_uuid()::text, ${committeeCode}, ${year}, ${nextNumber}, NOW(), NOW())
      `;
    } else {
      const currentRow = existingRows[0];

      // Check if sequence is exhausted
      if (currentRow.last_number >= MAX_SEQUENCE_NUMBER) {
        return {
          success: false,
          numero: '',
          secuencia: 0,
          anio: year,
          error: `SEQUENCE_EXHAUSTED: La capacidad de secuencia para ${committeeCode}-${year} se ha agotado (máximo ${MAX_SEQUENCE_NUMBER}).`,
        };
      }

      // Increment lastNumber
      nextNumber = currentRow.last_number + 1;

      await tx.$executeRaw`
        UPDATE sequences
        SET last_number = ${nextNumber}, updated_at = NOW()
        WHERE id = ${currentRow.id}
      `;
    }

    const numero = formatSequenceNumber(committeeCode, year, nextNumber);

    return {
      success: true,
      numero,
      secuencia: nextNumber,
      anio: year,
    };
  });
}

/**
 * Sequence Service implementation.
 *
 * Provides transactional, retry-capable sequence number generation
 * with row-level locking for concurrency safety.
 */
export const sequenceService: ISequenceService = {
  /**
   * Gets the next sequential number for a given committee code and year.
   *
   * Retries up to SEQUENCE_MAX_RETRIES times on lock contention with
   * exponential backoff (50ms, 100ms, 200ms).
   *
   * @param committeeCode - Committee prefix (CUR, INV, DEC, OTR)
   * @param year - Four-digit year (defaults to current year in America/Bogota)
   * @returns SequenceResult with formatted number or error
   */
  async getNextNumber(committeeCode: string, year: number): Promise<SequenceResult> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < SEQUENCE_MAX_RETRIES; attempt++) {
      try {
        const result = await generateSequenceInTransaction(committeeCode, year);
        return result;
      } catch (error) {
        lastError = error;

        if (isRetryableError(error) && attempt < SEQUENCE_MAX_RETRIES - 1) {
          // Exponential backoff: 50ms * 2^attempt (50ms, 100ms, 200ms)
          const backoffMs = 50 * Math.pow(2, attempt);
          await delay(backoffMs);
          continue;
        }

        // Non-retryable error or last attempt exhausted
        break;
      }
    }

    // All retries exhausted or non-retryable error
    const errorMessage =
      lastError instanceof Error
        ? lastError.message
        : 'Error desconocido en la generación de secuencia';

    return {
      success: false,
      numero: '',
      secuencia: 0,
      anio: year,
      error: `SEQUENCE_GENERATION_FAILED: ${errorMessage}`,
    };
  },
};
