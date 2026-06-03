/**
 * User Service Layer
 *
 * Provides CRUD operations for user management including:
 * - Paginated user listing sorted alphabetically by nombre_completo
 * - User creation with password hashing (bcrypt, 12 salt rounds)
 * - User update (nombre_completo, cargo, rol, correo — NOT password)
 * - Toggle active status with self-deactivation and last-admin protection
 * - Change role with last-admin protection
 *
 * Validates: Requirements 3.1, 3.2, 3.5, 3.6, 3.7
 */

import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/db/prisma';
import { PAGINATION } from '@/lib/utils/constants';
import type { ActionResult, Rol } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** User data returned from list/get operations (excludes sensitive fields). */
export interface UserListItem {
  id: string;
  nombreCompleto: string;
  usuario: string;
  cargo: string;
  correo: string;
  rol: Rol;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedUsers {
  users: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Alias used by the actions layer. */
export type UserListResult = PaginatedUsers;

export interface CreateUserData {
  nombreCompleto: string;
  usuario: string;
  password: string;
  cargo: string;
  correo: string;
  rol: Rol;
}

export interface UpdateUserData {
  nombreCompleto: string;
  cargo: string;
  correo: string;
  rol: Rol;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BCRYPT_SALT_ROUNDS = 12;

/** Fields to select from user queries (excludes password hash). */
const USER_SELECT = {
  id: true,
  nombreCompleto: true,
  usuario: true,
  cargo: true,
  correo: true,
  rol: true,
  activo: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Lists users with pagination, sorted alphabetically by nombre_completo.
 * Returns 20 users per page by default (PAGINATION.USERS_PER_PAGE).
 *
 * Validates: Requirement 3.1
 */
export async function listUsers(
  page: number = 1,
  pageSize: number = PAGINATION.USERS_PER_PAGE,
): Promise<ActionResult<PaginatedUsers>> {
  const skip = (page - 1) * pageSize;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { nombreCompleto: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.user.count(),
  ]);

  return {
    success: true,
    data: {
      users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Creates a new user with hashed password (bcrypt, 12 salt rounds).
 * Catches Prisma unique constraint violations for duplicate username.
 *
 * Validates: Requirements 3.2, 3.3
 */
export async function createUser(
  data: CreateUserData,
): Promise<ActionResult<UserListItem>> {
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: {
        nombreCompleto: data.nombreCompleto,
        usuario: data.usuario,
        passwordHash,
        cargo: data.cargo,
        correo: data.correo,
        rol: data.rol,
      },
      select: USER_SELECT,
    });

    return { success: true, data: user };
  } catch (error: unknown) {
    if (isDuplicateUsernameError(error)) {
      return {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'El nombre de usuario ya está en uso.',
          fieldErrors: { usuario: 'Este usuario ya existe.' },
        },
      };
    }
    throw error;
  }
}

/**
 * Updates an existing user's editable fields (nombre_completo, cargo, rol, correo).
 * Does NOT allow password changes through this function.
 *
 * Validates: Requirements 3.4, 3.5
 */
export async function updateUser(
  id: string,
  data: UpdateUserData,
): Promise<ActionResult<UserListItem>> {
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Usuario no encontrado.' },
    };
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      nombreCompleto: data.nombreCompleto,
      cargo: data.cargo,
      correo: data.correo,
      rol: data.rol,
    },
    select: USER_SELECT,
  });

  return { success: true, data: user };
}

/**
 * Toggles a user's active status.
 *
 * Enforces:
 * - Cannot deactivate own account (adminId === userId) → Req 3.6
 * - Cannot deactivate the last active Administrador → Req 3.6
 *
 * Validates: Requirements 3.5, 3.6
 */
export async function toggleUserActive(
  userId: string,
  adminId: string,
): Promise<ActionResult<UserListItem>> {
  // Prevent self-deactivation
  if (userId === adminId) {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'No puede desactivar su propia cuenta.',
      },
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, activo: true, rol: true },
  });

  if (!user) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Usuario no encontrado.' },
    };
  }

  // If deactivating an active admin, check last-admin protection
  if (user.activo && user.rol === 'Administrador') {
    const activeAdminCount = await prisma.user.count({
      where: { rol: 'Administrador', activo: true },
    });

    if (activeAdminCount <= 1) {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message:
            'No se puede desactivar al último Administrador activo del sistema.',
        },
      };
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { activo: !user.activo },
    select: USER_SELECT,
  });

  return { success: true, data: updated };
}

/**
 * Changes a user's role.
 *
 * Enforces:
 * - Cannot remove Administrador role from the last active admin → Req 3.6
 *
 * Validates: Requirements 3.6, 3.7
 */
export async function changeRole(
  userId: string,
  newRole: Rol,
  _adminId: string,
): Promise<ActionResult<UserListItem>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, rol: true, activo: true },
  });

  if (!user) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Usuario no encontrado.' },
    };
  }

  // If changing away from Administrador and user is active, check last-admin
  if (
    user.rol === 'Administrador' &&
    newRole !== 'Administrador' &&
    user.activo
  ) {
    const activeAdminCount = await prisma.user.count({
      where: { rol: 'Administrador', activo: true },
    });

    if (activeAdminCount <= 1) {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message:
            'No se puede cambiar el rol del último Administrador activo del sistema.',
        },
      };
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { rol: newRole },
    select: USER_SELECT,
  });

  return { success: true, data: updated };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Checks if a Prisma error is a unique constraint violation on the `usuario` field.
 */
function isDuplicateUsernameError(error: unknown): boolean {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  ) {
    const meta = (error as { meta?: { target?: string[] } }).meta;
    return meta?.target?.includes('usuario') ?? false;
  }
  return false;
}
