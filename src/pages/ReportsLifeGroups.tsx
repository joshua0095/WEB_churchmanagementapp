import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getLifeGroupMonthlyReport, weekNumberOfMonth, weeksInMonth, type LifeGroupReportRow } from "../api";
import { isAdmin, isRegistrar } from "../auth";
import { AppShell, Card, IconButton, ProfileMenu, Skeleton } from "../components/ui";
import { BackIcon } from "../components/ui/icons";

// Matches the church's own LGN letter codes — display order follows the paper report
// (Heterogeneous, then the homogeneous networks: Men, Women, Young Adult, Kids, Children).
const NETWORK_ORDER = ["Heterogeneous Network", "Men's Network", "Women's Network", "Young Adult Network", "KKB", "Children's Network"];
const NETWORK_LETTER: Record<string, string> = {
  "Heterogeneous Network": "H",
  "Men's Network": "M",
  "Women's Network": "W",
  "Young Adult Network": "Y",
  KKB: "K",
  "Children's Network": "C",
};

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

interface ReportRowComputed {
  row: LifeGroupReportRow;
  letter: string;
  average: number;
  actual: number;
  firstTimerTotal: number;
  weekCounts: (number | null)[];
}

function computeRows(rows: LifeGroupReportRow[], totalWeeks: number): ReportRowComputed[] {
  return rows.map((row) => {
    const sorted = [...row.sessions].sort((a, b) => a.date.localeCompare(b.date));
    const weekCounts: (number | null)[] = Array(totalWeeks).fill(null);
    for (const s of sorted) {
      const w = weekNumberOfMonth(s.date);
      if (w >= 1 && w <= totalWeeks) weekCounts[w - 1] = s.checkedIn;
    }
    const average = sorted.length === 0 ? 0 : round1(sorted.reduce((sum, s) => sum + s.checkedIn, 0) / sorted.length);
    const actual = sorted.length === 0 ? 0 : sorted[sorted.length - 1].checkedIn;
    const firstTimerTotal = sorted.reduce((sum, s) => sum + s.firstTimerCount, 0);
    const letter = (row.networkName && NETWORK_LETTER[row.networkName]) ?? row.networkName ?? "—";
    return { row, letter, average, actual, firstTimerTotal, weekCounts };
  });
}

function networkSortIndex(networkName: string | null): number {
  if (!networkName) return NETWORK_ORDER.length;
  const i = NETWORK_ORDER.indexOf(networkName);
  return i === -1 ? NETWORK_ORDER.length : i;
}

function ReportsLifeGroups() {
  const navigate = useNavigate();
  const overseer = isAdmin() || isRegistrar();

  const { year: defaultYear, month: defaultMonth } = currentYearMonth();
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [rows, setRows] = useState<LifeGroupReportRow[] | null>(null);
  const [loading, setLoading] = useState(overseer);
  const [error, setError] = useState<string | null>(null);

  const monthValue = useMemo(() => `${year}-${String(month).padStart(2, "0")}`, [year, month]);
  const totalWeeks = useMemo(() => weeksInMonth(`${monthValue}-01`), [monthValue]);

  useEffect(() => {
    if (!overseer) return;
    setLoading(true);
    setError(null);
    getLifeGroupMonthlyReport(year, month)
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

  const computed = rows
    ? computeRows(rows, totalWeeks).sort((a, b) => {
        const byNetwork = networkSortIndex(a.row.networkName) - networkSortIndex(b.row.networkName);
        return byNetwork !== 0 ? byNetwork : a.row.groupName.localeCompare(b.row.groupName);
      })
    : [];

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
        <h1 className="font-display text-2xl font-bold text-[var(--color-navy)]">Life Groups</h1>
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
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-[var(--color-border)] px-3 py-2 text-left font-bold text-[var(--color-text-secondary)]">
                    LGN
                  </th>
                  <th className="border-b border-[var(--color-border)] px-3 py-2 text-left font-bold text-[var(--color-text-secondary)]">
                    Code
                  </th>
                  <th className="border-b border-[var(--color-border)] px-3 py-2 text-left font-bold text-[var(--color-text-secondary)]">
                    Leader
                  </th>
                  <th className="border-b border-[var(--color-border)] px-3 py-2 text-center font-bold text-[var(--color-text-secondary)]">
                    Average
                  </th>
                  <th className="border-b border-[var(--color-border)] px-3 py-2 text-center font-bold text-[var(--color-text-secondary)]">
                    Actual
                  </th>
                  <th className="border-b border-[var(--color-border)] px-3 py-2 text-center font-bold text-[var(--color-text-secondary)]">
                    First Timer
                  </th>
                  {Array.from({ length: totalWeeks }, (_, i) => (
                    <th
                      key={i}
                      className="border-b border-[var(--color-border)] px-3 py-2 text-center font-bold text-[var(--color-text-secondary)]"
                    >
                      Week {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {computed.map(({ row, letter, average, actual, firstTimerTotal, weekCounts }) => (
                  <tr key={row.id}>
                    <td className="border-b border-[var(--color-border)] px-3 py-2 font-bold text-[var(--color-navy)]">
                      {letter}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-2 text-[var(--color-text-primary)]">
                      {row.groupName}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-2 text-[var(--color-text-primary)]">
                      {row.leaderName}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-2 text-center text-[var(--color-text-secondary)]">
                      {average}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-2 text-center text-[var(--color-text-secondary)]">
                      {actual}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-2 text-center text-[var(--color-text-secondary)]">
                      {firstTimerTotal}
                    </td>
                    {weekCounts.map((count, i) => (
                      <td
                        key={i}
                        className="border-b border-[var(--color-border)] px-3 py-2 text-center text-[var(--color-text-secondary)]"
                      >
                        {count ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}

export default ReportsLifeGroups;
