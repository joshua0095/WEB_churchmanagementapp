import { useState } from "react";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import { CloseIcon } from "./icons";

const DISMISS_KEY = "install-banner-dismissed";

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Ignore storage failures (e.g. private browsing) — banner just reappears.
  }
}

/** Mobile-only PWA install nudge. Shown above the login form; never blocks it. */
function InstallBanner() {
  const { isMobile, isStandalone, isIos, canPromptInstall, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!isMobile || isStandalone || dismissed) return null;
  if (!isIos && !canPromptInstall) return null;

  const dismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") dismiss();
  };

  return (
    <div className="install-banner" role="region" aria-label="Install app">
      <button
        type="button"
        className="install-banner-dismiss"
        aria-label="Dismiss install prompt"
        onClick={dismiss}
      >
        <CloseIcon />
      </button>
      <p className="install-banner-title font-display">Install JIL Church</p>
      {isIos ? (
        <p className="install-banner-text">
          Tap <strong>Share</strong> <span aria-hidden="true">&#x2191;</span> then{" "}
          <strong>Add to Home Screen</strong> for quick access.
        </p>
      ) : (
        <>
          <p className="install-banner-text">Add this app to your home screen for quick access.</p>
          <button type="button" className="install-banner-cta" onClick={handleInstall}>
            Install App
          </button>
        </>
      )}
    </div>
  );
}

export default InstallBanner;
