import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import type { SessionData } from '@/types';
import { getSessionOptions, isSessionExpired } from '@/lib/auth/middleware-handler';

/**
 * POST /api/session/ping
 *
 * Session keep-alive endpoint. Called by the client (SessionKeepAlive) only
 * when the user has interacted with the page, so that long form-filling
 * work (typing the agenda, attaching files) does not count as inactivity.
 *
 * - 200 { authenticated: true }  → session valid, lastActivity refreshed
 * - 401 { authenticated: false } → no session or expired (30 min idle / 8 h max)
 *
 * The /api routes are outside the proxy matcher, so session validation
 * is done here with the same rules used by the proxy.
 */
export async function POST() {
  const options = getSessionOptions();
  if (!options.password || options.password.length < 32) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, options);

    if (!session.userId || isSessionExpired(session)) {
      if (session.userId) session.destroy();
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    session.lastActivity = new Date().toISOString();
    await session.save();

    return NextResponse.json(
      { authenticated: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
