import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createLifeGroup,
  getAttendanceEvents,
  getLifeGroups,
  getMyLifeGroups,
  getUsers,
  type AttendanceEvent,
  type LifeGroupCategory,
  type User,
} from "../api";
import { isAdmin, isMis } from "../auth";
import {
  LIFE_GROUPS_EVENT,
  ROSTER_LABELS,
  eventCheckInUrl,
  formatShortDate,
  getLastEvent,
  getLastLifeGroup,
  headcountUrl,
  isSunday,
  isValidIsoDate,
  lifeGroupCheckInUrl,
  recentDateOptions,
  relativeDayLabel,
  setLastEvent,
  setLastLifeGroup,
  type RosterKind,
} from "../components/attendance/attendanceFlow";
import { Modal, useToast } from "../components/dialogs";
import { AppShell, Button, DatePicker, ProfileMenu, SelectField, Skeleton, TextField } from "../components/ui";
import { AttendanceIcon, BackIcon, CalendarIcon, HeadcountIcon, LifeGroupIcon } from "../components/ui/icons";
import { CheckThinIcon } from "../components/ui/shellIcons";

interface GroupOption {
  id: number;
  groupName: string;
  category: LifeGroupCategory;
}

// A Sunday-only event's "Other date" calendar refuses every other day outright.
const NON_SUNDAY_DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6];

function rostersFor(event: AttendanceEvent): RosterKind[] {
  if (event.rosterScope === "Workers") return ["workers"];
  if (event.rosterScope === "Congregation") return ["congregation"];
  return ["workers", "congregation"];
}

/** The card's meta line, built from the event's settings (Settings → Attendance). */
function eventMeta(event: AttendanceEvent): string {
  const days = event.sundayOnly ? "Sundays only" : "Any day";
  const roster = event.rosterScope === "Both" ? "Workers & Congregation" : event.rosterScope;
  return `${days} · ${roster}`;
}

function parseGroupParam(raw: string | null): number | null {
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

interface EventCardProps {
  selected: boolean;
  icon: ReactNode;
  name: string;
  meta: string;
  onSelect: () => void;
}

function EventCard({ selected, icon, name, meta, onSelect }: EventCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={["att-event", selected && "att-event--selected"].filter(Boolean).join(" ")}
      onClick={onSelect}
    >
      <span className="att-event-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="att-event-text">
        <span className="att-event-name">{name}</span>
        <span className="att-event-meta">{meta}</span>
      </span>
      <span className="att-event-check" aria-hidden="true">
        {selected && <CheckThinIcon strokeWidth={3} />}
      </span>
    </button>
  );
}

interface CountCardProps {
  to: string;
  primary?: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
}

function CountCard({ to, primary, icon, title, description, onClick }: CountCardProps) {
  return (
    <Link to={to} onClick={onClick} className={["att-count", primary && "att-count--primary"].filter(Boolean).join(" ")}>
      <span className="att-count-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="att-count-text">
        <span className="att-count-title">{title}</span>
        <span className="att-count-desc">{description}</span>
      </span>
      <BackIcon className="att-count-arrow" aria-hidden="true" />
    </Link>
  );
}

/** Step 1 of the attendance flow — event, date and how to count on one page. Tapping a
 * "how to count" card goes straight to Check-in or Headcount; the selections live in the
 * URL so Back/Change from there lands right here with them intact. */
