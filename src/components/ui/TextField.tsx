import { type InputHTMLAttributes, type ReactNode, useId } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  endAdornment?: ReactNode;
}

function TextField({ label, id, className, endAdornment, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label
      className={["ui-field", className].filter(Boolean).join(" ")}
      htmlFor={inputId}
    >
      <span className="ui-field-label">{label}</span>
      <div className="ui-field-input-wrap">
        <input
          id={inputId}
          className={["ui-field-input", endAdornment && "ui-field-input--with-adornment"]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {endAdornment && <div className="ui-field-adornment">{endAdornment}</div>}
      </div>
    </label>
  );
}

export default TextField;
