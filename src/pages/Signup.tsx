import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api";
import { setToken } from "../auth";
import { AuthLayout, Button, TextField } from "../components/ui";

function Signup() {
  const [name, setName] = useState("");
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
      const auth = await register(name, email, password);
      setToken(auth.token);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Sign Up"
      footer={
        <>
          Already have an account? <Link to="/login">Log in here</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <TextField
          label="Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
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
          minLength={8}
          required
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Sign Up"}
        </Button>
        {error && <p className="auth-error">{error}</p>}
      </form>
    </AuthLayout>
  );
}

export default Signup;
