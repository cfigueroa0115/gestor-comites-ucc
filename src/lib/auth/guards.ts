import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import type { SessionData } from '@/types';

/**
 * Role-based access guard helpers for Server Components and Server Actions.
 *
 * Each guard calls getSession() internally and verifies the appropriate
 * condition. If the check passes, the session data is returned for use
 * in the calling component. If it fails, the user is redirected.
 */

/**
 * Requires an authenticated session (any role).
 * Redirects to /login if no valid session exists.
 *
 * @returns SessionData for the authenticated user
 */
export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();

  if (!session.userId) {
    redirect('/login');
  }

  return {
    userId: session.userId,
    nombreCompleto: session.nombreCompleto,
    usuario: session.usuario,
    cargo: session.cargo,
    rol: session.rol,
    correo: session.correo,
    loginAt: session.loginAt,
    lastActivity: session.lastActivity,
  };
}

/**
 * Requires the authenticated user to have the Administrador role.
 * Redirects to /login if not authenticated, or /dashboard if role is insufficient.
 *
 * @returns SessionData for the admin user
 */
export async function requireAdmin(): Promise<SessionData> {
  const session = await requireAuth();

  if (session.rol !== 'Administrador') {
    redirect('/dashboard');
  }

  return session;
}

/**
 * Requires the authenticated user to have a role that can manage content
 * (Administrador or Usuario_Gestor). Users with Consulta role are redirected.
 * Redirects to /login if not authenticated, or /dashboard if role is Consulta.
 *
 * @returns SessionData for the gestor/admin user
 */
export async function requireGestor(): Promise<SessionData> {
  const session = await requireAuth();

  if (session.rol === 'Consulta') {
    redirect('/dashboard');
  }

  return session;
}
