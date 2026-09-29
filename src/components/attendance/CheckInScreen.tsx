import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, useToast } from "../dialogs";
import { AppShell, Button, ProfileMenu, TextField } from "../ui";
import { BackIcon, CalendarIcon } from "../ui/icons";
import { CheckThinIcon, TopbarSearchIcon } from "../ui/shellIcons";
import type { LifeGroupAgeCategory } from "../../api";
import { formatLongDate, formatWeekdayMonthDay, initials } from "./attendanceFlow";

export interface CheckInPerson {
  id: number;
  name: string;
  recordId: number | null;
  checkedInAt: string | null;
  /** Life Group members only — undefined for event rosters. */
  firstTimer?: boolean;
  /** Event rosters only — undefined for Life Groups, whose members have no birthday/gender.
   * null means the person couldn't be classified. */
  category?: LifeGroupAgeCategory | null;
}

export interface CheckInRoster {
  total: number;
  checkedInCount: number;
  people: CheckInPerson[];
}

interface WalkInConfig {
  /** Toolbar button + modal title, e.g. "Add walk-in" / "Add member". */
  label: string;
  submitLabel: string;
  /** Shows a "First-timer" checkbox (Life Groups). */
  firstTimerOption?: boolean;
  submit: (name: string, firstTimer: boolean) => Promise<unknown>;
  successMessage: string;
}

interface CheckInScreenProps {
  title: string;
  /** Chip in the meta row, e.g. "Congregation" or "Life Group". */
  rosterLabel: string;
  date: string;
  /** Setup URL with the current selections, for Back / Change / Done. */
  backUrl: string;
  /** Undefined while the page is still opening its session. */
  loadRoster?: () => Promise<CheckInRoster>;
  /** Replaces the list (e.g. a session that failed to open, or is tracked by headcount). */
  blocker?: ReactNode;
  onCheckIn: (id: number) => Promise<{ recordId: number; checkedInAt: string | null }>;
  onUndo: (recordId: number) => Promise<unknown>;
  onEditTime?: (recordId: number, checkedInAt: string) => Promise<unknown>;
  walkIn?: WalkInConfig;
  /** Extra toolbar actions (e.g. Life Groups' "Follow up"), given the current roster. */
  toolbarExtra?: (people: CheckInPerson[]) => ReactNode;
}

type Filter = "all" | "pending" | "checked";

// Placeholder recordId while a check-in's save is in flight — the row already reads as
// checked in, but can't be undone until the real id comes back.
const PENDING_RECORD_ID = -1;

// Display order for the "Details" breakdown — adults first, then down by age.
const CATEGORY_ORDER: LifeGroupAgeCategory[] = ["Men", "Women", "YAN", "KKB", "Children"];

// Matches the app shell's lg breakpoint (see attendance.css / ui.css).
const DESKTOP_QUERY = "(min-width: 1024px)";

