import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

// Mock session data
let mockSessionData: Record<string, unknown> = {};

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(async () => {
    const mockSave = vi.fn();
    const mockDestroy = vi.fn();
    return new Proxy({ ...mockSessionData } as Record<string, unknown>, {
      get(target, prop) {
        if (prop === 'save') return mockSave;
        if (prop === 'destroy') return mockDestroy;
        return target[prop as string];
      },
    });
  }),
}));

describe('guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionData = {};
  });

  describe('requireAuth()', () => {
    it('should redirect to /login when session has no userId', async () => {
      mockSessionData = {};
      const { requireAuth } = await import('./guards');
      await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT:/login');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('should return session data when user is authenticated', async () => {
      mockSessionData = {
        userId: 'user-1',
        nombreCompleto: 'Test User',
        usuario: 'testuser',
        cargo: 'Docente',
        rol: 'Administrador',
        correo: 'test@ucc.edu.co',
        loginAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-01T01:00:00.000Z',
      };
      const { requireAuth } = await import('./guards');
      const result = await requireAuth();

      expect(result.userId).toBe('user-1');
      expect(result.nombreCompleto).toBe('Test User');
      expect(result.usuario).toBe('testuser');
      expect(result.cargo).toBe('Docente');
      expect(result.rol).toBe('Administrador');
      expect(result.correo).toBe('test@ucc.edu.co');
      expect(result.loginAt).toBe('2024-01-01T00:00:00.000Z');
      expect(result.lastActivity).toBe('2024-01-01T01:00:00.000Z');
    });

    it('should redirect to /login when userId is empty string', async () => {
      mockSessionData = { userId: '' };
      const { requireAuth } = await import('./guards');
      await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT:/login');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('requireAdmin()', () => {
    it('should redirect to /login when not authenticated', async () => {
      mockSessionData = {};
      const { requireAdmin } = await import('./guards');
      await expect(requireAdmin()).rejects.toThrow('NEXT_REDIRECT:/login');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('should redirect to /dashboard when user is Usuario_Gestor', async () => {
      mockSessionData = {
        userId: 'user-2',
        nombreCompleto: 'Gestor User',
        usuario: 'gestor',
        cargo: 'Docente',
        rol: 'Usuario_Gestor',
        correo: 'gestor@ucc.edu.co',
        loginAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-01T01:00:00.000Z',
      };
      const { requireAdmin } = await import('./guards');
      await expect(requireAdmin()).rejects.toThrow('NEXT_REDIRECT:/dashboard');
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
    });

    it('should redirect to /dashboard when user is Consulta', async () => {
      mockSessionData = {
        userId: 'user-3',
        nombreCompleto: 'Consulta User',
        usuario: 'consulta',
        cargo: 'Docente',
        rol: 'Consulta',
        correo: 'consulta@ucc.edu.co',
        loginAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-01T01:00:00.000Z',
      };
      const { requireAdmin } = await import('./guards');
      await expect(requireAdmin()).rejects.toThrow('NEXT_REDIRECT:/dashboard');
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
    });

    it('should return session data when user is Administrador', async () => {
      mockSessionData = {
        userId: 'user-1',
        nombreCompleto: 'Admin User',
        usuario: 'admin',
        cargo: 'Decano',
        rol: 'Administrador',
        correo: 'admin@ucc.edu.co',
        loginAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-01T01:00:00.000Z',
      };
      const { requireAdmin } = await import('./guards');
      const result = await requireAdmin();

      expect(result.userId).toBe('user-1');
      expect(result.rol).toBe('Administrador');
    });
  });

  describe('requireGestor()', () => {
    it('should redirect to /login when not authenticated', async () => {
      mockSessionData = {};
      const { requireGestor } = await import('./guards');
      await expect(requireGestor()).rejects.toThrow('NEXT_REDIRECT:/login');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('should redirect to /dashboard when user is Consulta', async () => {
      mockSessionData = {
        userId: 'user-3',
        nombreCompleto: 'Consulta User',
        usuario: 'consulta',
        cargo: 'Docente',
        rol: 'Consulta',
        correo: 'consulta@ucc.edu.co',
        loginAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-01T01:00:00.000Z',
      };
      const { requireGestor } = await import('./guards');
      await expect(requireGestor()).rejects.toThrow('NEXT_REDIRECT:/dashboard');
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
    });

    it('should return session data when user is Administrador', async () => {
      mockSessionData = {
        userId: 'user-1',
        nombreCompleto: 'Admin User',
        usuario: 'admin',
        cargo: 'Decano',
        rol: 'Administrador',
        correo: 'admin@ucc.edu.co',
        loginAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-01T01:00:00.000Z',
      };
      const { requireGestor } = await import('./guards');
      const result = await requireGestor();

      expect(result.userId).toBe('user-1');
      expect(result.rol).toBe('Administrador');
    });

    it('should return session data when user is Usuario_Gestor', async () => {
      mockSessionData = {
        userId: 'user-2',
        nombreCompleto: 'Gestor User',
        usuario: 'gestor',
        cargo: 'Docente',
        rol: 'Usuario_Gestor',
        correo: 'gestor@ucc.edu.co',
        loginAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-01T01:00:00.000Z',
      };
      const { requireGestor } = await import('./guards');
      const result = await requireGestor();

      expect(result.userId).toBe('user-2');
      expect(result.rol).toBe('Usuario_Gestor');
    });
  });
});
