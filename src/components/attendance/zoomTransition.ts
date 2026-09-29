// "Card zooms into the next page" transition. Where the browser has View Transitions, the
// real next page is rendered at once and revealed through a window that starts as the
// tapped card and grows to the app's content area (never the sidebar or topbar), with the
// card fading into the page inside it. Elsewhere a copy of the card is pinned over it and
// grows to cover the content area, the route changes underneath, and the copy fades away —
// that copy lives on document.body, outside React, so it survives the navigation.

// Scopes the reveal's CSS (attendance.css) to this transition only.
const VT_CLASS = "att-zoom-vt";
// Upper bound on waiting for the next page to render before the reveal starts anyway.
const NEW_PAGE_TIMEOUT_MS = 1500;

const GROW_MS = 480;
const FADE_MS = 260;
const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";
// Above the page, the topbar and modals (100); below toasts (200), so the
// "Taking attendance for…" alert stays readable throughout.
const Z_INDEX = "150";

function firstVisibleRect(selector: string): DOMRect | null {
  for (const el of Array.from(document.querySelectorAll(selector))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  return null;
}

/** The app's content area on screen — the viewport minus the sidebar, the topbar and (on
 * phones) the bottom tab bar — so the zoom fills only where the next page's content goes. */
function contentAreaRect(): { left: number; top: number; width: number; height: number } {
  const main = firstVisibleRect(".app-main");
  const topbar = firstVisibleRect(".app-topbar");
  const bottomNav = firstVisibleRect(".app-bottom-nav");
  const left = Math.max(0, main?.left ?? 0);
  const right = Math.min(window.innerWidth, main?.right ?? window.innerWidth);
  const top = Math.max(0, main?.top ?? 0, topbar?.bottom ?? 0);
  const bottom = Math.min(window.innerHeight, main?.bottom ?? window.innerHeight, bottomNav?.top ?? window.innerHeight);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** A clip-path inset() matching `r` in viewport coordinates. */
function insetFor(r: { left: number; top: number; width: number; height: number }, radius: string): string {
  const right = window.innerWidth - (r.left + r.width);
  const bottom = window.innerHeight - (r.top + r.height);
  return `inset(${r.top}px ${right}px ${bottom}px ${r.left}px round ${radius})`;
}

/** Zooms `from` into the next page; `navigate` performs the route change.
 * Without an element or with reduced motion it just navigates. */
export function zoomIntoPage(from: HTMLElement | null, navigate: () => void): void {
  if (!from || prefersReducedMotion() || typeof from.animate !== "function") {
    navigate();
    return;
  }
  if (typeof document.startViewTransition === "function") revealNextPage(from, navigate);
  else coverThenNavigate(from, navigate);
}

/** View Transitions path: the real next page grows out of the card. */
function revealNextPage(from: HTMLElement, navigate: () => void): void {
  const rect = from.getBoundingClientRect();
  const target = contentAreaRect();
  const radius = getComputedStyle(from).borderRadius || "12px";
  const root = document.documentElement;

  root.classList.add(VT_CLASS);
  // React Router applies navigations inside React.startTransition, so they can't be flushed
  // synchronously — instead the callback resolves once the old page has actually unmounted
  // (the tapped card leaves the DOM), which is when the new page is on screen to snapshot.
  const transition = document.startViewTransition(() => {
    navigate();
    return new Promise<void>((resolve) => {
      const started = performance.now();
      const check = () => {
        if (!from.isConnected || performance.now() - started > NEW_PAGE_TIMEOUT_MS) resolve();
        else window.setTimeout(check, 10);
      };
      check();
    });
  });
  transition.ready
    .then(() => {
      const newPage = "::view-transition-new(root)";
      root.animate(
        { clipPath: [insetFor(rect, radius), insetFor(target, "0px")] },
        { duration: GROW_MS, easing: EASING, fill: "forwards", pseudoElement: newPage },
      );
      // The card (still visible in the old snapshot underneath) fades into the page.
      root.animate({ opacity: [0, 1] }, { duration: GROW_MS * 0.4, easing: "ease-out", fill: "forwards", pseudoElement: newPage });
    })
    .catch(() => {
      // Transition skipped (e.g. tab hidden) — the navigation has still happened.
    });
  transition.finished.finally(() => root.classList.remove(VT_CLASS));
}

/** Fallback path: a copy of the card covers the content area, then the page changes under it. */
function coverThenNavigate(from: HTMLElement, onCovered: () => void): void {
  const rect = from.getBoundingClientRect();
  const target = contentAreaRect();
  const fromStyle = getComputedStyle(from);
  const pageBg = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim() || "#f6f1e7";

  const card = from.cloneNode(true) as HTMLElement;
  card.removeAttribute("id");
  card.setAttribute("aria-hidden", "true");
  card.tabIndex = -1;
  Object.assign(card.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    minWidth: "0",
    margin: "0",
    zIndex: Z_INDEX,
    pointerEvents: "none",
    overflow: "hidden",
    boxSizing: "border-box",
  });
  document.body.appendChild(card);

  // The card's own text fades out early so it never looks stretched as the card grows.
  for (const child of Array.from(card.children)) {
    (child as HTMLElement).animate([{ opacity: 1 }, { opacity: 0 }], { duration: GROW_MS * 0.45, fill: "forwards" });
  }

  const grow = card.animate(
    [
      {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        borderRadius: fromStyle.borderRadius,
        backgroundColor: fromStyle.backgroundColor,
        borderColor: fromStyle.borderColor,
      },
      {
        left: `${target.left}px`,
        top: `${target.top}px`,
        width: `${target.width}px`,
        height: `${target.height}px`,
        borderRadius: "0px",
        backgroundColor: pageBg,
        borderColor: pageBg,
      },
    ],
    { duration: GROW_MS, easing: EASING, fill: "forwards" },
  );

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onCovered();
    // Two frames so the new page has painted under the card before it fades.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const fade = card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: "ease-out", fill: "forwards" });
        fade.onfinish = () => card.remove();
        fade.oncancel = () => card.remove();
      }),
    );
  };
  grow.onfinish = finish;
  grow.oncancel = finish;
}
