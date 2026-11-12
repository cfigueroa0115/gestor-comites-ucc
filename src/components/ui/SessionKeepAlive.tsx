'use client';

import { useEffect } from 'react';
import { pingSession } from '@/lib/utils/session-client';

/** How often (at most) the session is refreshed while the user is active. */
const PING_INTERVAL_MS = 4 * 60 * 1000;

/** DOM events that count as real user activity. */
const ACTIVITY_EVENTS = ['keydown', 'mousedown', 'input', 'change', 'touchstart', 'wheel'] as const;

/**
 * SessionKeepAlive – keeps the session alive while the user is actually
 * working on the page (e.g. filling the acta form, attaching files).
 *
 * Typing in a form does not hit the server, so without this the 30-minute
 * inactivity timeout could expire mid-form and the final submit would fail.
 * The server is only pinged if there was user activity since the last ping,
 * so a truly idle tab still expires after 30 minutes as designed.
 */
export function SessionKeepAlive() {
  useEffect(() => {
    let active = false;
    const markActive = () => {
      active = true;
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, markActive, { passive: true, capture: true }),
    );

    const interval = window.setInterval(() => {
      if (!active) return;
      active = false;
      void pingSession();
    }, PING_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, markActive, { capture: true }),
      );
    };
  }, []);

  return null;
}
