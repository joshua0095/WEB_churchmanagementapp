import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDevotionMonthlyReport, monthLabel, weekNumberOfMonth, weeksInMonth, type DevotionReportRow } from "../api";
import { isAdmin, isRegistrar } from "../auth";
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

// Counts entries per week rather than just marking presence — a worker can log more than
// one devotion in the same week, and each one should add to that week's cell.
function computeRows(rows: DevotionReportRow[], totalWeeks: number): ReportRowComputed[] {
  return rows.map((row) => {
    const weekCounts = Array(totalWeeks).fill(0);
    for (const date of row.dates) {
      const w = weekNumberOfMonth(date.slice(0, 10));
      if (w >= 1 && w <= totalWeeks) weekCounts[w - 1]++;
    }
    const total = weekCounts.reduce((sum, c) => sum + c, 0);
    return { row, weekCounts, total };
  });
}

function ReportsDevotions() {
  const navigate = useNavigate();
  const overseer = isAdmin() || isRegistrar();

  const { year: defaultYear, month: defaultMonth } = currentYearMonth();
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [rows, setRows] = useState<DevotionReportRow[] | null>(null);
  const [loading, setLoading] = useState(overseer);
  const [error, setError] = useState<string | null>(null);

  const monthValue = useMemo(() => `${year}-${String(month).padStart(2, "0")}`, [year, month]);
  const totalWeeks = useMemo(() => weeksInMonth(`${monthValue}-01`), [monthValue]);

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

  const computed = rows ? computeRows(rows, totalWeeks) : [];
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
                  {Array.from({ length: totalWeeks }, (_, i) => (
                    <th
                      key={i}
                      className="border-b-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]"
                    >
                      Week {i + 1}
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
