import { type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ToolbarMenuEntry =
  | { kind: "radio"; label: string; icon?: ReactNode; checked: boolean; onSelect: () => void }
  /** Toggles leave the menu open so several can be flipped in one go. */
  | { kind: "check"; label: string; icon?: ReactNode; checked: boolean; onSelect: () => void }
  | { kind: "divider" }
  /** A small, non-interactive caption above a group of items. */
  | { kind: "heading"; label: string }
  | { kind: "submenu"; label: string; icon?: ReactNode; items: ToolbarMenuEntry[] };

interface ToolbarMenuProps {
  label: string;
  icon: ReactNode;
  entries: ToolbarMenuEntry[];
}

const MENU_WIDTH = 210;
const GAP = 4;

function ChevronDown() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 4 4 4-4 4" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  );
}

/** Moves focus between a menu's items with the arrow keys (wrapping), Home and End. */
function handleArrowKeys(e: KeyboardEvent<HTMLDivElement>) {
  const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(":scope > [role^='menuitem']")];
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  let next = -1;
  if (e.key === "ArrowDown") next = (index + 1) % items.length;
  else if (e.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = items.length - 1;
  if (next < 0) return;
  e.preventDefault();
  items[next]?.focus();
}

interface MenuPanelProps {
  entries: ToolbarMenuEntry[];
  anchor: DOMRect;
  /** "below" drops under a toolbar button; "side" flies out beside a submenu row. */
  placement: "below" | "side";
  onClose: () => void;
  /** Esc / ArrowLeft inside a submenu closes just that submenu. */
  onBack?: () => void;
  panelRef?: (el: HTMLDivElement | null) => void;
}

function MenuPanel({ entries, anchor, placement, onClose, onBack, panelRef }: MenuPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [openSub, setOpenSub] = useState<{ index: number; rect: DOMRect; trigger: HTMLElement } | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);

  // Positioned once measured so it can flip away from the viewport's edges.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top: number;
    let left: number;
    if (placement === "below") {
      top = anchor.bottom + GAP;
      left = anchor.left;
      if (left + MENU_WIDTH > vw - 8) left = Math.max(8, anchor.right - MENU_WIDTH);
      if (top + h > vh - 8) top = Math.max(8, anchor.top - GAP - h);
    } else {
      top = anchor.top - 5;
      left = anchor.right + 2;
      if (left + MENU_WIDTH > vw - 8) left = anchor.left - MENU_WIDTH - 2;
      if (left < 8) left = Math.max(8, vw - MENU_WIDTH - 8);
      if (top + h > vh - 8) top = Math.max(8, vh - 8 - h);
    }
    setPos({ top, left });
  }, [anchor, placement]);

  useEffect(() => {
    if (!pos) return;
    const first = ref.current?.querySelector<HTMLButtonElement>("[role^='menuitem']");
    // A submenu takes focus when it appears; the root menu only when opened from the keyboard.
    if (placement === "side") first?.focus();
  }, [pos, placement]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const openSubmenu = (index: number, target: HTMLElement) =>
    setOpenSub({ index, rect: target.getBoundingClientRect(), trigger: target });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" || (e.key === "ArrowLeft" && onBack)) {
      e.preventDefault();
      e.stopPropagation();
      if (onBack) onBack();
      else onClose();
      return;
    }
    handleArrowKeys(e);
  };

  const sub = openSub ? entries[openSub.index] : null;

  return (
    <>
      <div
        ref={(el) => {
          ref.current = el;
          panelRef?.(el);
        }}
        role="menu"
        className="tb-menu"
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: MENU_WIDTH, visibility: pos ? "visible" : "hidden" }}
        onKeyDown={onKeyDown}
      >
        {entries.map((entry, i) => {
          if (entry.kind === "divider") return <div key={`d${i}`} className="tb-menu-divider" role="separator" />;
          if (entry.kind === "heading")
            return (
              <div key={`h${i}`} className="tb-menu-heading" role="presentation">
                {entry.label}
              </div>
            );
          if (entry.kind === "submenu") {
            const expanded = openSub?.index === i;
            return (
              <button
                key={entry.label}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={expanded}
                className="tb-menu-item"
                data-active={expanded || undefined}
                onClick={(e) => openSubmenu(i, e.currentTarget)}
                onMouseEnter={(e) => {
                  const target = e.currentTarget;
                  window.clearTimeout(hoverTimer.current);
                  hoverTimer.current = window.setTimeout(() => openSubmenu(i, target), 150);
                }}
                onMouseLeave={() => window.clearTimeout(hoverTimer.current)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSubmenu(i, e.currentTarget);
                  }
                }}
              >
                <span className="tb-menu-lead" aria-hidden="true">
                  {entry.icon}
                </span>
                <span className="tb-menu-label">{entry.label}</span>
                <span className="tb-menu-trail">
                  <ChevronRight />
                </span>
              </button>
            );
          }
          return (
            <button
              key={entry.label}
              type="button"
              role={entry.kind === "radio" ? "menuitemradio" : "menuitemcheckbox"}
              aria-checked={entry.checked}
              className="tb-menu-item"
              onMouseEnter={() => {
                window.clearTimeout(hoverTimer.current);
                hoverTimer.current = window.setTimeout(() => setOpenSub(null), 150);
              }}
              onClick={() => {
                if (entry.kind === "radio") onClose();
                entry.onSelect();
              }}
            >
              <span className="tb-menu-mark" aria-hidden="true">
                {entry.checked && (entry.kind === "radio" ? <span className="tb-menu-dot" /> : <CheckMark />)}
              </span>
              {entry.icon && (
                <span className="tb-menu-lead" aria-hidden="true">
                  {entry.icon}
                </span>
              )}
              <span className="tb-menu-label">{entry.label}</span>
            </button>
          );
        })}
      </div>
      {sub?.kind === "submenu" && openSub && (
        <MenuPanel
          entries={sub.items}
          anchor={openSub.rect}
          placement="side"
          onClose={onClose}
          panelRef={panelRef}
          onBack={() => {
            openSub.trigger.focus();
            setOpenSub(null);
          }}
        />
      )}
    </>
  );
}

