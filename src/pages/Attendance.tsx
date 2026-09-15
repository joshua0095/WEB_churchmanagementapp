import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addLifeGroupMember,
  getAttendanceEvents,
  getCongregationRoster,
  getMyLifeGroups,
  getWorkerRoster,
  lifeGroupCheckIn,
  openAttendanceSession,
  setLifeGroupFirstTimer,
  undoLifeGroupCheckIn,
  type AttendanceEvent,
  type AttendanceTrackingType,
  type LifeGroup,
} from "../api";
import { isAdmin, isRegistrar } from "../auth";
import ChurchWeekPicker from "../components/ChurchWeekPicker";
import FollowUpModal from "../components/FollowUpModal";
import LifeGroupMemberList from "../components/LifeGroupMemberList";
import {
  Accordion,
  AppShell,
  Button,
  Card,
  DatePicker,
  Modal,
  ProfileMenu,
  ProgressBar,
  Skeleton,
  TextField,
} from "../components/ui";
import { AttendanceIcon, BackIcon, HeadcountIcon, LifeGroupIcon, UserListIcon } from "../components/ui/icons";
import { useLifeGroupSessions } from "../hooks/useLifeGroupSessions";
import { successToast } from "../swal";

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

type Step = "event" | "date" | "type" | "lifegroups";

function Attendance() {
  const navigate = useNavigate();
  const overseer = isAdmin() || isRegistrar();

  const [checkingAccess, setCheckingAccess] = useState(!overseer);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [myGroups, setMyGroups] = useState<LifeGroup[]>([]);
  const {
    sessions,
    expandedLoading,
    error: sessionError,
    setError: setSessionError,
    loadGroupSession,
    changeGroupDate,
    refreshGroupSession,
    patchGroupMember,
    patchGroupMemberFirstTimer,
  } = useLifeGroupSessions();
  const [addMemberGroupId, setAddMemberGroupId] = useState<number | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [followUpGroupId, setFollowUpGroupId] = useState<number | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overseer]);

  // A leader with only the one Life Group sees it as a forced-open, non-collapsible
  // Accordion — there's nothing to pick, so its session loads immediately rather than
  // waiting for a header click that will never come.
  useEffect(() => {
    if (myGroups.length !== 1) return;
    const only = myGroups[0];
    if (!sessions[only.id] && expandedLoading !== only.id) void loadGroupSession(only);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myGroups]);

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

  const singleGroup = myGroups.length === 1;

  const handleAddMember = async () => {
    if (addMemberGroupId === null || !newMemberName.trim()) return;
    setAddingMember(true);
    try {
      await addLifeGroupMember(addMemberGroupId, newMemberName.trim());
      setNewMemberName("");
      const groupId = addMemberGroupId;
      setAddMemberGroupId(null);
      await refreshGroupSession(groupId);
      successToast("Member added");
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

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
          {overseer && loadingEvents ? (
            <Skeleton className="h-14 w-full max-w-md rounded-md" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {overseer &&
                events.map((event) => (
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
              {/* A non-overseer only ever has access to their own Life Group(s) — Bible
                  Reading / WHS / Worker's Empowerment / Headcount are Admin/Registrar-only
                  at the API level, so there's nothing else to show them here. */}
              {(overseer || myGroups.length > 0) && (
                <button
                  type="button"
                  onClick={() => (overseer ? navigate("/attendance/lifegroups") : setStep("lifegroups"))}
                  className="cursor-pointer border-0 bg-transparent p-0 text-left"
                >
                  <Card className="flex items-center gap-3 !p-5">
                    <LifeGroupIcon className="h-6 w-6 shrink-0 text-[var(--color-navy)]" />
                    <span className="font-display text-lg font-bold text-[var(--color-navy)]">Life Groups</span>
                  </Card>
                </button>
              )}
            </div>
          )}
        </>
      )}

      {step === "lifegroups" && !overseer && (
        <>
          <button
            type="button"
            onClick={() => setStep("event")}
            className="mb-4 mt-2 flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-sm font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-navy)]"
          >
            <BackIcon className="h-4 w-4" /> Back
          </button>

          <p className="helper-text mb-4">
            {singleGroup ? "Take attendance for your Life Group." : "Tap a Life Group to take its attendance."}
          </p>

          {sessionError && <p className="error mb-4">{sessionError}</p>}

          <div className="flex flex-col gap-3">
            {myGroups.map((group) => {
              const session = sessions[group.id];
              return (
                <Accordion
                  key={group.id}
                  forceOpen={singleGroup}
                  header={
                    <div
                      className="flex flex-1 items-center justify-between gap-4"
                      onClick={() => {
                        if (!sessions[group.id] && expandedLoading !== group.id) void loadGroupSession(group);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <LifeGroupIcon className="h-6 w-6 shrink-0 text-[var(--color-navy)]" />
                        <div>
                          <p className="text-lg font-bold text-[var(--color-navy)]">{group.groupName}</p>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {group.category === "Community" ? "Community" : "Church"} Life Group
                          </p>
                        </div>
                      </div>
                      {session && (
                        <div className="hidden min-w-40 sm:block">
                          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                            {session.roster.checkedInCount} of {session.roster.total} present
                          </p>
                          <ProgressBar value={session.roster.checkedInCount} max={session.roster.total} />
                        </div>
                      )}
                    </div>
                  }
                >
                  {expandedLoading === group.id ? (
                    <Skeleton className="h-16 w-full rounded-md" />
                  ) : session ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        {group.category === "Community" ? (
                          <DatePicker
                            value={session.date}
                            onChange={(iso) => changeGroupDate(group, iso)}
                            className="max-w-[200px]"
                          />
                        ) : (
                          <ChurchWeekPicker
                            value={session.date}
                            onChange={(iso) => changeGroupDate(group, iso)}
                            className="max-w-[200px]"
                          />
                        )}
                      </div>
                      <LifeGroupMemberList
                        people={session.roster.people}
                        onCheckIn={(memberId) => lifeGroupCheckIn(session.sessionId, memberId)}
                        onUndo={undoLifeGroupCheckIn}
                        onToggled={(memberId, recordId) => patchGroupMember(group.id, memberId, recordId)}
                        onSetFirstTimer={setLifeGroupFirstTimer}
                        onFirstTimerToggled={(memberId, isFirstTimer) =>
                          patchGroupMemberFirstTimer(group.id, memberId, isFirstTimer)
                        }
                      />
                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setAddMemberGroupId(group.id)}
                          className="self-start"
                        >
                          + Add member
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setFollowUpGroupId(group.id)}
                          className="self-start"
                        >
                          Follow up
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="helper-text">Tap this section to load attendance.</p>
                  )}
                </Accordion>
              );
            })}
          </div>

          <FollowUpModal
            open={followUpGroupId !== null}
            onClose={() => setFollowUpGroupId(null)}
            sessionId={followUpGroupId !== null ? (sessions[followUpGroupId]?.sessionId ?? null) : null}
            people={followUpGroupId !== null ? (sessions[followUpGroupId]?.roster.people ?? []) : []}
          />

          <Modal
            open={addMemberGroupId !== null}
            onClose={() => setAddMemberGroupId(null)}
            title="Add member"
            footer={
              <>
                <Button type="button" variant="secondary" onClick={() => setAddMemberGroupId(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleAddMember} disabled={addingMember || !newMemberName.trim()}>
                  {addingMember ? "Adding..." : "Add"}
                </Button>
              </>
            }
          >
            <TextField
              label="Full name"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Enter their name"
              autoFocus
            />
          </Modal>
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
