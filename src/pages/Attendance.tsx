import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getAttendanceEvents,
  getLifeGroups,
  getMyLifeGroups,
  type AttendanceEvent,
  type LifeGroupCategory,
} from "../api";
import { isAdmin, isMis } from "../auth";
import {
  LIFE_GROUPS_EVENT,
  ROSTER_LABELS,
  eventCheckInUrl,
  formatMonthDay,
  formatWeekday,
  formatWeekdayMonthDay,
  getLastLifeGroup,
  isSunday,
  isValidIsoDate,
  lifeGroupCheckInUrl,
  recentDateOptions,
  relativeDayLabel,
  setLastLifeGroup,
  type RosterKind,
} from "../components/attendance/attendanceFlow";
import { zoomIntoPage } from "../components/attendance/zoomTransition";
import { Modal, useToast } from "../components/dialogs";
import LifeGroupPicker from "../components/attendance/LifeGroupPicker";
import { AppShell, Button, DatePicker, ProfileMenu, Skeleton } from "../components/ui";
import { AttendanceIcon, CalendarIcon, LifeGroupIcon } from "../components/ui/icons";
import { CheckThinIcon } from "../components/ui/shellIcons";

interface GroupOption {
  id: number;
  groupName: string;
  category: LifeGroupCategory;
  /** Only known to overseers (from the full list); a leader's own groups leave it null — "You". */
  leaderName: string | null;
}

// A Sunday-only event's "Other date" calendar refuses every other day outright.
const NON_SUNDAY_DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6];

// Pause after a date is picked — the chip turns selected and the "Taking attendance for…"
// toast appears — before that chip zooms into the check-in page.
const ZOOM_START_MS = 500;

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

type StepKey = "event" | "group" | "roster" | "date";

interface StepSectionProps {
  id: StepKey;
  number: number;
  title: string;
  open: boolean;
  /** Not reached yet — shown as a greyed-out header so the remaining steps are visible. */
  locked?: boolean;
  /** What was picked, shown on the collapsed row once the step is done. */
  summary: ReactNode;
  /** Reopens the step; omitted when there's nothing else to pick. */
  onChange?: () => void;
  children: ReactNode;
}

/** One accordion step: the open step shows its choices; a finished one collapses to a
 * summary row that reopens it; one not reached yet is just a greyed-out header. */
function StepSection({ id, number, title, open, locked, summary, onChange, children }: StepSectionProps) {
  const labelId = `att-step-${id}`;
  if (locked) {
    return (
      <section className="att-section att-section--locked" aria-labelledby={labelId} aria-disabled="true">
        <div className="att-step-locked">
          <span className="att-step-locked-number" aria-hidden="true">
            {number}
          </span>
          <h2 className="att-section-label" id={labelId}>
            {title}
          </h2>
        </div>
      </section>
    );
  }
  if (!open) {
    return (
      <section className="att-section att-section--done" aria-labelledby={labelId}>
        <button type="button" className="att-step-summary" onClick={onChange} disabled={!onChange}>
          <span className="att-step-summary-check" aria-hidden="true">
            <CheckThinIcon strokeWidth={3} />
          </span>
          <span className="att-step-summary-text">
            <span className="att-section-label" id={labelId}>
              {number} · {title}
            </span>
            <span className="att-step-summary-value">{summary}</span>
          </span>
          {onChange && <span className="att-step-summary-change">Change</span>}
        </button>
      </section>
    );
  }
  return (
    <section className="att-section att-section--open" aria-labelledby={labelId} id={`${labelId}-section`}>
      <h2 className="att-section-label" id={labelId}>
        {number} · {title}
      </h2>
      {children}
    </section>
  );
}

function parseRosterParam(raw: string | null): RosterKind | null {
  return raw === "workers" || raw === "congregation" ? raw : null;
}

/** Step 1 of the attendance flow — event then date as an accordion: each pick collapses
 * its step and opens the next, and picking the date opens Check-in (Congregation check-in
 * also holds the headcount). The selections live in the URL so Back/Change from there
 * lands right here with the event already chosen. */
