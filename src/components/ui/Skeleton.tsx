import { type HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** "navy" for bars on a navy surface (e.g. Home's verse banner). */
  tone?: "light" | "navy";
}

/** Shimmering placeholder block — size it with width/height utility classes.
 * Pass a `rounded-*` class in `className` to override the default corner
 * radius (e.g. `rounded-full` for an avatar placeholder). Styles in wake.css. */
function Skeleton({ className = "", tone = "light", ...props }: SkeletonProps) {
  const radius = /\brounded(-\S+)?\b/.test(className) ? "" : "rounded-sm";
  return (
    <div
      className={["skeleton", tone === "navy" && "skeleton--navy", radius, className].filter(Boolean).join(" ")}
      aria-hidden="true"
      {...props}
    />
  );
}

export default Skeleton;
