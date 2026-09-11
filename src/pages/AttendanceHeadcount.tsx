import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getAttendanceEvents,
  getHeadcount,
  openAttendanceSession,
  submitHeadcount,
  type HeadcountCategory,
} from "../api";
import { successToast } from "../swal";
import { AppShell, Button, Card, IconButton, ProfileMenu, Skeleton, TextField } from "../components/ui";
import { BackIcon } from "../components/ui/icons";

const CATEGORIES: HeadcountCategory[] = ["Adults", "Youth", "Kids"];

function AttendanceHeadcount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = Number(searchParams.get("eventId"));
  const date = searchParams.get("date") ?? "";

  const [eventName, setEventName] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<HeadcountCategory, string>>({ Adults: "", Youth: "", Kids: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !date) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [events, session] = await Promise.all([
          getAttendanceEvents(),
          openAttendanceSession(eventId, date, "Headcount"),
        ]);
        if (cancelled) return;
        setEventName(events.find((e) => e.id === eventId)?.name ?? "");

        if (session.trackingType !== "Headcount") {
          setError(
            "This event's session for this date is already tracked with named check-in (Workers/Congregation), not headcount.",
          );
          return;
        }

        const headcount = await getHeadcount(session.id);
        if (cancelled) return;
        setSessionId(session.id);
        const next: Record<HeadcountCategory, string> = { Adults: "", Youth: "", Kids: "" };
        for (const entry of headcount.entries) next[entry.category] = String(entry.count);
        setCounts(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to open headcount session");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, date]);

  if (!eventId || !date) {
    return (
      <AppShell headerRight={<ProfileMenu />}>
        <p className="error">Missing event or date. Go back to Attendance and select an event.</p>
      </AppShell>
    );
  }

  const total = CATEGORIES.reduce((sum, c) => sum + (Number(counts[c]) || 0), 0);

  const handleSubmit = async () => {
    if (sessionId === null) return;
    setSaving(true);
    setError(null);
    try {
      const entries = CATEGORIES.map((category) => ({ category, count: Number(counts[category]) || 0 }));
      await submitHeadcount(sessionId, entries);
      successToast("Headcount saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save headcount");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="mb-6 flex items-start gap-4">
        <IconButton
          aria-label="Back to Attendance"
          onClick={() => navigate("/attendance")}
          className="mt-1 !h-11 !w-11 border border-[var(--color-border)] !text-[var(--color-navy)]"
        >
          <BackIcon />
        </IconButton>
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-navy)]">Headcount — {eventName}</h1>
          <p className="mt-1 text-base font-semibold text-[var(--color-text-secondary)]">{date}</p>
        </div>
      </div>

      {error && <p className="error mb-4">{error}</p>}

      {loading ? (
        <Skeleton className="h-64 w-full max-w-md rounded-md" />
      ) : sessionId !== null && (
        <Card className="flex max-w-md flex-col gap-4">
          {CATEGORIES.map((category) => (
            <TextField
              key={category}
              label={category}
              type="number"
              min={0}
              inputMode="numeric"
              value={counts[category]}
              onChange={(e) => setCounts((prev) => ({ ...prev, [category]: e.target.value }))}
            />
          ))}
          <p className="text-base font-semibold text-[var(--color-text-secondary)]">Total: {total}</p>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : "Save headcount"}
          </Button>
        </Card>
      )}
    </AppShell>
  );
}

export default AttendanceHeadcount;
