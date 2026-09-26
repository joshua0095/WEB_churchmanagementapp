import { useEffect, useState } from "react";
import { getMe } from "./api";

export type Me = { name: string; photoDataUrl: string | null };

// The app shell renders several places that all need the signed-in person's name/photo at
// once (sidebar user card, mobile topbar avatar, desktop account button) — a module-level
// cache with a single shared fetch means only one of them triggers the getMe() call, and
// the rest just subscribe to whatever it resolves to. Profile.tsx calls setCachedMe right
// after a successful self-save so every mounted consumer picks up a changed name/photo
// immediately, instead of waiting for a fresh page load.
let cachedMe: Me | null = null;
let inFlight: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let failedAttempts = 0;
const listeners = new Set<(me: Me | null) => void>();

const MAX_RETRIES = 3;

/** Pass null on logout: it also forgets that a fetch happened, so the next sign-in in the
 * same tab (no page reload) fetches the new person instead of waiting on the old cache. */
export function setCachedMe(me: Me | null) {
  cachedMe = me;
  if (me === null) {
    inFlight = null;
    failedAttempts = 0;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }
  listeners.forEach((listener) => listener(me));
}

function ensureFetched() {
  if (cachedMe || inFlight || retryTimer) return;
  const request = getMe()
    .then((me) => {
      if (inFlight !== request) return; // logged out (or refetched) while this was pending
      failedAttempts = 0;
      setCachedMe(me);
    })
    .catch(() => {
      if (inFlight !== request) return;
      inFlight = null;
      // A blip right after sign-in shouldn't leave the card on "Loading…" until a reload —
      // retry a few times, backing off, while something on screen is still waiting.
      if (++failedAttempts > MAX_RETRIES || listeners.size === 0) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (listeners.size > 0) ensureFetched();
      }, 1000 * 2 ** (failedAttempts - 1));
    });
  inFlight = request;
}

/** Subscribes to the shared cache, starting the shared getMe() fetch if nothing has the
 * person yet. Falls back to the generic icon (via a null return) if that fetch keeps
 * failing — callers still render fine without a name/photo. */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(cachedMe);

  useEffect(() => {
    listeners.add(setMe);
    // The fetch may have resolved between this component's render and now — catch up.
    setMe(cachedMe);
    // After giving up on retries, the next page that needs the person gets a fresh set.
    if (failedAttempts > MAX_RETRIES) failedAttempts = 0;
    ensureFetched();
    return () => {
      listeners.delete(setMe);
    };
  }, []);

  return me;
}
