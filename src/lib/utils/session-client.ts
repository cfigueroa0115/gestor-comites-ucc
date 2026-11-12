/**
 * Client-side session helpers.
 *
 * pingSession() refreshes the session's lastActivity on the server and
 * reports whether the user is still authenticated.
 */

export type SessionPingResult = 'ok' | 'expired' | 'network-error';

export async function pingSession(): Promise<SessionPingResult> {
  try {
    const res = await fetch('/api/session/ping', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (res.ok) return 'ok';
    if (res.status === 401) return 'expired';
    return 'network-error';
  } catch {
    return 'network-error';
  }
}

/** User-facing message shown when the session expired. */
export const SESSION_EXPIRED_MESSAGE =
  'Su sesión expiró por inactividad. Inicie sesión nuevamente en otra pestaña y vuelva a intentarlo.';
