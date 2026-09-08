import { type HTMLAttributes } from "react";

/** Pulsing gray placeholder block — size it with width/height utility classes.
 * Pass a `rounded-*` class in `className` to override the default corner
 * radius (e.g. `rounded-full` for an avatar placeholder). */
function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  const radius = /\brounded(-\S+)?\b/.test(className) ? "" : "rounded-sm";
  return <div className={`animate-pulse ${radius} bg-gray-200 ${className}`} {...props} />;
}

export default Skeleton;
