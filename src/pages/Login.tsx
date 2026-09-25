import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api";
import { setIsAdmin, setIsRegistrar, setModuleAccess, setToken } from "../auth";
import { InstallBanner, Spinner, TextField } from "../components/ui";
import { ErrorIcon, HidePasswordIcon, ShowPasswordIcon } from "../components/ui/icons";
import loginBg from "../assets/login-bg.jpg";
import logoWhite from "../assets/jil-logo-white.png";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slowServer, setSlowServer] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setSlowServer(false);
    const slowTimer = setTimeout(() => setSlowServer(true), 10000);
    try {
      const auth = await login(email, password);
      setToken(auth.token);
      setIsAdmin(auth.isAdmin);
      setIsRegistrar(auth.isRegistrar);
      setModuleAccess(auth.moduleAccess);
      navigate("/", { replace: true });
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
        </form>

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
