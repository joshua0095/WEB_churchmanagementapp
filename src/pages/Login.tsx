import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMe, login, quickLogin, registerQuickDevice, forgetQuickDevice, QuickLoginError, type AuthResponse } from "../api";
import { setIsAdmin, setIsMis, setModuleAccess, setToken } from "../auth";
import { setCachedMe } from "../meCache";
import { InstallBanner, Spinner, TextField } from "../components/ui";
import { ErrorIcon, HidePasswordIcon, ShowPasswordIcon } from "../components/ui/icons";
import loginBg from "../assets/login-bg.jpg";
import logoWhite from "../assets/jil-logo-white.png";
import PinPad from "../components/PinPad";
import PinSetupFlow from "../components/PinSetupFlow";
import {
  forgetAccount,
  getRememberedAccount,
  getRememberedAccounts,
  rememberAccount,
  touchAccount,
  type RememberedAccount,
} from "../quickLogin";

type Stage = "pick" | "pin" | "password" | "offer";

const DECLINED_KEY_PREFIX = "quickLoginDeclined:";

function hasDeclinedOffer(userId: number): boolean {
  try {
    return localStorage.getItem(DECLINED_KEY_PREFIX + userId) === "true";
  } catch {
    return false;
  }
}

function declineOffer(userId: number): void {
  try {
    localStorage.setItem(DECLINED_KEY_PREFIX + userId, "true");
  } catch {
    // not remembered — they will just be asked again next time
  }
}

