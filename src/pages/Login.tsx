import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api";
import { setToken } from "../auth";
import { AuthLayout, Button, TextField } from "../components/ui";

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
          Need an account? <Link to="/signup">Sign up here</Link>
        </>
      }
    >
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
        <Button type="submit" disabled={submitting}>
          {submitting ? "Logging in..." : "Log In"}
        </Button>
        {error && <p className="auth-error">{error}</p>}
      </form>
    </AuthLayout>
  );
}

export default Login;
