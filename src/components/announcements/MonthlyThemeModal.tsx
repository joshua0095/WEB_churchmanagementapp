import { useEffect, useState } from "react";
import { deleteMonthlyTheme, getMonthlyThemes, monthlyThemeImageSrc, saveMonthlyTheme, type MonthlyThemeInfo } from "../../api";
import { addMonths, formatThemeMonth, monthName, themeAltText } from "../../monthlyTheme";
import { Modal, useConfirm, useToast } from "../dialogs";
import Button from "../ui/Button";
import Skeleton from "../ui/Skeleton";
import { ThemeCard } from "./HomeCards";
import ImageDropZone from "./ImageDropZone";
import { prepareThemePoster } from "./imageFiles";

interface MonthlyThemeModalProps {
  open: boolean;
  onClose: () => void;
  /** The current Manila month ("yyyy-MM"); the Month select offers it and the next two. */
  currentMonth: string;
  /** Preselected month — whichever card/notice opened the modal. */
  initialMonth: string;
  onSaved: () => void;
}

/** Upload / replace / remove a month's theme poster, with a live "Preview on Home". */
function MonthlyThemeModal({ open, onClose, currentMonth, initialMonth, onSaved }: MonthlyThemeModalProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [month, setMonth] = useState(initialMonth);
  // undefined = loading this month's saved theme; null = nothing saved yet.
  const [existing, setExisting] = useState<MonthlyThemeInfo | null | undefined>(undefined);
  const [picked, setPicked] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [removed, setRemoved] = useState(false);
  const [name, setName] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setMonth(initialMonth);
  }, [open, initialMonth]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setExisting(undefined);
    setPicked(null);
    setRemoved(false);
    setError(null);
    getMonthlyThemes(month)
      .then((overview) => {
        if (cancelled) return;
        setExisting(overview.current);
        setName(overview.current?.name ?? "");
      })
      .catch((err) => {
        if (cancelled) return;
        setExisting(null);
        setError(err instanceof Error ? err.message : "Couldn't load this month's theme.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, month]);

  const pickImage = async (file: File) => {
    setError(null);
    setImageBusy(true);
    try {
      setPicked(await prepareThemePoster(file));
      setRemoved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that image.");
    } finally {
      setImageBusy(false);
    }
  };

  const removeImage = () => {
    setPicked(null);
    setRemoved(true);
  };

  const imageSrc = picked?.previewUrl ?? (existing && !removed ? monthlyThemeImageSrc(existing) : null);
  const label = formatThemeMonth(month);

  const save = async () => {
    setError(null);
    if (!imageSrc && !existing) {
      setError("Choose a poster image.");
      return;
    }
    setSaving(true);
    try {
      if (!imageSrc && existing) {
        const ok = await confirm({
          title: `Remove the ${label} theme?`,
          description: "Home will hide the theme card for that month until a new poster is uploaded.",
          confirmLabel: "Remove theme",
        });
        if (!ok) return;
        await deleteMonthlyTheme(month);
        toast.show({ type: "success", title: `${monthName(month)} theme removed` });
      } else {
        await saveMonthlyTheme(month, picked?.blob ?? null, name.trim() || null);
        toast.show({ type: "success", title: `${monthName(month)} theme saved` });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the theme.");
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || imageBusy;
  const monthOptions = [0, 1, 2].map((i) => addMonths(currentMonth, i));

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      size="xl"
      title="Monthly theme"
      bodyClassName="ann-split ann-split--theme"
      footer={
        <div className="ann-modal-footer ann-modal-footer--end">
          <div className="ann-modal-footer-buttons">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={busy || existing === undefined}>
              {saving ? "Saving…" : "Save theme"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="ann-split-fields">
        <div className="ann-field">
          <label className="ann-label" htmlFor="theme-month">
            Month
          </label>
          <select id="theme-month" className="ann-input" value={month} onChange={(e) => setMonth(e.target.value)} disabled={busy}>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {formatThemeMonth(m)}
                {m === currentMonth ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="ann-field">
          <label className="ann-label" htmlFor="theme-poster">
            Theme poster <span className="ann-label-hint">· 16:9 image</span>
          </label>
          {existing === undefined ? (
            <Skeleton className="aspect-video w-full rounded-[14px]" />
          ) : (
            <ImageDropZone
              id="theme-poster"
              src={imageSrc}
              alt={themeAltText(month, name || null)}
              busy={imageBusy}
              onPick={pickImage}
              onRemove={removeImage}
            />
          )}
          <p className="ann-hint">Use the JIL Worldwide poster. JPG or PNG, 1920×1080 works best.</p>
        </div>

        <div className="ann-field">
          <label className="ann-label" htmlFor="theme-name">
            Theme name <span className="ann-label-hint">· optional</span>
          </label>
          <input
            id="theme-name"
            className="ann-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Breakthrough: Goodness That Transforms"
            aria-describedby="theme-name-hint"
            disabled={existing === undefined}
          />
          <p id="theme-name-hint" className="ann-hint">
            Read aloud by screen readers, since the words are inside the image.
          </p>
        </div>

        {error && (
          <p className="ann-field-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <aside className="ann-split-preview" aria-label="Preview on Home">
        <p className="ann-preview-label">Preview on Home</p>
        {imageSrc ? (
          <ThemeCard monthLabel={label} imageSrc={imageSrc} alt="" className="ann-preview-theme" />
        ) : (
          <div className="ann-preview-empty">No poster yet. Home hides the theme card until one is uploaded.</div>
        )}
        <p className="ann-preview-note">Goes live on the 1st of the month and stays until the next month's poster takes over.</p>
      </aside>
    </Modal>
  );
}

export default MonthlyThemeModal;
