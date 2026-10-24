import { useEffect, useState } from "react";
import { getMe } from "./api";
import { getToken } from "./auth";

export type Me = { name: string; firstName?: string; photoDataUrl: string | null };

// The app shell renders several places that all need the signed-in person's name/photo at
// once (sidebar user card, mobile topbar avatar, desktop account button) — a module-level
// cache with a single shared fetch means only one of them triggers the getMe() call, and
// the rest just subscribe to whatever it resolves to. Profile.tsx calls setCachedMe right
// after a successful self-save so every mounted consumer picks up a changed name/photo
// immediately, instead of waiting for a fresh page load.
//
// The person is also kept in localStorage: on launch the shell can show their name while a
// sleeping server wakes up (see serverStatus.ts). It's still re-fetched once per page load.
const STORAGE_KEY = "authMe"; // also cleared by clearToken() in auth.ts

function readStored(): Me | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || !getToken()) return null;
    const parsed = JSON.parse(raw) as Me;
    return typeof parsed?.name === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(me: Me | null) {
  try {
    if (me) localStorage.setItem(STORAGE_KEY, JSON.stringify(me));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage full or blocked — the in-memory cache still works for this visit
  }
}

let cachedMe: Me | null = readStored();
let fetchedThisLoad = false;
let inFlight: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let failedAttempts = 0;
const listeners = new Set<(me: Me | null) => void>();

const MAX_RETRIES = 3;

/** True when a previous visit left this person cached on the device. */
export function hasCachedMe(): boolean {
  return readStored() !== null;
}

export function getCachedMe(): Me | null {
  return cachedMe;
}

/** Pass null on logout: it also forgets that a fetch happened, so the next sign-in in the
 * same tab (no page reload) fetches the new person instead of waiting on the old cache. */
export function setCachedMe(me: Me | null) {
  cachedMe = me;
  writeStored(me);
  fetchedThisLoad = me !== null;
  if (me === null) {
    inFlight = null;
    failedAttempts = 0;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }
  listeners.forEach((listener) => listener(me));
}

function ensureFetched() {
  if (fetchedThisLoad || inFlight || retryTimer) return;
  const request = getMe()
    .then((me) => {
      if (inFlight !== request) return; // logged out (or refetched) while this was pending
      inFlight = null;
      failedAttempts = 0;
      setCachedMe({ name: me.name, firstName: me.firstName, photoDataUrl: me.photoDataUrl });
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
