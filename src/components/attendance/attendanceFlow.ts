// Shared helpers for the two-step attendance flow: Setup (/attendance) → Check-in or
// Headcount. Event + date live in the URL so a refresh or the back button never loses
// where someone was.

export type RosterKind = "workers" | "congregation";

export const ROSTER_LABELS: Record<RosterKind, string> = {
  workers: "Workers",
  congregation: "Congregation",
};

/** The Setup page's "event" param for the Life Groups card (every other event is its id). */
export const LIFE_GROUPS_EVENT = "lifegroups";

export function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayIso(): string {
  return dateToIso(new Date());
}

/** Local-midnight Date for an ISO date — tolerates the API's "2026-09-27T00:00:00" form. */
export function parseIso(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}

export function isValidIsoDate(iso: string | null | undefined): iso is string {
  return !!iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(parseIso(iso).getTime());
}

export function isSunday(iso: string): boolean {
  return parseIso(iso).getDay() === 0;
}

/** "Sun 27 Sep" */
export function formatShortDate(iso: string): string {
  const d = parseIso(iso);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${weekday} ${d.getDate()} ${month}`;
}

/** "Sunday, 27 September 2026" */
export function formatLongDate(iso: string): string {
  const d = parseIso(iso);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${weekday}, ${d.getDate()} ${month} ${d.getFullYear()}`;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** The Setup page's date chips, most recent first: the 4 most recent Sundays (including
 * today if it's Sunday) for a Sunday-only event, otherwise today and the 3 days before. */
export function recentDateOptions(sundaysOnly: boolean): string[] {
  const today = parseIso(todayIso());
  if (sundaysOnly) {
    const lastSunday = addDays(today, -today.getDay());
    return [0, 1, 2, 3].map((w) => dateToIso(addDays(lastSunday, -7 * w)));
  }
  return [0, 1, 2, 3].map((n) => dateToIso(addDays(today, -n)));
}

/** A chip's small top line — Today / Yesterday / This week / Last week, or "" further back.
 * Weeks start on Sunday, matching how the church counts them. */
export function relativeDayLabel(iso: string): string {
  const today = parseIso(todayIso());
  const d = parseIso(iso);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 0) return "";
  const weekStart = addDays(today, -today.getDay());
  if (d >= weekStart) return "This week";
  if (d >= addDays(weekStart, -7)) return "Last week";
  return "";
}

// ---------- URLs ----------

export function setupUrl(params: { event?: string | number | null; date?: string | null; group?: number | null }): string {
  const search = new URLSearchParams();
  if (params.event != null) search.set("event", String(params.event));
  if (params.group != null) search.set("group", String(params.group));
  if (params.date) search.set("date", params.date);
  const qs = search.toString();
  return qs ? `/attendance?${qs}` : "/attendance";
}

export function eventCheckInUrl(eventId: number, date: string, roster: RosterKind): string {
  return `/attendance/${eventId}/${date}/checkin?roster=${roster}`;
}

export function headcountUrl(eventId: number, date: string): string {
  return `/attendance/${eventId}/${date}/headcount`;
}

export function lifeGroupCheckInUrl(groupId: number, date: string): string {
  return `/attendance/lifegroups/${groupId}/${date}/checkin`;
}

// ---------- Remembered selection ----------

const LAST_EVENT_KEY = "attendance:lastEvent";
const LAST_GROUP_KEY = "attendance:lastLifeGroup";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage — remembering the last event is just a convenience.
  }
}

export function getLastEvent(): string | null {
  return readStorage(LAST_EVENT_KEY);
}

export function setLastEvent(event: string | number): void {
  writeStorage(LAST_EVENT_KEY, String(event));
}

export function getLastLifeGroup(): number | null {
  const raw = readStorage(LAST_GROUP_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function setLastLifeGroup(groupId: number): void {
  writeStorage(LAST_GROUP_KEY, String(groupId));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}
