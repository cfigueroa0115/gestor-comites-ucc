import { getIronSession, type IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { SessionData } from '@/types';

/**
 * iron-session configuration for the portal.
 * SESSION_SECRET is read directly from process.env to avoid circular imports with env.ts.
 */

export const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'gestor_comites_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 8 * 60 * 60, // 8 hours in seconds
  },
};

export type SessionType = IronSession<SessionData>;

/**
 * Retrieves the current session from the encrypted cookie.
 * This is a READ-ONLY operation — does not modify cookies.
 * lastActivity is updated by the middleware (proxy.ts) on each request.
 * Must be called within a server context (Server Component, Server Action, or Route Handler).
 */
export async function getSession(): Promise<SessionType> {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      'SESSION_SECRET environment variable is missing or less than 32 characters.',
    );
  }

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, {
    password,
    cookieName: sessionOptions.cookieName,
    cookieOptions: sessionOptions.cookieOptions,
  });

  return session;
}

/**
 * Creates a new session for the authenticated user.
 * Sets all required session fields and persists the encrypted cookie.
 */
export async function createSession(user: {
  id: string;
  nombreCompleto: string;
  usuario: string;
  cargo: string;
  rol: SessionData['rol'];
  correo: string;
}): Promise<SessionType> {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      'SESSION_SECRET environment variable is missing or less than 32 characters.',
    );
  }

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, {
    password,
    cookieName: sessionOptions.cookieName,
    cookieOptions: sessionOptions.cookieOptions,
  });

  const now = new Date().toISOString();

  session.userId = user.id;
  session.nombreCompleto = user.nombreCompleto;
  session.usuario = user.usuario;
  session.cargo = user.cargo;
  session.rol = user.rol;
  session.correo = user.correo;
  session.loginAt = now;
  session.lastActivity = now;

  await session.save();

  return session;
}

/**
 * Destroys the current session, clearing all data and removing the cookie.
 */
export async function destroySession(): Promise<void> {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      'SESSION_SECRET environment variable is missing or less than 32 characters.',
    );
  }

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, {
    password,
    cookieName: sessionOptions.cookieName,
    cookieOptions: sessionOptions.cookieOptions,
  });

  session.destroy();
}
