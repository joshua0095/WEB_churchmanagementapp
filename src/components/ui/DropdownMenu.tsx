import { useEffect, useRef, useState } from "react";
import { MoreIcon } from "./icons";

export interface DropdownMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  ariaLabel: string;
}

/** Three-dot "more actions" menu. Closes on an outside click or after picking an item. */
function DropdownMenu({ items, ariaLabel }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent text-[var(--color-text-secondary)] transition-colors hover:bg-black/5 hover:text-[var(--color-text-primary)]"
      >
        <MoreIcon />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[190px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
        >
          {items.map((item) => (
            <div key={item.label}>
              {item.dividerBefore && <div className="my-1 border-t border-[var(--color-border)]" />}
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onSelect();
                }}
                className={[
                  "block w-full border-0 bg-transparent px-3.5 py-2 text-left text-sm font-medium transition-colors",
                  item.danger
                    ? "text-[var(--color-danger)] hover:bg-red-50"
                    : "text-[var(--color-text-primary)] hover:bg-black/5",
                ].join(" ")}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DropdownMenu;
