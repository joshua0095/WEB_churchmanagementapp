import { CheckThinIcon } from "./shellIcons";

interface CheckTileProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  "aria-label": string;
  disabled?: boolean;
}

/** Checkbox-as-button for a dense grid (the module-access matrix): a 44px tap target around
 * a small rounded box, filled navy with a gold-free checkmark when on. */
function CheckTile({ checked, onChange, disabled, ...aria }: CheckTileProps) {
  return (
    <button
      type="button"
      className="ui-check-tile"
      aria-pressed={checked}
      aria-label={aria["aria-label"]}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-check-tile-box">
        <CheckThinIcon />
      </span>
    </button>
  );
}

export default CheckTile;
