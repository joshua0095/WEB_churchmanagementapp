import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AttendancePerson, AttendanceRoster } from "../api";
import {
  AppShell,
  Button,
  IconButton,
  Modal,
  ProfileMenu,
  ProgressBar,
  SkeletonListRow,
  TextField,
} from "./ui";
import { BackIcon, CheckIcon } from "./ui/icons";
import { confirmDialog } from "../swal";

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

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

interface AttendanceRosterScreenProps {
  title: string;
  eventName: string;
  date: string;
  fetchRoster: () => Promise<AttendanceRoster>;
  onCheckIn: (personId: number) => Promise<{ recordId: number; checkedInAt: string }>;
  onUndo: (recordId: number) => Promise<void>;
  onEditTime: (recordId: number, checkedInAt: string) => Promise<unknown>;
  /** When provided, shows a labeled "Add walk-in" action for names not already in the system. */
  onAddWalkIn?: (name: string) => Promise<AttendancePerson>;
}

/** Shared screen for taking attendance in one sub-module (Workers or Congregation). */
function AttendanceRosterScreen({
  title,
  eventName,
  date,
  fetchRoster,
  onCheckIn,
  onUndo,
  onEditTime,
  onAddWalkIn,
}: AttendanceRosterScreenProps) {
  const navigate = useNavigate();
  const [roster, setRoster] = useState<AttendanceRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [timeInput, setTimeInput] = useState("");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);

  const reload = async () => {
    try {
      setRoster(await fetchRoster());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roster");
    }
  };

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visiblePeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!roster) return [];
    if (!q) return roster.people;
    return roster.people.filter((p) => p.name.toLowerCase().includes(q));
  }, [roster, query]);

  const handleToggle = async (person: AttendancePerson) => {
    if (person.recordId) {
      const confirmed = await confirmDialog({
        title: "Remove attendance?",
        message: `Remove attendance for ${person.name}? This will unmark them as present.`,
        confirmLabel: "Remove",
        danger: true,
      });
      if (!confirmed) return;
      try {
        await onUndo(person.recordId);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove attendance");
      }
    } else {
      try {
        await onCheckIn(person.personId);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to check in");
      }
    }
  };

  const startEditTime = (person: AttendancePerson) => {
    if (!person.recordId || !person.checkedInAt) return;
    setEditingRecordId(person.recordId);
    setTimeInput(toTimeInputValue(person.checkedInAt));
  };

  const saveTime = async (recordId: number) => {
    try {
      await onEditTime(recordId, combineDateAndTime(date, timeInput));
      setEditingRecordId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update time");
    }
  };

  const handleAddWalkIn = async () => {
    if (!onAddWalkIn || !walkInName.trim()) return;
    setWalkInSubmitting(true);
    try {
      await onAddWalkIn(walkInName.trim());
      setWalkInName("");
      setWalkInOpen(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add walk-in");
    } finally {
      setWalkInSubmitting(false);
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
          <h1 className="font-display text-2xl font-bold text-[var(--color-navy)]">
            {title} — {eventName}
          </h1>
          <p className="mt-1 text-base font-semibold text-[var(--color-text-secondary)]">{date}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search ${title.toLowerCase()}`}
          className="h-14 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-lg text-[var(--color-text-primary)] outline-none transition-shadow focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(242,183,5,0.25)] sm:max-w-md"
        />
        {onAddWalkIn && (
          <Button type="button" onClick={() => setWalkInOpen(true)}>
            + Add walk-in
          </Button>
        )}
      </div>

      {error && <p className="error mb-4">{error}</p>}

      {loading ? (
        <ul className="ui-list">
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
        </ul>
      ) : visiblePeople.length === 0 ? (
        <p className="helper-text">{roster?.people.length === 0 ? "No one to check in yet." : "No matches for that search."}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visiblePeople.map((person) => (
            <li
              key={person.personId}
              className="flex min-h-[92px] items-stretch overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-1 flex-col justify-center gap-1.5 px-5 py-4">
                <span className="text-lg font-bold text-[var(--color-navy)]">{person.name}</span>
                {person.recordId && person.checkedInAt ? (
                  editingRecordId === person.recordId ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={timeInput}
                        onChange={(e) => setTimeInput(e.target.value)}
                        className="ui-field-input h-10 w-32"
                      />
                      <Button type="button" onClick={() => saveTime(person.recordId!)}>
                        Save
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingRecordId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                        Checked in at {formatTimestamp(person.checkedInAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEditTime(person)}
                        className="text-sm font-bold text-[var(--color-info)] underline underline-offset-2"
                      >
                        Edit time
                      </button>
                    </div>
                  )
                ) : (
                  <span className="text-sm text-[var(--color-text-secondary)]">Not checked in yet</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleToggle(person)}
                aria-label={person.recordId ? `Unmark ${person.name} as present` : `Mark ${person.name} as present`}
                className={[
                  "flex w-24 shrink-0 items-center justify-center border-l transition-colors",
                  person.recordId
                    ? "border-[var(--color-gold)] bg-[var(--color-gold)] text-[var(--color-text-on-gold)]"
                    : "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-black/5",
                ].join(" ")}
              >
                <CheckIcon className="h-8 w-8" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="sticky bottom-0 mt-8 flex items-center justify-between gap-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] py-4">
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-base font-bold text-[var(--color-navy)]">
            {roster ? `${roster.checkedInCount} of ${roster.total} checked in` : "—"}
          </span>
          <ProgressBar value={roster?.checkedInCount ?? 0} max={roster?.total ?? 0} className="max-w-xs" />
        </div>
        <Button type="button" onClick={() => navigate("/attendance")} className="!px-8 !py-4 !text-lg">
          Done
        </Button>
      </div>

      <Modal
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        title="Add walk-in"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setWalkInOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddWalkIn} disabled={walkInSubmitting || !walkInName.trim()}>
              {walkInSubmitting ? "Adding..." : "Add & check in"}
            </Button>
          </>
        }
      >
        <TextField
          label="Full name"
          value={walkInName}
          onChange={(e) => setWalkInName(e.target.value)}
          placeholder="Enter their name"
          autoFocus
        />
      </Modal>
    </AppShell>
  );
}

export default AttendanceRosterScreen;
