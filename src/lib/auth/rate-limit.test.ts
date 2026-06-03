import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkIpRateLimit,
  recordIpFailure,
  resetIpAttempts,
  _resetStore,
  _getStoreSize,
} from './rate-limit';

describe('IP-based rate limiting', () => {
  beforeEach(() => {
    _resetStore();
  });

  describe('checkIpRateLimit', () => {
    it('allows requests from unknown IPs', () => {
      const result = checkIpRateLimit('192.168.1.1');
      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('allows requests when attempts are below threshold', () => {
      for (let i = 0; i < 4; i++) {
        recordIpFailure('10.0.0.1');
      }
      const result = checkIpRateLimit('10.0.0.1');
      expect(result.allowed).toBe(true);
    });

    it('blocks IP after 5 failed attempts within window', () => {
      for (let i = 0; i < 5; i++) {
        recordIpFailure('10.0.0.2');
      }
      const result = checkIpRateLimit('10.0.0.2');
      expect(result.allowed).toBe(false);
      expect(result.message).toBe(
        'Demasiados intentos de inicio de sesión. Por favor espere 15 minutos.',
      );
    });

    it('does not affect other IPs when one is blocked', () => {
      for (let i = 0; i < 5; i++) {
        recordIpFailure('10.0.0.3');
      }
      const blocked = checkIpRateLimit('10.0.0.3');
      const allowed = checkIpRateLimit('10.0.0.4');
      expect(blocked.allowed).toBe(false);
      expect(allowed.allowed).toBe(true);
    });
  });

  describe('recordIpFailure', () => {
    it('creates a new entry for first failure', () => {
      recordIpFailure('172.16.0.1');
      expect(_getStoreSize()).toBe(1);
      // Should still be allowed (1 attempt < 5)
      expect(checkIpRateLimit('172.16.0.1').allowed).toBe(true);
    });

    it('increments attempts for same IP', () => {
      recordIpFailure('172.16.0.2');
      recordIpFailure('172.16.0.2');
      recordIpFailure('172.16.0.2');
      // 3 attempts, still allowed
      expect(checkIpRateLimit('172.16.0.2').allowed).toBe(true);
    });

    it('triggers block at exactly 5 attempts', () => {
      for (let i = 0; i < 5; i++) {
        recordIpFailure('172.16.0.3');
      }
      expect(checkIpRateLimit('172.16.0.3').allowed).toBe(false);
    });
  });

  describe('resetIpAttempts', () => {
    it('clears rate limit for a specific IP', () => {
      for (let i = 0; i < 5; i++) {
        recordIpFailure('192.168.0.1');
      }
      expect(checkIpRateLimit('192.168.0.1').allowed).toBe(false);

      resetIpAttempts('192.168.0.1');
      expect(checkIpRateLimit('192.168.0.1').allowed).toBe(true);
    });

    it('does not affect other IPs when resetting one', () => {
      for (let i = 0; i < 5; i++) {
        recordIpFailure('192.168.0.2');
        recordIpFailure('192.168.0.3');
      }
      resetIpAttempts('192.168.0.2');
      expect(checkIpRateLimit('192.168.0.2').allowed).toBe(true);
      expect(checkIpRateLimit('192.168.0.3').allowed).toBe(false);
    });

    it('handles resetting a non-existent IP gracefully', () => {
      resetIpAttempts('unknown-ip');
      expect(_getStoreSize()).toBe(0);
    });
  });

  describe('window expiration', () => {
    it('resets after 15-minute window expires', () => {
      // Manually create an expired record by manipulating time
      recordIpFailure('10.1.1.1');
      recordIpFailure('10.1.1.1');
      recordIpFailure('10.1.1.1');
      recordIpFailure('10.1.1.1');
      recordIpFailure('10.1.1.1');

      // Verify blocked
      expect(checkIpRateLimit('10.1.1.1').allowed).toBe(false);

      // Simulate time passing by directly accessing the store through recording
      // after window. We use vi.useFakeTimers for proper time control.
    });
  });
});

describe('IP-based rate limiting with fake timers', () => {
  beforeEach(() => {
    _resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests after 15-minute window expires', () => {
    for (let i = 0; i < 5; i++) {
      recordIpFailure('10.2.2.2');
    }
    expect(checkIpRateLimit('10.2.2.2').allowed).toBe(false);

    // Advance time past the 15-minute window
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    expect(checkIpRateLimit('10.2.2.2').allowed).toBe(true);
  });

  it('starts a new window after expiration on next failure', () => {
    for (let i = 0; i < 5; i++) {
      recordIpFailure('10.3.3.3');
    }
    expect(checkIpRateLimit('10.3.3.3').allowed).toBe(false);

    // Advance past window
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    // New failure starts fresh window
    recordIpFailure('10.3.3.3');
    expect(checkIpRateLimit('10.3.3.3').allowed).toBe(true);

    // 4 more failures to reach the limit again
    recordIpFailure('10.3.3.3');
    recordIpFailure('10.3.3.3');
    recordIpFailure('10.3.3.3');
    recordIpFailure('10.3.3.3');
    expect(checkIpRateLimit('10.3.3.3').allowed).toBe(false);
  });
});
