import { type SVGProps } from "react";

/** Icons for the Modal/Toast subsystem — copied from the design reference as literal paths,
 * kept separate from ui/icons.tsx (Flowbite set, used at its own weights elsewhere) and
 * ui/shellIcons.tsx (app shell only) so none of those existing call sites shift. */

function base(props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

/** Modal's header close button and (at a heavier weight) a toast's own dismiss/error icon. */
export function CloseXIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Confirm modal's default icon-tile glyph — every confirm in this app is a delete/remove. */
export function TrashTileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  );
}

/** Toast warning icon — an exclamation mark. */
export function WarningDotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base({ strokeWidth: 2.6, ...props })}>
      <path d="M12 8v5M12 17h.01" />
    </svg>
  );
}

/** Toast info icon — a lowercase "i". */
export function InfoDotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base({ strokeWidth: 2.6, ...props })}>
      <path d="M12 11v6M12 7h.01" />
    </svg>
  );
}
