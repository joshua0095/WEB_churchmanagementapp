export interface User {
  id: string | number;
  name: string;
  email: string;
}

export interface NewUser {
  name: string;
  email: string;
}

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("VITE_API_URL is not set. Add it to your .env file.");
}

export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_URL}/api/users`);
  if (!res.ok) {
    throw new Error(`Failed to fetch users (${res.status})`);
  }
  return res.json();
}

export async function createUser(user: NewUser): Promise<User> {
  const res = await fetch(`${API_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    throw new Error(`Failed to create user (${res.status})`);
  }
  return res.json();
}
