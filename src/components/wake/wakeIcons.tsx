import { type SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function StepCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} strokeWidth={3} {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function WifiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} strokeWidth={2} {...props}>
      <path d="M2 8.8a15 15 0 0120 0" />
      <path d="M5 12.6a10 10 0 0114 0" />
      <path d="M8.5 16.3a5 5 0 017 0" />
      <path d="M12 20h.01" strokeWidth={3} />
    </svg>
  );
}

export function RetryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} strokeWidth={2.2} {...props}>
      <path d="M3 12a9 9 0 0115.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 01-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
