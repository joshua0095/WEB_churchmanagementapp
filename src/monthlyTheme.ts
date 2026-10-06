/** Month helpers for the theme-of-the-month poster. Months are "yyyy-MM" strings, the same
 * shape the /api/monthly-theme endpoints use, and are always Manila months (the server
 * decides which one is current). */

/** "2026-10" → "October 2026" */
export function formatThemeMonth(month: string): string {
  return `${monthName(month)} ${month.slice(0, 4)}`;
}

/** "2026-10" → "October" */
export function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" });
}

/** addMonths("2026-12", 1) → "2027-01" */
export function addMonths(month: string, count: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + count, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The current month in Manila — for the rare spot that needs it before the server has answered. */
export function manilaMonth(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

/** Alt text for a theme poster: its name if one was given, otherwise "{Month Year} theme of the month". */
export function themeAltText(month: string, name: string | null): string {
  return name?.trim() || `${formatThemeMonth(month)} theme of the month`;
}
