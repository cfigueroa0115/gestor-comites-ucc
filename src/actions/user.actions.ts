'use server';

import { headers } from 'next/headers';
import { requireAdmin } from '@/lib/auth/guards';
import {
  createUserSchema,
  updateUserSchema,
  changeRoleSchema,
  toggleActiveSchema,
  listUsersSchema,
} from '@/lib/validations/user.schema';
import {
  listUsers as listUsersService,
  createUser as createUserService,
  updateUser as updateUserService,
  toggleUserActive as toggleUserActiveService,
  changeRole as changeRoleService,
} from '@/lib/services/user.service';
import { sanitizeInput } from '@/lib/utils/sanitize';
import { auditLogger } from '@/lib/services/audit.service';
import type { PaginatedUsers, UserListItem } from '@/lib/services/user.service';
import type { ActionResult } from '@/types';
import type { ZodError } from 'zod';

/**
 * Server Actions for User Administration.
 *
 * All actions:
 * 1. Validate admin role via requireAdmin() guard (throws/redirects if not admin)
 * 2. Validate input with Zod schemas
 * 3. Call service layer
 * 4. Audit log the action
 * 5. Return ActionResult<T>
 *
 * Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.7, 3.9, 11.1
 */

/**
 * Attempts to extract the client IP address from request headers.
 * Falls back to '0.0.0.0' if unavailable.
 */
async function getClientIp(): Promise<string> {
  try {
    const headersList = await headers();
    const forwarded = headersList.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const realIp = headersList.get('x-real-ip');
    if (realIp) return realIp.trim();
  } catch {
    // headers() may not be available in all contexts
  }
  return '0.0.0.0';
}

// ---------------------------------------------------------------------------
// List Users
// ---------------------------------------------------------------------------

/**
 * Server action to list all users with pagination.
 * Requires Administrador role.
 */
export async function listUsersAction(
  page: number = 1,
  pageSize: number = 20,
): Promise<ActionResult<PaginatedUsers>> {
  await requireAdmin();

  const parsed = listUsersSchema.safeParse({ page, pageSize });

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Parámetros de paginación inválidos.',
        fieldErrors: flattenZodErrors(parsed.error),
      },
    };
  }

  try {
    const result = await listUsersService(parsed.data.page, parsed.data.pageSize);
    return result;
  } catch {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener la lista de usuarios.',
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Create User
// ---------------------------------------------------------------------------

/**
 * Server action to create a new user.
 * Requires Administrador role.
 * Handles duplicate username Prisma constraint violations via service layer.
 */
export async function createUserAction(
  data: unknown,
): Promise<ActionResult<UserListItem>> {
  const session = await requireAdmin();

  // Sanitize string inputs before validation (Req 13.4)
  const sanitizedData = sanitizeUserInput(data);

  const parsed = createUserSchema.safeParse(sanitizedData);

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos de usuario inválidos.',
        fieldErrors: flattenZodErrors(parsed.error),
      },
    };
  }

  try {
    const result = await createUserService(parsed.data);

    // Audit log user creation on success
    if (result.success && result.data) {
      const ipAddress = await getClientIp();
      auditLogger.log({
        userId: session.userId,
        action: 'CREATE',
        entityType: 'user',
        entityId: result.data.id,
        metadataJson: {
          usuario: parsed.data.usuario,
          nombreCompleto: parsed.data.nombreCompleto,
          rol: parsed.data.rol,
        },
        ipAddress,
      });
    }

    return result;
  } catch {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al crear el usuario.',
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Update User
// ---------------------------------------------------------------------------

/**
 * Server action to update an existing user's editable fields.
 * Requires Administrador role.
 */
export async function updateUserAction(
  userId: string,
  data: unknown,
): Promise<ActionResult<UserListItem>> {
  const session = await requireAdmin();

  if (!userId || typeof userId !== 'string') {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'ID de usuario inválido.',
      },
    };
  }

  const parsed = updateUserSchema.safeParse(sanitizeUserInput(data));

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos de actualización inválidos.',
        fieldErrors: flattenZodErrors(parsed.error),
      },
    };
  }

  try {
    const result = await updateUserService(userId, parsed.data);

    // Audit log user update on success
    if (result.success) {
      const ipAddress = await getClientIp();
      auditLogger.log({
        userId: session.userId,
        action: 'UPDATE',
        entityType: 'user',
        entityId: userId,
        metadataJson: {
          changedFields: Object.keys(parsed.data),
          ...parsed.data,
        },
        ipAddress,
      });
    }

    return result;
  } catch {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al actualizar el usuario.',
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Toggle Active
// ---------------------------------------------------------------------------

/**
 * Server action to toggle a user's active/inactive status.
 * Requires Administrador role.
 * Prevents self-deactivation and last-admin deactivation.
 */
export async function toggleActiveAction(
  userId: string,
): Promise<ActionResult<UserListItem>> {
  const session = await requireAdmin();

  const parsed = toggleActiveSchema.safeParse({ userId });

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'ID de usuario inválido.',
        fieldErrors: flattenZodErrors(parsed.error),
      },
    };
  }

  try {
    const result = await toggleUserActiveService(parsed.data.userId, session.userId);

    // Audit log user activate/deactivate on success
    if (result.success && result.data) {
      const ipAddress = await getClientIp();
      auditLogger.log({
        userId: session.userId,
        action: 'UPDATE',
        entityType: 'user',
        entityId: parsed.data.userId,
        metadataJson: {
          action: result.data.activo ? 'activate' : 'deactivate',
          targetUser: result.data.usuario,
        },
        ipAddress,
      });
    }

    return result;
  } catch {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al cambiar el estado del usuario.',
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Change Role
// ---------------------------------------------------------------------------

/**
 * Server action to change a user's role.
 * Requires Administrador role.
 * Prevents removing the last active Administrador.
 */
export async function changeRoleAction(
  userId: string,
  rol: string,
): Promise<ActionResult<UserListItem>> {
  const session = await requireAdmin();

  const parsed = changeRoleSchema.safeParse({ userId, rol });

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos de cambio de rol inválidos.',
        fieldErrors: flattenZodErrors(parsed.error),
      },
    };
  }

  try {
    const result = await changeRoleService(
      parsed.data.userId,
      parsed.data.rol,
      session.userId,
    );

    // Audit log role change on success
    if (result.success && result.data) {
      const ipAddress = await getClientIp();
      auditLogger.log({
        userId: session.userId,
        action: 'UPDATE',
        entityType: 'user',
        entityId: parsed.data.userId,
        metadataJson: {
          action: 'change_role',
          newRole: parsed.data.rol,
          targetUser: result.data.usuario,
        },
        ipAddress,
      });
    }

    return result;
  } catch {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al cambiar el rol del usuario.',
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitizes string fields in user input data before Zod validation.
 * Only processes known text fields to avoid corrupting password or email values.
 * Validates: Requirements 13.4
 */
function sanitizeUserInput(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  const obj = data as Record<string, unknown>;
  const result = { ...obj };

  // Sanitize text fields that accept free-form input
  if (typeof result.nombreCompleto === 'string') {
    result.nombreCompleto = sanitizeInput(result.nombreCompleto);
  }
  if (typeof result.usuario === 'string') {
    result.usuario = sanitizeInput(result.usuario);
  }
  if (typeof result.cargo === 'string') {
    result.cargo = sanitizeInput(result.cargo);
  }
  // Note: correo and password are not sanitized to preserve their valid characters

  return result;
}

/**
 * Flattens Zod validation errors into a field-to-message map.
 */
function flattenZodErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (path && !fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  }
  return fieldErrors;
}
