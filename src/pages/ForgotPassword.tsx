import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { requestPasswordReset } from "../api";
import { AuthLayout, Button, TextField } from "../components/ui";
import { infoAlert } from "../swal";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      await infoAlert("If that email is registered, a reset link has been sent.", "Check your email");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot Password"
      footer={
        <p className="m-0">
          Remembered it? <Link to="/login">Back to log in</Link>
        </p>
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
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending..." : "Send reset link"}
        </Button>
        {error && <p className="auth-error">{error}</p>}
      </form>
    </AuthLayout>
  );
}

export default ForgotPassword;
