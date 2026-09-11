import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { CalendarIcon } from "./icons";

interface DatePickerProps {
  label?: string;
  /** ISO date string (yyyy-MM-dd). */
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  /** Days of the week (0=Sunday..6=Saturday) that can't be picked — e.g. WHS only ever
   * happens on a Sunday, so every other day is disabled rather than just de-emphasized. */
  disabledDaysOfWeek?: number[];
  /** Renders the calendar directly on the page instead of behind a click-to-open field. */
  inline?: boolean;
}

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(iso: string): string {
  return parseIso(iso).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Rough estimate used only to keep the popover from opening off the right edge of the
// viewport — the popover itself is sized to its content (`width: max-content`) rather
// than this value, so a mismatch here can't cause the calendar to overflow its box.
const ESTIMATED_POPOVER_WIDTH = 320;

interface CalendarProps {
  value: string;
  onChange: (iso: string) => void;
  disabledDaysOfWeek?: number[];
}

/** Sundays get a subtle gold tint since Bible Reading / WHS attendance is almost always
 * taken for a Sunday, making the usual pick easy to spot at a glance. */
function Calendar({ value, onChange, disabledDaysOfWeek }: CalendarProps) {
  return (
    <DayPicker
      mode="single"
      required
      selected={parseIso(value)}
      onSelect={(date) => onChange(toIso(date))}
      modifiers={{ sunday: { dayOfWeek: [0] } }}
      modifiersClassNames={{ sunday: "jil-datepicker-sunday" }}
      disabled={disabledDaysOfWeek ? { dayOfWeek: disabledDaysOfWeek } : undefined}
      showOutsideDays
    />
  );
}

/** A themed date picker. By default it's a field-styled button that opens a calendar
 * popover on click; pass `inline` to render the calendar directly on the page instead. */
function DatePicker({ label, value, onChange, className, disabledDaysOfWeek, inline }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inline || !open) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.min(rect.left, window.innerWidth - ESTIMATED_POPOVER_WIDTH - 8);
      setPosition({ top: rect.bottom + 6, left: Math.max(8, left) });
    };
    updatePosition();

    const onClickAway = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
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
  }, [inline, open]);

  if (inline) {
    return (
      <div className={["jil-datepicker inline-block rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-card)]", className].filter(Boolean).join(" ")}>
        <Calendar value={value} onChange={onChange} disabledDaysOfWeek={disabledDaysOfWeek} />
      </div>
    );
  }

  return (
    <div className={["ui-field", className].filter(Boolean).join(" ")}>
      {label && <span className="ui-field-label">{label}</span>}
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="ui-field-input flex cursor-pointer items-center justify-between gap-2 text-left"
      >
        {formatDisplay(value)}
        <CalendarIcon className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: "max-content",
              maxWidth: "calc(100vw - 16px)",
            }}
            className="jil-datepicker z-50 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-pop)]"
          >
            <Calendar
              value={value}
              onChange={(iso) => {
                onChange(iso);
                setOpen(false);
              }}
              disabledDaysOfWeek={disabledDaysOfWeek}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

export default DatePicker;
