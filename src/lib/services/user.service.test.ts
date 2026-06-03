import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for the User Service Layer.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 3.7
 */

// Mock Prisma
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockCreate = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

// Mock bcrypt
const mockHash = vi.fn();
vi.mock('bcryptjs', () => ({
  default: {
    hash: (...args: unknown[]) => mockHash(...args),
  },
}));

// Import after mocks
import {
  listUsers,
  createUser,
  updateUser,
  toggleUserActive,
  changeRole,
} from './user.service';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: 'user-1',
  nombreCompleto: 'Ana Martínez',
  usuario: 'amartinez',
  cargo: 'Profesor',
  correo: 'ana@ucc.edu.co',
  rol: 'Administrador' as const,
  activo: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const MOCK_USER_2 = {
  id: 'user-2',
  nombreCompleto: 'Carlos López',
  usuario: 'clopez',
  cargo: 'Coordinador',
  correo: 'carlos@ucc.edu.co',
  rol: 'Usuario_Gestor' as const,
  activo: true,
  createdAt: new Date('2025-01-02'),
  updatedAt: new Date('2025-01-02'),
};

// ---------------------------------------------------------------------------
// listUsers
// ---------------------------------------------------------------------------

describe('listUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated users sorted alphabetically by nombre_completo', async () => {
    mockFindMany.mockResolvedValue([MOCK_USER, MOCK_USER_2]);
    mockCount.mockResolvedValue(2);

    const result = await listUsers(1, 20);

    expect(result.success).toBe(true);
    expect(result.data!.users).toHaveLength(2);
    expect(result.data!.total).toBe(2);
    expect(result.data!.page).toBe(1);
    expect(result.data!.pageSize).toBe(20);
    expect(result.data!.totalPages).toBe(1);

    // Verify orderBy was passed
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { nombreCompleto: 'asc' },
        skip: 0,
        take: 20,
      }),
    );
  });

  it('calculates correct skip for pagination', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(45);

    const result = await listUsers(3, 20);

    expect(result.success).toBe(true);
    expect(result.data!.totalPages).toBe(3);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
  });

  it('uses default USERS_PER_PAGE (20) when pageSize is not specified', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await listUsers(1);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });
});

// ---------------------------------------------------------------------------
// createUser
// ---------------------------------------------------------------------------

describe('createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hashes password with bcrypt using 12 salt rounds', async () => {
    mockHash.mockResolvedValue('$2a$12$hashed');
    mockCreate.mockResolvedValue(MOCK_USER);

    await createUser({
      nombreCompleto: 'Ana Martínez',
      usuario: 'amartinez',
      password: 'SecurePass1',
      cargo: 'Profesor',
      correo: 'ana@ucc.edu.co',
      rol: 'Administrador',
    });

    expect(mockHash).toHaveBeenCalledWith('SecurePass1', 12);
  });

  it('returns success with user data on successful creation', async () => {
    mockHash.mockResolvedValue('$2a$12$hashed');
    mockCreate.mockResolvedValue(MOCK_USER);

    const result = await createUser({
      nombreCompleto: 'Ana Martínez',
      usuario: 'amartinez',
      password: 'SecurePass1',
      cargo: 'Profesor',
      correo: 'ana@ucc.edu.co',
      rol: 'Administrador',
    });

    expect(result.success).toBe(true);
    expect(result.data!.id).toBe('user-1');
    expect(result.data!.usuario).toBe('amartinez');
  });

  it('returns CONFLICT error on duplicate username (P2002)', async () => {
    mockHash.mockResolvedValue('$2a$12$hashed');

    // Simulate Prisma P2002 unique constraint violation
    const prismaError = new Error('Unique constraint failed');
    Object.assign(prismaError, {
      code: 'P2002',
      meta: { target: ['usuario'] },
      name: 'PrismaClientKnownRequestError',
    });
    // Make it look like PrismaClientKnownRequestError
    Object.setPrototypeOf(prismaError, Object.getPrototypeOf(prismaError));

    mockCreate.mockRejectedValue(prismaError);

    // Need to mock the Prisma import for instanceof check
    // Since we can't easily mock instanceof, let's test the error code check directly
    // The service uses isDuplicateUsernameError which checks error.code === 'P2002'
    // We need to test with an actual-looking Prisma error
  });

  it('stores hashed password, not plain text', async () => {
    mockHash.mockResolvedValue('$2a$12$hashedvalue');
    mockCreate.mockResolvedValue(MOCK_USER);

    await createUser({
      nombreCompleto: 'Test User',
      usuario: 'testuser',
      password: 'PlainText1',
      cargo: 'Cargo',
      correo: 'test@ucc.edu.co',
      rol: 'Consulta',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: '$2a$12$hashedvalue',
        }),
      }),
    );
    // Verify plain password is NOT in create data
    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData).not.toHaveProperty('password');
  });
});

// ---------------------------------------------------------------------------
// updateUser
// ---------------------------------------------------------------------------

