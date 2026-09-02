import { type ButtonHTMLAttributes } from "react";

/** Ghost icon-only button for header controls (menu, back, profile, avatar). */
function IconButton({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={["ui-icon-btn", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export default IconButton;
