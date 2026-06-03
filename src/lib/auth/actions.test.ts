import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for loginAction server action.
 *
 * These tests mock external dependencies (prisma, bcrypt, session, redirect)
 * to validate the login logic in isolation.
 */

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error('NEXT_REDIRECT');
  },
}));

// Mock prisma
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

// Mock bcrypt
const mockCompare = vi.fn();
vi.mock('bcryptjs', () => ({
  default: {
    compare: (...args: unknown[]) => mockCompare(...args),
  },
}));

// Mock session
const mockCreateSession = vi.fn();
vi.mock('@/lib/auth/session', () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
}));

// Import after mocks
import { loginAction } from './actions';

// Helper to build FormData
function buildFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const VALID_USER = {
  id: 'user-123',
  nombreCompleto: 'Carlos Figueroa',
  usuario: 'cfigueroa',
  passwordHash: '$2a$12$hashedpassword',
  cargo: 'Profesor',
  correo: 'carlos@ucc.edu.co',
  rol: 'Administrador' as const,
  activo: true,
  failedAttempts: 0,
  lockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('loginAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns VALIDATION_ERROR when usuario is too short', async () => {
    const fd = buildFormData({
      usuario: 'ab',
      contrasena: 'password123',
      cargo: 'Profesor',
    });

    const result = await loginAction(fd);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR when contrasena is too short', async () => {
    const fd = buildFormData({
      usuario: 'cfigueroa',
      contrasena: 'short',
      cargo: 'Profesor',
    });

    const result = await loginAction(fd);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR when cargo is empty', async () => {
    const fd = buildFormData({
      usuario: 'cfigueroa',
      contrasena: 'password123',
      cargo: '',
    });

    const result = await loginAction(fd);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns INVALID_CREDENTIALS when user does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const fd = buildFormData({
      usuario: 'nonexistent',
      contrasena: 'password123',
      cargo: 'Profesor',
    });

    const result = await loginAction(fd);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_CREDENTIALS');
    expect(result.error?.message).toBe(
      'Credenciales inválidas. Por favor verifique sus datos.',
    );
  });

  it('returns INVALID_CREDENTIALS when user is inactive', async () => {
    mockFindUnique.mockResolvedValue({ ...VALID_USER, activo: false });

    const fd = buildFormData({
      usuario: 'cfigueroa',
      contrasena: 'password123',
      cargo: 'Profesor',
    });

    const result = await loginAction(fd);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_CREDENTIALS');
    // Same generic message – doesn't reveal inactive status
    expect(result.error?.message).toBe(
      'Credenciales inválidas. Por favor verifique sus datos.',
    );
  });

  it('returns ACCOUNT_LOCKED when account is locked', async () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    mockFindUnique.mockResolvedValue({
      ...VALID_USER,
      lockedUntil: futureDate,
      failedAttempts: 5,
    });

    const fd = buildFormData({
      usuario: 'cfigueroa',
      contrasena: 'password123',
      cargo: 'Profesor',
    });

    const result = await loginAction(fd);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('ACCOUNT_LOCKED');
    expect(result.error?.message).toContain('bloqueada temporalmente');
  });

  it('allows login when lock period has expired', async () => {
    const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    mockFindUnique.mockResolvedValue({
      ...VALID_USER,
      lockedUntil: pastDate,
      failedAttempts: 5,
    });
    mockCompare.mockResolvedValue(true);
    mockUpdate.mockResolvedValue({});
    mockCreateSession.mockResolvedValue({});

    const fd = buildFormData({
      usuario: 'cfigueroa',
      contrasena: 'password123',
      cargo: 'Profesor',
    });

    // Should redirect on success (throws NEXT_REDIRECT)
    await expect(loginAction(fd)).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('returns INVALID_CREDENTIALS and increments attempts on wrong password', async () => {
    mockFindUnique.mockResolvedValue({ ...VALID_USER, failedAttempts: 2 });
    mockCompare.mockResolvedValue(false);
    mockUpdate.mockResolvedValue({});

    const fd = buildFormData({
      usuario: 'cfigueroa',
      contrasena: 'wrongpassword',
      cargo: 'Profesor',
    });

    const result = await loginAction(fd);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_CREDENTIALS');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { failedAttempts: 3 },
    });
  });

  it('locks account when failed attempts reach threshold', async () => {
    mockFindUnique.mockResolvedValue({ ...VALID_USER, failedAttempts: 4 });
    mockCompare.mockResolvedValue(false);
    mockUpdate.mockResolvedValue({});

    const fd = buildFormData({
      usuario: 'cfigueroa',
      contrasena: 'wrongpassword',
      cargo: 'Profesor',
    });

    const result = await loginAction(fd);

    expect(result.success).toBe(false);
    // Verify update was called with lockedUntil set
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          failedAttempts: 5,
          lockedUntil: expect.any(Date),
        }),
      }),
    );
  });

  it('returns INVALID_CREDENTIALS when cargo does not match', async () => {
    mockFindUnique.mockResolvedValue(VALID_USER);
    mockCompare.mockResolvedValue(true);
    mockUpdate.mockResolvedValue({});

    const fd = buildFormData({
      usuario: 'cfigueroa',
      contrasena: 'password123',
      cargo: 'WrongCargo',
    });

    const result = await loginAction(fd);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_CREDENTIALS');
  });

  it('resets failedAttempts and creates session on successful login', async () => {
    mockFindUnique.mockResolvedValue({ ...VALID_USER, failedAttempts: 3 });
    mockCompare.mockResolvedValue(true);
    mockUpdate.mockResolvedValue({});
    mockCreateSession.mockResolvedValue({});

    const fd = buildFormData({
      usuario: 'cfigueroa',
      contrasena: 'password123',
      cargo: 'Profesor',
    });

    await expect(loginAction(fd)).rejects.toThrow('NEXT_REDIRECT');

    // Verify failedAttempts reset
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    // Verify session was created with correct data
    expect(mockCreateSession).toHaveBeenCalledWith({
      id: 'user-123',
      nombreCompleto: 'Carlos Figueroa',
      usuario: 'cfigueroa',
      cargo: 'Profesor',
      rol: 'Administrador',
      correo: 'carlos@ucc.edu.co',
    });

    // Verify redirect to dashboard
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('uses same generic error message for all failure cases', async () => {
    const genericMsg = 'Credenciales inválidas. Por favor verifique sus datos.';

    // Case 1: User not found
    mockFindUnique.mockResolvedValue(null);
    const r1 = await loginAction(
      buildFormData({ usuario: 'nope', contrasena: 'password123', cargo: 'X' }),
    );
    expect(r1.error?.message).toBe(genericMsg);

    // Case 2: User inactive
    mockFindUnique.mockResolvedValue({ ...VALID_USER, activo: false });
    const r2 = await loginAction(
      buildFormData({ usuario: 'cfigueroa', contrasena: 'pass1234', cargo: 'X' }),
    );
    expect(r2.error?.message).toBe(genericMsg);

    // Case 3: Wrong password
    mockFindUnique.mockResolvedValue(VALID_USER);
    mockCompare.mockResolvedValue(false);
    mockUpdate.mockResolvedValue({});
    const r3 = await loginAction(
      buildFormData({ usuario: 'cfigueroa', contrasena: 'wrong123', cargo: 'Profesor' }),
    );
    expect(r3.error?.message).toBe(genericMsg);

    // Case 4: Wrong cargo
    mockCompare.mockResolvedValue(true);
    mockUpdate.mockResolvedValue({});
    const r4 = await loginAction(
      buildFormData({ usuario: 'cfigueroa', contrasena: 'pass1234', cargo: 'WrongCargo' }),
    );
    expect(r4.error?.message).toBe(genericMsg);
  });
});
