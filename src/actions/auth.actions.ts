'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSession, destroySession } from '@/lib/auth/session';
import { auditLogger } from '@/lib/services/audit.service';

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

/**
 * Server action that logs out the current user by destroying their session
 * and redirecting to the login page.
 *
 * Audit logs the session destruction event.
 */
export async function logoutAction(): Promise<void> {
  // Retrieve session to get user info for audit logging
  const session = await getSession();
  const ipAddress = await getClientIp();

  // Audit log the session destruction/expiration event
  if (session.userId) {
    auditLogger.log({
      userId: session.userId,
      action: 'SESSION_EXPIRED',
      entityType: 'session',
      entityId: session.userId,
      metadataJson: { reason: 'user_logout', usuario: session.usuario },
      ipAddress,
    });
  }

  // Destroy the session (clears encrypted cookie)
  await destroySession();

  // Redirect to login page
  redirect('/login');
}
