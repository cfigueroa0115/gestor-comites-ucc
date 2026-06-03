import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock iron-session
const mockSave = vi.fn();
const mockDestroy = vi.fn();
let mockSessionData: Record<string, unknown> = {};

vi.mock('iron-session', () => ({
  getIronSession: vi.fn(async () => {
    const session = { ...mockSessionData };
    return new Proxy(session, {
      set(target, prop, value) {
        target[prop as string] = value;
        mockSessionData[prop as string] = value;
        return true;
      },
      get(target, prop) {
        if (prop === 'save') return mockSave;
        if (prop === 'destroy') return mockDestroy;
        return target[prop as string];
      },
    });
  }),
}));

import { handleProtectedRoute, isSessionExpired, getSessionOptions } from './middleware-handler';

describe('middleware-handler', () => {
  beforeEach(() => {
    mockSessionData = {};
    mockSave.mockReset();
    mockDestroy.mockReset();
    vi.stubEnv('SESSION_SECRET', 'a-very-long-secret-that-is-at-least-32-characters-long');
    vi.stubEnv('NODE_ENV', 'test');
  });

  function createRequest(path: string) {
    return new NextRequest(new URL(path, 'http://localhost:3000'));
  }

  describe('handleProtectedRoute - route protection', () => {
    it('should redirect to /login when no session exists on /dashboard', async () => {
      mockSessionData = {};
      const request = createRequest('/dashboard');
      const response = await handleProtectedRoute(request);

      expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    });

    it('should redirect to /login when no session exists on /actas', async () => {
      mockSessionData = {};
      const request = createRequest('/actas');
      const response = await handleProtectedRoute(request);

      expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    });

    it('should redirect to /login when no session exists on /admin', async () => {
      mockSessionData = {};
      const request = createRequest('/admin');
      const response = await handleProtectedRoute(request);

      expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    });

    it('should redirect to /login on nested protected routes', async () => {
      mockSessionData = {};
      const request = createRequest('/admin/usuarios');
      const response = await handleProtectedRoute(request);

      expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    });

    it('should allow access with valid session', async () => {
      const now = new Date().toISOString();
      mockSessionData = {
        userId: 'user-123',
        nombreCompleto: 'Test User',
        usuario: 'testuser',
        cargo: 'Docente',
        rol: 'Administrador',
        correo: 'test@ucc.edu.co',
        loginAt: now,
        lastActivity: now,
      };
      const request = createRequest('/dashboard');
      const response = await handleProtectedRoute(request);

      // Should not redirect — status 200 means pass-through
      expect(response.headers.get('location')).toBeNull();
      expect(response.status).toBe(200);
    });
  });

  describe('handleProtectedRoute - inactivity timeout (30 minutes)', () => {
    it('should redirect when lastActivity is older than 30 minutes', async () => {
      const thirtyOneMinutesAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();
      mockSessionData = {
        userId: 'user-123',
        nombreCompleto: 'Test User',
        usuario: 'testuser',
        cargo: 'Docente',
        rol: 'Administrador',
        correo: 'test@ucc.edu.co',
        loginAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        lastActivity: thirtyOneMinutesAgo,
      };
      const request = createRequest('/dashboard');
      const response = await handleProtectedRoute(request);

      expect(response.headers.get('location')).toBe('http://localhost:3000/login');
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should allow access when lastActivity is within 30 minutes', async () => {
      const twentyNineMinutesAgo = new Date(Date.now() - 29 * 60 * 1000).toISOString();
      mockSessionData = {
        userId: 'user-123',
        nombreCompleto: 'Test User',
        usuario: 'testuser',
        cargo: 'Docente',
        rol: 'Administrador',
        correo: 'test@ucc.edu.co',
        loginAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        lastActivity: twentyNineMinutesAgo,
      };
      const request = createRequest('/dashboard');
      const response = await handleProtectedRoute(request);

      expect(response.headers.get('location')).toBeNull();
      expect(response.status).toBe(200);
    });
  });

  describe('handleProtectedRoute - absolute lifetime (8 hours)', () => {
    it('should redirect when loginAt is older than 8 hours', async () => {
      const nineHoursAgo = new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString();
      mockSessionData = {
        userId: 'user-123',
        nombreCompleto: 'Test User',
        usuario: 'testuser',
        cargo: 'Docente',
        rol: 'Administrador',
        correo: 'test@ucc.edu.co',
        loginAt: nineHoursAgo,
        lastActivity: new Date().toISOString(),
      };
      const request = createRequest('/dashboard');
      const response = await handleProtectedRoute(request);

      expect(response.headers.get('location')).toBe('http://localhost:3000/login');
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should allow access when loginAt is within 8 hours', async () => {
      const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
      mockSessionData = {
        userId: 'user-123',
        nombreCompleto: 'Test User',
        usuario: 'testuser',
        cargo: 'Docente',
        rol: 'Administrador',
        correo: 'test@ucc.edu.co',
        loginAt: sevenHoursAgo,
        lastActivity: new Date().toISOString(),
      };
      const request = createRequest('/dashboard');
      const response = await handleProtectedRoute(request);

      expect(response.headers.get('location')).toBeNull();
      expect(response.status).toBe(200);
    });
  });

  describe('handleProtectedRoute - lastActivity update', () => {
    it('should update lastActivity on valid session access', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      mockSessionData = {
        userId: 'user-123',
        nombreCompleto: 'Test User',
        usuario: 'testuser',
        cargo: 'Docente',
        rol: 'Administrador',
        correo: 'test@ucc.edu.co',
        loginAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        lastActivity: fiveMinutesAgo,
      };
      const request = createRequest('/dashboard');
      await handleProtectedRoute(request);

      // lastActivity should have been updated to a more recent time
      expect(mockSessionData.lastActivity).not.toBe(fiveMinutesAgo);
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('handleProtectedRoute - missing SESSION_SECRET', () => {
    it('should redirect to /login if SESSION_SECRET is missing', async () => {
      vi.stubEnv('SESSION_SECRET', '');
      const request = createRequest('/dashboard');
      const response = await handleProtectedRoute(request);

      expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    });

    it('should redirect to /login if SESSION_SECRET is too short', async () => {
      vi.stubEnv('SESSION_SECRET', 'short');
      const request = createRequest('/dashboard');
      const response = await handleProtectedRoute(request);

      expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    });
  });

  describe('handleProtectedRoute - error handling', () => {
    it('should redirect to /login if getIronSession throws', async () => {
      const { getIronSession } = await import('iron-session');
      vi.mocked(getIronSession).mockRejectedValueOnce(
        new Error('Decryption failed'),
      );
      const request = createRequest('/dashboard');
      const response = await handleProtectedRoute(request);

      expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    });
  });

  describe('isSessionExpired', () => {
    it('should return true when lastActivity exceeds 30 minutes', () => {
      const session = {
        userId: 'user-123',
        nombreCompleto: 'Test',
        usuario: 'test',
        cargo: 'Docente',
        rol: 'Administrador' as const,
        correo: 'test@test.com',
        loginAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        lastActivity: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
      };
      expect(isSessionExpired(session)).toBe(true);
    });

    it('should return false when lastActivity is within 30 minutes', () => {
      const session = {
        userId: 'user-123',
        nombreCompleto: 'Test',
        usuario: 'test',
        cargo: 'Docente',
        rol: 'Administrador' as const,
        correo: 'test@test.com',
        loginAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        lastActivity: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      };
      expect(isSessionExpired(session)).toBe(false);
    });

    it('should return true when loginAt exceeds 8 hours', () => {
      const session = {
        userId: 'user-123',
        nombreCompleto: 'Test',
        usuario: 'test',
        cargo: 'Docente',
        rol: 'Administrador' as const,
        correo: 'test@test.com',
        loginAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
        lastActivity: new Date().toISOString(),
      };
      expect(isSessionExpired(session)).toBe(true);
    });

    it('should return false when loginAt is within 8 hours', () => {
      const session = {
        userId: 'user-123',
        nombreCompleto: 'Test',
        usuario: 'test',
        cargo: 'Docente',
        rol: 'Administrador' as const,
        correo: 'test@test.com',
        loginAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
        lastActivity: new Date().toISOString(),
      };
      expect(isSessionExpired(session)).toBe(false);
    });

    it('should return true when exactly at 30 min boundary (>30 min)', () => {
      const session = {
        userId: 'user-123',
        nombreCompleto: 'Test',
        usuario: 'test',
        cargo: 'Docente',
        rol: 'Administrador' as const,
        correo: 'test@test.com',
        loginAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        lastActivity: new Date(Date.now() - 30 * 60 * 1000 - 1).toISOString(),
      };
      expect(isSessionExpired(session)).toBe(true);
    });
  });

  describe('getSessionOptions', () => {
    it('should return correct cookie name', () => {
      const options = getSessionOptions();
      expect(options.cookieName).toBe('gestor_comites_session');
    });

    it('should set httpOnly to true', () => {
      const options = getSessionOptions();
      expect(options.cookieOptions.httpOnly).toBe(true);
    });

    it('should set sameSite to lax', () => {
      const options = getSessionOptions();
      expect(options.cookieOptions.sameSite).toBe('lax');
    });

    it('should set maxAge to 8 hours', () => {
      const options = getSessionOptions();
      expect(options.cookieOptions.maxAge).toBe(8 * 60 * 60);
    });

    it('should set secure to false in non-production', () => {
      vi.stubEnv('NODE_ENV', 'test');
      const options = getSessionOptions();
      expect(options.cookieOptions.secure).toBe(false);
    });

    it('should set secure to true in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const options = getSessionOptions();
      expect(options.cookieOptions.secure).toBe(true);
    });
  });
});