/**
 * A labelled toolbar button ("Sort ˅", "View ˅") that drops a Windows Explorer–style menu:
 * bullet-marked radio choices, check-marked toggles, headings, dividers and flyout submenus.
 * Rendered through a portal so scrolling ancestors can't clip it.
 */
function ToolbarMenu({ label, icon, entries }: ToolbarMenuProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panels = useRef(new Set<HTMLDivElement>());
  const openedByKey = useRef(false);

  const close = () => setAnchor(null);

  useEffect(() => {
    if (!anchor) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      for (const p of panels.current) if (p.contains(target)) return;
      close();
    };
    const onResize = () => close();
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    if (openedByKey.current) {
      requestAnimationFrame(() => {
        const first = [...panels.current][0]?.querySelector<HTMLButtonElement>("[role^='menuitem']");
        first?.focus();
      });
    }
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [anchor]);

  const toggle = (byKey: boolean) => {
    openedByKey.current = byKey;
    setAnchor((prev) => (prev ? null : (buttonRef.current?.getBoundingClientRect() ?? null)));
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="tb-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        aria-label={label}
        onClick={(e) => toggle(e.detail === 0)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !anchor) {
            e.preventDefault();
            toggle(true);
          }
        }}
      >
        <span className="tb-menu-trigger-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="tb-menu-trigger-label" aria-hidden="true">
          {label}
        </span>
        <span className="tb-menu-trigger-chevron" aria-hidden="true">
          <ChevronDown />
        </span>
      </button>
      {anchor &&
        createPortal(
          <MenuPanel
            entries={entries}
            anchor={anchor}
            placement="below"
            onClose={() => {
              close();
              buttonRef.current?.focus();
            }}
            panelRef={(el) => {
              // Refs are called with null on unmount; rebuild from what's still in the DOM.
              if (el) panels.current.add(el);
              for (const p of panels.current) if (!p.isConnected) panels.current.delete(p);
            }}
          />,
          document.body,
        )}
    </>
  );
}

export default ToolbarMenu;
