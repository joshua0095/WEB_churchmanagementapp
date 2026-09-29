import { useEffect, useState } from "react";

interface PinPadProps {
  /** Called once all digits are in. */
  onComplete: (pin: string) => void;
  length?: number;
  disabled?: boolean;
  /** Change this (e.g. increment) to clear the entered digits — after a wrong code, say. */
  resetKey?: number;
  /** Shakes the dots whenever it changes to a non-empty value. */
  error?: string | null;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

/**
 * Four dots and a phone-style number pad for the quick sign-in code. Physical keyboards work
 * too (digits and Backspace), so it's just as quick on a laptop.
 */
function PinPad({ onComplete, length = 4, disabled = false, resetKey = 0, error }: PinPadProps) {
  const [value, setValue] = useState("");

  useEffect(() => setValue(""), [resetKey]);

  const press = (key: string) => {
    if (disabled) return;
    if (key === "back") {
      setValue(value.slice(0, -1));
      return;
    }
    if (value.length >= length) return;
    const next = value + key;
    setValue(next);
    if (next.length === length) onComplete(next);
  };

  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="pin-pad">
      <div className="pin-dots" data-error={error ? "true" : undefined} key={error ?? ""} aria-hidden="true">
        {Array.from({ length }, (_, i) => (
          <span key={i} className="pin-dot" data-filled={i < value.length || undefined} />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {value.length} of {length} digits entered
      </p>
      <div className="pin-keys">
        {KEYS.map((key, i) =>
          key === "" ? (
            <span key={i} />
          ) : (
            <button
              key={key}
              type="button"
              className="pin-key"
              data-kind={key === "back" ? "back" : undefined}
              onClick={() => press(key)}
              disabled={disabled || (key === "back" && value.length === 0)}
              aria-label={key === "back" ? "Delete last digit" : key}
            >
              {key === "back" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7Z" />
                  <path d="m17 9-6 6M11 9l6 6" />
                </svg>
              ) : (
                key
              )}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export default PinPad;
