import { type InputHTMLAttributes, useId } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

function TextField({ label, id, className, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label
      className={["ui-field", className].filter(Boolean).join(" ")}
      htmlFor={inputId}
    >
      <span className="ui-field-label">{label}</span>
      <input id={inputId} className="ui-field-input" {...props} />
    </label>
  );
}

export default TextField;