function toTimeInputValue(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combineDateAndTime(dateIso: string, timeValue: string): string {
  const [hours, minutes] = timeValue.split(":").map(Number);
  const d = new Date(`${dateIso}T00:00:00`);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Step 2 of the attendance flow: one roster, searchable and filterable, where tapping a
 * row checks that person in (optimistically — the UI flips at once and rolls back with an
 * error toast if the save fails). */
function CheckInScreen({
  title,
  rosterLabel,
  date,
  backUrl,
  loadRoster,
  blocker,
  onCheckIn,
  onUndo,
  onEditTime,
  walkIn,
  toolbarExtra,
}: CheckInScreenProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [roster, setRoster] = useState<CheckInRoster | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  // Person whose "Undo check-in?" bubble is open — at most one at a time.
  const [confirmUndoId, setConfirmUndoId] = useState<number | null>(null);
  const undoConfirmRef = useRef<HTMLSpanElement>(null);
  const [timeInput, setTimeInput] = useState("");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInFirstTimer, setWalkInFirstTimer] = useState(false);
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);
  const [walkInError, setWalkInError] = useState<string | null>(null);
  // Rows with a save in flight — further taps on them are ignored until it settles.
  const pending = useRef(new Set<number>());

  const reload = async () => {
    if (!loadRoster) return;
    try {
      setRoster(await loadRoster());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load the list");
    }
  };

  useEffect(() => {
    setRoster(null);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRoster]);

  const people = useMemo(() => roster?.people ?? [], [roster]);
  const checkedCount = roster?.checkedInCount ?? 0;
  const total = roster?.total ?? 0;

  // Checked in / on the list per Life Group category, for the "Details" view. Only event
  // rosters carry a category (Life Group members have no birthday/gender), so it's null there.
  const breakdown = useMemo(() => {
    if (people.length === 0 || people.every((p) => p.category === undefined)) return null;
    const rows: { label: string; checked: number; total: number; muted?: boolean }[] = [
      ...CATEGORY_ORDER.map((label) => ({ label, checked: 0, total: 0 })),
      { label: "Not classified", checked: 0, total: 0, muted: true },
    ];
    for (const p of people) {
      const index = p.category ? CATEGORY_ORDER.indexOf(p.category) : -1;
      const row = rows[index >= 0 ? index : rows.length - 1];
      row.total++;
      if (p.recordId) row.checked++;
    }
    // "Not classified" only earns a line when someone falls into it.
    return rows.filter((r) => !r.muted || r.total > 0);
  }, [people]);

  const visiblePeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (filter === "pending") return !p.recordId;
      if (filter === "checked") return !!p.recordId;
      return true;
    });
  }, [people, query, filter]);

  const patchPerson = (id: number, patch: Partial<CheckInPerson>, countDelta: number) => {
    setRoster(
      (prev) =>
        prev && {
          ...prev,
          checkedInCount: prev.checkedInCount + countDelta,
          people: prev.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        },
    );
  };

  // Checking in is one tap; undoing asks first via a small bubble beside the button, since
  // a stray tap on a long list is easy.
  const requestToggle = (person: CheckInPerson) => {
    if (person.recordId) setConfirmUndoId((current) => (current === person.id ? null : person.id));
    else void toggle(person);
  };

  useEffect(() => {
    if (confirmUndoId === null) return;
    undoConfirmRef.current?.querySelector<HTMLButtonElement>(".att-undo-pop-confirm")?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!undoConfirmRef.current?.contains(e.target as Node)) setConfirmUndoId(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmUndoId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmUndoId]);

  const toggle = async (person: CheckInPerson) => {
    if (pending.current.has(person.id)) return;
    pending.current.add(person.id);
    try {
      if (person.recordId) {
        const previous = { recordId: person.recordId, checkedInAt: person.checkedInAt, firstTimer: person.firstTimer };
        // Undoing a Life Group check-in also clears first-timer — that flag only means
        // something on an actual attendance record.
        patchPerson(
          person.id,
          { recordId: null, checkedInAt: null, firstTimer: person.firstTimer === undefined ? undefined : false },
          -1,
        );
        if (editingRecordId === person.recordId) setEditingRecordId(null);
        try {
          await onUndo(person.recordId);
        } catch (err) {
          patchPerson(person.id, previous, 1);
          toast.show({
            type: "error",
            title: `Couldn't undo ${person.name}'s check-in`,
            message: err instanceof Error ? err.message : undefined,
          });
        }
      } else {
        patchPerson(person.id, { recordId: PENDING_RECORD_ID, checkedInAt: new Date().toISOString() }, 1);
        try {
          const { recordId, checkedInAt } = await onCheckIn(person.id);
          patchPerson(person.id, { recordId, checkedInAt }, 0);
        } catch (err) {
          patchPerson(person.id, { recordId: null, checkedInAt: null }, -1);
          toast.show({
            type: "error",
            title: `Couldn't check in ${person.name}`,
            message: err instanceof Error ? err.message : undefined,
          });
        }
      }
    } finally {
      pending.current.delete(person.id);
    }
  };

  const startEditTime = (person: CheckInPerson) => {
    if (!person.recordId || person.recordId === PENDING_RECORD_ID || !person.checkedInAt) return;
    setEditingRecordId(person.recordId);
    setTimeInput(toTimeInputValue(person.checkedInAt));
  };

  const saveTime = async (person: CheckInPerson) => {
    if (!onEditTime || !person.recordId) return;
    try {
      const checkedInAt = combineDateAndTime(date, timeInput);
      await onEditTime(person.recordId, checkedInAt);
      patchPerson(person.id, { checkedInAt }, 0);
      setEditingRecordId(null);
      toast.show({ type: "success", title: "Check-in time updated" });
    } catch (err) {
      toast.show({ type: "error", title: "Couldn't update the time", message: err instanceof Error ? err.message : undefined });
    }
  };

  const closeWalkIn = () => {
    setWalkInOpen(false);
    setWalkInName("");
    setWalkInFirstTimer(false);
    setWalkInError(null);
  };

  const submitWalkIn = async () => {
    if (!walkIn || !walkInName.trim()) return;
    setWalkInSubmitting(true);
    setWalkInError(null);
    try {
      await walkIn.submit(walkInName.trim(), walkInFirstTimer);
      closeWalkIn();
      await reload();
      toast.show({ type: "success", title: walkIn.successMessage });
    } catch (err) {
      setWalkInError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setWalkInSubmitting(false);
    }
  };

  const finish = () => {
    toast.show({ type: "success", title: `Attendance saved · ${checkedCount} checked in` });
    navigate(backUrl);
  };

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: people.length },
    { key: "pending", label: "Not yet", count: people.filter((p) => !p.recordId).length },
    { key: "checked", label: "Checked in", count: people.filter((p) => !!p.recordId).length },
  ];

  const loading = !blocker && !loadError && !roster;

  return (
    <AppShell
      headerRight={<ProfileMenu />}
      pageClassName="att-page att-page--checkin"
      mobileFocus={{
        title,
        subtitle: `${rosterLabel} · ${formatWeekdayMonthDay(date)}`,
        onBack: () => navigate(backUrl),
        backLabel: "Back to attendance setup",
      }}
    >
      <header className="att-checkin-header">
        <button type="button" className="att-back" aria-label="Back to attendance setup" onClick={() => navigate(backUrl)}>
          <BackIcon />
        </button>
        <div className="att-checkin-heading">
          <h1 className="att-checkin-title">{title}</h1>
          <div className="att-checkin-meta">
            <span className="att-roster-chip">{rosterLabel}</span>
            <span className="att-checkin-date">
              <CalendarIcon aria-hidden="true" />
              {formatLongDate(date)}
            </span>
            <button type="button" className="att-link" onClick={() => navigate(backUrl)}>
              Change
            </button>
          </div>
        </div>
      </header>

      {blocker ?? (
        <>
          <div className="att-toolbar">
            <label className="att-search">
              <TopbarSearchIcon />
              <input
                type="search"
                placeholder="Search by name"
                aria-label="Search by name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {walkIn && (
              <Button type="button" variant="outline" className="att-walkin" onClick={() => setWalkInOpen(true)} aria-label={walkIn.label}>
                <span aria-hidden="true" className="att-walkin-plus">
                  +
                </span>
                <span className="att-walkin-label">{walkIn.label}</span>
              </Button>
            )}
            {toolbarExtra?.(people)}
          </div>

          <div className="att-filter" role="group" aria-label="Filter the list">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                className="att-filter-option"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span className="att-filter-count">{roster ? f.count : "–"}</span>
              </button>
            ))}
          </div>

          {loadError ? (
            <div className="att-empty">
              <p>{loadError}</p>
              <Button type="button" variant="outline" onClick={() => void reload()}>
                Try again
              </Button>
            </div>
          ) : loading ? (
            <ul className="att-list" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="att-row att-row--skeleton">
                  <span className="att-avatar" />
                  <span className="att-skeleton-line" />
                </li>
              ))}
            </ul>
          ) : visiblePeople.length === 0 ? (
            <div className="att-empty">
              <p>
                {people.length === 0
                  ? "No one on this list yet."
                  : query.trim()
                    ? "No one matches that search."
                    : filter === "checked"
                      ? "No one is checked in yet."
                      : "Everyone is checked in."}
              </p>
            </div>
          ) : (
            <ul className="att-list">
              {visiblePeople.map((person) => {
                const checked = !!person.recordId;
                const editing = editingRecordId !== null && editingRecordId === person.recordId;
                const confirmingUndo = checked && confirmUndoId === person.id;
                return (
                  <li
                    key={person.id}
                    className={["att-row", checked && "att-row--checked"].filter(Boolean).join(" ")}
                    onClick={
                      editing
                        ? undefined
                        : () => {
                            // Whole-row tap is a mobile touch target; on desktop only the button toggles.
                            if (window.matchMedia(DESKTOP_QUERY).matches) return;
                            requestToggle(person);
                          }
                    }
                  >
                    <span className="att-avatar" aria-hidden="true">
                      {initials(person.name)}
                    </span>
                    <div className="att-row-text">
                      <span className="att-row-name">
                        {person.name}
                        {person.firstTimer && <span className="att-first-timer">First-timer</span>}
                      </span>
                      {editing ? (
                        <span className="att-time-edit" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="time"
                            value={timeInput}
                            onChange={(e) => setTimeInput(e.target.value)}
                            aria-label={`Check-in time for ${person.name}`}
                            className="att-time-input"
                          />
                          <button type="button" className="att-link" onClick={() => void saveTime(person)}>
                            Save
                          </button>
                          <button type="button" className="att-link att-link--muted" onClick={() => setEditingRecordId(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : checked ? (
                        <span className="att-row-status att-row-status--checked">
                          {person.checkedInAt ? `Checked in · ${formatTime(person.checkedInAt)}` : "Checked in"}
                          {onEditTime && person.checkedInAt && person.recordId !== PENDING_RECORD_ID && (
                            <button
                              type="button"
                              className="att-link att-link--small"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditTime(person);
                              }}
                            >
                              Edit time
                            </button>
                          )}
                        </span>
                      ) : (
                        <span className="att-row-status">Not checked in yet</span>
                      )}
                    </div>
                    <span className="att-toggle-wrap" ref={confirmingUndo ? undoConfirmRef : undefined}>
                      {confirmingUndo && (
                        <span
                          className="att-undo-pop"
                          role="dialog"
                          aria-label={`Undo ${person.name}'s check-in?`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="att-undo-pop-text">Undo check-in?</span>
                          <button type="button" className="att-undo-pop-keep" onClick={() => setConfirmUndoId(null)}>
                            Keep
                          </button>
                          <button
                            type="button"
                            className="att-undo-pop-confirm"
                            onClick={() => {
                              setConfirmUndoId(null);
                              void toggle(person);
                            }}
                          >
                            Undo
                          </button>
                        </span>
                      )}
                      <button
                        type="button"
                        className="att-toggle"
                        aria-pressed={checked}
                        aria-expanded={checked ? confirmingUndo : undefined}
                        aria-label={checked ? `${person.name} is checked in — tap to undo` : `Check in ${person.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          requestToggle(person);
                        }}
                      >
                        {checked ? (
                          <>
                            <CheckThinIcon strokeWidth={2.6} />
                            Checked in
                          </>
                        ) : (
                          "Check in"
                        )}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="att-bottom-bar">
            <div className="att-progress">
              <span className="att-progress-text">
                <span aria-live="polite">
                  <span className="att-progress-count">{checkedCount}</span> of {total} checked in
                </span>
                {breakdown && (
                  <button type="button" className="att-link att-link--small" onClick={() => setDetailsOpen(true)}>
                    Details
                  </button>
                )}
              </span>
              <span className="att-progress-track" aria-hidden="true">
                <span className="att-progress-fill" style={{ width: `${total ? Math.min(100, (checkedCount / total) * 100) : 0}%` }} />
              </span>
            </div>
            <Button type="button" className="att-done" onClick={finish}>
              Done
            </Button>
          </div>
        </>
      )}

      {breakdown && (
        <Modal open={detailsOpen} onClose={() => setDetailsOpen(false)} size="sm" title="Attendance details">
          <p className="att-details-sub">
            <strong>{checkedCount}</strong> of {total} checked in · {formatWeekdayMonthDay(date)}
          </p>
          <ul className="att-details">
            {breakdown.map((row) => (
              <li key={row.label} className={["att-details-row", row.muted && "att-details-row--muted"].filter(Boolean).join(" ")}>
                <span className="att-details-label">{row.label}</span>
                <span className="att-details-track" aria-hidden="true">
                  <span className="att-details-fill" style={{ width: `${checkedCount ? (row.checked / checkedCount) * 100 : 0}%` }} />
                </span>
                <span className="att-details-count">
                  <strong>{row.checked}</strong>
                  <span className="att-details-of"> / {row.total}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="att-note">
            Grouped by each person's birthday and gender as of this date — the same rules as the monthly report.
            "Not classified" means a birthday or gender is missing.
          </p>
        </Modal>
      )}

      {walkIn && (
        <Modal
          open={walkInOpen}
          onClose={closeWalkIn}
          size="sm"
          title={walkIn.label}
          footer={
            <>
              <Button type="button" variant="outline" onClick={closeWalkIn}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void submitWalkIn()} disabled={walkInSubmitting || !walkInName.trim()}>
                {walkInSubmitting ? "Adding…" : walkIn.submitLabel}
              </Button>
            </>
          }
        >
          <TextField
            label="Full name"
            value={walkInName}
            onChange={(e) => setWalkInName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitWalkIn();
            }}
            placeholder="Enter their name"
            autoComplete="off"
            data-autofocus
          />
          {walkIn.firstTimerOption && (
            <label className="att-checkbox">
              <input type="checkbox" checked={walkInFirstTimer} onChange={(e) => setWalkInFirstTimer(e.target.checked)} />
              First-timer
            </label>
          )}
          {walkInError && (
            <p className="att-field-error" role="alert">
              {walkInError}
            </p>
          )}
        </Modal>
      )}
    </AppShell>
  );
}

export default CheckInScreen;
