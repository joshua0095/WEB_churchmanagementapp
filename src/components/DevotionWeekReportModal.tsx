import { useEffect, useMemo, useState } from "react";
import { Modal, useToast } from "./dialogs";
import { Button, Switch } from "./ui";
import { useMe } from "../meCache";

export interface WeekReportDevo {
  id: number;
  date: Date;
  verse: string;
  scripture: string;
  observation: string;
  application: string;
  prayer: string;
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  devos: WeekReportDevo[];
}

/** Sunday-start weeks, matching the Devotions page and the monthly devotion report. */
function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Sep 27 – Oct 3, 2026" */
function weekRangeLabel(start: Date): string {
  const end = addDays(start, 6);
  const from = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const to = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${from} – ${to}`;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/**
 * A Sunday–Saturday summary of the signed-in person's devotions that they can copy or send
 * through the phone's share sheet (Messenger, Viber, SMS…) to their leader. Nothing is sent
 * by the app itself — the person chooses where the report goes.
 */
function DevotionWeekReportModal({ open, onClose, devos }: Props) {
  const toast = useToast();
  const me = useMe();
  const thisWeek = startOfWeek(new Date());
  const [weekStart, setWeekStart] = useState(thisWeek);
  const [includeReflections, setIncludeReflections] = useState(true);

  // Each time it opens, start from the current week.
  useEffect(() => {
    if (open) setWeekStart(startOfWeek(new Date()));
  }, [open]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        return { date, devo: devos.find((d) => isSameDay(d.date, date)) ?? null };
      }),
    [weekStart, devos],
  );

  const today = new Date();
  // Days still ahead this week aren't "missed" — they're left out of the count.
  const elapsed = days.filter((d) => d.date <= today).length;
  const done = days.filter((d) => d.devo).length;
  const isCurrentWeek = weekStart.getTime() >= thisWeek.getTime();

  const reportText = (() => {
    const lines = [
      `Devotion report — ${weekRangeLabel(weekStart)}`,
      ...(me?.name ? [me.name] : []),
      `${done} of ${elapsed} ${elapsed === 1 ? "day" : "days"}`,
    ];
    for (const { date, devo } of days) {
      if (date > today && !devo) continue;
      lines.push("");
      if (!devo) {
        lines.push(`${dayLabel(date)} — no devotion`);
        continue;
      }
      lines.push(`${dayLabel(date)} — ${devo.verse}`);
      if (includeReflections) {
        if (devo.scripture) lines.push(`S: ${devo.scripture}`);
        if (devo.observation) lines.push(`O: ${devo.observation}`);
        if (devo.application) lines.push(`A: ${devo.application}`);
        if (devo.prayer) lines.push(`P: ${devo.prayer}`);
      }
    }
    return lines.join("\n");
  })();

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      toast.show({ type: "success", title: "Report copied", message: "Paste it in a message to your leader." });
    } catch {
      toast.show({ type: "error", title: "Couldn't copy the report" });
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: `Devotion report — ${weekRangeLabel(weekStart)}`, text: reportText });
    } catch (err) {
      // Closing the share sheet rejects with AbortError — that's not a failure.
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.show({ type: "error", title: "Couldn't open sharing", message: "Try Copy instead." });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report to leader"
      description="Your devotions for the week, ready to send to your leader."
      footer={
        <>
          <Button type="button" variant="outline" onClick={copy}>
            Copy
          </Button>
          {canShare && (
            <Button type="button" onClick={share}>
              Share
            </Button>
          )}
        </>
      }
    >
      <div className="devo-report">
        <div className="devo-report-week">
          <button
            type="button"
            className="devo-icon-btn"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m12 5-5 5 5 5" />
            </svg>
          </button>
          <div className="devo-report-week-label">
            <strong>{isCurrentWeek ? "This week" : weekRangeLabel(weekStart)}</strong>
            <span>
              {isCurrentWeek ? `${weekRangeLabel(weekStart)} · ` : ""}
              {done} of {elapsed} {elapsed === 1 ? "day" : "days"}
            </span>
          </div>
          <button
            type="button"
            className="devo-icon-btn"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            disabled={isCurrentWeek}
            aria-label="Next week"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m8 5 5 5-5 5" />
            </svg>
          </button>
        </div>

        <ol className="devo-report-days">
          {days.map(({ date, devo }) => {
            const upcoming = date > today && !devo;
            return (
              <li key={date.toISOString()} className="devo-report-day" data-state={devo ? "done" : upcoming ? "upcoming" : "missed"}>
                <span className="devo-report-dot" aria-hidden="true" />
                <span className="devo-report-day-name">{dayLabel(date)}</span>
                <span className="devo-report-day-verse">{devo ? devo.verse : upcoming ? "Upcoming" : "No devotion"}</span>
              </li>
            );
          })}
        </ol>

        <label className="devo-report-toggle">
          <span>
            Include reflections
            <small>Scripture, Observation, Application and Prayer for each day</small>
          </span>
          <Switch checked={includeReflections} onChange={setIncludeReflections} aria-label="Include reflections" />
        </label>

        <details className="devo-report-preview">
          <summary>Preview message</summary>
          <pre>{reportText}</pre>
        </details>
      </div>
    </Modal>
  );
}

export default DevotionWeekReportModal;
