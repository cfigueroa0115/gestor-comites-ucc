/**
 * Unit tests for the Sequence Service.
 *
 * Tests the formatting logic, year calculation, retry behavior,
 * and transaction-based sequence generation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma - must be before imports
const mockTransaction = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// Import after mocks
import { sequenceService, formatSequenceNumber, getCurrentYearInBogota } from './sequence.service';
import { MAX_SEQUENCE_NUMBER } from '@/lib/utils/constants';

// ---------------------------------------------------------------------------
// formatSequenceNumber
// ---------------------------------------------------------------------------

describe('formatSequenceNumber', () => {
  it('should format with zero-padded 4-digit sequence', () => {
    expect(formatSequenceNumber('CUR', 2026, 1)).toBe('ACTA-CUR-2026-0001');
  });

  it('should handle double-digit sequences', () => {
    expect(formatSequenceNumber('INV', 2025, 42)).toBe('ACTA-INV-2025-0042');
  });

  it('should handle triple-digit sequences', () => {
    expect(formatSequenceNumber('DEC', 2025, 100)).toBe('ACTA-DEC-2025-0100');
  });

  it('should handle four-digit sequences at maximum', () => {
    expect(formatSequenceNumber('OTR', 2025, 9999)).toBe('ACTA-OTR-2025-9999');
  });

  it('should work with all committee prefixes', () => {
    expect(formatSequenceNumber('CUR', 2024, 5)).toBe('ACTA-CUR-2024-0005');
    expect(formatSequenceNumber('INV', 2024, 5)).toBe('ACTA-INV-2024-0005');
    expect(formatSequenceNumber('DEC', 2024, 5)).toBe('ACTA-DEC-2024-0005');
    expect(formatSequenceNumber('OTR', 2024, 5)).toBe('ACTA-OTR-2024-0005');
  });
});

// ---------------------------------------------------------------------------
// getCurrentYearInBogota
// ---------------------------------------------------------------------------

describe('getCurrentYearInBogota', () => {
  it('should return a valid four-digit year', () => {
    const year = getCurrentYearInBogota();
    expect(year).toBeGreaterThanOrEqual(2024);
    expect(year).toBeLessThanOrEqual(2100);
    expect(Number.isInteger(year)).toBe(true);
  });

  it('should return the current year (approximate check)', () => {
    const year = getCurrentYearInBogota();
    const systemYear = new Date().getFullYear();
    // The Bogota year could differ from system year around midnight UTC
    // but should be within 1 year of system year
    expect(Math.abs(year - systemYear)).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// sequenceService.getNextNumber
// ---------------------------------------------------------------------------

describe('sequenceService.getNextNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create new row with sequence 1 for new committee/year combination', async () => {
    const mockQueryRaw = vi.fn().mockResolvedValue([]);
    const mockExecuteRaw = vi.fn();

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: mockQueryRaw,
        $executeRaw: mockExecuteRaw,
      };
      return fn(tx);
    });

    const result = await sequenceService.getNextNumber('CUR', 2026);

    expect(result.success).toBe(true);
    expect(result.numero).toBe('ACTA-CUR-2026-0001');
    expect(result.secuencia).toBe(1);
    expect(result.anio).toBe(2026);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('should increment sequence for existing committee/year row', async () => {
    const mockQueryRaw = vi.fn().mockResolvedValue([
      {
        id: 'seq-1',
        committee_code: 'INV',
        year: 2025,
        last_number: 5,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    const mockExecuteRaw = vi.fn();

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: mockQueryRaw,
        $executeRaw: mockExecuteRaw,
      };
      return fn(tx);
    });

    const result = await sequenceService.getNextNumber('INV', 2025);

    expect(result.success).toBe(true);
    expect(result.numero).toBe('ACTA-INV-2025-0006');
    expect(result.secuencia).toBe(6);
    expect(result.anio).toBe(2025);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('should return SEQUENCE_EXHAUSTED error when lastNumber >= 9999', async () => {
    const mockQueryRaw = vi.fn().mockResolvedValue([
      {
        id: 'seq-1',
        committee_code: 'CUR',
        year: 2026,
        last_number: MAX_SEQUENCE_NUMBER,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    const mockExecuteRaw = vi.fn();

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: mockQueryRaw,
        $executeRaw: mockExecuteRaw,
      };
      return fn(tx);
    });

    const result = await sequenceService.getNextNumber('CUR', 2026);

    expect(result.success).toBe(false);
    expect(result.error).toContain('SEQUENCE_EXHAUSTED');
    expect(result.numero).toBe('');
    expect(result.secuencia).toBe(0);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('should retry on lock contention and succeed on subsequent attempt', async () => {
    let callCount = 0;

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('could not serialize access due to concurrent update');
      }
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'seq-1',
            committee_code: 'DEC',
            year: 2025,
            last_number: 10,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]),
        $executeRaw: vi.fn(),
      };
      return fn(tx);
    });

    const result = await sequenceService.getNextNumber('DEC', 2025);

    expect(result.success).toBe(true);
    expect(result.numero).toBe('ACTA-DEC-2025-0011');
    expect(result.secuencia).toBe(11);
    expect(callCount).toBe(2);
  });

  it('should retry on deadlock and succeed', async () => {
    let callCount = 0;

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      callCount++;
      if (callCount <= 2) {
        throw new Error('deadlock detected');
      }
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        $executeRaw: vi.fn(),
      };
      return fn(tx);
    });

    const result = await sequenceService.getNextNumber('OTR', 2025);

    expect(result.success).toBe(true);
    expect(result.numero).toBe('ACTA-OTR-2025-0001');
    expect(callCount).toBe(3);
  });

  it('should fail after exhausting all retries on lock contention', async () => {
    let callCount = 0;

    mockTransaction.mockImplementation(async () => {
      callCount++;
      throw new Error('deadlock detected');
    });

    const result = await sequenceService.getNextNumber('CUR', 2026);

    expect(result.success).toBe(false);
    expect(result.error).toContain('SEQUENCE_GENERATION_FAILED');
    expect(result.error).toContain('deadlock');
    expect(callCount).toBe(3); // SEQUENCE_MAX_RETRIES = 3
  });

  it('should not retry on non-retryable errors', async () => {
    let callCount = 0;

    mockTransaction.mockImplementation(async () => {
      callCount++;
      throw new Error('connection refused');
    });

    const result = await sequenceService.getNextNumber('CUR', 2026);

    expect(result.success).toBe(false);
    expect(callCount).toBe(1);
    expect(result.error).toContain('connection refused');
  });

  it('should retry on unique constraint violation (P2002)', async () => {
    let callCount = 0;

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Unique constraint failed on the fields: P2002');
      }
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'seq-1',
            committee_code: 'CUR',
            year: 2026,
            last_number: 1,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]),
        $executeRaw: vi.fn(),
      };
      return fn(tx);
    });

    const result = await sequenceService.getNextNumber('CUR', 2026);

    expect(result.success).toBe(true);
    expect(result.numero).toBe('ACTA-CUR-2026-0002');
    expect(callCount).toBe(2);
  });

  it('should correctly identify year in the result', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        $executeRaw: vi.fn(),
      };
      return fn(tx);
    });

    const result = await sequenceService.getNextNumber('CUR', 2030);

    expect(result.anio).toBe(2030);
  });
});
