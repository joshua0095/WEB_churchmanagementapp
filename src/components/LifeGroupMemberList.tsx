import type { LifeGroupPerson } from "../api";
import { confirmDialog } from "../swal";
import { CheckIcon } from "./ui/icons";

interface LifeGroupMemberListProps {
  people: LifeGroupPerson[];
  onCheckIn: (memberId: number) => Promise<unknown>;
  onUndo: (recordId: number) => Promise<unknown>;
  onChanged: () => void;
}

/** Present/absent list for one Life Group's session — no timestamps, just a checkmark toggle. */
function LifeGroupMemberList({ people, onCheckIn, onUndo, onChanged }: LifeGroupMemberListProps) {
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
    } else {
      await onCheckIn(person.memberId);
    }
    onChanged();
  };

  if (people.length === 0) {
    return <p className="helper-text">No members in this group yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {people.map((person) => (
        <li
          key={person.memberId}
          className="flex min-h-[64px] items-stretch overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          <div className="flex flex-1 items-center px-5 py-3">
            <span className="text-base font-bold text-[var(--color-navy)]">{person.name}</span>
          </div>
          <button
            type="button"
            onClick={() => handleToggle(person)}
            aria-label={person.recordId ? `Unmark ${person.name} as present` : `Mark ${person.name} as present`}
            className={[
              "flex w-20 shrink-0 items-center justify-center border-l transition-colors",
              person.recordId
                ? "border-[var(--color-gold)] bg-[var(--color-gold)] text-[var(--color-text-on-gold)]"
                : "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-black/5",
            ].join(" ")}
          >
            <CheckIcon className="h-7 w-7" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export default LifeGroupMemberList;
