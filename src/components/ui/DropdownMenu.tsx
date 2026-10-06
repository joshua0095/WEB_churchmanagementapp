import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreIcon } from "./icons";

export interface DropdownMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
  /** Leading icon shown before the label. */
  icon?: ReactNode;
  /** Greys the item out and ignores clicks — e.g. a feature that's not ready yet. */
  disabled?: boolean;
  /** Small pill after the label, e.g. "Soon". */
  badge?: string;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  ariaLabel: string;
  /** Overrides the default circular three-dot trigger — e.g. the Settings page's square
   * kebab button — while every other call site keeps that default unchanged. */
  icon?: ReactNode;
  triggerClassName?: string;
}

const MENU_WIDTH = 190;
const GAP = 4;
const EDGE = 8;

/** Bottom of the usable viewport — the top of the mobile tab bar when it's showing. */
function usableBottom(): number {
  // A hidden nav (desktop, or display:none) measures 0×0.
  const navRect = document.querySelector<HTMLElement>(".app-bottom-nav")?.getBoundingClientRect();
  const navTop = navRect && navRect.height > 0 ? navRect.top : window.innerHeight;
  return Math.min(window.innerHeight, navTop) - EDGE;
}

/**
 * Three-dot "more actions" menu. Closes on an outside click or after picking an item.
 *
 * The menu itself is rendered through a portal into document.body instead of as a child
 * of the trigger button — otherwise a scrollable ancestor (e.g. a table wrapped in
 * `overflow-x-auto`) clips it. Per the CSS overflow spec, setting overflow-x to anything
 * but visible forces the computed overflow-y to auto too, so a short container (as short
 * as a single table row) cuts the menu off instead of letting it float over the page.
 */
function DropdownMenu({ items, ariaLabel, icon, triggerClassName }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Layout effect: the menu is already in the DOM (hidden) on the first pass, so its real
  // height can be measured and it can flip above the trigger before it's ever painted.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = menuRef.current?.offsetHeight ?? 0;
      const below = rect.bottom + GAP;
      // Opens downward unless that would run off the screen (or under the tab bar) and there's more room above.
      const fitsBelow = below + menuHeight <= usableBottom();
      const top = fitsBelow || rect.top - GAP - menuHeight < EDGE ? below : rect.top - GAP - menuHeight;
      const left = Math.min(Math.max(EDGE, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - EDGE);
      setPosition({ top, left });
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
        className={
          triggerClassName ??
          "flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent text-[var(--color-text-secondary)] transition-colors hover:bg-black/5 hover:text-[var(--color-text-primary)]"
        }
      >
        {icon ?? <MoreIcon />}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              width: MENU_WIDTH,
              visibility: position ? "visible" : "hidden",
            }}
            className="z-50 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
          >
            {items.map((item) => (
              <div key={item.label}>
                {item.dividerBefore && <div className="my-1 border-t border-[var(--color-border)]" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={[
                    "flex w-full items-center gap-2 border-0 bg-transparent px-3.5 py-2 text-left text-sm font-medium transition-colors",
                    item.disabled
                      ? "cursor-not-allowed text-[var(--color-text-secondary)]"
                      : item.danger
                        ? "text-[var(--color-danger)] hover:bg-red-50"
                        : "text-[var(--color-text-primary)] hover:bg-black/5",
                  ].join(" ")}
                >
                  {item.icon && (
                    <span className="flex shrink-0 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span className="flex-1">{item.label}</span>
                  {item.badge && <span className="devo-soon">{item.badge}</span>}
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
