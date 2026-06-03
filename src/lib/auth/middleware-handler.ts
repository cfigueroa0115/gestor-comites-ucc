import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import type { SessionData } from '@/types';
import {
  SESSION_INACTIVITY_TIMEOUT_MINUTES,
  SESSION_MAX_LIFETIME_HOURS,
} from '@/lib/utils/constants';

/**
 * Session options for iron-session in middleware context.
 * Mirrors the configuration in src/lib/auth/session.ts.
 */
export function getSessionOptions() {
  return {
    password: process.env.SESSION_SECRET as string,
    cookieName: 'gestor_comites_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: 8 * 60 * 60, // 8 hours in seconds
    },
  };
}

/**
 * Checks whether a session has expired due to inactivity (30 min)
 * or absolute lifetime (8 hours since login).
 */
export function isSessionExpired(session: SessionData): boolean {
  const now = Date.now();

  // Check inactivity timeout (30 minutes)
  if (session.lastActivity) {
    const lastActivity = new Date(session.lastActivity).getTime();
    const inactivityLimitMs = SESSION_INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
    if (now - lastActivity > inactivityLimitMs) {
      return true;
    }
  }

  // Check absolute session lifetime (8 hours)
  if (session.loginAt) {
    const loginTime = new Date(session.loginAt).getTime();
    const maxLifetimeMs = SESSION_MAX_LIFETIME_HOURS * 60 * 60 * 1000;
    if (now - loginTime > maxLifetimeMs) {
      return true;
    }
  }

  return false;
}

/**
 * Handles session validation and route protection for protected routes.
 * Returns a NextResponse — either a redirect to /login or the pass-through response
 * with an updated session cookie.
 */
export async function handleProtectedRoute(request: NextRequest): Promise<NextResponse> {
  const sessionPassword = process.env.SESSION_SECRET;

  // If SESSION_SECRET is not configured, deny access to protected routes
  if (!sessionPassword || sessionPassword.length < 32) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  // Create a response to pass to iron-session (needed for cookie updates)
  const response = NextResponse.next();

  try {
    // Use the (req, res, options) overload of getIronSession.
    // iron-session reads cookies from request.headers.get("cookie")
    // and writes updated cookie via response.headers.append("set-cookie", ...)
    const session = await getIronSession<SessionData>(
      request,
      response,
      getSessionOptions(),
    );

    // Check if session has a userId (i.e., user is logged in)
    if (!session.userId) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl, { status: 302 });
    }

    // Check session expiry (inactivity or absolute lifetime)
    if (isSessionExpired(session)) {
      // Destroy the session cookie
      session.destroy();
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl, { status: 302 });
    }

    // Session is valid — update lastActivity timestamp
    session.lastActivity = new Date().toISOString();
    await session.save();

    // Return the response with updated session cookie
    return response;
  } catch {
    // If decryption fails or any error occurs, redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl, { status: 302 });
  }
}
