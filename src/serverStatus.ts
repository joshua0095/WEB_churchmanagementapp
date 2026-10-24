import { useEffect, useState, useSyncExternalStore } from "react";
import { refreshSession } from "./api";
import { getToken } from "./auth";
import { hasCachedMe } from "./meCache";

// The free Render instance sleeps when idle and takes up to a minute to start. This module
// drives the startup "waking up the server" flow (WakeScreen / WakeBanner) and tracks every
// in-flight API request so a stall later on surfaces the same way.

/** Below this, nothing extra is shown — a warm server answers well within it. */
export const WAKE_NOTICE_MS = 3_000;
/** After this, the UI switches to "taking longer than usual" + Try again. */
export const WAKE_SLOW_MS = 60_000;
const HEALTH_BUDGET_MS = 90_000;
const HEALTH_RETRY_DELAY_MS = 2_000;

const API_URL = import.meta.env.VITE_API_URL;

export type StartupStep = "health" | "auth" | "done";

export interface StartupState {
  step: StartupStep;
  /** The health check ran out of time (90s) without the server answering. */
  failed: boolean;
  /** When the flow (or the last Try again) started — the elapsed timer counts from here. */
  startedAt: number;
  /** When to switch to the slow state; "Keep waiting" pushes it another 60s out. */
  slowAt: number;
  offline: boolean;
  /** Decided once at launch: a token plus a cached user means the app shell can render
   * straight away (banner only); otherwise the full-screen WakeScreen covers the app. */
  savedSession: boolean;
  /** Set by the first successful response — the server is up from then on. */
  serverAwake: boolean;
}

export interface PendingRequest {
  since: number;
  /** Aborts the hung attempt and sends the request again (idempotent methods only). */
  retry?: () => void;
}

let state: StartupState = {
  step: "health",
  failed: false,
  startedAt: Date.now(),
  slowAt: Date.now() + WAKE_SLOW_MS,
  offline: typeof navigator !== "undefined" && !navigator.onLine,
  savedSession: false,
  serverAwake: false,
};
let runId = 0;
let runAbort: AbortController | null = null;
let healthDeadline = 0;
const pending = new Set<PendingRequest>();
let pendingSnapshot: PendingRequest[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<StartupState>) {
  state = { ...state, ...patch };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function markServerAwake() {
  if (state.serverAwake) return;
  const now = Date.now();
  // Requests that were queued behind the cold start get a fresh 3s before they count as slow.
  pending.forEach((p) => (p.since = Math.max(p.since, now)));
  pendingSnapshot = [...pending];
  setState({ serverAwake: true });
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Polls GET /api/health until it answers 200 or the (extendable) 90s budget runs out. */
async function waitForHealth(signal: AbortSignal): Promise<boolean> {
  while (!signal.aborted && Date.now() < healthDeadline) {
    const attempt = new AbortController();
    const onAbort = () => attempt.abort();
    signal.addEventListener("abort", onAbort);
    const timer = setTimeout(() => attempt.abort(), healthDeadline - Date.now());
    try {
      const res = await fetch(`${API_URL}/api/health`, { cache: "no-store", signal: attempt.signal });
      // Any non-5xx answer means the server is up (a 404 would just be an older backend
      // without this endpoint). 503 = up but the database isn't reachable yet — keep polling.
      if (res.status < 500) {
        markServerAwake();
        return true;
      }
    } catch {
      // Render's proxy error page (no CORS headers), offline, or timed out — keep polling.
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    }
    await sleep(HEALTH_RETRY_DELAY_MS, signal);
  }
  return false;
}

async function run(resetClock: boolean) {
  const id = ++runId;
  runAbort?.abort();
  const abort = new AbortController();
  runAbort = abort;
  const now = Date.now();
  healthDeadline = now + HEALTH_BUDGET_MS;
  setState({
    step: "health",
    failed: false,
    slowAt: now + WAKE_SLOW_MS,
    ...(resetClock ? { startedAt: now } : {}),
  });

  const healthy = await waitForHealth(abort.signal);
  if (id !== runId) return;
  if (!healthy) {
    setState({ failed: true });
    return;
  }

  setState({ step: "auth" });
  if (getToken()) await refreshSession(true);
  if (id !== runId) return;
  setState({ step: "done" });
}

let started = false;

/** Call once at app start (main.tsx), before the first render. */
export function startStartup() {
  if (started) return;
  started = true;
  state = { ...state, savedSession: !!getToken() && hasCachedMe() };
  window.addEventListener("online", () => setState({ offline: false }));
  window.addEventListener("offline", () => setState({ offline: true }));
  void run(true);
}

/** "Try again": restarts the whole flow (and re-sends any hung requests). */
export function retryAll() {
  if (state.step !== "done") void run(true);
  pending.forEach((p) => p.retry?.());
}

/** "Keep waiting": back to the normal state for another 60s without resetting the timer. */
export function keepWaiting() {
  const now = Date.now();
  healthDeadline = Math.max(healthDeadline, now + HEALTH_BUDGET_MS);
  if (state.failed) {
    void run(false);
  } else {
    setState({ slowAt: now + WAKE_SLOW_MS });
  }
}

export function useStartup(): StartupState {
  return useSyncExternalStore(subscribe, () => state);
}

export function usePendingRequests(): PendingRequest[] {
  return useSyncExternalStore(subscribe, () => pendingSnapshot);
}

/** Re-renders every `intervalMs` while `active` — drives the elapsed "m:ss" and the 3s/60s thresholds. */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const RETRYABLE_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);

function updatePending() {
  pendingSnapshot = [...pending];
  emit();
}

/** fetch() that registers itself as pending, so a stall shows the WakeBanner after 3s and a
 * "Try again" toast after 60s. Try again only re-sends idempotent requests — re-sending a
 * POST that may already have reached the server could create something twice. */
export function trackedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const entry: PendingRequest = { since: Date.now() };
    let attempt = 0;
    let controller: AbortController | null = null;

    const settle = () => {
      pending.delete(entry);
      updatePending();
    };

    const send = () => {
      const mine = ++attempt;
      controller = new AbortController();
      fetch(url, { ...init, signal: controller.signal }).then(
        (res) => {
          if (mine !== attempt) return;
          settle();
          if (res.status < 500) markServerAwake();
          resolve(res);
        },
        (err) => {
          if (mine !== attempt) return;
          settle();
          reject(err);
        },
      );
    };

    // Honour a caller's own abort signal.
    init.signal?.addEventListener("abort", () => {
      attempt++;
      controller?.abort();
      settle();
      reject(init.signal!.reason);
    });

    if (RETRYABLE_METHODS.has((init.method ?? "GET").toUpperCase())) {
      entry.retry = () => {
        controller?.abort();
        entry.since = Date.now();
        updatePending();
        send();
      };
    }

    pending.add(entry);
    updatePending();
    send();
  });
}
