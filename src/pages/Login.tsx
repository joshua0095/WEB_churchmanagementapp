import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api";
import { setIsAdmin, setIsRegistrar, setModuleAccess, setToken } from "../auth";
import { AuthLayout, Button, InstallBanner, TextField } from "../components/ui";
import { ErrorIcon, HidePasswordIcon, ShowPasswordIcon } from "../components/ui/icons";

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
    <AuthLayout
      title="Log In"
      footer={
        <>
          <p className="m-0">
            Need an account? <Link to="/signup">Sign up here</Link>
          </p>
          <p className="m-0 mt-2 text-[11px] opacity-60">v{__APP_VERSION__}</p>
        </>
      }
    >
      <p className="auth-subtitle">Welcome back! Please sign in to continue.</p>
      <InstallBanner />
      <form onSubmit={handleSubmit} className="auth-form">
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type={showPassword ? "text" : "password"}
          name="password"
          autoComplete="current-password"
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
        <p className="m-0 text-right text-[13px]">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {submitting ? "Logging in..." : "Log In"}
        </Button>
        {slowServer && (
          <p className="auth-note">
            Still working — our free server can take up to a minute to wake up after being idle.
          </p>
        )}
        {error && (
          <p className="auth-error">
            <ErrorIcon aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </form>
    </AuthLayout>
  );
}

export default Login;
