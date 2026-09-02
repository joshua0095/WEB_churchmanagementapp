import { type SelectHTMLAttributes, useId } from "react";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

function SelectField({ label, id, className, children, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <label
      className={["ui-field", className].filter(Boolean).join(" ")}
      htmlFor={selectId}
    >
      <span className="ui-field-label">{label}</span>
      <select id={selectId} className="ui-field-input" {...props}>
        {children}
      </select>
    </label>
  );
}

export default SelectField;
