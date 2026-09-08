import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAttendanceEvents,
  getCongregationRoster,
  getLifeGroupsSummary,
  getMyLifeGroups,
  getWorkerRoster,
  openAttendanceSession,
  type AttendanceEvent,
} from "../api";
import { isAdmin, isRegistrar } from "../auth";
import { AppShell, Card, Chip, ProfileMenu, ProgressBar, Skeleton } from "../components/ui";
import { AttendanceIcon, LifeGroupIcon, UserListIcon } from "../components/ui/icons";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface Progress {
  total: number;
  checkedInCount: number;
}

function Attendance() {
  const navigate = useNavigate();
  const overseer = isAdmin() || isRegistrar();
  const date = todayIso();

  const [checkingAccess, setCheckingAccess] = useState(!overseer);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [workerProgress, setWorkerProgress] = useState<Progress | null>(null);
  const [congregationProgress, setCongregationProgress] = useState<Progress | null>(null);
  const [lifeGroupProgress, setLifeGroupProgress] = useState<Progress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Life Group leaders (not Admin/Registrar) skip this hub entirely — they only
  // ever manage their own group(s), never Bible Reading / WHS / Worker's Empowerment.
  useEffect(() => {
    if (overseer) return;
    getMyLifeGroups()
      .then((groups) => {
        if (groups.length === 1) {
          navigate(`/attendance/lifegroups/${groups[0].id}`, { replace: true });
        } else if (groups.length === 0) {
          setAccessError("You don't have access to Attendance.");
          setCheckingAccess(false);
        } else {
          setCheckingAccess(false);
        }
      })
      .catch((err) => {
        setAccessError(err instanceof Error ? err.message : "Failed to load your life groups");
        setCheckingAccess(false);
      });
  }, [overseer, navigate]);

  useEffect(() => {
    if (!overseer) return;
    getAttendanceEvents()
      .then((items) => {
        setEvents(items);
        if (items.length > 0) setSelectedEventId(items[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load events"))
      .finally(() => setLoadingEvents(false));
  }, [overseer]);

  useEffect(() => {
    if (!overseer || selectedEventId === null) return;
    let cancelled = false;
    setLoadingProgress(true);
    setError(null);

    (async () => {
      try {
        const session = await openAttendanceSession(selectedEventId, date);
        const [workers, congregation, lifeGroups] = await Promise.all([
          getWorkerRoster(session.id),
          getCongregationRoster(session.id),
          getLifeGroupsSummary(date),
        ]);
        if (cancelled) return;
        setWorkerProgress({ total: workers.total, checkedInCount: workers.checkedInCount });
        setCongregationProgress({ total: congregation.total, checkedInCount: congregation.checkedInCount });
        setLifeGroupProgress({ total: lifeGroups.total, checkedInCount: lifeGroups.checkedInCount });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load attendance progress");
      } finally {
        if (!cancelled) setLoadingProgress(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [overseer, selectedEventId, date]);

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
    // A leader of more than one group lands here instead of a single group.
    return (
      <AppShell headerRight={<ProfileMenu />}>
        <div className="page-header">
          <h1>Attendance</h1>
        </div>
        <p className="helper-text">Choose which Life Group to take attendance for.</p>
      </AppShell>
    );
  }

  const goToSubModule = (path: string) => {
    if (selectedEventId === null) return;
    navigate(`/attendance/${path}?eventId=${selectedEventId}&date=${date}`);
  };

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="page-header">
        <h1>Attendance</h1>
      </div>

      <div className="mb-6 flex flex-col gap-4">
        {loadingEvents ? (
          <Skeleton className="h-12 w-full max-w-md rounded-full" />
        ) : (
          <div className="flex flex-wrap gap-3">
            {events.map((event) => (
              <Chip
                key={event.id}
                label={event.name}
                active={event.id === selectedEventId}
                onClick={() => setSelectedEventId(event.id)}
              />
            ))}
          </div>
        )}
        <p className="text-lg font-bold text-[var(--color-navy)]">{formatLongDate(date)}</p>
      </div>

      {error && <p className="error mb-4">{error}</p>}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => goToSubModule("workers")}
          disabled={selectedEventId === null}
          className="text-left disabled:cursor-not-allowed disabled:opacity-60"
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

        <button
          type="button"
          onClick={() => goToSubModule("congregation")}
          disabled={selectedEventId === null}
          className="text-left disabled:cursor-not-allowed disabled:opacity-60"
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

        <button
          type="button"
          onClick={() => navigate("/attendance/lifegroups")}
          className="text-left"
        >
          <Card className="flex flex-col gap-3 !p-6">
            <div className="flex items-center gap-3">
              <LifeGroupIcon className="h-7 w-7 text-[var(--color-navy)]" />
              <h2 className="font-display text-lg font-bold text-[var(--color-navy)]">Life Groups</h2>
            </div>
            {loadingProgress || !lifeGroupProgress ? (
              <Skeleton className="h-6 w-32" />
            ) : (
              <p className="text-base font-semibold text-[var(--color-text-secondary)]">
                {lifeGroupProgress.checkedInCount} of {lifeGroupProgress.total} checked in today
              </p>
            )}
            <ProgressBar
              value={lifeGroupProgress?.checkedInCount ?? 0}
              max={lifeGroupProgress?.total ?? 0}
            />
          </Card>
        </button>
      </div>
    </AppShell>
  );
}

export default Attendance;
