const BIBLE_VERSION_KEY = "bibleVersionId";

export function getBibleVersionId(): string | null {
  return localStorage.getItem(BIBLE_VERSION_KEY);
}

export function setBibleVersionId(id: string): void {
  localStorage.setItem(BIBLE_VERSION_KEY, id);
}
