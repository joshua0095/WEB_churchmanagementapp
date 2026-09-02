import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createUser, getUsers, type User } from "../api";
import { clearToken } from "../auth";
import { AppHeader, Button, Card, TextField } from "../components/ui";

function Members() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const navigate = useNavigate();

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await getUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await createUser({ name, email });
      setName("");
      setEmail("");
      await loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <AppHeader
        title="Jesus Is Lord Church"
        actions={
          <Button variant="secondary" type="button" onClick={handleLogout}>
            Log out
          </Button>
        }
      />
      <div className="page">
        <div className="page-header">
          <h1>Church Members</h1>
        </div>

        <div className="page-sections">
          <Card>
            <h2 className="section-title">Add a member</h2>
            <form onSubmit={handleSubmit} className="user-form">
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
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding..." : "Add Member"}
              </Button>
              {formError && <p className="error">{formError}</p>}
            </form>
          </Card>

          <Card>
            <h2 className="section-title">Members</h2>
            {loading && <p className="helper-text">Loading...</p>}
            {error && <p className="error">{error}</p>}
            {!loading && !error && users.length === 0 && (
              <p className="helper-text">No members yet.</p>
            )}
            {!loading && !error && users.length > 0 && (
              <ul className="user-list">
                {users.map((user) => (
                  <li key={user.id}>
                    <strong>{user.name}</strong>
                    <span className="user-email">{user.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default Members;
