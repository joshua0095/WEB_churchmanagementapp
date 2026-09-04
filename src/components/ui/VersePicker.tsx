import { useState } from "react";
import { getBiblePassage, getChapterVerseCount, type VerseOfTheDay } from "../../api";
import { getBibleVersionId } from "../../preferences";
import { findBook, NEW_TESTAMENT_BOOKS, OLD_TESTAMENT_BOOKS } from "./bibleBooks";
import Button from "./Button";
import { BackIcon } from "./icons";
import Modal from "./Modal";
import SelectField from "./SelectField";

interface VersePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (result: VerseOfTheDay) => void;
}

const TILE_CLASS =
  "flex aspect-square items-center justify-center rounded-md border border-[var(--color-border)] bg-white text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-navy)] hover:bg-[var(--color-navy)]/5";

const SELECTED_TILE_CLASS =
  "flex aspect-square items-center justify-center rounded-md border border-[var(--color-navy)] bg-[var(--color-navy)] text-sm font-semibold text-white transition-colors";

const BACK_BUTTON_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text-primary)]";

function numberRange(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i + 1);
}

/**
 * Browse-by-reference verse picker backed by YouVersion's Platform API,
 * styled after the YouVersion app's own Book → Chapter → Verse tile picker.
 * YouVersion has no full-text search endpoint, only passage-by-reference
 * lookup, so this stays a browser rather than a search box. Chapter counts
 * are hardcoded (stable across translations); verse counts are fetched live
 * per chapter since those genuinely vary by translation/versification.
 *
 * Verse selection supports a range: tapping a single tile selects just that
 * verse; tapping a second, different tile extends the selection to a range
 * between the two (YouVersion's passages endpoint accepts "13-15"-style
 * verse ranges directly). Tapping again after a range is selected starts a
 * fresh single-verse selection.
 */
function VersePicker({ open, onClose, onSelect }: VersePickerProps) {
  const [book, setBook] = useState("PSA");
  const [chapter, setChapter] = useState<number | null>(null);
  const [verseCount, setVerseCount] = useState<number | null>(null);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [loadingVerse, setLoadingVerse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerseOfTheDay | null>(null);

  const bookInfo = findBook(book);

  const resetVerseSelection = () => {
    setRangeStart(null);
    setRangeEnd(null);
    setResult(null);
    setError(null);
  };

  const handleBookChange = (code: string) => {
    setBook(code);
    setChapter(null);
    setVerseCount(null);
    resetVerseSelection();
  };

  const handleChapterSelect = async (n: number) => {
    setChapter(n);
    setVerseCount(null);
    resetVerseSelection();
    setLoadingChapter(true);
    try {
      setVerseCount(await getChapterVerseCount(book, n, getBibleVersionId("devotion")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load that chapter.");
    } finally {
      setLoadingChapter(false);
    }
  };

  const fetchRange = async (start: number, end: number) => {
    if (chapter === null) return;
    setResult(null);
    setError(null);
    setLoadingVerse(true);
    try {
      setResult(await getBiblePassage(book, chapter, start, getBibleVersionId("devotion"), end));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to look up that passage.");
    } finally {
      setLoadingVerse(false);
    }
  };

  const handleVerseTileClick = (n: number) => {
    // Start a fresh single-verse selection unless exactly one verse is
    // already selected, in which case this tap extends it into a range.
    const startFresh = rangeStart === null || rangeStart !== rangeEnd;
    const newStart = startFresh ? n : Math.min(rangeStart!, n);
    const newEnd = startFresh ? n : Math.max(rangeStart!, n);
    setRangeStart(newStart);
    setRangeEnd(newEnd);
    void fetchRange(newStart, newEnd);
  };

  const handleUse = () => {
    if (!result) return;
    onSelect(result);
    resetVerseSelection();
  };

  const backToChapters = () => {
    setChapter(null);
    setVerseCount(null);
    resetVerseSelection();
  };

  return (
    <Modal open={open} onClose={onClose} title="Select a Verse">
      <div className="flex flex-col gap-4">
        <SelectField label="Book" value={book} onChange={(e) => handleBookChange(e.target.value)}>
          <optgroup label="Old Testament">
            {OLD_TESTAMENT_BOOKS.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="New Testament">
            {NEW_TESTAMENT_BOOKS.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </optgroup>
        </SelectField>

        {chapter === null && bookInfo && (
          <div>
            <p className="ui-field-label mb-2">Chapter</p>
            <div className="grid max-h-72 grid-cols-5 gap-2 overflow-y-auto pr-1">
              {numberRange(bookInfo.chapters).map((n) => (
                <button key={n} type="button" onClick={() => handleChapterSelect(n)} className={TILE_CLASS}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {chapter !== null && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <button type="button" onClick={backToChapters} aria-label="Back to chapters" className={BACK_BUTTON_CLASS}>
                <BackIcon />
              </button>
              <p className="font-display text-sm font-bold text-[var(--color-navy)]">
                {bookInfo?.name} {chapter}
                {rangeStart !== null && `:${rangeStart === rangeEnd ? rangeStart : `${rangeStart}-${rangeEnd}`}`}
              </p>
            </div>

            {loadingChapter && <p className="text-sm text-[var(--color-text-secondary)]">Loading chapter...</p>}

            {!loadingChapter && verseCount !== null && (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="ui-field-label mb-0">Verse</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Tap a 2nd verse for a range</p>
                </div>
                <div className="grid max-h-72 grid-cols-5 gap-2 overflow-y-auto pr-1">
                  {numberRange(verseCount).map((n) => {
                    const selected = rangeStart !== null && rangeEnd !== null && n >= rangeStart && n <= rangeEnd;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleVerseTileClick(n)}
                        className={selected ? SELECTED_TILE_CLASS : TILE_CLASS}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {loadingVerse && <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Loading verse...</p>}
            {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
            {result && (
              <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5">
                <p className="font-display text-sm font-bold text-[var(--color-navy)]">{result.reference}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-primary)]">{result.text}</p>
                <Button type="button" onClick={handleUse} className="mt-3 w-full">
                  {rangeStart === rangeEnd ? "Use this verse" : "Use these verses"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default VersePicker;
