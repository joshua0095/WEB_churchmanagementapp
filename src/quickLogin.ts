// Accounts remembered on this device for quick sign-in (pick a person, enter a 4-digit code).
// Each entry holds the device token the server issued; the code itself is never stored.
// Storage can be unavailable (private mode, blocked site data) — then nothing is remembered.

export interface RememberedAccount {
  userId: number;
  name: string;
  photoDataUrl: string | null;
  deviceToken: string;
}

const KEY = "quickLoginAccounts";

export function getRememberedAccounts(): RememberedAccount[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as RememberedAccount[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(accounts: RememberedAccount[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(accounts));
  } catch {
    // Photos are data URLs; if they push past the quota, keep the accounts without them.
    try {
      localStorage.setItem(KEY, JSON.stringify(accounts.map((a) => ({ ...a, photoDataUrl: null }))));
    } catch {
      // storage unavailable — quick sign-in just won't be offered on this device
    }
  }
}

export function getRememberedAccount(userId: number): RememberedAccount | null {
  return getRememberedAccounts().find((a) => a.userId === userId) ?? null;
}

/** Adds or replaces this person's entry, keeping the most recent sign-in first. */
export function rememberAccount(account: RememberedAccount): void {
  save([account, ...getRememberedAccounts().filter((a) => a.userId !== account.userId)]);
}

export function forgetAccount(userId: number): void {
  save(getRememberedAccounts().filter((a) => a.userId !== userId));
}

/** Moves an account to the front after it signs in, and refreshes its name/photo. */
export function touchAccount(userId: number, update?: Partial<Pick<RememberedAccount, "name" | "photoDataUrl">>): void {
  const existing = getRememberedAccount(userId);
  if (existing) rememberAccount({ ...existing, ...update });
}
