interface ProgressBarProps {
  value: number;
  max: number;
  className?: string;
}

/** Thin gold-on-cream progress bar — used for live "X of Y checked in" counts. */
function ProgressBar({ value, max, className }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={["h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export default ProgressBar;
