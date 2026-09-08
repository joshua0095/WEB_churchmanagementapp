import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api";
import { setIsAdmin, setIsRegistrar, setModuleAccess, setToken } from "../auth";
import { AuthLayout, Button, InstallBanner, TextField } from "../components/ui";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
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
      setSubmitting(false);
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
      <InstallBanner />
      <form onSubmit={handleSubmit} className="auth-form">
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="m-0 text-right text-[13px]">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Logging in..." : "Log In"}
        </Button>
        {error && <p className="auth-error">{error}</p>}
      </form>
    </AuthLayout>
  );
}

export default Login;
