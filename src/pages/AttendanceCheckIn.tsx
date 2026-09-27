import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  addWalkIn,
  checkInAttendance,
  editCheckInTime,
  getAttendanceEvents,
  getCongregationRoster,
  getWorkerRoster,
  openAttendanceSession,
  undoCheckIn,
  type AttendanceEvent,
  type AttendanceRoster,
} from "../api";
import {
  ROSTER_LABELS,
  headcountUrl,
  isValidIsoDate,
  setupUrl,
  type RosterKind,
} from "../components/attendance/attendanceFlow";
import CheckInScreen, { type CheckInRoster } from "../components/attendance/CheckInScreen";

function toCheckInRoster(roster: AttendanceRoster): CheckInRoster {
  return {
    total: roster.total,
    checkedInCount: roster.checkedInCount,
    people: roster.people.map((p) => ({ id: p.personId, name: p.name, recordId: p.recordId, checkedInAt: p.checkedInAt })),
  };
}

/** Which roster this check-in is for — the `roster` query param when the event allows it,
 * otherwise the event's only roster (a "Both" event defaults to Congregation). */
function resolveRoster(event: AttendanceEvent, requested: string | null): RosterKind {
  if (event.rosterScope === "Workers") return "workers";
  if (event.rosterScope === "Congregation") return "congregation";
  return requested === "workers" ? "workers" : "congregation";
}

/** /attendance/:eventId/:date/checkin — named check-in for one event's Workers or
 * Congregation roster. */
function AttendanceCheckIn() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const eventId = Number(params.eventId);
  const date = params.date ?? "";
  const validParams = Number.isInteger(eventId) && eventId > 0 && isValidIsoDate(date);

  const [event, setEvent] = useState<AttendanceEvent | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [headcountOnly, setHeadcountOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!validParams) return;
    let cancelled = false;
    Promise.all([getAttendanceEvents(), openAttendanceSession(eventId, date)])
      .then(([events, session]) => {
        if (cancelled) return;
        const found = events.find((e) => e.id === eventId) ?? null;
        if (!found) {
          setError("That event no longer exists.");
          return;
        }
        setEvent(found);
        if (session.trackingType === "Headcount") setHeadcountOnly(true);
        else setSessionId(session.id);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to open attendance");
      });
    return () => {
      cancelled = true;
    };
  }, [validParams, eventId, date]);

  const roster = event ? resolveRoster(event, searchParams.get("roster")) : "congregation";

  const loadRoster = useCallback(async () => {
    if (sessionId === null) throw new Error("No session");
    const data = roster === "workers" ? await getWorkerRoster(sessionId) : await getCongregationRoster(sessionId);
    return toCheckInRoster(data);
  }, [sessionId, roster]);

  const backUrl = setupUrl({ event: validParams ? eventId : null, date: validParams ? date : null });

  let blocker = null;
  if (!validParams) {
    blocker = <div className="att-empty"><p>This link is missing its event or date.</p></div>;
  } else if (error) {
    blocker = <div className="att-empty"><p>{error}</p></div>;
  } else if (headcountOnly) {
    blocker = (
      <div className="att-empty">
        <p>This date is already being counted by headcount, so names can't be checked in for it.</p>
        <Link className="att-empty-action" to={headcountUrl(eventId, date)}>
          Go to headcount
        </Link>
      </div>
    );
  }

  return (
    <CheckInScreen
      title={event?.name ?? "Attendance"}
      rosterLabel={ROSTER_LABELS[roster]}
      date={isValidIsoDate(date) ? date : new Date().toISOString().slice(0, 10)}
      backUrl={backUrl}
      blocker={blocker}
      loadRoster={sessionId !== null ? loadRoster : undefined}
      onCheckIn={(personId) => checkInAttendance(sessionId!, roster === "workers" ? "Worker" : "Attendee", personId)}
      onUndo={undoCheckIn}
      onEditTime={editCheckInTime}
      walkIn={
        roster === "congregation" && sessionId !== null
          ? {
              label: "Add walk-in",
              submitLabel: "Add & check in",
              submit: (name) => addWalkIn(sessionId, name),
              successMessage: "Walk-in added",
            }
          : undefined
      }
    />
  );
}

export default AttendanceCheckIn;
