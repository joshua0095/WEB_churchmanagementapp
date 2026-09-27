import { Navigate, useSearchParams } from "react-router-dom";
import {
  LIFE_GROUPS_EVENT,
  eventCheckInUrl,
  headcountUrl,
  isValidIsoDate,
  setupUrl,
} from "../components/attendance/attendanceFlow";

interface AttendanceLegacyRedirectProps {
  to: "workers" | "congregation" | "headcount" | "lifegroups";
}

/** Sends the old query-string attendance URLs (/attendance/workers?eventId=…&date=…, etc.,
 * which bookmarks and the installed PWA may still hold) to their new path-based routes. */
function AttendanceLegacyRedirect({ to }: AttendanceLegacyRedirectProps) {
  const [searchParams] = useSearchParams();
  const eventId = Number(searchParams.get("eventId"));
  const date = searchParams.get("date");

  if (to === "lifegroups") return <Navigate to={setupUrl({ event: LIFE_GROUPS_EVENT })} replace />;
  if (!Number.isInteger(eventId) || eventId <= 0 || !isValidIsoDate(date)) return <Navigate to="/attendance" replace />;
  if (to === "headcount") return <Navigate to={headcountUrl(eventId, date)} replace />;
  return <Navigate to={eventCheckInUrl(eventId, date, to)} replace />;
}

export default AttendanceLegacyRedirect;
