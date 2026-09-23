import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "./icons";

interface AccordionProps {
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /**
   * Always expanded and cannot be collapsed — used when there's nothing to hide, e.g. a
   * leader who has only the one Life Group.
   */
  forceOpen?: boolean;
  /** Fired with the new open state whenever the header is clicked — e.g. to lazily load
   * content the first time a section opens, regardless of where in the header it's clicked. */
  onToggle?: (open: boolean) => void;
}

/** Expandable section — used for each Life Group leader, with members nested inside. */
function Accordion({ header, children, defaultOpen = false, forceOpen = false, onToggle }: AccordionProps) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = forceOpen || openState;

  const handleClick = () => {
    setOpenState((o) => {
      const next = !o;
      onToggle?.(next);
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={forceOpen ? undefined : handleClick}
        aria-expanded={open}
        aria-disabled={forceOpen || undefined}
        className={[
          "flex w-full items-center justify-between gap-4 border-none bg-[var(--color-surface)] px-5 py-4 text-left outline-none focus-visible:shadow-[0_0_0_3px_rgba(242,183,5,0.5)]",
          forceOpen ? "cursor-default" : "",
        ].join(" ")}
      >
        {header}
        {!forceOpen && (
          <ChevronDownIcon
            className={["shrink-0 transition-transform", open ? "rotate-180" : ""].join(" ")}
          />
        )}
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)] px-5 py-4 pl-8">{children}</div>
      )}
    </div>
  );
}

export default Accordion;
