import { useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "../dialogs";
import {
  WAKE_NOTICE_MS,
  WAKE_SLOW_MS,
  keepWaiting,
  retryAll,
  useNow,
  usePendingRequests,
  useStartup,
} from "../../serverStatus";
import WakeScreen from "./WakeScreen";

const FADE_MS = 200;

/** Wraps the whole app. Without a saved session, covers it with the WakeScreen once startup
 * (health check + sign-in) has taken 3s+; signed-in people get the WakeBanner instead (see
 * AppShell). The app renders underneath either way and keeps its URL. */
export function StartupGate({ children }: { children: ReactNode }) {
  const startup = useStartup();
  const running = startup.step !== "done";
  const now = useNow(running, 500);

  const elapsed = now - startup.startedAt;
  const slow = startup.failed || startup.offline || now >= startup.slowAt;
  const wanted = !startup.savedSession && running && (elapsed >= WAKE_NOTICE_MS || slow);

  const [shown, setShown] = useState(false);
  const [fading, setFading] = useState(false);

  // Adjusted during render (React's "storing information from previous renders" pattern).
  if (wanted && (!shown || fading)) {
    setShown(true);
    setFading(false);
  } else if (!wanted && shown && !fading) {
    setFading(true);
  }

  useEffect(() => {
    if (!fading) return;
    const timer = setTimeout(() => {
      setShown(false);
      setFading(false);
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [fading]);

  return (
    <>
      <div className="contents" inert={shown}>
        {children}
      </div>
      {shown && (
        <WakeScreen
          startup={startup}
          now={now}
          slow={slow && !fading}
          fading={fading}
          onRetry={retryAll}
          onKeepWaiting={keepWaiting}
        />
      )}
    </>
  );
}

/** After startup: if any request is still pending after 60s, an error toast offers Try
 * again. One toast per stall; it's dismissed once the stalled requests settle. */
export function RequestWatchdog() {
  const toast = useToast();
  const startup = useStartup();
  const pending = usePendingRequests();
  const now = useNow(pending.length > 0 && startup.step === "done");
  const toastId = useRef<string | null>(null);

  const stalled = startup.step === "done" && pending.some((p) => now - p.since >= WAKE_SLOW_MS);

  useEffect(() => {
    if (stalled && !toastId.current) {
      toastId.current = toast.show({
        type: "error",
        title: "The server isn't responding",
        message: "This is taking longer than usual. Check your connection, then try again.",
        action: "Try again",
        onAction: () => {
          toastId.current = null;
          retryAll();
        },
      });
    } else if (!stalled && toastId.current) {
      toast.dismiss(toastId.current);
      toastId.current = null;
    }
  }, [stalled, toast]);

  return null;
}
