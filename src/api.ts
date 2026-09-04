import { clearToken, getToken } from "./auth";

export interface User {
  id: string | number;
  name: string;
  email: string;
}

export interface NewUser {
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  userId: number;
  name: string;
  email: string;
}

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("VITE_API_URL is not set. Add it to your .env file.");
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  return res;
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    throw new Error(await res.text() || `Registration failed (${res.status})`);
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await res.text() || `Login failed (${res.status})`);
  }
  return res.json();
}

export interface VerseOfTheDay {
  reference: string;
  text: string;
}

export interface BibleVersion {
  id: string;
  abbreviation: string;
  title: string;
}

export async function getVerseOfTheDay(bibleId?: string | null): Promise<VerseOfTheDay> {
  const query = bibleId ? `?bibleId=${encodeURIComponent(bibleId)}` : "";
  const res = await fetch(`${API_URL}/api/verse-of-the-day${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch verse of the day (${res.status})`);
  }
  return res.json();
}

export async function getBibleVersions(): Promise<BibleVersion[]> {
  const res = await fetch(`${API_URL}/api/verse-of-the-day/versions`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Bible versions (${res.status})`);
  }
  return res.json();
}

export async function getUsers(): Promise<User[]> {
  const res = await apiFetch("/api/users");
  if (!res.ok) {
    throw new Error(`Failed to fetch users (${res.status})`);
  }
  return res.json();
}

export async function createUser(user: NewUser): Promise<User> {
  const res = await apiFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    throw new Error(`Failed to create user (${res.status})`);
  }
  return res.json();
}

export interface Announcement {
  id: number;
  eyebrow: string | null;
  title: string | null;
  imageDataUrl: string | null;
  createdAt: string;
}

export interface AnnouncementRequest {
  eyebrow: string | null;
  title: string | null;
  imageDataUrl: string | null;
}

export async function getAnnouncements(): Promise<Announcement[]> {
  const res = await apiFetch("/api/announcements");
  if (!res.ok) {
    throw new Error(`Failed to fetch announcements (${res.status})`);
  }
  return res.json();
}

export async function createAnnouncement(announcement: AnnouncementRequest): Promise<Announcement> {
  const res = await apiFetch("/api/announcements", {
    method: "POST",
    body: JSON.stringify(announcement),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to create announcement (${res.status})`);
  }
  return res.json();
}

export async function deleteAnnouncement(id: number): Promise<void> {
  const res = await apiFetch(`/api/announcements/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete announcement (${res.status})`);
  }
}
