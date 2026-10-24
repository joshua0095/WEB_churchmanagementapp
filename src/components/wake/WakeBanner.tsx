import {
  WAKE_NOTICE_MS,
  WAKE_SLOW_MS,
  formatElapsed,
  retryAll,
  useNow,
  usePendingRequests,
  useStartup,
} from "../../serverStatus";

/** Slim notice under the app shell's top bar. Shown to a signed-in person while the server
 * wakes at launch, and whenever any request has been pending for 3s+ later on. */
function WakeBanner() {
  const startup = useStartup();
  const pending = usePendingRequests();

  // Only the saved-session launch uses the banner; everyone else sees the full WakeScreen.
  const startupPending = startup.savedSession && startup.step !== "done" && !startup.serverAwake;
  let since: number | null = startupPending ? startup.startedAt : null;
  for (const request of pending) {
    if (since === null || request.since < since) since = request.since;
  }

  const now = useNow(since !== null, 500);
  if (since === null) return null;

  const elapsed = now - since;
  const startupStuck = startupPending && (startup.failed || startup.offline);
  if (elapsed < WAKE_NOTICE_MS && !startupStuck) return null;

  const slow = startupPending ? startupStuck || now >= startup.slowAt : elapsed >= WAKE_SLOW_MS;

  return (
    <div className="wake-banner" role="status">
      {!slow && <span className="wake-banner-spinner" aria-hidden="true" />}
      <span className="wake-banner-text">
        {slow ? (
          <>
            {startup.offline ? "You're offline." : "Taking longer than usual."}{" "}
            <button type="button" className="wake-banner-retry" onClick={retryAll}>
              Try again
            </button>
          </>
        ) : (
          "Waking up the server. Your page will fill in shortly."
        )}
      </span>
      <span className="wake-banner-time">{formatElapsed(elapsed)}</span>
    </div>
  );
}

export default WakeBanner;
