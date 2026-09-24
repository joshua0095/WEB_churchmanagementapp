import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// border-width/style/color are left to each variant (rather than a shared "border-none"
// here) so "outline"'s real border can't lose a cascade-order tie against a base utility
// that targets the same property.
const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-md px-[1.4rem] py-[0.7rem] " +
  "text-[0.95rem] font-bold tracking-[0.2px] cursor-pointer transition duration-150 " +
  "active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "border-none bg-[var(--color-gold)] text-[var(--color-text-on-gold)] enabled:hover:bg-[var(--color-gold-hover)]",
  secondary:
    "border-none bg-[var(--color-navy)] text-[var(--color-text-on-navy)] enabled:hover:bg-[var(--color-navy-mid)]",
  danger: "border-none bg-[var(--color-danger)] text-white enabled:hover:opacity-90",
  outline:
    "border-[1.5px] border-solid border-[color-mix(in_srgb,var(--color-navy)_16%,transparent)] " +
    "bg-[var(--color-surface)] text-[var(--color-text-primary)] enabled:hover:bg-black/[0.03]",
};

/** Gold = primary call to action, navy = solid secondary, outline = a quieter secondary
 * (white with a hairline border), red = destructive.
 *
 * `data-variant` carries no styling of its own (that's all the Tailwind classes below) — it's
 * a stable hook for a few outside contexts that need to style a Button differently by variant
 * without knowing its Tailwind internals, e.g. Modal's mobile footer turning an "outline"
 * Cancel into a plain text button. */
function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      data-variant={variant}
      className={[BASE_CLASSES, VARIANT_CLASSES[variant], className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export default Button;
