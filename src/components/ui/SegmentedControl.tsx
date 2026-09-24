interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  /** "light" (default): white pill on a cream track, for an inline per-row control (e.g. a
   * roster picker). "dark": navy-filled selected segment, for a standalone toolbar filter. */
  variant?: "light" | "dark";
  /** Segments share the row's width equally (default) vs. size to their own content — an
   * equal-width row of two or three options reads as one control, while a short "All /
   * Church / Community" filter looks better sized to its own labels. */
  inline?: boolean;
  disabled?: boolean;
}

/** Single-select button group — a segmented alternative to a native <select> for a small,
 * fixed set of options (e.g. an event's roster, a list's type filter). */
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = "light",
  inline = false,
  disabled = false,
  ...aria
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={aria["aria-label"]}
      className={["ui-segmented", variant === "dark" && "ui-segmented--dark", inline && "ui-segmented--inline"]
        .filter(Boolean)
        .join(" ")}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default SegmentedControl;
