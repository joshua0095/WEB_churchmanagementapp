import { type SVGProps } from "react";

/** Small inline spinner — e.g. a submit button's in-progress state, or a table row being
 * updated in place. */
function Spinner({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default Spinner;
