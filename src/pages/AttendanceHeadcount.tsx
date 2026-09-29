import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAttendanceEvents, getHeadcount, openAttendanceSession, submitHeadcount } from "../api";
import {
  formatLongDate,
  formatWeekdayMonthDay,
  isValidIsoDate,
  setupUrl,
  todayIso,
} from "../components/attendance/attendanceFlow";
import {
  EMPTY_HEADCOUNT,
  HEADCOUNT_CATEGORIES,
  HeadcountCounters,
  headcountTotal,
  type HeadcountCounts,
} from "../components/attendance/HeadcountModal";
import { useToast } from "../components/dialogs";
import { AppShell, Button, ProfileMenu } from "../components/ui";
import { BackIcon, CalendarIcon } from "../components/ui/icons";

/** /attendance/:eventId/:date/headcount — a quick Adults / Youth / Kids count. Loads any
 * headcount already saved for that event + date so it can be corrected. The same count is
 * also reachable from the Congregation check-in screen; the two share one session. */
function AttendanceHeadcount() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams();
  const eventId = Number(params.eventId);
  const date = params.date ?? "";
  const validParams = Number.isInteger(eventId) && eventId > 0 && isValidIsoDate(date);

  const [eventName, setEventName] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [counts, setCounts] = useState<HeadcountCounts>(EMPTY_HEADCOUNT);
  const [loading, setLoading] = useState(validParams);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!validParams) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [events, session] = await Promise.all([getAttendanceEvents(), openAttendanceSession(eventId, date, "Headcount")]);
        if (cancelled) return;
        setEventName(events.find((e) => e.id === eventId)?.name ?? "");

        const headcount = await getHeadcount(session.id);
        if (cancelled) return;
        setSessionId(session.id);
        const next: HeadcountCounts = { ...EMPTY_HEADCOUNT };
        for (const entry of headcount.entries) next[entry.category] = entry.count;
        setCounts(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to open headcount");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [validParams, eventId, date]);

  const total = headcountTotal(counts);
  const backUrl = setupUrl({ event: validParams ? eventId : null, date: validParams ? date : null });
  const displayDate = validParams ? date : todayIso();

  const handleSave = async () => {
    if (sessionId === null) return;
    setSaving(true);
    try {
      await submitHeadcount(
        sessionId,
        HEADCOUNT_CATEGORIES.map((category) => ({ category, count: counts[category] })),
      );
      toast.show({ type: "success", title: "Headcount saved", message: `${total} counted in all` });
    } catch (err) {
      toast.show({ type: "error", title: "Couldn't save the headcount", message: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  let blocker: ReactNode = null;
  if (!validParams) blocker = <p>This link is missing its event or date.</p>;
  else if (error) blocker = <p>{error}</p>;

  return (
    <AppShell
      headerRight={<ProfileMenu />}
      pageClassName="att-page att-page--headcount"
      mobileFocus={{
        title: "Headcount",
        subtitle: [eventName, formatWeekdayMonthDay(displayDate)].filter(Boolean).join(" · "),
        onBack: () => navigate(backUrl),
        backLabel: "Back to attendance setup",
      }}
    >
      <div className="hc-wrap">
        <header className="att-checkin-header">
          <button type="button" className="att-back" aria-label="Back to attendance setup" onClick={() => navigate(backUrl)}>
            <BackIcon />
          </button>
          <div className="att-checkin-heading">
            <h1 className="att-checkin-title">Headcount</h1>
            <div className="att-checkin-meta">
              {eventName && <span className="att-roster-chip">{eventName}</span>}
              <span className="att-checkin-date">
                <CalendarIcon aria-hidden="true" />
                {formatLongDate(displayDate)}
              </span>
              <button type="button" className="att-link" onClick={() => navigate(backUrl)}>
                Change
              </button>
            </div>
          </div>
        </header>

        {blocker ? (
          <div className="att-empty">{blocker}</div>
        ) : (
          <>
            <p className="hc-helper">Tap + for each person. You can also tap a number to type it.</p>
            <HeadcountCounters counts={counts} onChange={setCounts} disabled={loading || saving} busy={loading} />

            <div className="att-bottom-bar att-bottom-bar--solo">
              <Button type="button" className="hc-save" onClick={() => void handleSave()} disabled={loading || saving || sessionId === null}>
                {saving ? "Saving…" : "Save headcount"}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

export default AttendanceHeadcount;
