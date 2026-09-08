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
