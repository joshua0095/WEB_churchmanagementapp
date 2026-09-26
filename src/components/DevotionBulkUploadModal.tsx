import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { BulkDevotionUploadError, bulkCreateDevotions, getBulkDevotionWorkers, type BulkWorkerOption } from "../api";
import { BULK_TEMPLATE, parseBulkDevotions, toRequestRows, type ParsedDevotion } from "../utils/devotionBulkUpload";
import { Modal, useToast } from "./dialogs";
import { Button, SelectField } from "./ui";

interface DevotionBulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful import — e.g. to reload the list if the uploader picked themselves. */
  onImported: () => void;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024;

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

/** Admin/MIS: import one worker's devotions from a .txt copy of their journal (format in utils/devotionBulkUpload). */
function DevotionBulkUploadModal({ open, onClose, onImported }: DevotionBulkUploadModalProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [workers, setWorkers] = useState<BulkWorkerOption[] | null>(null);
  const [workerId, setWorkerId] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
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
    setFileText(null);
    setRows(null);
    setFileError(null);
    setSkipDuplicates(false);
  };

  const close = () => {
    if (uploading) return;
    clearFile();
    setWorkerId("");
    onClose();
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
    setFileText(text);
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
      description="Add many devotions for one worker at once from a text file."
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
            if (fileText !== null) setRows(parseBulkDevotions(fileText));
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
        {fileError && <p className="error m-0">{fileError}</p>}

        {rows && (
          <>
            {invalidCount > 0 ? (
              <p className="error m-0">
                {`${invalidCount} of ${rows.length} devotion${rows.length === 1 ? "" : "s"} ${invalidCount === 1 ? "has a problem. Fix it" : "have problems. Fix them"} in the file and choose it again — nothing has been saved.`}
                {duplicateCount > 0 &&
                  ` (${duplicateCount} more ${duplicateCount === 1 ? "has a duplicate date" : "have duplicate dates"} — you'll be able to skip ${duplicateCount === 1 ? "it" : "those"}.)`}
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
                      className={[
                        "border-t border-[var(--color-border)] align-top",
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
