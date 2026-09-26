import type { BulkDevotionRow } from "../api";

/**
 * Plain-text format for Admin/MIS bulk devotion uploads — one worker's journal, written the
 * way people already keep it: a date line ("September 1") starts each devotion, followed by
 * `Scripture:`, `Observation:`, `Application:` and `Prayer:` sections (plus an optional
 * `Notes:`). A section's text can sit on the label line or the lines after it. The verse
 * reference goes on the last (or first) line of the Scripture section, or under its own
 * `Verse:` label.
 */
export const BULK_TEMPLATE = `September 1
Scripture:
Come to me, all you who are weary and burdened, and I will give you rest. Take my yoke upon you and learn from me, for I am gentle and humble in heart, and you will find rest for your souls.
Matthew 11:28–29 (NIV)
Observation:
Jesus invites the tired rather than the impressive, offering rest instead of more pressure. He describes Himself as gentle and humble, which makes coming to Him safe. Rest here isn't just physical; it reaches the soul.
Application:
I will bring my weariness to Jesus instead of trying to push through on my own strength.
Prayer:
Jesus, I'm tired in ways I can't fix myself. Thank you for being gentle. I'm coming to you for rest. Amen
`;

const SECTIONS = ["scripture", "verse", "observation", "application", "prayer", "notes"] as const;
type Section = (typeof SECTIONS)[number];
const REQUIRED: Section[] = ["scripture", "observation", "application", "prayer"];
const LABELS: Record<Section, string> = {
  scripture: "Scripture",
  verse: "Verse",
  observation: "Observation",
  application: "Application",
  prayer: "Prayer",
  notes: "Notes",
};

const SECTION_LINE = new RegExp(`^\\s*(${SECTIONS.join("|")})\\s*:\\s*(.*)$`, "i");

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** Full names plus common abbreviations only — never a loose prefix match, so a line like
 * "Mark 5" (a book of the Bible) is never mistaken for March 5. */
