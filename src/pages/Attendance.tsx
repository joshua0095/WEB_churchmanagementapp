import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAttendanceEvents,
  getCongregationRoster,
  getMyLifeGroups,
  getWorkerRoster,
  openAttendanceSession,
  type AttendanceEvent,
  type AttendanceTrackingType,
  type LifeGroup,
} from "../api";
import { isAdmin, isRegistrar } from "../auth";
import { AppShell, Button, Card, DatePicker, ProfileMenu, ProgressBar, Skeleton } from "../components/ui";
import { AttendanceIcon, BackIcon, HeadcountIcon, LifeGroupIcon, UserListIcon } from "../components/ui/icons";

function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayIso(): string {
  return dateToIso(new Date());
}

function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// A Sunday-only event's date picker refuses every other day outright, rather than just
// suggesting one — driven by Event.sundayOnly (an admin-configurable flag, see Settings)
// instead of a name heuristic, since the events list itself is becoming dynamic.
const NON_SUNDAY_DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6];

function suggestedDateFor(event: AttendanceEvent): string {
  const now = new Date();
  if (event.sundayOnly) now.setDate(now.getDate() - now.getDay());
  return dateToIso(now);
}

interface Progress {
  total: number;
  checkedInCount: number;
}

type Step = "event" | "date" | "type";

