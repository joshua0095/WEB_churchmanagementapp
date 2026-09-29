import { useEffect, useState } from "react";

/** Below this, AppShell switches to its mobile layout (navy top bar + bottom tab bar). */
export const MOBILE_LAYOUT_QUERY = "(max-width: 1023px)";

/** Live `matchMedia` result — re-renders when the viewport crosses the query. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
