interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  "aria-label": string;
  disabled?: boolean;
  className?: string;
}

/** Boolean pill toggle (e.g. an attendance event's "Sunday only" flag). */
function Switch({ checked, onChange, disabled, className, ...aria }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={aria["aria-label"]}
      disabled={disabled}
      className={["ui-switch", className].filter(Boolean).join(" ")}
      onClick={() => onChange(!checked)}
    />
  );
}

export default Switch;