function Attendance() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const overseer = isAdmin() || isMis();

  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Nothing is pre-selected on a fresh visit — only a link back from Check-in (event in the
  // URL) restores the event.
  const [eventKey, setEventKey] = useState<string | null>(() => searchParams.get("event"));
  const [groupId, setGroupId] = useState<number | null>(() => parseGroupParam(searchParams.get("group")) ?? getLastLifeGroup());
  const [date, setDate] = useState<string | null>(() => {
    const d = searchParams.get("date");
    return isValidIsoDate(d) ? d : null;
  });
  // Only asked for a Workers & Congregation event; a single-roster event implies it.
  const [rosterChoice, setRosterChoice] = useState<RosterKind | null>(() => parseRosterParam(searchParams.get("roster")));
  const [otherDateOpen, setOtherDateOpen] = useState(false);
  // A date in the URL means the flow was finished before (e.g. Back from Check-in), so
  // the page reopens on the Date step instead of walking through every step again.
  const [resumeAtDate] = useState(() => isValidIsoDate(searchParams.get("date")));
  // null until the user acts; until then the open step is derived from what's loaded.
  const [stepState, setStep] = useState<StepKey | null>(null);
  // Pending auto-redirect to check-in after a date is picked; cleared if the page unmounts.
  const redirectTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current);
  }, []);

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
          setGroups(mine.map((g) => ({ ...g, leaderName: null })));
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

  // Once loaded, drop a URL selection that no longer exists (e.g. a deleted event). Overseers
  // then start with no event picked; everyone else only has Life Groups, so that's implied.
  useEffect(() => {
    if (loading) return;
    const eventValid =
      (eventKey === LIFE_GROUPS_EVENT && groups.length > 0) || (overseer && events.some((e) => String(e.id) === eventKey));
    if (!eventValid) {
      const fallback = !overseer && groups.length > 0 ? LIFE_GROUPS_EVENT : null;
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
  const eventRosters = selectedEvent ? rostersFor(selectedEvent) : [];
  const needsRosterChoice = eventRosters.length > 1;
  const roster: RosterKind | null = needsRosterChoice ? rosterChoice : (eventRosters[0] ?? null);
  const dateReady = isLifeGroups ? !!selectedGroup : !!selectedEvent && roster !== null;
  const dateOptions = recentDateOptions(sundaysOnly);
  const effectiveDate = date && (!sundaysOnly || isSunday(date)) ? date : dateOptions[0];
  const pickedOutsideOptions = !dateOptions.includes(effectiveDate);

  // Non-overseers only ever have Life Groups, so the Event step is skipped for them. Date
  // is the last step — picking one opens Check-in.
  const steps: StepKey[] = [
    ...(overseer ? (["event"] as const) : []),
    ...(isLifeGroups ? (["group"] as const) : []),
    ...(needsRosterChoice ? (["roster"] as const) : []),
    "date",
  ];
  const initialStep: StepKey =
    resumeAtDate && dateReady ? "date" : !overseer ? (selectedGroup ? "date" : "group") : "event";
  const step = stepState && steps.includes(stepState) ? stepState : initialStep;
  const stepIndex = Math.max(0, steps.indexOf(step));
  const stepNumber = (key: StepKey) => steps.indexOf(key) + 1;
  const reached = (key: StepKey) => steps.includes(key) && steps.indexOf(key) <= stepIndex;

  // Brings the newly opened step into view — matters on phones, where the next step can
  // land below the fold.
  useEffect(() => {
    if (!stepState) return;
    document.getElementById(`att-step-${stepState}-section`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [stepState]);

  // Mirrors the selection into the URL (replace, not push) so a refresh keeps it and the
  // check-in page's Back/Change can link straight back to it. The date only goes in once
  // it's been picked — its presence is what resumes the page at the Date step.
  const paramsString = searchParams.toString();
  useEffect(() => {
    if (loading) return;
    const next = new URLSearchParams();
    if (eventKey) next.set("event", eventKey);
    if (isLifeGroups && groupId !== null) next.set("group", String(groupId));
    if (needsRosterChoice && rosterChoice) next.set("roster", rosterChoice);
    if (dateReady && date) next.set("date", effectiveDate);
    if (next.toString() !== paramsString) setSearchParams(next, { replace: true });
  }, [loading, eventKey, isLifeGroups, groupId, needsRosterChoice, rosterChoice, dateReady, date, effectiveDate, paramsString, setSearchParams]);

  // Re-picking the current event still advances, so a pre-selected event (restored from
  // the URL on the way back from Check-in) only takes one tap to confirm.
  const selectEvent = (key: string) => {
    if (key !== eventKey) {
      setEventKey(key);
      setDate(null);
      setRosterChoice(null);
    }
    const picked = events.find((e) => String(e.id) === key);
    setStep(key === LIFE_GROUPS_EVENT ? "group" : picked && rostersFor(picked).length > 1 ? "roster" : "date");
  };

  const selectRoster = (kind: RosterKind) => {
    setRosterChoice(kind);
    setStep("date");
  };

  const selectGroup = (id: number | null) => {
    setGroupId(id);
    setDate(null);
    if (id !== null) {
      setLastLifeGroup(id);
      setStep("date");
    }
  };

  // Where picking a date leads: the Life Group's check-in, or the event's check-in for its
  // roster (chosen in the List step for a Workers & Congregation event).
  const checkInTarget = (iso: string): { url: string; name: string; label: string } | null => {
    if (isLifeGroups) {
      if (!selectedGroup) return null;
      return {
        url: lifeGroupCheckInUrl(selectedGroup.id, iso),
        name: selectedGroup.groupName,
        label: "Life Group",
      };
    }
    if (!selectedEvent || !roster) return null;
    return {
      url: eventCheckInUrl(selectedEvent.id, iso, roster),
      name: selectedEvent.name,
      label: ROSTER_LABELS[roster],
    };
  };

  // Picking a date goes straight on to check-in, after a short pause and a toast naming the
  // event and date, so it's clear what's being counted before the list opens.
  const pickDate = (iso: string) => {
    if (redirectTimer.current !== null) return;
    setDate(iso);
    const target = checkInTarget(iso);
    if (!target) return;
    toast.show({
      type: "info",
      title: `Taking attendance for ${target.name}`,
      message: `${formatWeekdayMonthDay(iso)} · ${target.label}`,
      duration: 3500,
    });
    redirectTimer.current = window.setTimeout(() => {
      // Looked up now rather than at tap time: a date from "Other date" only gets its chip
      // on the next render.
      const chipEl = document.querySelector<HTMLElement>(`[data-date-chip="${iso}"]`);
      zoomIntoPage(chipEl, () => navigate(target.url));
    }, ZOOM_START_MS);
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
        data-date-chip={iso}
        onClick={() => pickDate(iso)}
      >
        <span className="att-date-top">{[topLine, formatWeekday(iso)].filter(Boolean).join(" - ")}</span>
        <span className="att-date-main">{formatMonthDay(iso)}</span>
      </button>
    );
  };

  return (
    <AppShell headerRight={<ProfileMenu />} pageClassName="att-page att-page--setup">
      <header className="att-setup-header">
        <h1 className="att-setup-title">Take attendance</h1>
        <p className="att-setup-sub">Pick the event, then the date — check-in opens right away.</p>
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
          {steps.includes("event") && (
            <StepSection
              id="event"
              number={stepNumber("event")}
              title="Event"
              open={step === "event"}
              locked={!reached("event")}
              summary={isLifeGroups ? "Life Groups" : selectedEvent?.name}
              onChange={() => setStep("event")}
            >
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
            </StepSection>
          )}

          {steps.includes("group") && (
            <StepSection
              id="group"
              number={stepNumber("group")}
              title="Life Group"
              open={step === "group"}
              locked={!reached("group")}
              summary={
                selectedGroup &&
                `${selectedGroup.groupName} · ${selectedGroup.leaderName ?? "You"} · ${selectedGroup.category === "Community" ? "Community" : "Church"}`
              }
              onChange={overseer || groups.length > 1 ? () => setStep("group") : undefined}
            >
              <div className="att-group-row">
                <LifeGroupPicker groups={groups} value={groupId} onChange={selectGroup} />
                {selectedGroup && (
                  <Button type="button" className="att-group-add" onClick={() => setStep("date")}>
                    Continue
                  </Button>
                )}
              </div>
            </StepSection>
          )}

          {steps.includes("roster") && (
            <StepSection
              id="roster"
              number={stepNumber("roster")}
              title="List"
              open={step === "roster"}
              locked={!reached("roster")}
              summary={roster && ROSTER_LABELS[roster]}
              onChange={() => setStep("roster")}
            >
              <div className="att-events" role="radiogroup" aria-labelledby="att-step-roster">
                {eventRosters.map((kind) => (
                  <EventCard
                    key={kind}
                    selected={rosterChoice === kind}
                    icon={<AttendanceIcon />}
                    name={ROSTER_LABELS[kind]}
                    meta={kind === "congregation" ? "Tick names, or add a quick headcount" : "Tick names from the Workers list"}
                    onSelect={() => selectRoster(kind)}
                  />
                ))}
              </div>
            </StepSection>
          )}

          {steps.includes("date") && (
            <StepSection
              id="date"
              number={stepNumber("date")}
              title="Date"
              open={step === "date"}
              locked={!reached("date") || !dateReady}
              summary={[relativeDayLabel(effectiveDate), formatWeekdayMonthDay(effectiveDate)].filter(Boolean).join(" · ")}
              onChange={() => setStep("date")}
            >
              <div className="att-dates">
                {dateOptions.map((iso) => chip(iso, relativeDayLabel(iso)))}
                {pickedOutsideOptions && chip(effectiveDate, relativeDayLabel(effectiveDate) || "Picked")}
                <button type="button" className="att-date att-date--other" onClick={() => setOtherDateOpen(true)}>
                  <CalendarIcon aria-hidden="true" />
                  <span className="att-date-main">Other date</span>
                </button>
              </div>
              {dateNote && <p className="att-note">{dateNote}</p>}
            </StepSection>
          )}
        </>
      )}

      <Modal open={otherDateOpen} onClose={() => setOtherDateOpen(false)} size="sm" title="Pick a date">
        <div className="att-calendar">
          <DatePicker
            inline
            value={effectiveDate}
            onChange={(iso) => {
              pickDate(iso);
              setOtherDateOpen(false);
            }}
            disabledDaysOfWeek={sundaysOnly ? NON_SUNDAY_DAYS_OF_WEEK : undefined}
          />
        </div>
      </Modal>

    </AppShell>
  );
}

export default Attendance;