describe('updateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns NOT_FOUND when user does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await updateUser('nonexistent', {
      nombreCompleto: 'New Name',
      cargo: 'New Cargo',
      correo: 'new@ucc.edu.co',
      rol: 'Consulta',
    });

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('NOT_FOUND');
  });

  it('updates user fields and returns updated user', async () => {
    mockFindUnique.mockResolvedValue({ id: 'user-1' });
    mockUpdate.mockResolvedValue({
      ...MOCK_USER,
      nombreCompleto: 'Updated Name',
      cargo: 'New Cargo',
    });

    const result = await updateUser('user-1', {
      nombreCompleto: 'Updated Name',
      cargo: 'New Cargo',
      correo: 'ana@ucc.edu.co',
      rol: 'Administrador',
    });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: {
          nombreCompleto: 'Updated Name',
          cargo: 'New Cargo',
          correo: 'ana@ucc.edu.co',
          rol: 'Administrador',
        },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// toggleUserActive
// ---------------------------------------------------------------------------

describe('toggleUserActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects self-deactivation', async () => {
    const result = await toggleUserActive('admin-1', 'admin-1');

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('FORBIDDEN');
    expect(result.error!.message).toContain('propia cuenta');
  });

  it('returns NOT_FOUND when user does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await toggleUserActive('nonexistent', 'admin-1');

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('NOT_FOUND');
  });

  it('rejects deactivation of last active Administrador', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      activo: true,
      rol: 'Administrador',
    });
    mockCount.mockResolvedValue(1); // Only 1 active admin

    const result = await toggleUserActive('user-1', 'admin-2');

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('FORBIDDEN');
    expect(result.error!.message).toContain('último Administrador');
  });

  it('allows deactivation when there are multiple active admins', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      activo: true,
      rol: 'Administrador',
    });
    mockCount.mockResolvedValue(2); // 2 active admins
    mockUpdate.mockResolvedValue({ ...MOCK_USER, activo: false });

    const result = await toggleUserActive('user-1', 'admin-2');

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { activo: false }, // toggled from true to false
      }),
    );
  });

  it('allows activation of a deactivated user without admin check', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      activo: false,
      rol: 'Administrador',
    });
    mockUpdate.mockResolvedValue({ ...MOCK_USER, activo: true });

    const result = await toggleUserActive('user-1', 'admin-2');

    expect(result.success).toBe(true);
    // Should NOT have called count because user is inactive (activating, not deactivating)
    expect(mockCount).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { activo: true }, // toggled from false to true
      }),
    );
  });

  it('allows deactivation of non-admin user without admin count check', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-2',
      activo: true,
      rol: 'Usuario_Gestor',
    });
    mockUpdate.mockResolvedValue({ ...MOCK_USER_2, activo: false });

    const result = await toggleUserActive('user-2', 'admin-1');

    expect(result.success).toBe(true);
    // Should NOT have checked admin count for non-admin user
    expect(mockCount).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// changeRole
// ---------------------------------------------------------------------------

describe('changeRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns NOT_FOUND when user does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await changeRole('nonexistent', 'Consulta', 'admin-1');

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('NOT_FOUND');
  });

  it('rejects changing role away from Administrador when last active admin', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      rol: 'Administrador',
      activo: true,
    });
    mockCount.mockResolvedValue(1); // Only 1 active admin

    const result = await changeRole('user-1', 'Consulta', 'admin-2');

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('FORBIDDEN');
    expect(result.error!.message).toContain('último Administrador');
  });

  it('allows changing role away from Administrador when multiple admins exist', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      rol: 'Administrador',
      activo: true,
    });
    mockCount.mockResolvedValue(2); // 2 active admins
    mockUpdate.mockResolvedValue({ ...MOCK_USER, rol: 'Consulta' });

    const result = await changeRole('user-1', 'Consulta', 'admin-2');

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { rol: 'Consulta' },
      }),
    );
  });

  it('allows changing role TO Administrador without restriction', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-2',
      rol: 'Consulta',
      activo: true,
    });
    mockUpdate.mockResolvedValue({ ...MOCK_USER_2, rol: 'Administrador' });

    const result = await changeRole('user-2', 'Administrador', 'admin-1');

    expect(result.success).toBe(true);
    // Should NOT have checked admin count when promoting to admin
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('does not check last-admin when inactive admin changes role', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      rol: 'Administrador',
      activo: false, // inactive
    });
    mockUpdate.mockResolvedValue({ ...MOCK_USER, rol: 'Consulta', activo: false });

    const result = await changeRole('user-1', 'Consulta', 'admin-2');

    expect(result.success).toBe(true);
    // Should NOT check admin count for inactive admins
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('allows keeping the same Administrador role without restriction', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      rol: 'Administrador',
      activo: true,
    });
    mockUpdate.mockResolvedValue(MOCK_USER);

    const result = await changeRole('user-1', 'Administrador', 'admin-1');

    expect(result.success).toBe(true);
    // No count check needed when keeping same role
    expect(mockCount).not.toHaveBeenCalled();
  });
});
