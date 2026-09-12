import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api";
import { setIsAdmin, setIsRegistrar, setModuleAccess, setToken } from "../auth";
import { AuthLayout, Button, TextField } from "../components/ui";
import { successToast } from "../swal";

function Signup() {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
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
      const auth = await register({
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        nickname: nickname.trim() || null,
        email,
        password,
      });
      setToken(auth.token);
      setIsAdmin(auth.isAdmin);
      setIsRegistrar(auth.isRegistrar);
      setModuleAccess(auth.moduleAccess);
      navigate("/", { replace: true });
      successToast(`Welcome, ${firstName.trim()}!`);
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
          label="First name"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <TextField
          label="Middle name (optional)"
          type="text"
          value={middleName}
          onChange={(e) => setMiddleName(e.target.value)}
        />
        <TextField
          label="Last name"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
        <TextField
          label="Nickname (optional)"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
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
