import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg border-none px-[1.4rem] py-[0.7rem] " +
  "text-[0.95rem] font-bold tracking-[0.2px] cursor-pointer transition duration-150 " +
  "active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-gold)] text-[var(--color-text-on-gold)] enabled:hover:bg-[var(--color-gold-hover)]",
  secondary:
    "bg-[var(--color-navy)] text-[var(--color-text-on-navy)] enabled:hover:bg-[var(--color-navy-mid)]",
  danger: "bg-[var(--color-danger)] text-white enabled:hover:opacity-90",
};

/** Gold = primary call to action, navy = secondary, red = destructive. */
function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={[BASE_CLASSES, VARIANT_CLASSES[variant], className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export default Button;
