import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createAnnouncement,
  createDevotion,
  deleteDevotion,
  getBibleVersions,
  versionShortLabel,
  getDevotions,
  updateDevotion,
  type Devotion as ApiDevotion,
  type DevotionRequest,
} from "../api";
import { isAdmin, isMis } from "../auth";
import DevotionBulkUploadModal from "../components/DevotionBulkUploadModal";
import DevotionWeekReportModal from "../components/DevotionWeekReportModal";
import { Modal, useConfirm, useToast } from "../components/dialogs";
import {
  AppShell,
  Button,
  DropdownMenu,
  Pagination,
  ProfileMenu,
  Skeleton,
  ToolbarMenu,
  VersePicker,
  type ToolbarMenuEntry,
} from "../components/ui";
import { StarIcon } from "../components/ui/icons";
import { KebabIcon, NavDevotionIcon, TopbarSearchIcon } from "../components/ui/shellIcons";
import { getBibleVersionId, getDevotionListPrefs, setDevotionListPrefs, type DevotionListPrefs } from "../preferences";

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

type FilterKey = "all" | "week";

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

/** "September 19, 2026" — the muted date beside a card's reference. */
function formatCardDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** "Sep 19, 2026" — the tighter date used on grid tiles. */
function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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

function groupKeyOf(d: Date, groupBy: DevotionListPrefs["groupBy"]): string {
  if (groupBy === "year") return String(d.getFullYear());
  if (groupBy === "month") return monthGroupLabel(d);
  return startOfWeek(d).toISOString();
}

function groupLabelOf(d: Date, groupBy: DevotionListPrefs["groupBy"]): string {
  if (groupBy === "year") return String(d.getFullYear());
  if (groupBy === "month") return monthGroupLabel(d);
  return weekGroupLabel(d);
}

const svgProps = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const SortIcon = () => (
  <svg {...svgProps}>
    <path d="M6 16V4M3 7l3-3 3 3M14 4v12M11 13l3 3 3-3" />
  </svg>
);
const ViewIcon = () => (
  <svg {...svgProps}>
    <rect x="3" y="4" width="14" height="12" rx="2" />
    <path d="M3 8h14" />
  </svg>
);
const CardsIcon = () => (
  <svg {...svgProps}>
    <rect x="3" y="3" width="14" height="6" rx="1.5" />
    <rect x="3" y="11" width="14" height="6" rx="1.5" />
  </svg>
);
const ListIcon = () => (
  <svg {...svgProps}>
    <rect x="3" y="3.5" width="14" height="3.5" rx="1" />
    <rect x="3" y="8.25" width="14" height="3.5" rx="1" />
    <rect x="3" y="13" width="14" height="3.5" rx="1" />
  </svg>
);
const GridIcon = () => (
  <svg {...svgProps}>
    <rect x="2.5" y="3" width="4" height="6" rx="1" />
    <rect x="8" y="3" width="4" height="6" rx="1" />
    <rect x="13.5" y="3" width="4" height="6" rx="1" />
    <rect x="2.5" y="11" width="4" height="6" rx="1" />
    <rect x="8" y="11" width="4" height="6" rx="1" />
    <rect x="13.5" y="11" width="4" height="6" rx="1" />
  </svg>
);
const CompactIcon = () => (
  <svg {...svgProps}>
    <path d="M7 5h10M7 10h10M7 15h10M3.5 5h.01M3.5 10h.01M3.5 15h.01" />
  </svg>
);
const ExpandedIcon = () => (
  <svg {...svgProps}>
    <rect x="3" y="3" width="14" height="14" rx="1.5" />
    <path d="M6 7h8M6 10h8M6 13h5" />
  </svg>
);
const NewestIcon = () => (
  <svg {...svgProps}>
    <path d="M10 16V4M5 9l5-5 5 5" />
  </svg>
);
const OldestIcon = () => (
  <svg {...svgProps}>
    <path d="M10 4v12M5 11l5 5 5-5" />
  </svg>
);
const GroupIcon = () => (
  <svg {...svgProps}>
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="11" y="3" width="6" height="6" rx="1" />
    <rect x="3" y="11" width="6" height="6" rx="1" />
    <rect x="11" y="11" width="6" height="6" rx="1" />
  </svg>
);
type ShowKey = "showDateTile" | "showScripture" | "showObservation" | "showApplication" | "showPrayer" | "showNotes";

