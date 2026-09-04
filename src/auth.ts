const TOKEN_KEY = "authToken";
const IS_ADMIN_KEY = "authIsAdmin";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function setIsAdmin(isAdmin: boolean): void {
  localStorage.setItem(IS_ADMIN_KEY, String(isAdmin));
}

export function isAdmin(): boolean {
  return localStorage.getItem(IS_ADMIN_KEY) === "true";
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(IS_ADMIN_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
