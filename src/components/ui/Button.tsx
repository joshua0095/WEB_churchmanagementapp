import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** Gold = primary call to action, navy = secondary, red = destructive. */
function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={["ui-btn", `ui-btn--${variant}`, className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export default Button;