/** View-menu "Show" toggles, each listed only under the views that can display it. */
const SHOW_FIELDS: { key: ShowKey; label: string; views: DevotionListPrefs["view"][] }[] = [
  { key: "showDateTile", label: "Date tile", views: ["cards", "compact", "expanded"] },
  { key: "showScripture", label: "Scripture", views: ["cards", "expanded"] },
  { key: "showObservation", label: "Observation", views: ["cards", "expanded"] },
  { key: "showApplication", label: "Application", views: ["expanded"] },
  { key: "showPrayer", label: "Prayer", views: ["expanded"] },
  { key: "showNotes", label: "Notes", views: ["expanded"] },
];

/** Auto-grows a textarea to fit its content instead of scrolling internally. */
function autoGrowRef(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "week", label: "This week" },
];

/** O / A / P steps — Scripture (S) has its own verse-picker markup. */
const REFLECTION_STEPS = [
  { key: "observation", letter: "O", label: "Observation", placeholder: "Write what you notice…", error: "Write what you notice in the passage." },
  { key: "application", letter: "A", label: "Application", placeholder: "Today I will…", error: "Write how you'll apply it today." },
  { key: "prayer", letter: "P", label: "Prayer", placeholder: "Lord, …", error: "Write a short prayer." },
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

type FormErrors = Partial<Record<"verse" | "scripture" | "observation" | "application" | "prayer", string>>;

const EMPTY_FORM: DevoForm = {
  date: toDateInputValue(new Date()),
  verse: "",
  scripture: "",
  observation: "",
  application: "",
  prayer: "",
  notes: "",
};

function validate(form: DevoForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.verse.trim()) errors.verse = "Choose a verse to reflect on.";
  else if (!form.scripture.trim()) errors.scripture = "Add the verse text.";
  for (const step of REFLECTION_STEPS) {
    if (!form[step.key].trim()) errors[step.key] = step.error;
  }
  return errors;
}

function StepHeading({ letter, label, htmlFor }: { letter: string; label: string; htmlFor?: string }) {
  return (
    <div className="devo-step-head">
      <span className="devo-step-letter" aria-hidden="true">
        {letter}
      </span>
      {htmlFor ? (
        <label className="devo-step-title" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="devo-step-title">{label}</span>
      )}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="devo-field-error" id={id}>
      {message}
    </p>
  );
}

