const TOKEN_KEY = "authToken";
const IS_ADMIN_KEY = "authIsAdmin";
const IS_MIS_KEY = "authIsMis";
// Pre-MIS builds cached the (now removed) Registrar flag here — only ever cleared, never read.
const LEGACY_IS_REGISTRAR_KEY = "authIsRegistrar";
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

/** Member of the Management Information System network — the overseer role alongside Admin. */
export function setIsMis(isMis: boolean): void {
  localStorage.setItem(IS_MIS_KEY, String(isMis));
}

export function isMis(): boolean {
  return localStorage.getItem(IS_MIS_KEY) === "true";
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
  localStorage.removeItem(IS_MIS_KEY);
  localStorage.removeItem(LEGACY_IS_REGISTRAR_KEY);
  localStorage.removeItem(MODULE_ACCESS_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/** Same precedence as the badge shown on the My Profile page (Admin > MIS > Member),
 * but derived from the login-time flags cached here rather than a fresh User fetch — for
 * places like the sidebar user card that only need a role label, not the full profile. */
export function getRoleLabel(): string {
  if (isAdmin()) return "Admin";
  if (isMis()) return "MIS";
  return "Member";
}
