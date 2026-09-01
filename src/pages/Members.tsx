import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createUser, getUsers, type User } from "../api";
import { clearToken } from "../auth";

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
    <div className="page">
      <div className="page-header">
        <h1>Church Members</h1>
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </div>

      <section className="card">
        <h2>Add a member</h2>
        <form onSubmit={handleSubmit} className="user-form">
          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add member"}
          </button>
          {formError && <p className="error">{formError}</p>}
        </form>
      </section>

      <section className="card">
        <h2>Members</h2>
        {loading && <p>Loading...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && users.length === 0 && <p>No members yet.</p>}
        {!loading && !error && users.length > 0 && (
          <ul className="user-list">
            {users.map((user) => (
              <li key={user.id}>
                <strong>{user.name}</strong> — {user.email}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default Members;
