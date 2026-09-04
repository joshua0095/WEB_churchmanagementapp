import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmPasswordReset } from "../api";
import { setIsAdmin, setToken } from "../auth";
import { AuthLayout, Button, TextField } from "../components/ui";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      const auth = await confirmPasswordReset(token, newPassword);
      setToken(auth.token);
      setIsAdmin(auth.isAdmin);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      footer={
        <p className="m-0">
          <Link to="/login">Back to log in</Link>
        </p>
      }
    >
      {token ? (
        <form onSubmit={handleSubmit} className="auth-form">
          <TextField
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Resetting..." : "Reset password"}
          </Button>
          {error && <p className="auth-error">{error}</p>}
        </form>
      ) : (
        <p className="auth-error">
          This reset link is missing its token. Request a new one from the forgot password page.
        </p>
      )}
    </AuthLayout>
  );
}

export default ResetPassword;
