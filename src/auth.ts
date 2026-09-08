const TOKEN_KEY = "authToken";
const IS_ADMIN_KEY = "authIsAdmin";
const IS_REGISTRAR_KEY = "authIsRegistrar";
const MODULE_ACCESS_KEY = "authModuleAccess";

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

export function setIsRegistrar(isRegistrar: boolean): void {
  localStorage.setItem(IS_REGISTRAR_KEY, String(isRegistrar));
}

export function isRegistrar(): boolean {
  return localStorage.getItem(IS_REGISTRAR_KEY) === "true";
}

export function setModuleAccess(moduleAccess: Record<string, boolean>): void {
  localStorage.setItem(MODULE_ACCESS_KEY, JSON.stringify(moduleAccess));
}

/** Defaults to allowed if module access hasn't been fetched yet (e.g. before the first login on this device) — the backend is the real enforcement, this only drives nav/page visibility. */
export function canAccessModule(module: string): boolean {
  const raw = localStorage.getItem(MODULE_ACCESS_KEY);
  if (!raw) return true;
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed[module] ?? true;
  } catch {
    return true;
  }
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(IS_ADMIN_KEY);
  localStorage.removeItem(IS_REGISTRAR_KEY);
  localStorage.removeItem(MODULE_ACCESS_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
