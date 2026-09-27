import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getAttendanceEvents,
  getHeadcount,
  openAttendanceSession,
  submitHeadcount,
  type HeadcountCategory,
} from "../api";
import {
  eventCheckInUrl,
  formatLongDate,
  formatShortDate,
  isValidIsoDate,
  setupUrl,
  todayIso,
} from "../components/attendance/attendanceFlow";
import { useToast } from "../components/dialogs";
import { AppShell, Button, ProfileMenu } from "../components/ui";
import { BackIcon, CalendarIcon } from "../components/ui/icons";

const CATEGORIES: HeadcountCategory[] = ["Adults", "Youth", "Kids"];

type Counts = Record<HeadcountCategory, number>;

const EMPTY_COUNTS: Counts = { Adults: 0, Youth: 0, Kids: 0 };

interface CounterProps {
  category: HeadcountCategory;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}

/** One headcount row: − / number / +. Tapping the number swaps it for a numeric input. */
function Counter({ category, value, onChange, disabled }: CounterProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const n = Number.parseInt(draft, 10);
    onChange(Number.isFinite(n) && n >= 0 ? n : value);
    setEditing(false);
  };

  return (
    <div className="hc-counter">
      <span className="hc-counter-label">{category}</span>
      <div className="hc-counter-controls">
        <button
          type="button"
          className="hc-step hc-step--minus"
          aria-label={`Remove one from ${category}`}
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <span aria-hidden="true">−</span>
        </button>
        {editing ? (
          <input
            ref={inputRef}
            className="hc-counter-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={`${category} count`}
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="hc-counter-value"
            aria-label={`${category}: ${value}. Tap to type a number`}
            disabled={disabled}
            onClick={() => {
              setDraft(String(value));
              setEditing(true);
            }}
          >
            {value}
          </button>
        )}
        <button
          type="button"
          className="hc-step hc-step--plus"
          aria-label={`Add one to ${category}`}
          disabled={disabled}
          onClick={() => onChange(value + 1)}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
}

/** /attendance/:eventId/:date/headcount — a quick Adults / Youth / Kids count. Loads any
 * headcount already saved for that event + date so it can be corrected. */
function AttendanceHeadcount() {
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams();
  const eventId = Number(params.eventId);
  const date = params.date ?? "";
  const validParams = Number.isInteger(eventId) && eventId > 0 && isValidIsoDate(date);

  const [eventName, setEventName] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(validParams);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rosterTracked, setRosterTracked] = useState(false);

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

        if (session.trackingType !== "Headcount") {
          setRosterTracked(true);
          return;
        }

        const headcount = await getHeadcount(session.id);
        if (cancelled) return;
        setSessionId(session.id);
        const next: Counts = { ...EMPTY_COUNTS };
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

  const total = CATEGORIES.reduce((sum, c) => sum + counts[c], 0);
  const backUrl = setupUrl({ event: validParams ? eventId : null, date: validParams ? date : null });
  const displayDate = validParams ? date : todayIso();

  const handleSave = async () => {
    if (sessionId === null) return;
    setSaving(true);
    try {
      await submitHeadcount(
        sessionId,
        CATEGORIES.map((category) => ({ category, count: counts[category] })),
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
  else if (rosterTracked)
    blocker = (
      <>
        <p>Names are already being checked in for this date, so it can't be counted by headcount too.</p>
        <Link className="att-empty-action" to={eventCheckInUrl(eventId, date, "congregation")}>
          Go to check-in
        </Link>
      </>
    );

  return (
    <AppShell
      headerRight={<ProfileMenu />}
      pageClassName="att-page att-page--headcount"
      mobileFocus={{
        title: "Headcount",
        subtitle: [eventName, formatShortDate(displayDate)].filter(Boolean).join(" · "),
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
            <div className="hc-counters" aria-busy={loading}>
              {CATEGORIES.map((category) => (
                <Counter
                  key={category}
                  category={category}
                  value={counts[category]}
                  disabled={loading || saving}
                  onChange={(value) => setCounts((prev) => ({ ...prev, [category]: value }))}
                />
              ))}
              <div className="hc-total">
                <span className="hc-total-label">Total</span>
                <span className="hc-total-value" aria-live="polite">
                  {total}
                </span>
              </div>
            </div>

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
