import type { NextRequest } from 'next/server';
import { handleProtectedRoute } from '@/lib/auth/middleware-handler';

/**
 * Next.js proxy (middleware) for session validation and route protection.
 * Intercepts all requests to protected routes and validates the session cookie.
 *
 * - Decrypts and validates session on every protected request
 * - Checks session expiry: 30-minute inactivity OR 8-hour absolute limit
 * - Updates lastActivity timestamp on valid requests
 * - Redirects to /login if session is invalid or expired
 * - Public routes (/, /login) bypass this proxy entirely
 *
 * Note: In Next.js 16, the "middleware" convention was renamed to "proxy".
 * This file uses the proxy.ts convention with export function proxy().
 * The core logic lives in src/lib/auth/middleware-handler.ts for testability.
 */
export async function proxy(request: NextRequest) {
  return handleProtectedRoute(request);
}

/**
 * Matcher configuration: only run proxy on protected routes.
 * Public routes (/, /login) are excluded and don't require session validation.
 */
export const config = {
  matcher: ['/dashboard/:path*', '/actas/:path*', '/admin/:path*'],
};
