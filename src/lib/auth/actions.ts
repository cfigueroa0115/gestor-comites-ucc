'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';

import { loginSchema } from '@/lib/validations/auth.schema';
import { createSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { sanitizeInput } from '@/lib/utils/sanitize';
import { auditLogger } from '@/lib/services/audit.service';
import {
  MAX_FAILED_LOGIN_ATTEMPTS,
  ACCOUNT_LOCK_DURATION_MINUTES,
} from '@/lib/utils/constants';
import type { ActionResult, AuditAction } from '@/types';

// ---------------------------------------------------------------------------
// Error Messages
// ---------------------------------------------------------------------------

const GENERIC_ERROR_MESSAGE =
  'Credenciales inválidas. Por favor verifique sus datos.';

const LOCK_MESSAGE =
  'Su cuenta ha sido bloqueada temporalmente por múltiples intentos fallidos. Intente nuevamente en 15 minutos.';

// ---------------------------------------------------------------------------
// IP Address Helper
// ---------------------------------------------------------------------------

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
// Audit Logging Helper
// ---------------------------------------------------------------------------

/**
 * Logs an audit entry using the auditLogger service.
 */
function auditLog(entry: {
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadataJson?: Record<string, unknown>;
  ipAddress: string;
}): void {
  auditLogger.log({
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadataJson: entry.metadataJson,
    ipAddress: entry.ipAddress,
  });
}

// ---------------------------------------------------------------------------
// Login Action
// ---------------------------------------------------------------------------

/**
 * Server action that authenticates a user with usuario, contraseña, and cargo.
 *
 * Flow:
 * 1. Validate input with Zod schema.
 * 2. Query user by `usuario`.
 * 3. Verify user exists, is active, and is not locked.
 * 4. Compare password with bcrypt.
 * 5. Verify cargo matches.
 * 6. On success: reset failedAttempts, create session, audit log, redirect.
 * 7. On failure: increment failedAttempts, potentially lock account, audit log.
 *
 * Returns a generic error regardless of which check failed to prevent
 * credential enumeration attacks (Requirements 2.3).
 *
 * @param formData - FormData from the login form
 * @returns ActionResult on failure; redirects on success (never returns)
 */
export async function loginAction(
  formData: FormData,
): Promise<ActionResult> {
  // Get client IP address for audit logging
  const ipAddress = await getClientIp();

  // 1. Extract and validate input
  const raw = {
    usuario: formData.get('usuario'),
    contrasena: formData.get('contrasena'),
    cargo: formData.get('cargo'),
  };

  // Sanitize text inputs before validation (Req 13.4)
  const sanitizedRaw = {
    usuario: typeof raw.usuario === 'string' ? sanitizeInput(raw.usuario) : raw.usuario,
    contrasena: raw.contrasena, // Password is not sanitized to preserve valid characters
    cargo: typeof raw.cargo === 'string' ? sanitizeInput(raw.cargo) : raw.cargo,
  };

  const parsed = loginSchema.safeParse(sanitizedRaw);

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: GENERIC_ERROR_MESSAGE,
      },
    };
  }

  const { usuario, contrasena, cargo } = parsed.data;

  // 2. Query user by usuario
  const user = await prisma.user.findUnique({
    where: { usuario },
  });

  // If user does not exist, return generic error (don't reveal user existence)
  if (!user) {
    auditLog({
      action: 'LOGIN_FAILED',
      entityType: 'user',
      metadataJson: { usuario, reason: 'user_not_found' },
      ipAddress,
    });
    return {
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: GENERIC_ERROR_MESSAGE,
      },
    };
  }

  // 3. Check if user is active
  if (!user.activo) {
    auditLog({
      userId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'user',
      entityId: user.id,
      metadataJson: { usuario, reason: 'account_inactive' },
      ipAddress,
    });
    // Return the same generic error – do not reveal account status
    return {
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: GENERIC_ERROR_MESSAGE,
      },
    };
  }

  // 4. Check if account is locked
  if (user.lockedUntil && new Date() < user.lockedUntil) {
    auditLog({
      userId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'user',
      entityId: user.id,
      metadataJson: { usuario, reason: 'account_locked' },
      ipAddress,
    });
    return {
      success: false,
      error: {
        code: 'ACCOUNT_LOCKED',
        message: LOCK_MESSAGE,
      },
    };
  }

  // 5. Compare password with bcrypt
  const passwordValid = await bcrypt.compare(contrasena, user.passwordHash);

  if (!passwordValid) {
    await handleFailedAttempt(user.id, user.failedAttempts, usuario, ipAddress);
    return {
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: GENERIC_ERROR_MESSAGE,
      },
    };
  }

  // 6. Verify cargo matches
  if (user.cargo !== cargo) {
    await handleFailedAttempt(user.id, user.failedAttempts, usuario, ipAddress);
    return {
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: GENERIC_ERROR_MESSAGE,
      },
    };
  }

  // 7. Success: reset failedAttempts and clear lock
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
    },
  });

  // Create session
  await createSession({
    id: user.id,
    nombreCompleto: user.nombreCompleto,
    usuario: user.usuario,
    cargo: user.cargo,
    rol: user.rol,
    correo: user.correo,
  });

  // Audit log login success
  auditLog({
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    entityType: 'user',
    entityId: user.id,
    metadataJson: { usuario },
    ipAddress,
  });

  // Audit log session creation
  auditLog({
    userId: user.id,
    action: 'SESSION_CREATED',
    entityType: 'session',
    entityId: user.id,
    metadataJson: { usuario },
    ipAddress,
  });

  // Redirect to dashboard
  redirect('/dashboard');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Handles a failed login attempt for a known user:
 * - Increments failedAttempts
 * - If failedAttempts reaches MAX_FAILED_LOGIN_ATTEMPTS, locks the account
 * - Logs the failed attempt
 */
async function handleFailedAttempt(
  userId: string,
  currentAttempts: number,
  usuario: string,
  ipAddress: string,
): Promise<void> {
  const newAttempts = currentAttempts + 1;
  const shouldLock = newAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

  const updateData: { failedAttempts: number; lockedUntil?: Date } = {
    failedAttempts: newAttempts,
  };

  if (shouldLock) {
    const lockUntil = new Date();
    lockUntil.setMinutes(
      lockUntil.getMinutes() + ACCOUNT_LOCK_DURATION_MINUTES,
    );
    updateData.lockedUntil = lockUntil;
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  auditLog({
    userId,
    action: 'LOGIN_FAILED',
    entityType: 'user',
    entityId: userId,
    metadataJson: {
      usuario,
      reason: 'invalid_credentials',
      failedAttempts: newAttempts,
      accountLocked: shouldLock,
    },
    ipAddress,
  });
}
