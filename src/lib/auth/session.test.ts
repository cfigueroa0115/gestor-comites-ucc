import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock iron-session
const mockSave = vi.fn();
const mockDestroy = vi.fn();
let mockSessionData: Record<string, unknown> = {};

vi.mock('iron-session', () => ({
  getIronSession: vi.fn(async () => {
    const session = { ...mockSessionData };
    Object.defineProperty(session, 'save', { value: mockSave, enumerable: false });
    Object.defineProperty(session, 'destroy', { value: mockDestroy, enumerable: false });
    // Make properties assignable
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

// Mock next/headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  getAll: vi.fn(() => []),
  has: vi.fn(),
  delete: vi.fn(),
};
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

describe('session', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    mockSessionData = {};
    mockSave.mockReset();
    mockDestroy.mockReset();
    process.env = {
      ...originalEnv,
      SESSION_SECRET: 'a-very-long-secret-that-is-at-least-32-characters-long',
      NODE_ENV: 'test',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sessionOptions', () => {
    it('should have correct cookie name', async () => {
      const { sessionOptions } = await import('./session');
      expect(sessionOptions.cookieName).toBe('gestor_comites_session');
    });

    it('should have httpOnly set to true', async () => {
      const { sessionOptions } = await import('./session');
      expect(sessionOptions.cookieOptions.httpOnly).toBe(true);
    });

    it('should have sameSite set to lax', async () => {
      const { sessionOptions } = await import('./session');
      expect(sessionOptions.cookieOptions.sameSite).toBe('lax');
    });

    it('should have maxAge of 8 hours (28800 seconds)', async () => {
      const { sessionOptions } = await import('./session');
      expect(sessionOptions.cookieOptions.maxAge).toBe(8 * 60 * 60);
      expect(sessionOptions.cookieOptions.maxAge).toBe(28800);
    });

    it('should set secure to false in non-production', async () => {
      process.env.NODE_ENV = 'test';
      const { sessionOptions } = await import('./session');
      expect(sessionOptions.cookieOptions.secure).toBe(false);
    });
  });

  describe('getSession()', () => {
    it('should throw if SESSION_SECRET is missing', async () => {
      process.env.SESSION_SECRET = '';
      const { getSession } = await import('./session');
      await expect(getSession()).rejects.toThrow(
        'SESSION_SECRET environment variable is missing or less than 32 characters.',
      );
    });

    it('should throw if SESSION_SECRET is less than 32 characters', async () => {
      process.env.SESSION_SECRET = 'short-secret';
      const { getSession } = await import('./session');
      await expect(getSession()).rejects.toThrow(
        'SESSION_SECRET environment variable is missing or less than 32 characters.',
      );
    });

    it('should return session from iron-session', async () => {
      const { getSession } = await import('./session');
      const session = await getSession();
      expect(session).toBeDefined();
    });

    it('should update lastActivity when session has userId', async () => {
      mockSessionData = { userId: 'user-123', lastActivity: '2024-01-01T00:00:00.000Z' };
      const { getSession } = await import('./session');
      await getSession();
      expect(mockSave).toHaveBeenCalled();
      expect(mockSessionData.lastActivity).not.toBe('2024-01-01T00:00:00.000Z');
    });

    it('should NOT update lastActivity when session has no userId', async () => {
      mockSessionData = {};
      const { getSession } = await import('./session');
      await getSession();
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  describe('createSession()', () => {
    it('should throw if SESSION_SECRET is missing', async () => {
      process.env.SESSION_SECRET = '';
      const { createSession } = await import('./session');
      await expect(
        createSession({
          id: 'user-1',
          nombreCompleto: 'Test User',
          usuario: 'testuser',
          cargo: 'Docente',
          rol: 'Administrador',
          correo: 'test@ucc.edu.co',
        }),
      ).rejects.toThrow(
        'SESSION_SECRET environment variable is missing or less than 32 characters.',
      );
    });

    it('should set all session fields for the user', async () => {
      const { createSession } = await import('./session');
      await createSession({
        id: 'user-123',
        nombreCompleto: 'Carlos Figueroa',
        usuario: 'cfigueroa',
        cargo: 'Docente',
        rol: 'Administrador',
        correo: 'carlos@ucc.edu.co',
      });

      expect(mockSessionData.userId).toBe('user-123');
      expect(mockSessionData.nombreCompleto).toBe('Carlos Figueroa');
      expect(mockSessionData.usuario).toBe('cfigueroa');
      expect(mockSessionData.cargo).toBe('Docente');
      expect(mockSessionData.rol).toBe('Administrador');
      expect(mockSessionData.correo).toBe('carlos@ucc.edu.co');
      expect(mockSessionData.loginAt).toBeDefined();
      expect(mockSessionData.lastActivity).toBeDefined();
    });

    it('should set loginAt and lastActivity to the same timestamp', async () => {
      const { createSession } = await import('./session');
      await createSession({
        id: 'user-123',
        nombreCompleto: 'Test',
        usuario: 'test',
        cargo: 'Cargo',
        rol: 'Consulta',
        correo: 'test@test.com',
      });

      expect(mockSessionData.loginAt).toBe(mockSessionData.lastActivity);
    });

    it('should call save() after setting fields', async () => {
      const { createSession } = await import('./session');
      await createSession({
        id: 'user-123',
        nombreCompleto: 'Test',
        usuario: 'test',
        cargo: 'Cargo',
        rol: 'Usuario_Gestor',
        correo: 'test@test.com',
      });

      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('destroySession()', () => {
    it('should throw if SESSION_SECRET is missing', async () => {
      process.env.SESSION_SECRET = '';
      const { destroySession } = await import('./session');
      await expect(destroySession()).rejects.toThrow(
        'SESSION_SECRET environment variable is missing or less than 32 characters.',
      );
    });

    it('should call destroy() on the session', async () => {
      const { destroySession } = await import('./session');
      await destroySession();
      expect(mockDestroy).toHaveBeenCalled();
    });
  });
});
