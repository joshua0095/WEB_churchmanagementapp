import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { refreshSession } from "../api";
import { isAuthenticated } from "../auth";
import logoWhite from "../assets/jil-logo-white.png";
import { Spinner } from "./ui";

// Once per page load: a returning, still-signed-in person gets their session refreshed (and
// the idle server woken) behind a loading screen before the app renders. Later route changes
// skip it.
let sessionChecked = false;

/** Only shown once the check has run this long, so a fast server never flashes the note. */
const SLOW_SERVER_NOTE_DELAY_MS = 3000;

function ProtectedRoute() {
  const [checking, setChecking] = useState(!sessionChecked);
  const [slowServer, setSlowServer] = useState(false);

  useEffect(() => {
    if (sessionChecked || !isAuthenticated()) return;
    const slowTimer = setTimeout(() => setSlowServer(true), SLOW_SERVER_NOTE_DELAY_MS);
    refreshSession(true).finally(() => {
      clearTimeout(slowTimer);
      sessionChecked = true;
      setChecking(false);
    });
    return () => clearTimeout(slowTimer);
  }, []);

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (checking) {
    return (
      <div className="session-loading" role="status" aria-live="polite">
        <img className="session-loading-logo" src={logoWhite} alt="Jesus Is Lord Church" />
        <Spinner className="h-8 w-8" />
        <p className="session-loading-text">Signing you in…</p>
        {slowServer && (
          <p className="session-loading-note">
            Still working — our free server can take up to a minute to wake up after being idle.
          </p>
        )}
      </div>
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
