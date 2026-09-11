import { useEffect, useMemo, useState } from "react";
import {
  getAttendanceEvents,
  getCongregationBreakdown,
  getRetentionReport,
  type AttendanceEvent,
  type CongregationBreakdownReport,
  type CongregationBreakdownRow,
  type RetentionReport,
} from "../api";
import { isAdmin, isRegistrar } from "../auth";
import { AppShell, Card, FilterBar, ProfileMenu, SelectField, Skeleton, TextField } from "../components/ui";

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function formatWeekDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function BreakdownTable({
  title,
  weekDates,
  rows,
}: {
  title: string;
  weekDates: string[];
  rows: CongregationBreakdownRow[];
}) {
  return (
    <Card className="!p-0">
      <p className="section-title px-4 pt-4">{title}</p>
      <div className="overflow-x-auto pb-2">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-[var(--color-border)] px-3 py-2 text-left font-bold text-[var(--color-text-secondary)]">
                Category
              </th>
              {weekDates.map((d) => (
                <th
                  key={d}
                  className="border-b border-[var(--color-border)] px-3 py-2 text-center font-bold text-[var(--color-text-secondary)]"
                >
                  {formatWeekDate(d)}
                </th>
              ))}
              <th className="border-b border-[var(--color-border)] px-3 py-2 text-center font-bold text-[var(--color-text-secondary)]">
                AVE
              </th>
              <th className="border-b border-[var(--color-border)] px-3 py-2 text-center font-bold text-[var(--color-text-secondary)]">
                ACT
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={row.label === "Total" ? "font-bold" : undefined}>
                <td className="border-b border-[var(--color-border)] px-3 py-2 text-[var(--color-text-primary)]">
                  {row.label}
                </td>
                {row.weekCounts.map((count, i) => (
                  <td
                    key={i}
                    className="border-b border-[var(--color-border)] px-3 py-2 text-center text-[var(--color-text-secondary)]"
                  >
                    {count}
                  </td>
                ))}
                <td className="border-b border-[var(--color-border)] px-3 py-2 text-center text-[var(--color-text-secondary)]">
                  {row.average}
                </td>
                <td className="border-b border-[var(--color-border)] px-3 py-2 text-center text-[var(--color-text-secondary)]">
                  {row.actual}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Reports() {
  const overseer = isAdmin() || isRegistrar();

  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const { year: defaultYear, month: defaultMonth } = currentYearMonth();
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);

  const [report, setReport] = useState<CongregationBreakdownReport | null>(null);
  const [loading, setLoading] = useState(overseer);
  const [error, setError] = useState<string | null>(null);

  const [cohortDate, setCohortDate] = useState(todayIso());
  const [windowWeeks, setWindowWeeks] = useState(2);
  const [retention, setRetention] = useState<RetentionReport | null>(null);
  const [loadingRetention, setLoadingRetention] = useState(overseer);
  const [retentionError, setRetentionError] = useState<string | null>(null);

  useEffect(() => {
    if (!overseer) return;
    getAttendanceEvents()
      .then((items) => {
        setEvents(items);
        // WHS = "Worship Healing Service" — default to it when present, otherwise the first event.
        const whs = items.find((e) => e.name.toLowerCase().includes("worship healing"));
        setSelectedEventId((whs ?? items[0])?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load events"));
  }, [overseer]);

  useEffect(() => {
    if (!overseer || selectedEventId === null) return;
    setLoading(true);
    setError(null);
    getCongregationBreakdown(selectedEventId, year, month)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load report"))
      .finally(() => setLoading(false));
  }, [overseer, selectedEventId, year, month]);

  const monthValue = useMemo(() => `${year}-${String(month).padStart(2, "0")}`, [year, month]);

  useEffect(() => {
    if (!overseer || !cohortDate) return;
    setLoadingRetention(true);
    setRetentionError(null);
    getRetentionReport(cohortDate, windowWeeks)
      .then(setRetention)
      .catch((err) => setRetentionError(err instanceof Error ? err.message : "Failed to load retention report"))
      .finally(() => setLoadingRetention(false));
  }, [overseer, cohortDate, windowWeeks]);

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

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="page-header">
        <h1>Reports</h1>
      </div>

      <FilterBar
        primary={
          <SelectField
            label="Event"
            value={selectedEventId ?? ""}
            onChange={(e) => setSelectedEventId(Number(e.target.value))}
            className="sm:max-w-[280px]"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </SelectField>
        }
        className="mb-6"
      >
        <label className="ui-field sm:max-w-[200px]">
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
      </FilterBar>

      {error && <p className="error mb-4">{error}</p>}

      <Card className="mb-6 flex flex-col gap-4">
        <p className="section-title">Retention — first-timers who came back</p>
        <p className="helper-text">
          Of everyone whose very first visit fell on the chosen date, what share came back within the window.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <TextField
            label="First-timer date"
            type="date"
            value={cohortDate}
            onChange={(e) => setCohortDate(e.target.value)}
            className="sm:max-w-[220px]"
          />
          <SelectField
            label="Window"
            value={windowWeeks}
            onChange={(e) => setWindowWeeks(Number(e.target.value))}
            className="sm:max-w-[160px]"
          >
            <option value={1}>1 week</option>
            <option value={2}>2 weeks</option>
            <option value={3}>3 weeks</option>
            <option value={4}>4 weeks</option>
          </SelectField>
        </div>

        {retentionError && <p className="error">{retentionError}</p>}

        {loadingRetention ? (
          <Skeleton className="h-16 w-full max-w-sm rounded-md" />
        ) : retention && retention.firstTimersInCohort === 0 ? (
          <p className="helper-text">No one's very first visit fell on that date.</p>
        ) : (
          retention && (
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-2xl font-bold text-[var(--color-navy)]">{retention.firstTimersInCohort}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">First-timers that week</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-navy)]">{retention.returnedWithinWindow}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">Returned within the window</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-navy)]">{retention.retentionRatePct}%</p>
                <p className="text-sm text-[var(--color-text-secondary)]">Retention rate</p>
              </div>
            </div>
          )
        )}
      </Card>

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-md" />
          <Skeleton className="h-40 w-full rounded-md" />
        </div>
      ) : report && report.weekDates.length === 0 ? (
        <p className="helper-text">No sessions recorded for this event in the selected month yet.</p>
      ) : (
        report && (
          <div className="flex flex-col gap-6">
            <BreakdownTable title="Congregation — by Life Group" weekDates={report.weekDates} rows={report.byLifeGroup} />
            <BreakdownTable
              title="Congregation — First Timers by Life Group"
              weekDates={report.weekDates}
              rows={report.byLifeGroupFirstTimers}
            />
            <BreakdownTable
              title="Congregation — by Age Bracket"
              weekDates={report.weekDates}
              rows={report.byAgeBracket}
            />
            <BreakdownTable
              title="Congregation — First Timers by Age Bracket"
              weekDates={report.weekDates}
              rows={report.byAgeBracketFirstTimers}
            />
          </div>
        )
      )}
    </AppShell>
  );
}

export default Reports;
