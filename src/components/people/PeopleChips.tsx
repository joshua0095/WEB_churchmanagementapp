import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { abbreviateNetworkName } from "../networkTree";

export type ChipKind = "network" | "ministry";

export interface ChipItem {
  key: string;
  kind: ChipKind;
  /** Full name — shown in the tooltip and the "+N" popover. */
  name: string;
}

/** What goes on a chip: the code in a trailing "(WAN)" if the name has one, the name itself
 * when it's short, otherwise its initials ("Church Development Network" → "CDN"). */
export function chipLabel(name: string): string {
  const code = name.match(/\(([^)]+)\)\s*$/)?.[1].trim();
  if (code) return code;
  return name.length <= 14 ? name : abbreviateNetworkName(name);
}

const POPOVER_WIDTH = 240;

/** Shows a small popover under an element on hover / keyboard focus / tap — portaled so a
 * scrolling table or a fixed-height card can't clip it, and closed on scroll, resize or a
 * tap elsewhere. */
function usePopover<T extends HTMLElement>(width?: number) {
  const ref = useRef<T>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("mousedown", onDown);
    };
  }, [pos]);

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const w = width ?? rect.width;
    setPos({ top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)) });
  };
  const hide = () => setPos(null);

  const triggerProps = {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (pos) hide();
      else show();
    },
  };
  return { ref, pos, triggerProps };
}

/** A network/ministry pill. Shows its short code; the full name pops up on hover, focus or tap. */
export function Chip({ item }: { item: ChipItem }) {
  const label = chipLabel(item.name);
  // Clamped as if 240px wide, so a long name near the right edge still fits on screen.
  const { ref, pos, triggerProps } = usePopover<HTMLSpanElement>(POPOVER_WIDTH);

  return (
    <>
      <span
        ref={ref}
        className={`wk-chip wk-chip--${item.kind}`}
        tabIndex={0}
        {...triggerProps}
      >
        {/* The text lives in its own element: ellipsis doesn't apply to a flex container's text. */}
        <span className="wk-chip-text" aria-hidden="true">
          {label}
        </span>
        <span className="sr-only">{item.name}</span>
      </span>
      {pos &&
        createPortal(
          <div role="tooltip" className="wk-chip-tip" style={{ top: pos.top, left: pos.left }}>
            {item.name}
          </div>,
          document.body,
        )}
    </>
  );
}

/** A dashed "+N" chip that lists the hidden items in a small popover — on hover/focus for a
 * mouse, on tap for touch. Portaled so a scrolling table or a fixed-height card can't clip it. */
function MoreChip({ hidden }: { hidden: ChipItem[] }) {
  const { ref, pos, triggerProps } = usePopover<HTMLButtonElement>(POPOVER_WIDTH);

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="wk-chip wk-chip--more"
        aria-label={`${hidden.length} more: ${hidden.map((h) => h.name).join(", ")}`}
        aria-expanded={pos !== null}
        {...triggerProps}
      >
        +{hidden.length}
      </button>
      {pos &&
        createPortal(
          <div role="tooltip" className="wk-chip-popover" style={{ top: pos.top, left: pos.left, width: POPOVER_WIDTH }}>
            {hidden.map((h) => (
              <span key={h.key} className="wk-chip-popover-row">
                <span className={`wk-chip-dot wk-chip-dot--${h.kind}`} aria-hidden="true" />
                {h.name}
              </span>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Up to `max` chips, then "+N" for the rest; a muted "—" (or `empty`) when there are none. */
export function ChipList({ items, max = 2, empty = "—" }: { items: ChipItem[]; max?: number; empty?: string }) {
  if (items.length === 0) return <span className="wk-empty">{empty}</span>;
  const shown = items.slice(0, max);
  const hidden = items.slice(max);
  return (
    <span className="wk-chips">
      {shown.map((item) => (
        <Chip key={item.key} item={item} />
      ))}
      {hidden.length > 0 && <MoreChip hidden={hidden} />}
    </span>
  );
}