function Attendance() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const overseer = isAdmin() || isMis();

  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eventKey, setEventKey] = useState<string | null>(() => searchParams.get("event") ?? getLastEvent());
  const [groupId, setGroupId] = useState<number | null>(() => parseGroupParam(searchParams.get("group")) ?? getLastLifeGroup());
  const [date, setDate] = useState<string | null>(() => {
    const d = searchParams.get("date");
    return isValidIsoDate(d) ? d : null;
  });
  const [otherDateOpen, setOtherDateOpen] = useState(false);

  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newLeaderId, setNewLeaderId] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [addGroupError, setAddGroupError] = useState<string | null>(null);

  // Admin/MIS see every event plus every life group. Anyone else only ever takes
  // attendance for the life group(s) they lead — the other events are Admin/MIS-only at
  // the API level — so for them this page is just the Life Groups path.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (overseer) {
          const [loadedEvents, loadedGroups] = await Promise.all([getAttendanceEvents(), getLifeGroups()]);
          if (cancelled) return;
          setEvents(loadedEvents);
          setGroups(loadedGroups);
        } else {
          const mine = await getMyLifeGroups();
          if (cancelled) return;
          if (mine.length === 0) setError("You don't have access to Attendance.");
          setGroups(mine);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load attendance");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [overseer]);

  // Once loaded, drop a remembered/URL selection that no longer exists, and fall back to
  // a sensible default so there's always something selected.
  useEffect(() => {
    if (loading) return;
    const eventValid =
      (eventKey === LIFE_GROUPS_EVENT && groups.length > 0) || (overseer && events.some((e) => String(e.id) === eventKey));
    if (!eventValid) {
      const fallback = overseer && events.length > 0 ? String(events[0].id) : groups.length > 0 ? LIFE_GROUPS_EVENT : null;
      if (fallback !== eventKey) {
        setEventKey(fallback);
        setDate(null);
      }
    }
    if (groupId === null || !groups.some((g) => g.id === groupId)) {
      const fallbackGroup = groups.length === 1 ? groups[0].id : null;
      if (fallbackGroup !== groupId) setGroupId(fallbackGroup);
    }
  }, [loading, overseer, events, groups, eventKey, groupId]);

  const isLifeGroups = eventKey === LIFE_GROUPS_EVENT;
  const selectedEvent = !isLifeGroups ? events.find((e) => String(e.id) === eventKey) : undefined;
  const selectedGroup = isLifeGroups ? groups.find((g) => g.id === groupId) : undefined;
  // A Church life group's session is always that week's Sunday, so it gets Sunday chips
  // just like a Sunday-only event; a Community group can meet any day.
  const sundaysOnly = isLifeGroups ? selectedGroup?.category !== "Community" : !!selectedEvent?.sundayOnly;
  const dateReady = isLifeGroups ? !!selectedGroup : !!selectedEvent;
  const dateOptions = recentDateOptions(sundaysOnly);
  const effectiveDate = date && (!sundaysOnly || isSunday(date)) ? date : dateOptions[0];
  const pickedOutsideOptions = !dateOptions.includes(effectiveDate);

  // Mirrors the selection into the URL (replace, not push) so a refresh keeps it and the
  // check-in page's Back/Change can link straight back to it.
  const paramsString = searchParams.toString();
  useEffect(() => {
    if (loading) return;
    const next = new URLSearchParams();
    if (eventKey) next.set("event", eventKey);
    if (isLifeGroups && groupId !== null) next.set("group", String(groupId));
    if (dateReady) next.set("date", effectiveDate);
    if (next.toString() !== paramsString) setSearchParams(next, { replace: true });
  }, [loading, eventKey, isLifeGroups, groupId, dateReady, effectiveDate, paramsString, setSearchParams]);

  const selectEvent = (key: string) => {
    if (key === eventKey) return;
    setEventKey(key);
    setDate(null);
    setLastEvent(key);
  };

  const selectGroup = (id: number | null) => {
    setGroupId(id);
    setDate(null);
    if (id !== null) setLastLifeGroup(id);
  };

  const openAddGroup = async () => {
    setAddGroupOpen(true);
    setAddGroupError(null);
    if (users.length === 0) {
      try {
        setUsers(await getUsers());
      } catch (err) {
        setAddGroupError(err instanceof Error ? err.message : "Failed to load leaders");
      }
    }
  };

  const closeAddGroup = () => {
    setAddGroupOpen(false);
    setNewGroupName("");
    setNewLeaderId("");
    setAddGroupError(null);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !newLeaderId) return;
    setCreatingGroup(true);
    setAddGroupError(null);
    try {
      const created = await createLifeGroup(Number(newLeaderId), newGroupName.trim());
      setGroups(await getLifeGroups());
      selectGroup(created.id);
      closeAddGroup();
      toast.show({ type: "success", title: "Life group added" });
    } catch (err) {
      setAddGroupError(err instanceof Error ? err.message : "Failed to create life group");
    } finally {
      setCreatingGroup(false);
    }
  };

  const dateNote = !dateReady
    ? null
    : isLifeGroups && sundaysOnly
      ? "Church life groups are counted by week, so only Sundays are shown."
      : sundaysOnly
        ? "This event only happens on Sundays, so only Sundays are shown."
        : "Most recent days are shown first.";

  const chip = (iso: string, topLine: string) => {
    const selected = iso === effectiveDate;
    return (
      <button
        key={iso}
        type="button"
        className={["att-date", selected && "att-date--selected"].filter(Boolean).join(" ")}
        aria-pressed={selected}
        onClick={() => setDate(iso)}
      >
        <span className="att-date-top">{topLine || " "}</span>
        <span className="att-date-main">{formatShortDate(iso)}</span>
      </button>
    );
  };

  // Life Groups' own section is inserted before Date, which shifts the later numbers.
  const dateStep = isLifeGroups ? 3 : 2;

  return (
    <AppShell headerRight={<ProfileMenu />} pageClassName="att-page att-page--setup">
      <header className="att-setup-header">
        <h1 className="att-setup-title">Take attendance</h1>
        <p className="att-setup-sub">Pick the event, confirm the date, then choose how to count.</p>
      </header>

      {error ? (
        <p className="att-empty">{error}</p>
      ) : loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : (
        <>
          <section className="att-section" aria-labelledby="att-step-event">
            <h2 className="att-section-label" id="att-step-event">
              1 · Event
            </h2>
            <div className="att-events" role="radiogroup" aria-labelledby="att-step-event">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  selected={String(event.id) === eventKey}
                  icon={<AttendanceIcon />}
                  name={event.name}
                  meta={eventMeta(event)}
                  onSelect={() => selectEvent(String(event.id))}
                />
              ))}
              {groups.length > 0 && (
                <EventCard
                  selected={isLifeGroups}
                  icon={<LifeGroupIcon />}
                  name="Life Groups"
                  meta="Any day · Pick a group"
                  onSelect={() => selectEvent(LIFE_GROUPS_EVENT)}
                />
              )}
            </div>
          </section>

          {isLifeGroups && (
            <section className="att-section" aria-labelledby="att-step-group">
              <h2 className="att-section-label" id="att-step-group">
                2 · Life Group
              </h2>
              <div className="att-group-row">
                <SelectField
                  label="Life Group"
                  className="att-group-select"
                  value={groupId !== null ? String(groupId) : ""}
                  onChange={(e) => selectGroup(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Choose a life group…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.groupName} · {g.category === "Community" ? "Community" : "Church"}
                    </option>
                  ))}
                </SelectField>
                {overseer && (
                  <Button type="button" variant="outline" className="att-group-add" onClick={() => void openAddGroup()}>
                    + Add Life Group
                  </Button>
                )}
              </div>
            </section>
          )}

          <section className="att-section" aria-labelledby="att-step-date">
            <h2 className="att-section-label" id="att-step-date">
              {dateStep} · Date
            </h2>
            {dateReady ? (
              <>
                <div className="att-dates">
                  {dateOptions.map((iso) => chip(iso, relativeDayLabel(iso)))}
                  {pickedOutsideOptions && chip(effectiveDate, relativeDayLabel(effectiveDate) || "Picked")}
                  <button type="button" className="att-date att-date--other" onClick={() => setOtherDateOpen(true)}>
                    <CalendarIcon aria-hidden="true" />
                    <span className="att-date-main">Other date</span>
                  </button>
                </div>
                {dateNote && <p className="att-note">{dateNote}</p>}
              </>
            ) : (
              <p className="att-note">Choose a life group first.</p>
            )}
          </section>

          <section className="att-section" aria-labelledby="att-step-count">
            <h2 className="att-section-label" id="att-step-count">
              {dateStep + 1} · How to count
            </h2>
            {isLifeGroups ? (
              selectedGroup ? (
                <div className="att-counts">
                  <CountCard
                    primary
                    to={lifeGroupCheckInUrl(selectedGroup.id, effectiveDate)}
                    icon={<AttendanceIcon />}
                    title="Check in group members"
                    description={`Tick names from the ${selectedGroup.groupName} list`}
                    onClick={() => setLastLifeGroup(selectedGroup.id)}
                  />
                </div>
              ) : (
                <p className="att-note">Choose a life group first.</p>
              )
            ) : selectedEvent ? (
              <div className="att-counts">
                {rostersFor(selectedEvent).map((roster) => (
                  <CountCard
                    key={roster}
                    primary
                    to={eventCheckInUrl(selectedEvent.id, effectiveDate, roster)}
                    icon={<AttendanceIcon />}
                    title={`Check in ${ROSTER_LABELS[roster]}`}
                    description={`Tick names from the ${ROSTER_LABELS[roster]} list`}
                    onClick={() => setLastEvent(selectedEvent.id)}
                  />
                ))}
                <CountCard
                  to={headcountUrl(selectedEvent.id, effectiveDate)}
                  icon={<HeadcountIcon />}
                  title="Headcount"
                  description="Quick count of adults, youth and kids"
                  onClick={() => setLastEvent(selectedEvent.id)}
                />
              </div>
            ) : null}
          </section>
        </>
      )}

      <Modal open={otherDateOpen} onClose={() => setOtherDateOpen(false)} size="sm" title="Pick a date">
        <div className="att-calendar">
          <DatePicker
            inline
            value={effectiveDate}
            onChange={(iso) => {
              setDate(iso);
              setOtherDateOpen(false);
            }}
            disabledDaysOfWeek={sundaysOnly ? NON_SUNDAY_DAYS_OF_WEEK : undefined}
          />
        </div>
      </Modal>

      {overseer && (
        <Modal
          open={addGroupOpen}
          onClose={closeAddGroup}
          size="sm"
          title="Add Life Group"
          footer={
            <>
              <Button type="button" variant="outline" onClick={closeAddGroup}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleCreateGroup()}
                disabled={creatingGroup || !newGroupName.trim() || !newLeaderId}
              >
                {creatingGroup ? "Adding…" : "Add group"}
              </Button>
            </>
          }
        >
          <TextField
            label="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="e.g. Norzagaray Life Group"
            data-autofocus
          />
          <SelectField label="Leader" value={newLeaderId} onChange={(e) => setNewLeaderId(e.target.value)}>
            <option value="">Select a leader…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </SelectField>
          {addGroupError && (
            <p className="att-field-error" role="alert">
              {addGroupError}
            </p>
          )}
        </Modal>
      )}
    </AppShell>
  );
}

export default Attendance;
