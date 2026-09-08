import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  addWalkIn,
  checkInAttendance,
  editCheckInTime,
  getAttendanceEvents,
  getCongregationRoster,
  openAttendanceSession,
  undoCheckIn,
} from "../api";
import AttendanceRosterScreen from "../components/AttendanceRosterScreen";
import { AppShell, ProfileMenu } from "../components/ui";

function AttendanceCongregation() {
  const [searchParams] = useSearchParams();
  const eventId = Number(searchParams.get("eventId"));
  const date = searchParams.get("date") ?? "";

  const [eventName, setEventName] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !date) return;
    Promise.all([getAttendanceEvents(), openAttendanceSession(eventId, date)])
      .then(([events, session]) => {
        setEventName(events.find((e) => e.id === eventId)?.name ?? "");
        setSessionId(session.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to open session"));
  }, [eventId, date]);

  if (!eventId || !date) {
    return (
      <AppShell headerRight={<ProfileMenu />}>
        <p className="error">Missing event or date. Go back to Attendance and select an event.</p>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell headerRight={<ProfileMenu />}>
        <p className="error">{error}</p>
      </AppShell>
    );
  }

  if (sessionId === null) {
    return (
      <AppShell headerRight={<ProfileMenu />}>
        <p className="helper-text">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AttendanceRosterScreen
      title="Congregation"
      eventName={eventName}
      date={date}
      fetchRoster={() => getCongregationRoster(sessionId)}
      onCheckIn={(personId) => checkInAttendance(sessionId, "Attendee", personId)}
      onUndo={undoCheckIn}
      onEditTime={editCheckInTime}
      onAddWalkIn={(name) => addWalkIn(sessionId, name)}
    />
  );
}

export default AttendanceCongregation;
