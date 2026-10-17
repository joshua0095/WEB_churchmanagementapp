import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { BulkDevotionUploadError, bulkCreateDevotions, getBulkDevotionWorkers, type BulkWorkerOption } from "../api";
import { BULK_TEMPLATE, parseBulkDevotions, toRequestRows, type ParsedDevotion } from "../utils/devotionBulkUpload";
import { Modal, useConfirm, useToast } from "./dialogs";
import { Button, SegmentedControl, SelectField } from "./ui";
import { CalendarIcon } from "./ui/icons";

interface DevotionBulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful import — e.g. to reload the list if the uploader picked themselves. */
  onImported: () => void;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Source = "file" | "paste";
const SOURCE_OPTIONS: { value: Source; label: string }[] = [
  { value: "file", label: "Upload file" },
  { value: "paste", label: "Paste text" },
];

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([BULK_TEMPLATE], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "devotions-template.txt";
  a.click();
  URL.revokeObjectURL(url);
}

function formatPreviewDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Sep 1, 2026", "Sep 1 – Sep 30, 2026", or "Dec 1, 2025 – Jan 15, 2026" across years. */
function formatDateSpan(isoDates: string[]): string {
  const sorted = [...isoDates].sort();
  const toDate = (iso: string) => new Date(`${iso}T00:00:00`);
  const full = (iso: string) => toDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === last) return full(first);
  if (first.slice(0, 4) === last.slice(0, 4)) {
    return `${toDate(first).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${full(last)}`;
  }
  return `${full(first)} – ${full(last)}`;
}

/** Admin/MIS: import one worker's devotions from a .txt copy of their journal, or the same text pasted
 * in (format in utils/devotionBulkUpload). Pasted text is checked as it's typed. */
