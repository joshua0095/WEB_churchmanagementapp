import { type HTMLAttributes } from "react";

/** Pulsing gray placeholder block — size it with width/height utility classes. */
function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} {...props} />;
}

export default Skeleton;
