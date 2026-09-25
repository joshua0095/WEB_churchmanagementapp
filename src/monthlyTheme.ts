/** The church's theme of the month, shown as a card on the Home screen.
 *
 * Update this each month. Set it to `null` (or leave `title` empty) to hide the card —
 * the announcements card then takes the full row. */
export interface MonthlyTheme {
  /** Shown as "{month} · Theme of the month", e.g. "September 2026". */
  month: string;
  /** The one-word focus shown above the title, e.g. "Breakthrough". */
  keyword: string;
  title: string;
  /** Key verses, shown under the divider joined by " · ". */
  verses: string[];
}

export const monthlyTheme: MonthlyTheme | null = {
  month: "September 2026",
  keyword: "Breakthrough",
  title: "Goodness That Transforms",
  verses: ["Romans 12:9", "Psalm 37:3"],
};
