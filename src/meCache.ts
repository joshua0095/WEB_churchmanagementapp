import { useEffect, useState } from "react";
import { getMe } from "./api";

export type Me = { name: string; photoDataUrl: string | null };

// The app shell renders several places that all need the signed-in person's name/photo at
// once (sidebar user card, mobile topbar avatar, desktop account button) — a module-level
// cache with a single fetch-on-first-use means only one of them triggers the getMe() call,
// and the rest just subscribe to whatever it resolves to. Profile.tsx calls setCachedMe
// right after a successful self-save so every mounted consumer picks up a changed
// name/photo immediately, instead of waiting for a fresh page load.
let cachedMe: Me | null = null;
let hasFetched = false;
const listeners = new Set<(me: Me | null) => void>();

export function setCachedMe(me: Me | null) {
  cachedMe = me;
  listeners.forEach((listener) => listener(me));
}

/** Subscribes to the shared cache, kicking off the one-time getMe() fetch if nothing has
 * requested it yet. Falls back to the generic icon (via a null return) if that fetch fails —
 * callers still render fine without a name/photo. */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(cachedMe);

  useEffect(() => {
    listeners.add(setMe);
    return () => {
      listeners.delete(setMe);
    };
  }, []);

  useEffect(() => {
    if (hasFetched) return;
    hasFetched = true;
    getMe()
      .then(setCachedMe)
      .catch(() => {
        hasFetched = false;
      });
  }, []);

  return me;
}
