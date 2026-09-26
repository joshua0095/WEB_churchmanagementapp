import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDevotionMonthlyReport, monthLabel, type DevotionReportRow } from "../api";
import { isAdmin, isMis } from "../auth";
import { AppShell, Card, IconButton, ProfileMenu, Skeleton } from "../components/ui";
import { BackIcon } from "../components/ui/icons";

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

interface ReportRowComputed {
  row: DevotionReportRow;
  weekCounts: number[];
  total: number;
}

interface CalendarWeek {
  startDay: number;
  endDay: number;
}

// Devotions are daily, so the report uses real Sunday–Saturday calendar weeks clipped to
// the month (e.g. Sep 2026: 1–5, 6–12, 13–19, 20–26, 27–30) — never more than 7 days each.
// Not api.ts's weekNumberOfMonth: that one is for Sunday attendance and folds the days
// before the month's first Sunday into week 1, which made a daily streak read as 12.
function calendarWeeksOfMonth(year: number, month: number): CalendarWeek[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks: CalendarWeek[] = [];
  for (let start = 1; start <= daysInMonth; ) {
    const end = Math.min(daysInMonth, start + (6 - ((firstWeekday + start - 1) % 7)));
    weeks.push({ startDay: start, endDay: end });
    start = end + 1;
  }
  return weeks;
}

function calendarWeekIndex(day: number, year: number, month: number): number {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  return Math.floor((day + firstWeekday - 1) / 7);
}

// Counts entries per week rather than just marking presence — the count is how many days
// that week the worker journaled, out of the week's length shown in the column header.
function computeRows(rows: DevotionReportRow[], year: number, month: number, totalWeeks: number): ReportRowComputed[] {
  return rows.map((row) => {
    const weekCounts = Array(totalWeeks).fill(0);
    for (const date of row.dates) {
      const [y, m, d] = date.slice(0, 10).split("-").map(Number);
      if (y !== year || m !== month) continue;
      const w = calendarWeekIndex(d, year, month);
      if (w >= 0 && w < totalWeeks) weekCounts[w]++;
    }
    const total = weekCounts.reduce((sum, c) => sum + c, 0);
    return { row, weekCounts, total };
  });
}

function ReportsDevotions() {
  const navigate = useNavigate();
  const overseer = isAdmin() || isMis();

  const { year: defaultYear, month: defaultMonth } = currentYearMonth();
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [rows, setRows] = useState<DevotionReportRow[] | null>(null);
  const [loading, setLoading] = useState(overseer);
  const [error, setError] = useState<string | null>(null);

  const monthValue = useMemo(() => `${year}-${String(month).padStart(2, "0")}`, [year, month]);
  const weeks = useMemo(() => calendarWeeksOfMonth(year, month), [year, month]);
  const totalWeeks = weeks.length;
  const shortMonth = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short" });

  useEffect(() => {
    if (!overseer) return;
    setLoading(true);
    setError(null);
    getDevotionMonthlyReport(year, month)
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load report"))
      .finally(() => setLoading(false));
  }, [overseer, year, month]);

  if (!overseer) {
    return (
      <AppShell headerRight={<ProfileMenu />}>
        <div className="page-header">
          <h1>Reports</h1>
        </div>
        <p className="helper-text">You don't have access to Reports.</p>
      </AppShell>
    );
  }

  const computed = rows ? computeRows(rows, year, month, totalWeeks) : [];
  const weekTotals = Array.from({ length: totalWeeks }, (_, i) => computed.reduce((sum, c) => sum + c.weekCounts[i], 0));
  const grandTotal = weekTotals.reduce((sum, c) => sum + c, 0);

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="mb-6 flex items-center gap-4">
        <IconButton
          aria-label="Back to Reports"
          onClick={() => navigate("/reports")}
          className="!h-11 !w-11 border border-[var(--color-border)] !text-[var(--color-navy)]"
        >
          <BackIcon />
        </IconButton>
        <h1 className="font-display text-2xl font-bold text-[var(--color-navy)]">Devotions</h1>
      </div>

      <label className="ui-field mb-6 sm:max-w-[200px]">
        <span className="ui-field-label">Month</span>
        <input
          type="month"
          className="ui-field-input"
          value={monthValue}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            if (y && m) {
              setYear(y);
              setMonth(m);
            }
          }}
        />
      </label>

      {error && <p className="error mb-4">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      ) : (
        <Card className="!p-0">
          <div className="overflow-x-auto pb-2">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="border-b-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left align-bottom text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]"
                  >
                    No.
                  </th>
                  <th
                    rowSpan={2}
                    className="border-b-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left align-bottom text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]"
                  >
                    Names
                  </th>
                  <th
                    colSpan={totalWeeks + 1}
                    className="rounded-t-sm bg-[var(--color-navy)] px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-white"
                  >
                    {monthLabel(`${monthValue}-01`)}
                  </th>
                </tr>
                <tr>
                  {weeks.map((week, i) => (
                    <th
                      key={i}
                      className="border-b-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]"
                    >
                      Week {i + 1}
                      <span className="mt-0.5 block whitespace-nowrap text-[11px] font-semibold normal-case tracking-normal">
                        {shortMonth} {week.startDay}
                        {week.endDay !== week.startDay && `–${week.endDay}`}
                      </span>
                    </th>
                  ))}
                  <th className="border-b-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {computed.map(({ row, weekCounts, total }, i) => (
                  <tr key={row.userId}>
                    <td className="border-b border-[var(--color-border)] px-3 py-2 text-[var(--color-text-secondary)]">
                      {i + 1}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-2 text-[var(--color-text-primary)]">
                      {row.userName}
                    </td>
                    {weekCounts.map((count, w) => (
                      <td
                        key={w}
                        className="border-b border-[var(--color-border)] px-3 py-2 text-center text-[var(--color-text-secondary)]"
                      >
                        {count}
                      </td>
                    ))}
                    <td className="border-b border-[var(--color-border)] px-3 py-2 text-center font-bold text-[var(--color-danger)]">
                      {total}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right font-bold text-[var(--color-text-primary)]">Total</td>
                  {weekTotals.map((count, w) => (
                    <td key={w} className="px-3 py-2 text-center font-bold text-[var(--color-text-primary)]">
                      {count}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold text-[var(--color-danger)]">{grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}

export default ReportsDevotions;
