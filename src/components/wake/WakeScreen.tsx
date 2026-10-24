import { formatElapsed, type StartupState } from "../../serverStatus";
import loginBg from "../../assets/login-bg.jpg";
import logoWhite from "../../assets/jil-logo-white.png";
import { RetryIcon, StepCheckIcon, WifiIcon } from "./wakeIcons";

type StepStatus = "done" | "active" | "pending";

function Step({ status, label, detail }: { status: StepStatus; label: string; detail?: string }) {
  return (
    <li className={`wake-step wake-step--${status}`}>
      <span className="wake-step-icon" aria-hidden="true">
        {status === "done" && <StepCheckIcon />}
      </span>
      <span className="wake-step-text">
        <span className="wake-step-label">
          {label}
          <span className="sr-only">{status === "done" ? " — done" : status === "active" ? " — in progress" : " — waiting"}</span>
        </span>
        {detail && <span className="wake-step-detail">{detail}</span>}
      </span>
    </li>
  );
}

interface WakeScreenProps {
  startup: StartupState;
  now: number;
  slow: boolean;
  fading: boolean;
  onRetry: () => void;
  onKeepWaiting: () => void;
}

/** Full-screen navy cover shown at launch to someone without a saved session while the
 * free server wakes up. The app stays mounted (inert) underneath, so nothing typed is lost. */
function WakeScreen({ startup, now, slow, fading, onRetry, onKeepWaiting }: WakeScreenProps) {
  const { step, offline } = startup;
  const serverStatus: StepStatus = step === "health" ? "active" : "done";
  const authStatus: StepStatus = step === "health" ? "pending" : step === "auth" ? "active" : "done";

  return (
    <main className={["wake", fading && "wake--fading"].filter(Boolean).join(" ")} aria-busy="true">
      <div className="wake-bg" aria-hidden="true">
        <img src={loginBg} alt="" decoding="async" />
      </div>

      <div className="wake-column">
        <img className="wake-logo" src={logoWhite} alt="Jesus Is Lord Church" />

        <section className="wake-card" aria-labelledby="wake-title">
          <span className="wake-ribbon" aria-hidden="true" />
          {slow ? (
            <div role="alert">
              <span className="wake-alert-icon" aria-hidden="true">
                <WifiIcon />
              </span>
              <h1 id="wake-title" className="wake-title">
                {offline ? "You're offline" : "This is taking longer than usual"}
              </h1>
              <p className="wake-text">Check that your data or Wi-Fi is on, then try again. Nothing you entered was lost.</p>
              <button type="button" className="wake-retry" onClick={onRetry}>
                <RetryIcon />
                Try again
              </button>
              <button type="button" className="wake-keep" onClick={onKeepWaiting}>
                Keep waiting
              </button>
            </div>
          ) : (
            <>
              <h1 id="wake-title" className="wake-title">
                Waking up the server
              </h1>
              <p className="wake-text">After a quiet night it can take up to a minute. Thanks for waiting.</p>
              <div className="wake-progress" role="progressbar" aria-label="Waking up the server">
                <span />
              </div>
              <ol className="wake-steps" aria-live="polite">
                <Step status={offline ? "pending" : "done"} label="Connected" />
                <Step
                  status={serverStatus}
                  label="Starting the server"
                  detail={serverStatus === "active" ? formatElapsed(now - startup.startedAt) : undefined}
                />
                <Step status={authStatus} label="Signing you in" />
              </ol>
            </>
          )}
        </section>

        {!slow && (
          <figure className="wake-verse">
            <blockquote>“Be still, and know that I am God.”</blockquote>
            <figcaption>Psalm 46:10</figcaption>
          </figure>
        )}
      </div>
    </main>
  );
}

export default WakeScreen;
