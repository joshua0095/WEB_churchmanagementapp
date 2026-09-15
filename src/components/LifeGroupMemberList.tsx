import type { LifeGroupPerson } from "../api";
import { confirmDialog } from "../swal";
import { CheckedIcon, CheckIcon, StarIcon } from "./ui/icons";

interface LifeGroupMemberListProps {
  people: LifeGroupPerson[];
  onCheckIn: (memberId: number) => Promise<{ recordId: number }>;
  onUndo: (recordId: number) => Promise<unknown>;
  /** Called with the new recordId (or null once undone) so the parent can patch its
   * roster state directly — avoids a full roster re-fetch just to reflect one toggle. */
  onToggled: (memberId: number, recordId: number | null) => void;
  onSetFirstTimer: (recordId: number, isFirstTimer: boolean) => Promise<unknown>;
  /** Called after a first-timer toggle succeeds, so the parent can patch its roster state. */
  onFirstTimerToggled: (memberId: number, isFirstTimer: boolean) => void;
}

/** Present/absent list for one Life Group's session — a checkmark toggle, plus a
 * first-timer star once someone's checked in. */
function LifeGroupMemberList({
  people,
  onCheckIn,
  onUndo,
  onToggled,
  onSetFirstTimer,
  onFirstTimerToggled,
}: LifeGroupMemberListProps) {
  const handleToggle = async (person: LifeGroupPerson) => {
    if (person.recordId) {
      const confirmed = await confirmDialog({
        title: "Remove attendance?",
        message: `Remove attendance for ${person.name}? This will unmark them as present.`,
        confirmLabel: "Remove",
        danger: true,
      });
      if (!confirmed) return;
      await onUndo(person.recordId);
      onToggled(person.memberId, null);
    } else {
      const { recordId } = await onCheckIn(person.memberId);
      onToggled(person.memberId, recordId);
    }
  };

  const handleToggleFirstTimer = async (person: LifeGroupPerson) => {
    if (!person.recordId) return;
    const next = !person.isFirstTimer;
    await onSetFirstTimer(person.recordId, next);
    onFirstTimerToggled(person.memberId, next);
  };

  if (people.length === 0) {
    return <p className="helper-text">No members in this group yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {people.map((person) => (
        <li
          key={person.memberId}
          className="flex min-h-[64px] items-stretch overflow-hidden rounded-md bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
        >
          <div className="flex flex-1 items-center px-5 py-3">
            <span className="text-base font-bold text-[var(--color-navy)]">{person.name}</span>
          </div>
          {person.recordId && (
            <button
              type="button"
              onClick={() => handleToggleFirstTimer(person)}
              aria-label={
                person.isFirstTimer ? `Unmark ${person.name} as first-timer` : `Mark ${person.name} as first-timer`
              }
              title="First-timer"
              className={[
                "flex w-14 shrink-0 items-center justify-center border-none border-l border-l-[var(--color-border)] outline-none transition-colors focus-visible:shadow-[0_0_0_3px_rgba(242,183,5,0.5)]",
                person.isFirstTimer
                  ? "bg-[var(--color-navy)] text-[var(--color-gold)]"
                  : "bg-transparent text-[var(--color-text-secondary)]/40 hover:bg-black/5",
              ].join(" ")}
            >
              <StarIcon className="h-5 w-5" fill={person.isFirstTimer ? "currentColor" : "none"} />
            </button>
          )}
          <button
            type="button"
            onClick={() => handleToggle(person)}
            aria-label={person.recordId ? `Unmark ${person.name} as present` : `Mark ${person.name} as present`}
            className={[
              "flex w-20 shrink-0 items-center justify-center border-none outline-none transition-colors focus-visible:shadow-[0_0_0_3px_rgba(242,183,5,0.5)]",
              person.recordId
                ? "bg-[var(--color-gold)] text-[var(--color-text-on-gold)]"
                : "bg-transparent text-[var(--color-text-secondary)] hover:bg-black/5",
            ].join(" ")}
          >
            {person.recordId ? (
              <CheckedIcon className="ui-check-pop h-6 w-6" />
            ) : (
              <CheckIcon className="h-7 w-7" />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default LifeGroupMemberList;
