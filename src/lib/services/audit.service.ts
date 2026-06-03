/**
 * Audit Logger Service - Fire-and-forget asynchronous audit logging.
 *
 * Implements IAuditLogger with a non-blocking, in-memory queue pattern.
 * The `log()` method returns void immediately (synchronous), pushing entries
 * to an internal queue that is processed asynchronously in the background.
 *
 * Key behaviors:
 * - Write-only: no update/delete operations on audit_logs
 * - Non-blocking: adds <100ms latency to primary operations
 * - Retry up to 3 times on DB write failure (100ms linear backoff)
 * - Fallback to console.error with [AUDIT_FALLBACK] prefix if all retries fail
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import { prisma } from '@/lib/db/prisma';
import { APP_TIMEZONE } from '@/lib/utils/constants';
import type { Prisma } from '@prisma/client';
import type { IAuditLogger, AuditEntry } from '@/types';

/** Maximum number of retry attempts for a single audit entry write. */
const MAX_RETRIES = 3;

/** Linear backoff delay in milliseconds between retries. */
const RETRY_DELAY_MS = 100;

/**
 * Delays execution for the specified number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gets the current timestamp in America/Bogota timezone as a Date object.
 */
function getNowInBogota(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '0';

  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10) - 1; // JS months are 0-based
  const day = parseInt(get('day'), 10);
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const second = parseInt(get('second'), 10);

  return new Date(year, month, day, hour, minute, second);
}

/**
 * Attempts to write an audit entry to the database with retry logic.
 *
 * Retries up to MAX_RETRIES times with RETRY_DELAY_MS linear backoff.
 * If all retries fail, logs the entry to console.error with [AUDIT_FALLBACK] prefix.
 */
async function processEntry(entry: AuditEntry): Promise<void> {
  const createdAt = getNowInBogota();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          metadataJson: entry.metadataJson
            ? (entry.metadataJson as Prisma.InputJsonValue)
            : undefined,
          ipAddress: entry.ipAddress,
          createdAt,
        },
      });
      // Write successful, exit
      return;
    } catch {
      // If not the last attempt, wait before retrying
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  // All retries exhausted — fallback to console.error
  console.error('[AUDIT_FALLBACK]', JSON.stringify(entry));
}

/**
 * Internal queue for audit entries.
 * Entries are pushed synchronously and processed asynchronously.
 */
const queue: AuditEntry[] = [];

/** Flag indicating whether the queue processor is currently running. */
let processing = false;

/**
 * Background queue processor.
 *
 * Drains entries from the queue one at a time, processing each with
 * retry logic. Runs until the queue is empty, then stops until
 * new entries are enqueued.
 */
async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (entry) {
        await processEntry(entry);
      }
    }
  } finally {
    processing = false;
  }
}

/**
 * Audit Logger singleton implementing IAuditLogger.
 *
 * The `log()` method is synchronous (returns void, not Promise<void>).
 * It pushes the entry to an in-memory queue and triggers background
 * processing without awaiting the result.
 */
export const auditLogger: IAuditLogger = {
  log(entry: AuditEntry): void {
    queue.push(entry);
    // Fire-and-forget: trigger processing without awaiting
    void processQueue();
  },
};
