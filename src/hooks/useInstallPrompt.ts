import { useCallback, useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 768px)";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

interface UseInstallPromptResult {
  /** True when the viewport is at or below the mobile breakpoint. */
  isMobile: boolean;
  /** True when running as an installed PWA already. */
  isStandalone: boolean;
  /** True for iOS browsers, which never fire beforeinstallprompt. */
  isIos: boolean;
  /** True once a beforeinstallprompt event has been captured and is ready to use. */
  canPromptInstall: boolean;
  /** Shows the native install prompt (Android/Chrome only). Resolves to the user's choice. */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

/** Tracks install eligibility for the PWA install banner. */
export function useInstallPrompt(): UseInstallPromptResult {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return "unavailable" as const;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    setDeferredEvent(null);
    return outcome;
  }, [deferredEvent]);

  return {
    isMobile,
    isStandalone: isStandalone(),
    isIos: isIos(),
    canPromptInstall: deferredEvent !== null,
    promptInstall,
  };
}
