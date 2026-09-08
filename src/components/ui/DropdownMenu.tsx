import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const MENU_WIDTH = 190;

/**
 * Three-dot "more actions" menu. Closes on an outside click or after picking an item.
 *
 * The menu itself is rendered through a portal into document.body instead of as a child
 * of the trigger button — otherwise a scrollable ancestor (e.g. a table wrapped in
 * `overflow-x-auto`) clips it. Per the CSS overflow spec, setting overflow-x to anything
 * but visible forces the computed overflow-y to auto too, so a short container (as short
 * as a single table row) cuts the menu off instead of letting it float over the page.
 */
function DropdownMenu({ items, ariaLabel }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({ top: rect.bottom + 4, left: rect.right - MENU_WIDTH });
    };
    updatePosition();

    const onClickAway = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onClickAway);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
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
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", top: position.top, left: position.left, width: MENU_WIDTH }}
            className="z-50 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
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
          </div>,
          document.body,
        )}
    </>
  );
}

export default DropdownMenu;