function DevotionBulkUploadModal({ open, onClose, onImported }: DevotionBulkUploadModalProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [workers, setWorkers] = useState<BulkWorkerOption[] | null>(null);
  const [workerId, setWorkerId] = useState("");
  const [source, setSource] = useState<Source>("file");
  const [fileName, setFileName] = useState<string | null>(null);
  /** The text the preview rows were parsed from — the chosen file's contents, or the pasted text. */
  const [sourceText, setSourceText] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedDevotion[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(false);

  useEffect(() => {
    if (!open || workers) return;
    getBulkDevotionWorkers()
      .then(setWorkers)
      .catch((err) => setFileError(err instanceof Error ? err.message : "Failed to load workers"));
  }, [open, workers]);

  const clearFile = () => {
    setFileName(null);
    setSourceText(null);
    setRows(null);
    setFileError(null);
    setSkipDuplicates(false);
  };

  const close = () => {
    if (uploading) return;
    clearFile();
    setWorkerId("");
    setSource("file");
    onClose();
  };

  const switchSource = (next: Source) => {
    if (next === source) return;
    clearFile();
    setSource(next);
  };

  /** Re-parses on every edit, so the preview (and its problems) always matches the text. */
  const handlePaste = (text: string) => {
    setSourceText(text);
    setFileError(null);
    if (!text.trim()) {
      setRows(null);
      return;
    }
    const parsed = parseBulkDevotions(text);
    if (parsed.length === 0) {
      setRows(null);
      setFileError('No devotions found yet. Each one should start with its date, like "September 1".');
      return;
    }
    setRows(parsed);
  };

  /** A file with problems can be fixed right here instead of editing it and choosing it again. */
  const editFileAsText = () => {
    setFileName(null);
    // The textarea holds "\n" line endings; match them so jumpToLine's offsets line up.
    setSourceText((text) => text?.replace(/\r\n/g, "\n") ?? null);
    setSource("paste");
  };

  /** Selects a devotion's date line in the textarea so the problem is easy to find. */
  const jumpToLine = (line: number) => {
    const el = textareaRef.current;
    if (!el || sourceText === null) return;
    const lines = sourceText.split("\n");
    const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
    el.focus();
    el.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.scrollTop = Math.max(0, (line - 3) * lineHeight);
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    clearFile();
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setFileError("That file is too large. Split it into smaller files (under 2 MB each).");
      return;
    }
    const text = await file.text();
    const parsed = parseBulkDevotions(text);
    if (parsed.length === 0) {
      setFileError('No devotions found in that file. Each one should start with its date, like "September 1".');
      return;
    }
    setSourceText(text);
    setRows(parsed);
  };

  const worker = workers?.find((w) => String(w.id) === workerId) ?? null;
  const invalidCount = rows?.filter((r) => r.errors.length > 0).length ?? 0;
  // A row with a real error counts as invalid even if its date is also a duplicate.
  const duplicateCount = rows?.filter((r) => r.duplicate && r.errors.length === 0).length ?? 0;
  const importCount = (rows?.length ?? 0) - (skipDuplicates ? duplicateCount : 0);
  const canImport =
    !!worker && !!rows && invalidCount === 0 && (duplicateCount === 0 || skipDuplicates) && importCount > 0 && !uploading;

  const handleImport = async () => {
    if (!worker || !rows || !canImport) return;

    // Last check before saving: whose journal these land in, and which dates they cover.
    const importDates = rows
      .filter((r) => !(skipDuplicates && r.duplicate))
      .map((r) => r.isoDate)
      .filter((d): d is string => d !== null);
    const ok = await confirm({
      title: `Add ${importCount} devotion${importCount === 1 ? "" : "s"} for ${worker.name}?`,
      description: `They'll be added to ${worker.name}'s devotions for ${formatDateSpan(importDates)}.${
        skipDuplicates && duplicateCount > 0
          ? ` ${duplicateCount} with a duplicate date will be skipped.`
          : ""
      }`,
      confirmLabel: "Import",
      danger: false,
      icon: <CalendarIcon />,
    });
    if (!ok) return;

    setUploading(true);
    try {
      const { imported, skipped } = await bulkCreateDevotions(worker.id, toRequestRows(rows), skipDuplicates);
      toast.show({
        type: "success",
        title: `Imported ${imported} devotion${imported === 1 ? "" : "s"} for ${worker.name}`,
        ...(skipped > 0 && { message: `Skipped ${skipped} with duplicate dates.` }),
      });
      clearFile();
      setWorkerId("");
      setSource("file");
      onImported();
      onClose();
    } catch (err) {
      if (err instanceof BulkDevotionUploadError) {
        // Server-side problems — pin them to their rows so the preview shows exactly what to
        // fix. "Already has a devotion that day" is a duplicate, which the uploader can skip.
        const byLine = new Map<number, typeof err.rowErrors>();
        for (const e of err.rowErrors) byLine.set(e.line, [...(byLine.get(e.line) ?? []), e]);
        setRows(
          (prev) =>
            prev?.map((r) => {
              const found = byLine.get(r.line);
              if (!found) return r;
              const dup = found.find((e) => e.kind === "duplicate");
              return {
                ...r,
                duplicate: r.duplicate ?? dup?.message ?? null,
                errors: [...r.errors, ...found.filter((e) => e.kind !== "duplicate").map((e) => e.message)],
              };
            }) ?? null,
        );
      } else {
        setFileError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  const importLabel = uploading
    ? "Importing…"
    : rows
      ? `Import ${importCount} devotion${importCount === 1 ? "" : "s"}`
      : "Import";

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Bulk upload devotions"
      description="Add many devotions for one worker at once from a text file or pasted text."
      footer={
        <>
          <Button type="button" variant="outline" onClick={close} disabled={uploading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleImport} disabled={!canImport}>
            {importLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SelectField
          label="Worker"
          value={workerId}
          onChange={(e) => {
            setWorkerId(e.target.value);
            // Server errors like "already has a devotion that day" belonged to the old worker.
            if (sourceText !== null && rows) setRows(parseBulkDevotions(sourceText));
          }}
          disabled={!workers || uploading}
        >
          <option value="">{workers ? "Select a worker…" : "Loading workers…"}</option>
          {workers?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.email})
            </option>
          ))}
        </SelectField>

        <div className="rounded-md bg-black/[0.03] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          <p className="m-0">
            Start each devotion with its date (like <strong>September 1</strong>), then the <strong>Scripture:</strong>,{" "}
            <strong>Observation:</strong>, <strong>Application:</strong> and <strong>Prayer:</strong> sections. Put the
            verse reference on the last line of Scripture. A date without a year counts as the most recent one.
          </p>
        </div>

        <SegmentedControl
          aria-label="How to add devotions"
          options={SOURCE_OPTIONS}
          value={source}
          onChange={switchSource}
          disabled={uploading}
        />

        {source === "file" ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={downloadTemplate}>
                Download template
              </Button>
              <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
                {fileName ? "Choose a different file" : "Choose .txt file"}
              </Button>
              <input ref={inputRef} type="file" accept=".txt,text/plain" className="hidden" onChange={handleFile} />
            </div>
            {fileName && <p className="m-0 text-sm font-semibold text-[var(--color-text-primary)]">{fileName}</p>}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="bulk-devotion-text" className="text-sm font-semibold text-[var(--color-text-primary)]">
                Devotions text
              </label>
              {!sourceText && (
                <Button type="button" variant="outline" onClick={() => handlePaste(BULK_TEMPLATE)} disabled={uploading}>
                  Paste an example
                </Button>
              )}
            </div>
            <textarea
              id="bulk-devotion-text"
              ref={textareaRef}
              className="ui-field-input min-h-56 resize-y font-mono text-xs leading-5"
              value={sourceText ?? ""}
              onChange={(e) => handlePaste(e.target.value)}
              placeholder={"September 1\nScripture:\n…\nBook 1:1 (NIV)\nObservation:\n…\nApplication:\n…\nPrayer:\n…"}
              spellCheck={false}
              disabled={uploading}
              aria-invalid={invalidCount > 0 ? true : undefined}
            />
          </div>
        )}
        {fileError && <p className="error m-0">{fileError}</p>}

        {rows && (
          <>
            {invalidCount > 0 ? (
              <p className="error m-0">
                {`${invalidCount} of ${rows.length} devotion${rows.length === 1 ? "" : "s"} ${invalidCount === 1 ? "has a problem. Fix it" : "have problems. Fix them"} ${source === "paste" ? "in the text above — click a row to jump to it" : "in the file and choose it again"}. Nothing has been saved.`}
                {duplicateCount > 0 &&
                  ` (${duplicateCount} more ${duplicateCount === 1 ? "has a duplicate date" : "have duplicate dates"} — you'll be able to skip ${duplicateCount === 1 ? "it" : "those"}.)`}
                {source === "file" && (
                  <>
                    {" "}
                    <button type="button" className="font-semibold underline" onClick={editFileAsText} disabled={uploading}>
                      Fix it here instead
                    </button>
                  </>
                )}
              </p>
            ) : duplicateCount > 0 ? (
              <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
                <p className="m-0 text-sm font-semibold text-amber-900">
                  {`${duplicateCount} of ${rows.length} devotion${rows.length === 1 ? "" : "s"} ${duplicateCount === 1 ? "has a duplicate date" : "have duplicate dates"}.`}
                </p>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    disabled={uploading}
                  />
                  <span>
                    {rows.length > duplicateCount
                      ? `Skip ${duplicateCount === 1 ? "it" : `these ${duplicateCount}`} and import the other ${rows.length - duplicateCount}. The devotion already saved for that date (or the first one in the file) is kept.`
                      : "Skip them — but every devotion in this file is a duplicate, so there's nothing new to import."}
                  </span>
                </label>
              </div>
            ) : (
              <p className="m-0 text-sm text-[var(--color-text-secondary)]">
                {`${rows.length} devotion${rows.length === 1 ? "" : "s"} ready to import${worker ? ` for ${worker.name}` : " — select a worker above"}.`}
              </p>
            )}
            <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-black/[0.03] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Line</th>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Verse</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.line}
                      onClick={source === "paste" ? () => jumpToLine(r.line) : undefined}
                      title={source === "paste" ? `Go to line ${r.line}` : undefined}
                      className={[
                        "border-t border-[var(--color-border)] align-top",
                        source === "paste" ? "cursor-pointer hover:bg-black/[0.03]" : "",
                        r.errors.length > 0 ? "bg-red-50" : r.duplicate ? "bg-amber-50" : "",
                        r.errors.length === 0 && r.duplicate && skipDuplicates ? "opacity-60" : "",
                      ].join(" ")}
                    >
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{r.line}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {r.isoDate ? formatPreviewDate(r.isoDate) : r.dateText || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.verse || "—"}
                        {r.errors.map((msg) => (
                          <p key={msg} className="error m-0 mt-1 text-xs">
                            {msg}
                          </p>
                        ))}
                        {r.duplicate && (
                          <p className="m-0 mt-1 text-xs text-amber-800">
                            {r.duplicate}
                            {r.errors.length === 0 && skipDuplicates && " Will be skipped."}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default DevotionBulkUploadModal;
