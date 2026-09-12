import {
  dateForWeekOfMonth,
  formatLifeGroupDate,
  monthLabel,
  ordinalWeekLabel,
  shiftMonth,
  weekNumberOfMonth,
  weeksInMonth,
} from "../api";
import { IconButton, SelectField } from "./ui";
import { BackIcon } from "./ui/icons";

interface ChurchWeekPickerProps {
  /** ISO date (yyyy-MM-dd) representing the currently selected week. */
  value: string;
  onChange: (iso: string) => void;
  className?: string;
}

/** Month stepper + week-of-month dropdown for Church Life Groups — the week options
 * (and which weekday they map to) are always derived from whichever month is shown. */
function ChurchWeekPicker({ value, onChange, className }: ChurchWeekPickerProps) {
  return (
    <div className={["flex flex-row gap-4", className].filter(Boolean).join(" ")}>
      <div className="flex items-center justify-between gap-2">
        <IconButton
          aria-label="Previous month"
          onClick={() => onChange(shiftMonth(value, -1))}
          className="!h-8 !w-8 border border-[var(--color-border)] !text-[var(--color-navy)]"
        >
          <BackIcon className="h-4 w-4" />
        </IconButton>
        <p className="text-sm font-semibold text-[var(--color-navy)]">{monthLabel(value)}</p>
        <IconButton
          aria-label="Next month"
          onClick={() => onChange(shiftMonth(value, 1))}
          className="!h-8 !w-8 border border-[var(--color-border)] !text-[var(--color-navy)]"
        >
          <BackIcon className="h-4 w-4 rotate-180" />
        </IconButton>
      </div>
      <SelectField
        label="Attendance week"
        value={String(weekNumberOfMonth(value))}
        onChange={(e) => onChange(dateForWeekOfMonth(value, Number(e.target.value)))}
      >
        {Array.from({ length: weeksInMonth(value) }, (_, i) => i + 1).map((week) => (
          <option key={week} value={week}>
            {ordinalWeekLabel(week)} — {formatLifeGroupDate(dateForWeekOfMonth(value, week))}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

export default ChurchWeekPicker;
