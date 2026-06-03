/**
 * IP-based rate limiting for login attempts.
 *
 * Uses an in-memory Map to track failed login attempts per IP address.
 * Blocks an IP for 15 minutes after 5 consecutive failed attempts within
 * a 15-minute window.
 *
 * Note: The in-memory store resets on serverless cold starts (Vercel),
 * which is acceptable for this use case. Per-user lockout is handled
 * separately via User.failedAttempts and User.lockedUntil in the database.
 */

import {
  MAX_FAILED_LOGIN_ATTEMPTS,
  ACCOUNT_LOCK_DURATION_MINUTES,
} from '@/lib/utils/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IpAttemptRecord {
  /** Number of failed attempts from this IP. */
  attempts: number;
  /** Timestamp (ms) of the first failed attempt in the current window. */
  firstAttemptAt: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed to proceed. */
  allowed: boolean;
  /** Human-readable message when blocked. */
  message?: string;
}

// ---------------------------------------------------------------------------
// In-Memory Store
// ---------------------------------------------------------------------------

const ipAttemptStore = new Map<string, IpAttemptRecord>();

/** Window duration in milliseconds. */
const WINDOW_MS = ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000;

// ---------------------------------------------------------------------------
// Periodic Cleanup
// ---------------------------------------------------------------------------

/**
 * Removes stale entries older than the rate-limit window.
 * Called periodically to prevent unbounded memory growth.
 */
function cleanupStaleEntries(): void {
  const now = Date.now();
  for (const [ip, record] of ipAttemptStore) {
    if (now - record.firstAttemptAt > WINDOW_MS) {
      ipAttemptStore.delete(ip);
    }
  }
}

// Run cleanup every 5 minutes (only in long-running processes)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanupInterval(): void {
  if (cleanupInterval === null) {
    cleanupInterval = setInterval(cleanupStaleEntries, 5 * 60 * 1000);
    // Allow the process to exit without waiting for this interval
    if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
      cleanupInterval.unref();
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Checks whether the given IP address is currently rate-limited.
 *
 * An IP is blocked if it has accumulated MAX_FAILED_LOGIN_ATTEMPTS (5)
 * failed attempts within the 15-minute window.
 */
export function checkIpRateLimit(ip: string): RateLimitResult {
  const record = ipAttemptStore.get(ip);

  if (!record) {
    return { allowed: true };
  }

  const now = Date.now();

  // If the window has expired, clean up and allow
  if (now - record.firstAttemptAt > WINDOW_MS) {
    ipAttemptStore.delete(ip);
    return { allowed: true };
  }

  // If attempts are below the threshold, allow
  if (record.attempts < MAX_FAILED_LOGIN_ATTEMPTS) {
    return { allowed: true };
  }

  // IP is rate-limited
  return {
    allowed: false,
    message:
      'Demasiados intentos de inicio de sesión. Por favor espere 15 minutos.',
  };
}

/**
 * Records a failed login attempt for the given IP address.
 * If the window has expired, resets the counter for a fresh window.
 */
export function recordIpFailure(ip: string): void {
  ensureCleanupInterval();

  const now = Date.now();
  const existing = ipAttemptStore.get(ip);

  if (!existing || now - existing.firstAttemptAt > WINDOW_MS) {
    // Start a new window
    ipAttemptStore.set(ip, { attempts: 1, firstAttemptAt: now });
  } else {
    // Increment within current window
    existing.attempts += 1;
  }
}

/**
 * Resets the attempt counter for the given IP address.
 * Called on successful login to clear any accumulated failures.
 */
export function resetIpAttempts(ip: string): void {
  ipAttemptStore.delete(ip);
}

// ---------------------------------------------------------------------------
// Testing Utilities (exported for unit tests only)
// ---------------------------------------------------------------------------

/**
 * Clears all entries from the IP attempt store.
 * Intended for use in tests to ensure clean state between test cases.
 */
export function _resetStore(): void {
  ipAttemptStore.clear();
}

/**
 * Returns the current size of the IP attempt store.
 * Intended for use in tests.
 */
export function _getStoreSize(): number {
  return ipAttemptStore.size;
}