function Attendance() {
  const navigate = useNavigate();
  const overseer = isAdmin() || isRegistrar();

  const [checkingAccess, setCheckingAccess] = useState(!overseer);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [myGroups, setMyGroups] = useState<LifeGroup[]>([]);
  const [leaderStep, setLeaderStep] = useState<"date" | "group">("date");
  const [leaderDate, setLeaderDate] = useState(todayIso());

  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("event");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());

  const [trackingType, setTrackingType] = useState<AttendanceTrackingType | null>(null);
  const [workerProgress, setWorkerProgress] = useState<Progress | null>(null);
  const [congregationProgress, setCongregationProgress] = useState<Progress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Life Group leaders (not Admin/Registrar) skip this hub entirely — they only
  // ever manage their own group(s), never Bible Reading / WHS / Worker's Empowerment.
  useEffect(() => {
    if (overseer) return;
    getMyLifeGroups()
      .then((groups) => {
        if (groups.length === 0) {
          setAccessError("You don't have access to Attendance.");
        } else {
          setMyGroups(groups);
        }
        setCheckingAccess(false);
      })
      .catch((err) => {
        setAccessError(err instanceof Error ? err.message : "Failed to load your life groups");
        setCheckingAccess(false);
      });
  }, [overseer]);

  useEffect(() => {
    if (!overseer) return;
    getAttendanceEvents()
      .then(setEvents)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load events"))
      .finally(() => setLoadingEvents(false));
  }, [overseer]);

  useEffect(() => {
    if (!overseer || selectedEventId === null || step !== "type") return;
    let cancelled = false;
    setLoadingProgress(true);
    setError(null);

    (async () => {
      try {
        const session = await openAttendanceSession(selectedEventId, date);
        if (cancelled) return;
        setTrackingType(session.trackingType);

        if (session.trackingType === "Headcount") {
          setWorkerProgress(null);
          setCongregationProgress(null);
          return;
        }

        const rosterScope = events.find((e) => e.id === selectedEventId)?.rosterScope ?? "Both";
        const [workers, congregation] = await Promise.all([
          rosterScope !== "Congregation" ? getWorkerRoster(session.id) : null,
          rosterScope !== "Workers" ? getCongregationRoster(session.id) : null,
        ]);
        if (cancelled) return;
        setWorkerProgress(workers && { total: workers.total, checkedInCount: workers.checkedInCount });
        setCongregationProgress(congregation && { total: congregation.total, checkedInCount: congregation.checkedInCount });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load attendance progress");
      } finally {
        if (!cancelled) setLoadingProgress(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [overseer, selectedEventId, date, step, events]);

  if (!overseer && checkingAccess) {
    return (
      <AppShell headerRight={<ProfileMenu />}>
        <div className="page-header">
          <h1>Attendance</h1>
        </div>
        <Skeleton className="h-24 w-full rounded-md" />
      </AppShell>
    );
  }

  if (!overseer && accessError) {
    return (
      <AppShell headerRight={<ProfileMenu />}>
        <div className="page-header">
          <h1>Attendance</h1>
        </div>
        <p className="helper-text">{accessError}</p>
      </AppShell>
    );
  }

  if (!overseer) {
    const confirmLeaderDate = (iso: string) => {
      setLeaderDate(iso);
      if (myGroups.length === 1) {
        navigate(`/attendance/lifegroups/${myGroups[0].id}?date=${iso}`);
      } else {
        setLeaderStep("group");
      }
    };

    return (
      <AppShell headerRight={<ProfileMenu />}>
        <div className="page-header">
          <h1>Attendance</h1>
        </div>

        {leaderStep === "date" && (
          <>
            <p className="helper-text mb-4">Tap the date this attendance is for.</p>
            <div className="flex justify-center">
              <DatePicker inline value={leaderDate} onChange={confirmLeaderDate} />
            </div>
          </>
        )}

        {leaderStep === "group" && (
          <>
            <button
              type="button"
              onClick={() => setLeaderStep("date")}
              className="mb-4 flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-sm font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-navy)]"
            >
              <BackIcon className="h-4 w-4" /> Change date
            </button>
            <p className="helper-text mb-4">Choose which Life Group to take attendance for.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {myGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => navigate(`/attendance/lifegroups/${group.id}?date=${leaderDate}`)}
                  className="cursor-pointer border-0 bg-transparent p-0 text-left"
                >
                  <Card className="flex items-center gap-3 !p-5">
                    <LifeGroupIcon className="h-6 w-6 shrink-0 text-[var(--color-navy)]" />
                    <span className="font-display text-lg font-bold text-[var(--color-navy)]">
                      {group.groupName}
                    </span>
                  </Card>
                </button>
              ))}
            </div>
          </>
        )}
      </AppShell>
    );
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const selectEvent = (event: AttendanceEvent) => {
    setSelectedEventId(event.id);
    setDate(suggestedDateFor(event));
    setTrackingType(null);
    setStep("date");
  };

  const goToSubModule = (path: string) => {
    if (selectedEventId === null) return;
    navigate(`/attendance/${path}?eventId=${selectedEventId}&date=${date}`);
  };

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="page-header">
        <h1>Attendance</h1>
      </div>

      {error && <p className="error mb-4">{error}</p>}

      {step === "event" && (
        <>
          <p className="helper-text mb-6">Choose what you're taking attendance for.</p>
          {loadingEvents ? (
            <Skeleton className="h-14 w-full max-w-md rounded-md" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => selectEvent(event)}
                  className="cursor-pointer border-0 bg-transparent p-0 text-left"
                >
                  <Card className="flex items-center gap-3 !p-5">
                    <AttendanceIcon className="h-6 w-6 shrink-0 text-[var(--color-navy)]" />
                    <span className="font-display text-lg font-bold text-[var(--color-navy)]">{event.name}</span>
                  </Card>
                </button>
              ))}
              <button
                type="button"
                onClick={() => navigate("/attendance/lifegroups")}
                className="cursor-pointer border-0 bg-transparent p-0 text-left"
              >
                <Card className="flex items-center gap-3 !p-5">
                  <LifeGroupIcon className="h-6 w-6 shrink-0 text-[var(--color-navy)]" />
                  <span className="font-display text-lg font-bold text-[var(--color-navy)]">Life Groups</span>
                </Card>
              </button>
            </div>
          )}
        </>
      )}

      {step === "date" && selectedEvent && (
        <>
          <button
            type="button"
            onClick={() => setStep("event")}
            className="mb-4 mt-2 flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-sm font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-navy)]"
          >
            <BackIcon className="h-4 w-4" /> Change event
          </button>
          <p className="font-display text-lg font-bold text-[var(--color-navy)]">{selectedEvent.name}</p>
          <p className="helper-text mb-4">
            Tap the date this attendance is for.
            {selectedEvent.sundayOnly && " This event is Sunday-only, so other days can't be picked."}
          </p>
          <div className="flex justify-center">
            <DatePicker
              inline
              value={date}
              onChange={(iso) => {
                setDate(iso);
                setStep("type");
              }}
              disabledDaysOfWeek={selectedEvent.sundayOnly ? NON_SUNDAY_DAYS_OF_WEEK : undefined}
            />
          </div>
        </>
      )}

      {step === "type" && selectedEvent && (
        <>
          <button
            type="button"
            onClick={() => setStep("date")}
            className="mb-4 flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-sm font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-navy)]"
          >
            <BackIcon className="h-4 w-4" /> Change date
          </button>
          <div className="mb-6">
            <p className="font-display text-lg font-bold text-[var(--color-navy)]">{selectedEvent.name}</p>
            <p className="text-base font-semibold text-[var(--color-text-secondary)]">{formatLongDate(date)}</p>
          </div>

          {trackingType === "Headcount" ? (
            <Card className="flex flex-col items-start gap-2 !p-6">
              <p className="font-display text-lg font-bold text-[var(--color-navy)]">
                This date is tracked via Headcount
              </p>
              <p className="text-base text-[var(--color-text-secondary)]">
                Named Worker/Congregation check-in isn't used for this session — go to Headcount instead.
              </p>
              <Button onClick={() => goToSubModule("headcount")}>Go to Headcount</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {selectedEvent.rosterScope !== "Congregation" && (
                <button
                  type="button"
                  onClick={() => goToSubModule("workers")}
                  className="cursor-pointer border-0 bg-transparent p-0 text-left"
                >
                  <Card className="flex flex-col gap-3 !p-6">
                    <div className="flex items-center gap-3">
                      <UserListIcon className="h-7 w-7 text-[var(--color-navy)]" />
                      <h2 className="font-display text-lg font-bold text-[var(--color-navy)]">Workers</h2>
                    </div>
                    {loadingProgress || !workerProgress ? (
                      <Skeleton className="h-6 w-32" />
                    ) : (
                      <p className="text-base font-semibold text-[var(--color-text-secondary)]">
                        {workerProgress.checkedInCount} of {workerProgress.total} checked in
                      </p>
                    )}
                    <ProgressBar value={workerProgress?.checkedInCount ?? 0} max={workerProgress?.total ?? 0} />
                  </Card>
                </button>
              )}

              {selectedEvent.rosterScope !== "Workers" && (
                <button
                  type="button"
                  onClick={() => goToSubModule("congregation")}
                  className="cursor-pointer border-0 bg-transparent p-0 text-left"
                >
                  <Card className="flex flex-col gap-3 !p-6">
                    <div className="flex items-center gap-3">
                      <AttendanceIcon className="h-7 w-7 text-[var(--color-navy)]" />
                      <h2 className="font-display text-lg font-bold text-[var(--color-navy)]">Congregation</h2>
                    </div>
                    {loadingProgress || !congregationProgress ? (
                      <Skeleton className="h-6 w-32" />
                    ) : (
                      <p className="text-base font-semibold text-[var(--color-text-secondary)]">
                        {congregationProgress.checkedInCount} of {congregationProgress.total} checked in
                      </p>
                    )}
                    <ProgressBar
                      value={congregationProgress?.checkedInCount ?? 0}
                      max={congregationProgress?.total ?? 0}
                    />
                  </Card>
                </button>
              )}

              <button
                type="button"
                onClick={() => goToSubModule("headcount")}
                className="cursor-pointer border-0 bg-transparent p-0 text-left"
              >
                <Card className="flex flex-col gap-3 !p-6">
                  <div className="flex items-center gap-3">
                    <HeadcountIcon className="h-7 w-7 text-[var(--color-navy)]" />
                    <h2 className="font-display text-lg font-bold text-[var(--color-navy)]">Headcount</h2>
                  </div>
                  <p className="text-base font-semibold text-[var(--color-text-secondary)]">
                    Quick Adults / Youth / Kids count
                  </p>
                </Card>
              </button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

export default Attendance;
