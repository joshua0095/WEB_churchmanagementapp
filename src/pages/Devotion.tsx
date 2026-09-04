import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createAnnouncement,
  createDevotion,
  deleteDevotion,
  getDevotions,
  updateDevotion,
  type Devotion as ApiDevotion,
  type DevotionRequest,
} from "../api";
import {
  AppShell,
  Button,
  DropdownMenu,
  Modal,
  ProfileMenu,
  SelectField,
  Skeleton,
  VersePicker,
} from "../components/ui";
import { StarIcon } from "../components/ui/icons";
import { confirmDialog } from "../swal";

interface Devo {
  id: number;
  date: Date;
  verse: string;
  scripture: string;
  observation: string;
  application: string;
  prayer: string;
  notes: string;
}

type FilterKey = "all" | "week" | "verse";
type GroupKey = "none" | "week" | "month";

// The API's date field has no timezone suffix (e.g. "2026-09-04T00:00:00"),
// which JS parses as local midnight on that calendar day — exactly what we
// want, no conversion needed.
function fromApi(d: ApiDevotion): Devo {
  return {
    id: d.id,
    date: new Date(d.date),
    verse: d.verse,
    scripture: d.scripture,
    observation: d.observation,
    application: d.application,
    prayer: d.prayer,
    notes: d.notes,
  };
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function isThisWeek(d: Date): boolean {
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return d >= start && d < end;
}

function formatDate(d: Date): string {
  const full = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" });
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  return `${full} (${weekday})`;
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateInputValue(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function truncate(text: string, max = 130): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function weekGroupLabel(d: Date): string {
  const start = startOfWeek(d);
  const thisWeekStart = startOfWeek(new Date());
  const diffWeeks = Math.round((thisWeekStart.getTime() - start.getTime()) / (7 * 86_400_000));
  if (diffWeeks === 0) return "This Week";
  if (diffWeeks === 1) return "Last Week";
  return `Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function monthGroupLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Auto-grows a textarea to fit its content instead of scrolling internally. */
function autoGrowRef(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "week", label: "This week" },
  { key: "verse", label: "By verse" },
];

const SOAP_FIELDS = [
  { key: "scripture", label: "Scripture", placeholder: "The verse or passage text — auto-filled when you pick a verse above, but you can edit it." },
  { key: "observation", label: "Observation", placeholder: "What stands out to you in this passage? What is God showing you?" },
  { key: "application", label: "Application", placeholder: "How will you apply this truth to your life today?" },
  { key: "prayer", label: "Prayer", placeholder: "Write a short prayer responding to what you've read." },
] as const;

interface DevoForm {
  date: string;
  verse: string;
  scripture: string;
  observation: string;
  application: string;
  prayer: string;
  notes: string;
}

const EMPTY_FORM: DevoForm = {
  date: toDateInputValue(new Date()),
  verse: "",
  scripture: "",
  observation: "",
  application: "",
  prayer: "",
  notes: "",
};

function Devotion() {
  const [devos, setDevos] = useState<Devo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [groupBy, setGroupBy] = useState<GroupKey>("none");

  const [modal, setModal] = useState<{ mode: "add" | "edit" | "view"; devo: Devo | null } | null>(null);
  const [form, setForm] = useState<DevoForm>(EMPTY_FORM);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [banner, setBanner] = useState<string | null>(null);

  const loadDevotions = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setDevos((await getDevotions()).map(fromApi));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load devotions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevotions();
  }, []);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(t);
  }, [banner]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = devos;
    if (q) {
      list = list.filter((d) =>
        [formatDate(d.date), d.verse, d.scripture, d.observation, d.application, d.prayer, d.notes]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (filter === "week") {
      list = list.filter((d) => isThisWeek(d.date));
    }
    list = [...list].sort((a, b) =>
      filter === "verse" ? a.verse.localeCompare(b.verse) : b.date.getTime() - a.date.getTime(),
    );
    return list;
  }, [devos, query, filter]);

  // Flags when the date currently chosen in the Add/Edit form already has a
  // devotion — re-checks live as the date field changes, and excludes the
  // entry being edited so editing a devotion in place doesn't flag itself.
  const duplicateDateDevo = useMemo(() => {
    if (modal?.mode !== "add" && modal?.mode !== "edit") return null;
    const selectedDate = parseDateInputValue(form.date);
    return devos.find((d) => d.id !== modal.devo?.id && isSameDay(d.date, selectedDate)) ?? null;
  }, [devos, form.date, modal]);

  const groups = useMemo(() => {
    if (filter === "verse" || groupBy === "none") {
      return [{ key: "all", label: null as string | null, items: visible }];
    }
    const map = new Map<string, { label: string; items: Devo[] }>();
    for (const d of visible) {
      const label = groupBy === "month" ? monthGroupLabel(d.date) : weekGroupLabel(d.date);
      const key = groupBy === "month" ? label : startOfWeek(d.date).toISOString();
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(d);
    }
    return [...map.entries()].map(([key, group]) => ({ key, ...group }));
  }, [visible, groupBy, filter]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setModal({ mode: "add", devo: null });
  };

  const openEdit = (devo: Devo) => {
    setForm({
      date: toDateInputValue(devo.date),
      verse: devo.verse,
      scripture: devo.scripture,
      observation: devo.observation,
      application: devo.application,
      prayer: devo.prayer,
      notes: devo.notes,
    });
    setModal({ mode: "edit", devo });
  };

  const openView = (devo: Devo) => setModal({ mode: "view", devo });
  const closeModal = () => setModal(null);

  const updateForm = (key: keyof DevoForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  // Add: dirty once any field has been typed into (the date defaults to
  // today on its own, so that alone doesn't count). Edit: dirty once the
  // form differs from the devotion it was opened with.
  const isFormDirty =
    modal?.mode === "add"
      ? Object.entries(form).some(([key, value]) => key !== "date" && value.trim() !== "")
      : modal?.mode === "edit" && modal.devo
        ? form.date !== toDateInputValue(modal.devo.date) ||
          form.verse !== modal.devo.verse ||
          form.scripture !== modal.devo.scripture ||
          form.observation !== modal.devo.observation ||
          form.application !== modal.devo.application ||
          form.prayer !== modal.devo.prayer ||
          form.notes !== modal.devo.notes
        : false;

  const closeAddEditModal = async () => {
    if (isFormDirty) {
      const message =
        modal?.mode === "edit"
          ? "Discard your changes to this devotion?"
          : "Discard this devotion? It won't be saved.";
      const confirmed = await confirmDialog({ message, confirmLabel: "Discard", danger: true });
      if (!confirmed) return;
    }
    closeModal();
  };

  const handleSaveModal = async (e: FormEvent) => {
    e.preventDefault();
    if (
      !form.verse.trim() ||
      !form.scripture.trim() ||
      !form.observation.trim() ||
      !form.application.trim() ||
      !form.prayer.trim()
    ) {
      return;
    }
    const payload: DevotionRequest = {
      date: form.date,
      verse: form.verse.trim(),
      scripture: form.scripture.trim(),
      observation: form.observation.trim(),
      application: form.application.trim(),
      prayer: form.prayer.trim(),
      notes: form.notes.trim(),
    };
    setSaving(true);
    try {
      if (modal?.mode === "add") {
        await createDevotion(payload);
      } else if (modal?.mode === "edit" && modal.devo) {
        await updateDevotion(modal.devo.id, payload);
      }
      await loadDevotions();
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Failed to save devotion.");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (devo: Devo) => {
    try {
      await createDevotion({
        date: toDateInputValue(new Date()),
        verse: devo.verse,
        scripture: devo.scripture,
        observation: devo.observation,
        application: devo.application,
        prayer: devo.prayer,
        notes: devo.notes,
      });
      await loadDevotions();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Failed to duplicate devotion.");
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmDialog({ message: "Delete this devotion?", confirmLabel: "Delete", danger: true });
    if (!confirmed) return;
    try {
      await deleteDevotion(id);
      await loadDevotions();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Failed to delete devotion.");
    }
  };

  const handleShare = async (devo: Devo) => {
    try {
      await createAnnouncement({
        eyebrow: devo.verse,
        title: truncate(devo.observation || devo.scripture, 80),
        imageDataUrl: null,
      });
      setBanner(`Shared "${devo.verse}" to Announcements.`);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Failed to share to Announcements.");
    }
  };

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="page-header">
        <h1>Devotions</h1>
        <Button type="button" onClick={openAdd}>
          + Add Devotion
        </Button>
      </div>

      {banner && (
        <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] shadow-sm">
          {banner}
        </div>
      )}

      <div className="mb-5 flex flex-col gap-4">
        <input
          type="text"
          placeholder="Search devotions..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search devotions"
          className="h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text-primary)] outline-none transition-shadow focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(242,183,5,0.25)]"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.key)}
                className={[
                  "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                  filter === chip.key
                    ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-white"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-navy)] hover:text-[var(--color-navy)]",
                ].join(" ")}
              >
                {chip.label}
              </button>
            ))}
            <button
              type="button"
              disabled
              title="Favorites need a new field on the devotion model — see note below the list."
              className="flex cursor-not-allowed items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] opacity-50"
            >
              <StarIcon />
              Favorites
            </button>
          </div>

          <SelectField
            label="Group by"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupKey)}
            className="min-w-40"
          >
            <option value="none">None</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </SelectField>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
              <Skeleton className="mt-2 h-4 w-28" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-1.5 h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <p className="error">{loadError}</p>
      ) : visible.length === 0 ? (
        <p className="helper-text">
          {devos.length === 0 ? "No devotions yet." : "No devotions match your search or filter."}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-3">
              {group.label && (
                <h2 className="font-display text-sm font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  {group.label}
                </h2>
              )}
              <div className="flex flex-col gap-3">
                {group.items.map((devo) => {
                  const today = isSameDay(devo.date, new Date());
                  return (
                    <article
                      key={devo.id}
                      className={[
                        "rounded-xl bg-[var(--color-surface)] p-4 shadow-sm transition-shadow hover:shadow-md",
                        today
                          ? "border border-l-4 border-[var(--color-border)] border-l-[var(--color-gold)]"
                          : "border border-[var(--color-border)]",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-base font-bold text-[var(--color-navy)]">
                            {formatDate(devo.date)}
                          </span>
                          {today && (
                            <span className="inline-flex items-center rounded-full bg-[var(--color-gold)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-on-gold)]">
                              Today
                            </span>
                          )}
                        </div>
                        <DropdownMenu
                          ariaLabel={`Actions for ${devo.verse}`}
                          items={[
                            { label: "Edit", onSelect: () => openEdit(devo) },
                            { label: "View full devotion", onSelect: () => openView(devo) },
                            { label: "Duplicate", onSelect: () => handleDuplicate(devo) },
                            { label: "Share to announcements", onSelect: () => handleShare(devo) },
                            {
                              label: "Delete",
                              onSelect: () => handleDelete(devo.id),
                              danger: true,
                              dividerBefore: true,
                            },
                          ]}
                        />
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[var(--color-text-secondary)]">{devo.verse}</p>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--color-text-primary)]">
                        {truncate(devo.observation || devo.scripture)}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-[var(--color-text-secondary)]">
        Favorites filter is disabled — see the summary for what it needs before it can go live.
      </p>

      <Modal
        open={modal?.mode === "add" || modal?.mode === "edit"}
        onClose={closeAddEditModal}
        title={modal?.mode === "edit" ? "Edit Devotion" : "Add Devotion"}
        size="lg"
        closeOnBackdropClick={false}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeAddEditModal}>
              Cancel
            </Button>
            <Button type="submit" form="devo-form" disabled={!!duplicateDateDevo || saving}>
              {saving ? "Saving..." : "Save Devotion"}
            </Button>
          </>
        }
      >
        <form id="devo-form" onSubmit={handleSaveModal} className="flex flex-col gap-4">
          <label className="ui-field">
            <span className="ui-field-label">Date</span>
            <input
              className="ui-field-input"
              type="date"
              value={form.date}
              onChange={(e) => updateForm("date", e.target.value)}
              required
            />
          </label>

          {duplicateDateDevo && (
            <div className="flex flex-col items-start rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
              <p className="m-1">
                You already have a devotion for{" "}
                {isSameDay(parseDateInputValue(form.date), new Date())
                  ? "today"
                  : formatDate(parseDateInputValue(form.date))}
                . Change the date to add a new devotion, or edit the existing one instead.
              </p>
              <button
                type="button"
                onClick={() => openEdit(duplicateDateDevo)}
                className="mt-0 rounded-lg border-0 bg-amber-900 px-3.5 py-1.5 text-sm font-semibold text-amber-50 transition-opacity hover:opacity-90"
              >
                Edit that devotion instead
              </button>
            </div>
          )}

          <div className="ui-field">
            <span className="ui-field-label">Scripture reference</span>
            <div className="flex gap-2">
              <input
                className="ui-field-input flex-1 disabled:opacity-60"
                value={form.verse}
                readOnly
                disabled={!!duplicateDateDevo}
                placeholder="No verse selected yet"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPickerOpen(true)}
                disabled={!!duplicateDateDevo}
              >
                Select verse
              </Button>
            </div>
          </div>

          {SOAP_FIELDS.map((field) => (
            <label key={field.key} className="ui-field">
              <span className="ui-field-label">{field.label}</span>
              <textarea
                ref={autoGrowRef}
                className="min-h-36 w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 font-sans text-sm text-[var(--color-text-primary)] outline-none transition-shadow focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(242,183,5,0.25)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-28"
                value={form[field.key]}
                onChange={(e) => updateForm(field.key, e.target.value)}
                onInput={(e) => autoGrowRef(e.currentTarget)}
                placeholder={field.placeholder}
                disabled={!!duplicateDateDevo}
                required
              />
            </label>
          ))}

          <label className="ui-field">
            <span className="ui-field-label">Notes / comments (optional)</span>
            <textarea
              ref={autoGrowRef}
              className="min-h-24 w-full resize-none overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 font-sans text-sm text-[var(--color-text-primary)] outline-none transition-shadow focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(242,183,5,0.25)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-20"
              value={form.notes}
              onChange={(e) => updateForm("notes", e.target.value)}
              onInput={(e) => autoGrowRef(e.currentTarget)}
              placeholder="Anything else you'd like to remember (optional)."
              disabled={!!duplicateDateDevo}
            />
          </label>
        </form>
      </Modal>

      <VersePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(result) => {
          setForm((prev) => ({ ...prev, verse: result.reference, scripture: result.text }));
          setPickerOpen(false);
        }}
      />

      <Modal
        open={modal?.mode === "view"}
        onClose={closeModal}
        title={modal?.devo?.verse ?? "Devotion"}
        footer={
          <Button type="button" onClick={closeModal}>
            Close
          </Button>
        }
      >
        {modal?.devo && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-[var(--color-text-secondary)]">{formatDate(modal.devo.date)}</p>
            {(
              [
                ["Scripture", modal.devo.scripture],
                ["Observation", modal.devo.observation],
                ["Application", modal.devo.application],
                ["Prayer", modal.devo.prayer],
                ["Notes", modal.devo.notes],
              ] as const
            )
              .filter(([, value]) => value.trim().length > 0)
              .map(([label, value]) => (
                <div key={label}>
                  <p className="font-display text-sm font-bold text-[var(--color-navy)]">{label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
                    {value}
                  </p>
                </div>
              ))}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

export default Devotion;