/** Kept local (not PeopleShared) so the login screen does not pull in the photo cropper. */
function AccountAvatar({ account, large }: { account: Pick<RememberedAccount, "name" | "photoDataUrl">; large?: boolean }) {
  const initials = account.name
    .split(/s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  return account.photoDataUrl ? (
    <img className="quick-avatar" data-large={large || undefined} src={account.photoDataUrl} alt="" />
  ) : (
    <span className="quick-avatar" data-large={large || undefined} aria-hidden="true">
      {initials || "?"}
    </span>
  );
}

function firstName(name: string): string {
  return name.split(/s+/)[0] ?? name;
}

function Login() {
  const [accounts, setAccounts] = useState(getRememberedAccounts);
  const [stage, setStage] = useState<Stage>(() => (getRememberedAccounts().length > 0 ? "pick" : "password"));
  const [selected, setSelected] = useState<RememberedAccount | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLocked, setPinLocked] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinResetKey, setPinResetKey] = useState(0);
  const [pendingAuth, setPendingAuth] = useState<AuthResponse | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slowServer, setSlowServer] = useState(false);
  const navigate = useNavigate();

  const applyAuth = (auth: AuthResponse) => {
    setToken(auth.token);
    setIsAdmin(auth.isAdmin);
    setIsMis(auth.isMis);
    setModuleAccess(auth.moduleAccess);
    setCachedMe(null); // fetch this person fresh, never a previous session's cached name/photo
  };

  const goHome = () => navigate("/", { replace: true });

  const chooseAccount = (account: RememberedAccount) => {
    setSelected(account);
    setPinError(null);
    setPinLocked(false);
    setPinResetKey((k) => k + 1);
    setStage("pin");
  };

  const removeAccount = (account: RememberedAccount) => {
    forgetAccount(account.userId);
    void forgetQuickDevice(account.deviceToken);
    const rest = getRememberedAccounts();
    setAccounts(rest);
    if (rest.length === 0) setStage("password");
  };

  const handlePin = async (pin: string) => {
    if (!selected) return;
    setPinBusy(true);
    setPinError(null);
    try {
      const auth = await quickLogin(selected.deviceToken, pin);
      applyAuth(auth);
      touchAccount(auth.userId, { name: auth.name });
      goHome();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      if (err instanceof QuickLoginError && err.status === 410) {
        // This device was forgotten or the code turned off — it can never work from here.
        forgetAccount(selected.userId);
        setAccounts(getRememberedAccounts());
        setEmail("");
        setError(message);
        setStage("password");
        return;
      }
      if (err instanceof QuickLoginError && err.status === 423) setPinLocked(true);
      setPinError(message);
      setPinResetKey((k) => k + 1);
    } finally {
      setPinBusy(false);
    }
  };

  // After a password sign-in on a device that doesn't remember this person yet.
  const finishOffer = async (pin: string) => {
    if (!pendingAuth) return;
    const deviceToken = await registerQuickDevice(pin);
    let photoDataUrl: string | null = null;
    try {
      photoDataUrl = (await getMe()).photoDataUrl ?? null;
    } catch {
      // initials are fine
    }
    rememberAccount({ userId: pendingAuth.userId, name: pendingAuth.name, photoDataUrl, deviceToken });
    goHome();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setSlowServer(false);
    const slowTimer = setTimeout(() => setSlowServer(true), 10000);
    try {
      const auth = await login(email, password);
      applyAuth(auth);
      if (getRememberedAccount(auth.userId)) {
        touchAccount(auth.userId, { name: auth.name });
        goHome();
      } else if (hasDeclinedOffer(auth.userId)) {
        goHome();
      } else {
        setPendingAuth(auth);
        setStage("offer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      clearTimeout(slowTimer);
      setSubmitting(false);
      setSlowServer(false);
    }
  };

  return (
    <div className="login-page">
      {/* Decorative photo backdrop — the page itself is navy, so it already looks right
          before the image has loaded. */}
      <div className="login-hero">
        <img className="login-hero-photo" src={loginBg} alt="" decoding="async" />
        <div className="login-hero-overlay" aria-hidden="true" />
        <img className="login-logo" src={logoWhite} alt="Jesus Is Lord Church" />
        <div className="login-hero-copy">
          <p className="login-hero-eyebrow">JIL Church Norzagaray</p>
          <p className="login-hero-title">Welcome home.</p>
          <p className="login-hero-text">
            Devotions, attendance and announcements for our church family, all in one place.
          </p>
        </div>
      </div>

      {/* Empty unless the (mobile-only) install prompt renders — see .login-banner-slot. */}
      <div className="login-banner-slot">
        <InstallBanner />
      </div>

      <main className="login-card">
        <span className="login-ribbon" aria-hidden="true" />

        {stage === "pick" && (
          <>
            <p className="login-eyebrow">Log in</p>
            <h1 className="login-title">Who's signing in?</h1>
            <p className="login-subtitle">Choose your account, then enter your 4-digit code.</p>
            <ul className="quick-accounts">
              {accounts.map((account) => (
                <li key={account.userId} className="quick-account">
                  <button type="button" className="quick-account-pick" onClick={() => chooseAccount(account)}>
                    <AccountAvatar account={account} />
                    <span className="quick-account-name">{account.name}</span>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m8 5 5 5-5 5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="quick-account-remove"
                    onClick={() => removeAccount(account)}
                    aria-label={`Remove ${account.name} from this device`}
                    title="Remove from this device"
                  >
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                      <path d="m6 6 8 8M14 6l-8 8" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="quick-link" onClick={() => setStage("password")}>
              Sign in with email &amp; password
            </button>
          </>
        )}

        {stage === "pin" && selected && (
          <div className="quick-pin">
            <AccountAvatar account={selected} large />
            <h1 className="login-title">Hi, {firstName(selected.name)}</h1>
            <p className="login-subtitle">Enter your 4-digit code.</p>
            <PinPad onComplete={handlePin} resetKey={pinResetKey} error={pinError} disabled={pinBusy || pinLocked} />
            <p className="pin-setup-error" role="alert">
              {pinBusy ? "Signing in…" : pinError}
            </p>
            <div className="quick-pin-links">
              <button type="button" className="quick-link" onClick={() => setStage("pick")}>
                Not you?
              </button>
              <button
                type="button"
                className="quick-link"
                onClick={() => {
                  setError(null);
                  setStage("password");
                }}
              >
                Use email &amp; password
              </button>
            </div>
          </div>
        )}

        {stage === "offer" && pendingAuth && (
          <div className="quick-pin">
            <p className="login-eyebrow">Quick sign-in</p>
            <h1 className="login-title">Sign in faster next time</h1>
            <p className="login-subtitle">
              {pendingAuth.hasQuickPin
                ? "Use your 4-digit code on this device too."
                : "Set a 4-digit code and just tap your name next time on this device."}
            </p>
            <PinSetupFlow mode={pendingAuth.hasQuickPin ? "verify" : "create"} onSubmit={finishOffer} />
            <div className="quick-pin-links">
              <button type="button" className="quick-link" onClick={goHome}>
                Not now
              </button>
              <button
                type="button"
                className="quick-link"
                onClick={() => {
                  declineOffer(pendingAuth.userId);
                  goHome();
                }}
              >
                Don't ask again
              </button>
            </div>
          </div>
        )}

        {stage === "password" && (
        <>
        <p className="login-eyebrow">Log in</p>
        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">Sign in to continue to JIL Norzagaray Connect.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <TextField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="flex flex-col gap-2.5">
            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              endAdornment={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <HidePasswordIcon /> : <ShowPasswordIcon />}
                </button>
              }
            />
            <p className="login-forgot">
              <Link to="/forgot-password">Forgot password?</Link>
            </p>
          </div>

          {error && (
            <p className="login-error" role="alert">
              <ErrorIcon aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting && <Spinner />}
            {submitting ? "Logging in…" : "Log in"}
          </button>

          {slowServer && (
            <p className="login-note">
              Still working — our free server can take up to a minute to wake up after being idle.
            </p>
          )}

          {accounts.length > 0 && (
            <button type="button" className="quick-link" onClick={() => setStage("pick")}>
              Back to quick sign-in
            </button>
          )}
        </form>
        </>
        )}

        <div className="login-footer">
          <p className="m-0">
            New to JIL Connect? <Link to="/signup">Create an account</Link>
          </p>
          <p className="login-version">v{__APP_VERSION__}</p>
        </div>
      </main>
    </div>
  );
}

export default Login;
