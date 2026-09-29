import { useEffect, useRef, useState } from "react";
import { getHeadcount, submitHeadcount, type HeadcountCategory } from "../../api";
import { Modal, useToast } from "../dialogs";
import { Button } from "../ui";

export const HEADCOUNT_CATEGORIES: HeadcountCategory[] = ["Adults", "Youth", "Kids"];

export type HeadcountCounts = Record<HeadcountCategory, number>;

export const EMPTY_HEADCOUNT: HeadcountCounts = { Adults: 0, Youth: 0, Kids: 0 };

export function headcountTotal(counts: HeadcountCounts): number {
  return HEADCOUNT_CATEGORIES.reduce((sum, c) => sum + counts[c], 0);
}

interface CounterProps {
  category: HeadcountCategory;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}

/** One headcount row: − / number / +. Tapping the number swaps it for a numeric input. */
export function Counter({ category, value, onChange, disabled }: CounterProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const n = Number.parseInt(draft, 10);
    onChange(Number.isFinite(n) && n >= 0 ? n : value);
    setEditing(false);
  };

  return (
    <div className="hc-counter">
      <span className="hc-counter-label">{category}</span>
      <div className="hc-counter-controls">
        <button
          type="button"
          className="hc-step hc-step--minus"
          aria-label={`Remove one from ${category}`}
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <span aria-hidden="true">−</span>
        </button>
        {editing ? (
          <input
            ref={inputRef}
            className="hc-counter-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={`${category} count`}
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="hc-counter-value"
            aria-label={`${category}: ${value}. Tap to type a number`}
            disabled={disabled}
            onClick={() => {
              setDraft(String(value));
              setEditing(true);
            }}
          >
            {value}
          </button>
        )}
        <button
          type="button"
          className="hc-step hc-step--plus"
          aria-label={`Add one to ${category}`}
          disabled={disabled}
          onClick={() => onChange(value + 1)}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
}

interface HeadcountCountersProps {
  counts: HeadcountCounts;
  onChange: (counts: HeadcountCounts) => void;
  disabled: boolean;
  busy?: boolean;
}

/** Adults / Youth / Kids counters plus the running total. */
export function HeadcountCounters({ counts, onChange, disabled, busy }: HeadcountCountersProps) {
  return (
    <div className="hc-counters" aria-busy={busy}>
      {HEADCOUNT_CATEGORIES.map((category) => (
        <Counter
          key={category}
          category={category}
          value={counts[category]}
          disabled={disabled}
          onChange={(value) => onChange({ ...counts, [category]: value })}
        />
      ))}
      <div className="hc-total">
        <span className="hc-total-label">Total</span>
        <span className="hc-total-value" aria-live="polite">
          {headcountTotal(counts)}
        </span>
      </div>
    </div>
  );
}

function toCounts(entries: { category: HeadcountCategory; count: number }[]): HeadcountCounts {
  const next: HeadcountCounts = { ...EMPTY_HEADCOUNT };
  for (const entry of entries) next[entry.category] = entry.count;
  return next;
}

interface HeadcountButtonProps {
  sessionId: number;
}

/** Toolbar button on the Congregation check-in screen: a quick headcount recorded on the
 * same session as the named check-ins. The button shows the saved total once there is one. */
export function HeadcountButton({ sessionId }: HeadcountButtonProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<HeadcountCounts | null>(null);
  const [draft, setDraft] = useState<HeadcountCounts>(EMPTY_HEADCOUNT);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSaved(null);
    setLoadError(null);
    getHeadcount(sessionId)
      .then((summary) => {
        if (!cancelled) setSaved(toCounts(summary.entries));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load the headcount");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const openModal = () => {
    setDraft(saved ?? EMPTY_HEADCOUNT);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const summary = await submitHeadcount(
        sessionId,
        HEADCOUNT_CATEGORIES.map((category) => ({ category, count: draft[category] })),
      );
      setSaved(toCounts(summary.entries));
      setLoadError(null);
      setOpen(false);
      toast.show({ type: "success", title: "Headcount saved", message: `${summary.total} counted in all` });
    } catch (err) {
      toast.show({ type: "error", title: "Couldn't save the headcount", message: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const savedTotal = saved ? headcountTotal(saved) : 0;

  return (
    <>
      <Button type="button" variant="outline" className="att-toolbar-btn" onClick={openModal}>
        Headcount
        {savedTotal > 0 && <span className="att-toolbar-count">{savedTotal}</span>}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Headcount"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving || saved === null}>
              {saving ? "Saving…" : "Save headcount"}
            </Button>
          </>
        }
      >
        <p className="hc-helper">Tap + for each person. You can also tap a number to type it.</p>
        {loadError && saved === null ? (
          <p className="att-field-error" role="alert">
            {loadError}
          </p>
        ) : (
          <HeadcountCounters counts={draft} onChange={setDraft} disabled={saving || saved === null} busy={saved === null} />
        )}
      </Modal>
    </>
  );
}
