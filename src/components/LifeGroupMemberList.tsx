import type { LifeGroupPerson } from "../api";
import { confirmDialog } from "../swal";
import { CheckedIcon, CheckIcon } from "./ui/icons";

interface LifeGroupMemberListProps {
  people: LifeGroupPerson[];
  onCheckIn: (memberId: number) => Promise<{ recordId: number }>;
  onUndo: (recordId: number) => Promise<unknown>;
  /** Called with the new recordId (or null once undone) so the parent can patch its
   * roster state directly — avoids a full roster re-fetch just to reflect one toggle. */
  onToggled: (memberId: number, recordId: number | null) => void;
}

/** Present/absent list for one Life Group's session — no timestamps, just a checkmark toggle. */
function LifeGroupMemberList({ people, onCheckIn, onUndo, onToggled }: LifeGroupMemberListProps) {
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