const MONTHS = new Map<string, number>(
  MONTH_NAMES.flatMap((name, i) => [
    [name, i + 1],
    [name.slice(0, 3), i + 1],
  ]),
);
MONTHS.set("sept", 9);
// "September 1", "Sept. 1st, 2026", "Monday, September 1"
const WORDY_DATE =
  /^\s*(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+)?([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\s*$/i;
const ISO_DATE = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/;
const SLASH_DATE = /^\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*$/;

// "Matthew 11:28–29 (NIV)", "1 John 4:8", "Psalm 23", "Song of Songs 2:4, 6".
const REFERENCE =
  /^(?:[1-3]\s?)?[a-z][a-z.' ]*?\s+\d{1,3}(?::\d{1,3}(?:\s*[-–—]\s*\d{1,3}(?::\d{1,3})?)?(?:\s*,\s*\d{1,3}(?:\s*[-–—]\s*\d{1,3})?)*)?(?:\s*\([a-z0-9 ]+\))?\s*$/i;

export interface ParsedDevotion {
  /** 1-based line of this devotion's date line in the file — how errors point back into it. */
  line: number;
  /** The date line exactly as written, for the preview when it can't be understood. */
  dateText: string;
  /** Normalized YYYY-MM-DD, or null when unparseable. */
  isoDate: string | null;
  verse: string;
  scripture: string;
  observation: string;
  application: string;
  prayer: string;
  notes: string;
  /** Problems that block the upload until the file is fixed. */
  errors: string[];
  /** Set when this date repeats an earlier row or one the worker already has — the uploader
   * can choose to skip these rows instead of fixing the file. */
  duplicate: string | null;
}

function toIso(y: number, m: number, d: number): string | null {
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** A date written without a year means the most recent one that isn't in the future —
 * so December entries uploaded in January land in last year, not eleven months ahead. */
function withInferredYear(m: number, d: number, today: Date): string | null {
  const thisYear = today.getFullYear();
  const iso = toIso(thisYear, m, d);
  if (!iso) return toIso(thisYear - 1, m, d); // Feb 29 in a non-leap year
  return new Date(thisYear, m - 1, d) > today ? toIso(thisYear - 1, m, d) : iso;
}

/** Returns undefined when the line isn't a date line at all, null when it looks like one but is invalid. */
function parseDateLine(line: string, today: Date): string | null | undefined {
  let match = line.match(WORDY_DATE);
  if (match) {
    const month = MONTHS.get(match[1].toLowerCase());
    if (month === undefined) return undefined;
    const day = Number(match[2]);
    return match[3] ? toIso(Number(match[3]), month, day) : withInferredYear(month, day, today);
  }
  if ((match = line.match(ISO_DATE))) return toIso(Number(match[1]), Number(match[2]), Number(match[3]));
  if ((match = line.match(SLASH_DATE))) {
    const [m, d] = [Number(match[1]), Number(match[2])];
    return match[3] ? toIso(Number(match[3]), m, d) : withInferredYear(m, d, today);
  }
  return undefined;
}

interface RawBlock {
  line: number;
  dateText: string;
  isoDate: string | null;
  sections: Partial<Record<Section, string>>;
  errors: string[];
}

export function parseBulkDevotions(text: string, today = new Date()): ParsedDevotion[] {
  const blocks: RawBlock[] = [];
  let block: RawBlock | null = null;
  let current: Section | null = null;
  let strayLine: number | null = null;

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNo = index + 1;

    // Only a line with no section in progress — or right after a finished Prayer/Notes —
    // can start a new devotion; inside Scripture a line like "Psalm 23" is the reference.
    const date = current === "scripture" || current === "verse" ? undefined : parseDateLine(rawLine, today);
    if (date !== undefined) {
      block = { line: lineNo, dateText: rawLine.trim(), isoDate: date, sections: {}, errors: [] };
      if (date === null) block.errors.push(`"${rawLine.trim()}" isn't a valid date.`);
      blocks.push(block);
      current = null;
      return;
    }

    const section = rawLine.match(SECTION_LINE);
    if (section) {
      if (!block) {
        strayLine ??= lineNo;
        return;
      }
      const name = section[1].toLowerCase() as Section;
      if (block.sections[name] !== undefined) block.errors.push(`${LABELS[name]} appears twice (line ${lineNo}).`);
      block.sections[name] = section[2];
      current = name;
      return;
    }

    if (!rawLine.trim()) {
      if (block && current) block.sections[current] += "\n";
      return;
    }
    if (!block) {
      strayLine ??= lineNo;
      return;
    }
    if (current) {
      block.sections[current] = `${block.sections[current]}\n${rawLine}`;
    } else {
      block.errors.push(`Line ${lineNo} isn't under a section like "Scripture:".`);
    }
  });

  const parsed = blocks.map(finish);
  if (strayLine !== null) {
    parsed.unshift({
      line: strayLine,
      dateText: "",
      isoDate: null,
      verse: "",
      scripture: "",
      observation: "",
      application: "",
      prayer: "",
      notes: "",
      duplicate: null,
      errors: ["Text before the first date. Start each devotion with its date, like \"September 1\"."],
    });
  }
  return markDuplicateDates(parsed);
}

function finish(block: RawBlock): ParsedDevotion {
  const get = (s: Section) => (block.sections[s] ?? "").trim();
  const errors = [...block.errors];

  let scripture = get("scripture");
  let verse = get("verse");
  if (!verse && scripture) {
    // Pull the reference off the Scripture section's last line (the usual spot), else its first.
    const lines = scripture.split("\n");
    const last = lines[lines.length - 1].trim();
    const first = lines[0].trim();
    if (lines.length > 1 && last.length <= 60 && REFERENCE.test(last)) {
      verse = last;
      scripture = lines.slice(0, -1).join("\n").trim();
    } else if (lines.length > 1 && first.length <= 60 && REFERENCE.test(first)) {
      verse = first;
      scripture = lines.slice(1).join("\n").trim();
    }
  }

  const missing = REQUIRED.filter((s) => !get(s)).map((s) => LABELS[s]);
  if (missing.length > 0) errors.push(`Missing ${missing.join(", ")}.`);
  if (get("scripture") && !verse) {
    errors.push("Couldn't find the verse reference — put it on the last line of Scripture, like \"Matthew 11:28–29 (NIV)\".");
  }

  return {
    line: block.line,
    dateText: block.dateText,
    isoDate: block.isoDate,
    verse,
    scripture,
    observation: get("observation"),
    application: get("application"),
    prayer: get("prayer"),
    notes: get("notes"),
    errors,
    duplicate: null,
  };
}

/** Flags a date repeating an earlier row in the file — the first one is the one kept if duplicates are skipped. */
function markDuplicateDates(rows: ParsedDevotion[]): ParsedDevotion[] {
  const firstSeen = new Map<string, number>();
  return rows.map((row) => {
    if (!row.isoDate) return row;
    const first = firstSeen.get(row.isoDate);
    if (first === undefined) {
      firstSeen.set(row.isoDate, row.line);
      return row;
    }
    return { ...row, duplicate: `Same date as the devotion on line ${first}.` };
  });
}

export function toRequestRows(rows: ParsedDevotion[]): BulkDevotionRow[] {
  return rows.map((r) => ({
    line: r.line,
    date: r.isoDate ?? "",
    verse: r.verse,
    scripture: r.scripture,
    observation: r.observation,
    application: r.application,
    prayer: r.prayer,
    notes: r.notes || null,
  }));
}
