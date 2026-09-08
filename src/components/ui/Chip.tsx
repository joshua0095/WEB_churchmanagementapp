interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

/** Large, high-contrast selectable chip — used for the Attendance event selector. */
function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-full border-2 px-5 py-3 text-base font-bold transition-colors",
        active
          ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-white"
          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-navy)] hover:text-[var(--color-navy)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export default Chip;