function Devotion() {
  const toast = useToast();
  const confirm = useConfirm();

  const [devos, setDevos] = useState<Devo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [prefs, setPrefs] = useState<DevotionListPrefs>(getDevotionListPrefs);
  const { sort, groupBy, view, layout } = prefs;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const listTopRef = useRef<HTMLDivElement>(null);

  const updatePrefs = (patch: Partial<DevotionListPrefs>) =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      setDevotionListPrefs(next);
      return next;
    });

  // A new search/filter/sort/grouping starts back on page 1 rather than an arbitrary later page.
  useEffect(() => {
    setPage(1);
  }, [query, filter, sort, groupBy]);

  const sortEntries: ToolbarMenuEntry[] = [
    { kind: "radio", label: "Newest first", icon: <NewestIcon />, checked: sort === "newest", onSelect: () => updatePrefs({ sort: "newest" }) },
    { kind: "radio", label: "Oldest first", icon: <OldestIcon />, checked: sort === "oldest", onSelect: () => updatePrefs({ sort: "oldest" }) },
    { kind: "divider" },
    {
      kind: "submenu",
      label: "Group by",
      icon: <GroupIcon />,
      items: (
        [
          ["none", "None"],
          ["week", "Week"],
          ["month", "Month"],
          ["year", "Year"],
        ] as const
      ).map(([key, label]) => ({
        kind: "radio" as const,
        label,
        checked: groupBy === key,
        onSelect: () => updatePrefs({ groupBy: key }),
      })),
    },
  ];

  const viewEntries: ToolbarMenuEntry[] = [
    { kind: "radio", label: "Cards", icon: <CardsIcon />, checked: view === "cards", onSelect: () => updatePrefs({ view: "cards" }) },
    { kind: "radio", label: "Compact list", icon: <CompactIcon />, checked: view === "compact", onSelect: () => updatePrefs({ view: "compact" }) },
    { kind: "radio", label: "Full SOAP", icon: <ExpandedIcon />, checked: view === "expanded", onSelect: () => updatePrefs({ view: "expanded" }) },
    { kind: "divider" },
    { kind: "heading", label: "Layout" },
    { kind: "radio", label: "List", icon: <ListIcon />, checked: layout === "list", onSelect: () => updatePrefs({ layout: "list" }) },
    { kind: "radio", label: "Grid", icon: <GridIcon />, checked: layout === "grid", onSelect: () => updatePrefs({ layout: "grid" }) },
    { kind: "divider" },
    { kind: "heading", label: "Show" },
    // Only the fields the current view can display — a compact row is just the date and verse.
    ...SHOW_FIELDS.filter((f) => f.views.includes(view)).map(
      (f): ToolbarMenuEntry => ({
        kind: "check",
        label: f.label,
        checked: prefs[f.key],
        onSelect: () => updatePrefs({ [f.key]: !prefs[f.key] }),
      }),
    ),
  ];

  const [modal, setModal] = useState<{ mode: "add" | "edit" | "view"; devo: Devo | null } | null>(null);
  const [form, setForm] = useState<DevoForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [versionLabel, setVersionLabel] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const canBulkUpload = isAdmin() || isMis();

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

  // The picker fetches in the devotion translation chosen in Settings; its abbreviation
  // labels the verse chip. With no choice made the server default is used, which the API
  // doesn't name, so the chip then shows just the reference.
  useEffect(() => {
    const versionId = getBibleVersionId("devotion");
    if (!versionId) return;
    getBibleVersions()
      .then((versions) => {
        const version = versions.find((v) => v.id === versionId);
        setVersionLabel(version ? versionShortLabel(version) : null);
      })
      .catch(() => {});
  }, []);

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
    const dir = sort === "newest" ? -1 : 1;
    return [...list].sort((a, b) => dir * (a.date.getTime() - b.date.getTime()));
  }, [devos, query, filter, sort]);

  // Flags when the date currently chosen in the Add/Edit form already has a
  // devotion — re-checks live as the date field changes, and excludes the
  // entry being edited so editing a devotion in place doesn't flag itself.
  const duplicateDateDevo = useMemo(() => {
    if (modal?.mode !== "add" && modal?.mode !== "edit") return null;
    const selectedDate = parseDateInputValue(form.date);
    return devos.find((d) => d.id !== modal.devo?.id && isSameDay(d.date, selectedDate)) ?? null;
  }, [devos, form.date, modal]);

  // Paged client-side: the list is only ever this user's own devotions (at most one a day),
  // so fetching them all stays cheap while search, filters, grouping and the duplicate-date
  // check keep working across everything — only rendering is limited to one page of cards.
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => visible.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [visible, currentPage, pageSize],
  );

  const groups = useMemo(() => {
    if (groupBy === "none") {
      return [{ key: "all", label: null as string | null, items: pageItems, total: visible.length }];
    }
    const keyOf = (d: Devo) => groupKeyOf(d.date, groupBy);
    // A month/week can straddle two pages — its header count still reflects the whole group.
    const totals = new Map<string, number>();
    for (const d of visible) totals.set(keyOf(d), (totals.get(keyOf(d)) ?? 0) + 1);
    const map = new Map<string, { label: string; items: Devo[] }>();
    for (const d of pageItems) {
      const key = keyOf(d);
      if (!map.has(key)) map.set(key, { label: groupLabelOf(d.date, groupBy), items: [] });
      map.get(key)!.items.push(d);
    }
    return [...map.entries()].map(([key, group]) => ({ key, ...group, total: totals.get(key) ?? group.items.length }));
  }, [visible, pageItems, groupBy]);

  const goToPage = (next: number) => {
    setPage(next);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, date: toDateInputValue(new Date()) });
    setErrors({});
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
    setErrors({});
    setModal({ mode: "edit", devo });
  };

  const openView = (devo: Devo) => setModal({ mode: "view", devo });
  const closeModal = () => setModal(null);

  // Deep links from the Home screen's "Time in the Word" card: ?compose=today opens a new
  // devotion for today, ?open=today opens today's devotion (or a new one if there isn't one
  // yet). Handled once the list has loaded, then stripped so a refresh doesn't reopen it.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (loading) return;
    const compose = searchParams.get("compose") === "today";
    const open = searchParams.get("open") === "today";
    if (!compose && !open) return;
    const todays = open ? devos.find((d) => isSameDay(d.date, new Date())) : undefined;
    if (todays) {
      openView(todays);
    } else {
      setForm({ ...EMPTY_FORM, date: toDateInputValue(new Date()) });
      setErrors({});
      setModal({ mode: "add", devo: null });
    }
    setSearchParams({}, { replace: true });
  }, [loading, devos, searchParams, setSearchParams]);

  const updateForm = (key: keyof DevoForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

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
      const confirmed = await confirm(
        modal?.mode === "edit"
          ? { title: "Discard your changes?", description: "Your edits to this devotion won't be saved.", confirmLabel: "Discard" }
          : { title: "Discard this devotion?", description: "What you've written won't be saved.", confirmLabel: "Discard" },
      );
      if (!confirmed) return;
    }
    closeModal();
  };

  const handleSaveModal = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

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
      toast.show({ type: "success", title: "Devotion saved" });
      await loadDevotions();
      closeModal();
    } catch (err) {
      toast.show({
        type: "error",
        title: "Couldn't save devotion",
        message: err instanceof Error ? err.message : "Please try again.",
      });
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
      toast.show({ type: "success", title: "Devotion duplicated" });
    } catch (err) {
      toast.show({
        type: "error",
        title: "Couldn't duplicate devotion",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  const handleDelete = async (devo: Devo) => {
    const confirmed = await confirm({
      title: "Delete this devotion?",
      description: `${devo.verse} · ${formatCardDate(devo.date)}. This can't be undone.`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;
    try {
      await deleteDevotion(devo.id);
      await loadDevotions();
      toast.show({ type: "success", title: "Devotion deleted" });
    } catch (err) {
      toast.show({
        type: "error",
        title: "Couldn't delete devotion",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  const handleShare = async (devo: Devo) => {
    try {
      await createAnnouncement({
        eyebrow: null,
        title: truncate(devo.observation || devo.scripture, 80),
        content: devo.verse,
        imageDataUrl: null,
        eventDate: null,
      });
      toast.show({ type: "success", title: "Shared to Announcements", message: devo.verse });
    } catch (err) {
      toast.show({
        type: "error",
        title: "Couldn't share to Announcements",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  const formLocked = !!duplicateDateDevo;

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="devo-page">
        <div className="devo-header">
          <div>
            <h1 className="devo-title">Devotions</h1>
            <p className="devo-subtitle">Your SOAP journal: Scripture, Observation, Application, Prayer.</p>
          </div>
          <div className="devo-header-actions">
            {canBulkUpload && (
              <button
                type="button"
                className="devo-write-btn devo-bulk-btn"
                onClick={() => setBulkOpen(true)}
                aria-label="Bulk upload devotions"
              >
                <span className="devo-write-long" aria-hidden="true">
                  Bulk upload
                </span>
                <span className="devo-write-short" aria-hidden="true">
                  Upload
                </span>
              </button>
            )}
            <button
              type="button"
              className="devo-write-btn devo-bulk-btn"
              onClick={() => setReportOpen(true)}
              aria-label="Report to leader"
            >
              <span className="devo-write-long" aria-hidden="true">
                Report to leader
              </span>
              <span className="devo-write-short" aria-hidden="true">
                Report
              </span>
            </button>
            <button type="button" className="devo-write-btn" onClick={openAdd} aria-label="Write devotion">
              <span className="devo-write-long" aria-hidden="true">
                + Write devotion
              </span>
              <span className="devo-write-short" aria-hidden="true">
                + Write
              </span>
            </button>
          </div>
        </div>

        <div className="devo-toolbar">
          <label className="devo-search">
            <TopbarSearchIcon />
            <input
              type="search"
              placeholder="Search by verse or words"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search devotions"
            />
          </label>
          <div className="devo-toolbar-menus">
            <ToolbarMenu label="Sort" icon={<SortIcon />} entries={sortEntries} />
            <ToolbarMenu label="View" icon={<ViewIcon />} entries={viewEntries} />
          </div>
        </div>

        <div className="devo-chips" role="group" aria-label="Filter devotions">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="devo-chip"
              aria-pressed={filter === chip.key}
              onClick={() => setFilter(chip.key)}
            >
              {chip.label}
            </button>
          ))}
          <button type="button" className="devo-chip devo-chip--soon" disabled>
            Favorites <span className="devo-soon">Soon</span>
          </button>
        </div>

        {loading ? (
          <div className="devo-list" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="devo-card">
                <Skeleton className="devo-tile-skeleton rounded-xl" />
                <div className="devo-card-body">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="mt-2.5 h-5 w-full" />
                  <Skeleton className="mt-2.5 h-3.5 w-2/3" />
                </div>
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
          <div className="devo-groups" ref={listTopRef}>
            {groups.map((group) => (
              <section key={group.key} aria-label={group.label ?? "Devotions"}>
                {group.label && (
                  <h2 className="devo-group-head">
                    {group.label}
                    <span className="devo-group-count">
                      {group.total} {group.total === 1 ? "devotion" : "devotions"}
                    </span>
                  </h2>
                )}
                <div className={layout === "grid" ? "devo-list devo-list--grid" : "devo-list"}>
                  {group.items.map((devo) => (
                    <article
                      key={devo.id}
                      className={`devo-card devo-card--${view}${prefs.showDateTile ? "" : " devo-card--no-tile"}`}
                    >
                      {prefs.showDateTile && (
                        <div className="devo-date-tile" aria-hidden="true">
                          <span className="devo-date-day">{String(devo.date.getDate()).padStart(2, "0")}</span>
                          <span className="devo-date-weekday">
                            {devo.date.toLocaleDateString("en-US", { weekday: "short" })}
                          </span>
                        </div>
                      )}
                      <div className="devo-card-body">
                        <p className="devo-card-meta">
                          {/* Stretched over the whole card (see .devo-card-open::after) so a click
                              anywhere opens the devotion, while staying a real, focusable button. */}
                          <button
                            type="button"
                            className="devo-card-open"
                            onClick={() => openView(devo)}
                            aria-label={`Open devotion: ${devo.verse}, ${formatCardDate(devo.date)}`}
                          >
                            {devo.verse}
                          </button>
                          <span className="devo-card-date">
                            {layout === "grid" ? formatShortDate(devo.date) : formatCardDate(devo.date)}
                          </span>
                        </p>
                        {view !== "compact" && prefs.showScripture && devo.scripture && (
                          <p className="devo-card-scripture">“{devo.scripture}”</p>
                        )}
                        {view !== "compact" && prefs.showObservation && devo.observation && (
                          <p className="devo-card-observation">
                            <strong>Observation:</strong> {devo.observation}
                          </p>
                        )}
                        {view === "expanded" && (
                          <>
                            {prefs.showApplication && devo.application && (
                              <p className="devo-card-observation">
                                <strong>Application:</strong> {devo.application}
                              </p>
                            )}
                            {prefs.showPrayer && devo.prayer && (
                              <p className="devo-card-observation">
                                <strong>Prayer:</strong> {devo.prayer}
                              </p>
                            )}
                            {prefs.showNotes && devo.notes && (
                              <p className="devo-card-observation">
                                <strong>Notes:</strong> {devo.notes}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="devo-card-actions" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu
                          icon={<KebabIcon />}
                          triggerClassName="devo-icon-btn"
                          ariaLabel={`Actions for ${devo.verse}`}
                          items={[
                            {
                              label: "Add to favorites",
                              icon: <StarIcon />,
                              onSelect: () => {},
                              disabled: true,
                              badge: "Soon",
                            },
                            { label: "Edit", onSelect: () => openEdit(devo), dividerBefore: true },
                            { label: "View full devotion", onSelect: () => openView(devo) },
                            { label: "Duplicate", onSelect: () => handleDuplicate(devo) },
                            { label: "Share to announcements", onSelect: () => handleShare(devo) },
                            { label: "Delete", onSelect: () => handleDelete(devo), danger: true, dividerBefore: true },
                          ]}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
            <div className="devo-pagination">
              <Pagination
                page={currentPage}
                pageSize={pageSize}
                total={visible.length}
                onPageChange={goToPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                pageSizeOptions={[10, 20, 50]}
              />
            </div>
          </div>
        )}
      </div>

      <Modal
        open={modal?.mode === "add" || modal?.mode === "edit"}
        // While the verse picker is open on top, its own Esc/close handles it — without this
        // guard the same Esc keypress would also close (or prompt to discard) this form.
        onClose={pickerOpen ? () => {} : closeAddEditModal}
        size="lg"
        title={modal?.mode === "edit" ? "Edit devotion" : "New devotion"}
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeAddEditModal}>
              Cancel
            </Button>
            <Button type="submit" form="devo-form" disabled={formLocked || saving}>
              {saving ? "Saving…" : "Save devotion"}
            </Button>
          </>
        }
      >
        <form id="devo-form" onSubmit={handleSaveModal} noValidate className="devo-form">
          <label className="ui-field devo-date-field">
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
            <div className="devo-duplicate" role="status">
              <p className="m-0">
                You already have a devotion for{" "}
                {isSameDay(parseDateInputValue(form.date), new Date())
                  ? "today"
                  : formatDate(parseDateInputValue(form.date))}
                . Change the date to add a new devotion, or edit the existing one instead.
              </p>
              <Button type="button" variant="secondary" onClick={() => openEdit(duplicateDateDevo)}>
                Edit that devotion instead
              </Button>
            </div>
          )}

          <div className="devo-step">
            <StepHeading letter="S" label="Scripture" htmlFor={form.verse ? "devo-scripture" : undefined} />
            {form.verse ? (
              <div className="devo-verse-row">
                <span className="devo-verse-chip">
                  <NavDevotionIcon />
                  {form.verse}
                  {versionLabel ? ` · ${versionLabel}` : ""}
                </span>
                <button type="button" className="devo-link-btn" onClick={() => setPickerOpen(true)} disabled={formLocked}>
                  Change verse
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="devo-choose-verse"
                onClick={() => setPickerOpen(true)}
                disabled={formLocked}
                aria-describedby={errors.verse ? "devo-verse-error" : undefined}
              >
                <NavDevotionIcon />
                Choose a verse
              </button>
            )}
            <FieldError id="devo-verse-error" message={errors.verse} />
            {form.verse && (
              <>
                <textarea
                  id="devo-scripture"
                  ref={autoGrowRef}
                  className="devo-textarea devo-textarea--scripture"
                  value={form.scripture}
                  onChange={(e) => updateForm("scripture", e.target.value)}
                  onInput={(e) => autoGrowRef(e.currentTarget)}
                  disabled={formLocked}
                  aria-invalid={!!errors.scripture}
                  aria-describedby={errors.scripture ? "devo-scripture-error" : undefined}
                />
                <FieldError id="devo-scripture-error" message={errors.scripture} />
              </>
            )}
          </div>

          {REFLECTION_STEPS.map((step) => (
            <div key={step.key} className="devo-step">
              <StepHeading letter={step.letter} label={step.label} htmlFor={`devo-${step.key}`} />
              <textarea
                id={`devo-${step.key}`}
                ref={autoGrowRef}
                className="devo-textarea"
                value={form[step.key]}
                onChange={(e) => updateForm(step.key, e.target.value)}
                onInput={(e) => autoGrowRef(e.currentTarget)}
                placeholder={step.placeholder}
                disabled={formLocked}
                aria-invalid={!!errors[step.key]}
                aria-describedby={errors[step.key] ? `devo-${step.key}-error` : undefined}
              />
              <FieldError id={`devo-${step.key}-error`} message={errors[step.key]} />
            </div>
          ))}

          <label className="ui-field">
            <span className="ui-field-label">Notes (optional)</span>
            <textarea
              ref={autoGrowRef}
              className="devo-textarea"
              value={form.notes}
              onChange={(e) => updateForm("notes", e.target.value)}
              onInput={(e) => autoGrowRef(e.currentTarget)}
              placeholder="Anything else you'd like to remember."
              disabled={formLocked}
            />
          </label>
        </form>
      </Modal>

      <VersePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(result) => {
          setForm((prev) => ({ ...prev, verse: result.reference, scripture: result.text }));
          setErrors((prev) => ({ ...prev, verse: undefined, scripture: undefined }));
          setPickerOpen(false);
        }}
      />

      <Modal
        open={modal?.mode === "view"}
        onClose={closeModal}
        title={modal?.devo?.verse ?? "Devotion"}
        description={modal?.devo ? formatDate(modal.devo.date) : undefined}
        footer={
          <>
            {modal?.devo && (
              <Button type="button" variant="outline" onClick={() => modal.devo && openEdit(modal.devo)}>
                Edit
              </Button>
            )}
            <Button type="button" onClick={closeModal}>
              Close
            </Button>
          </>
        }
      >
        {modal?.devo && (
          <div className="flex flex-col gap-4">
            {(
              [
                ["S", "Scripture", modal.devo.scripture],
                ["O", "Observation", modal.devo.observation],
                ["A", "Application", modal.devo.application],
                ["P", "Prayer", modal.devo.prayer],
                ["", "Notes", modal.devo.notes],
              ] as const
            )
              .filter(([, , value]) => value.trim().length > 0)
              .map(([letter, label, value]) => (
                <div key={label} className="devo-step">
                  {letter ? <StepHeading letter={letter} label={label} /> : <p className="ui-field-label m-0">{label}</p>}
                  <p className={letter === "S" ? "devo-view-text devo-view-text--scripture" : "devo-view-text"}>{value}</p>
                </div>
              ))}
          </div>
        )}
      </Modal>

      <DevotionWeekReportModal open={reportOpen} onClose={() => setReportOpen(false)} devos={devos} />

      {canBulkUpload && (
        <DevotionBulkUploadModal open={bulkOpen} onClose={() => setBulkOpen(false)} onImported={loadDevotions} />
      )}
    </AppShell>
  );
}

export default Devotion;
