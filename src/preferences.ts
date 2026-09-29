export type BibleModule = "verseOfTheDay" | "devotion";

// Pre-dates per-module preferences; kept as the fallback default for any
// module that hasn't had its own version chosen yet, so existing users don't
// lose their preference when this ships.
const LEGACY_BIBLE_VERSION_KEY = "bibleVersionId";

const MODULE_KEYS: Record<BibleModule, string> = {
  verseOfTheDay: "bibleVersionId:verseOfTheDay",
  devotion: "bibleVersionId:devotion",
};

export function getBibleVersionId(module: BibleModule): string | null {
  return localStorage.getItem(MODULE_KEYS[module]) ?? localStorage.getItem(LEGACY_BIBLE_VERSION_KEY);
}

export function setBibleVersionId(module: BibleModule, id: string): void {
  localStorage.setItem(MODULE_KEYS[module], id);
}

export type PaginatedTable = "peopleUsers" | "peopleCongregation" | "peopleNetworks" | "peopleMinistries";

const PAGE_SIZE_KEY_PREFIX = "pageSize:";

export function getPageSize(table: PaginatedTable, fallback: number): number {
  const raw = localStorage.getItem(`${PAGE_SIZE_KEY_PREFIX}${table}`);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function setPageSize(table: PaginatedTable, size: number): void {
  localStorage.setItem(`${PAGE_SIZE_KEY_PREFIX}${table}`, String(size));
}

const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";

export function getSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

export function setSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
}

export interface DevotionListPrefs {
  sort: "newest" | "oldest";
  groupBy: "none" | "week" | "month" | "year";
  view: "cards" | "compact" | "expanded";
  layout: "list" | "grid";
  showDateTile: boolean;
  showScripture: boolean;
  showObservation: boolean;
  showApplication: boolean;
  showPrayer: boolean;
  showNotes: boolean;
}

const DEVOTION_LIST_PREFS_KEY = "devotionListPrefs";

export const DEFAULT_DEVOTION_LIST_PREFS: DevotionListPrefs = {
  sort: "newest",
  groupBy: "month",
  view: "cards",
  layout: "list",
  showDateTile: true,
  showScripture: true,
  showObservation: true,
  showApplication: true,
  showPrayer: true,
  showNotes: true,
};

// Storage can be unavailable (private mode, blocked site data) — fall back to the defaults.
export function getDevotionListPrefs(): DevotionListPrefs {
  try {
    const raw = localStorage.getItem(DEVOTION_LIST_PREFS_KEY);
    if (!raw) return DEFAULT_DEVOTION_LIST_PREFS;
    const prefs = { ...DEFAULT_DEVOTION_LIST_PREFS, ...JSON.parse(raw) };
    // "grid" briefly shipped as a view; it is now a layout that any view can use.
    if (prefs.view === "grid") return { ...prefs, view: "cards", layout: "grid" };
    return prefs;
  } catch {
    return DEFAULT_DEVOTION_LIST_PREFS;
  }
}

export function setDevotionListPrefs(prefs: DevotionListPrefs): void {
  try {
    localStorage.setItem(DEVOTION_LIST_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Not persisted this session; the in-memory choice still applies.
  }
}
