import { useState, type ReactNode } from "react";
import { ChevronDownIcon, FilterIcon } from "./icons";

interface FilterBarProps {
  /** Always-visible control (usually the search box). */
  primary?: ReactNode;
  /** Secondary filters — shown inline on tablet/desktop, collapsed behind a toggle on mobile. */
  children: ReactNode;
  /** Number of secondary filters currently narrowing the list, shown as a badge on the toggle. */
  activeCount?: number;
  className?: string;
}

/** Keeps the primary filter visible on mobile and tucks the rest behind a "Filters" toggle,
 * while showing everything inline together once there's room at `sm+`. */
function FilterBar({ primary, children, activeCount = 0, className }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={["flex flex-col gap-3", className ?? "mb-5"].filter(Boolean).join(" ")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {primary}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="flex h-11 items-center justify-center gap-2 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text-primary)] sm:hidden"
        >
          <FilterIcon className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-[var(--color-navy)] px-1.5 py-0.5 text-[0.7rem] font-bold leading-none text-white">
              {activeCount}
            </span>
          )}
          <ChevronDownIcon className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>
      <div
        className={`flex-col gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-end ${expanded ? "flex" : "hidden"}`}
      >
        {children}
      </div>
    </div>
  );
}

export default FilterBar;
