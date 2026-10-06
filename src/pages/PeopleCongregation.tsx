import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { deleteCongregant, getCongregation, type CongregationMember } from "../api";
import { isAdmin, isMis } from "../auth";
import { Modal, useConfirm, useToast } from "../components/dialogs";
import { InitialAvatar } from "../components/PeopleShared";
import CongregantModal, { ageFrom, distinctCategories } from "../components/people/CongregantModal";
import { AppShell, Button, DropdownMenu, ProfileMenu, Skeleton, Spinner, type DropdownMenuItem } from "../components/ui";
import { KebabIcon, NavChevronIcon, TopbarSearchIcon } from "../components/ui/shellIcons";
import { MOBILE_LAYOUT_QUERY, useMediaQuery } from "../hooks/useMediaQuery";
import { getPageSize, setPageSize } from "../preferences";

type GroupBy = "oldCategory" | "newCategory" | "gender" | "none";
type SortBy = "name" | "birthday";

/** "All" per page — stored as a big number, since the page-size preference must be > 0. */
const ALL = 100000;
const PAGE_SIZES = [100, 50, ALL];

const GROUP_LABELS: Record<GroupBy, string> = {
  oldCategory: "Old category",
  newCategory: "New category",
  gender: "Gender",
  none: "None",
};

function Icon({ d, ...rest }: { d: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={d} />
    </svg>
  );
}
const PlusIcon = () => <Icon d="M12 5v14M5 12h14" strokeWidth={2.2} />;
const FilterLinesIcon = () => <Icon d="M4 6h16M7 12h10M10 18h4" />;
const ArrowUpIcon = () => <Icon d="M12 19V5M6 11l6-6 6 6" />;
const ArrowDownIcon = () => <Icon d="M12 5v14M6 13l6 6 6-6" />;

/** "Nov 21, 2014" */
function formatLongBirthday(value: string): string {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
/** "Nov 21" */
function formatShortBirthday(value: string): string {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const NotSet = ({ children = "Not set" }: { children?: ReactNode }) => <span className="cg-notset">{children}</span>;

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  inline?: boolean;
}
function LabeledSelect({ label, value, onChange, children, inline }: SelectProps) {
  return (
    <label className={inline ? "cg-select cg-select--inline" : "cg-select"}>
      <span className="cg-select-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

function PeopleCongregation() {
  const toast = useToast();
  const confirm = useConfirm();
  const isMobile = useMediaQuery(MOBILE_LAYOUT_QUERY);

  const [search, setSearch] = useState("");
  const [congOldFilter, setCongOldFilter] = useState("");
  const [congNewFilter, setCongNewFilter] = useState("");
  const [congGenderFilter, setCongGenderFilter] = useState("");
  const [congGroupBy, setCongGroupBy] = useState<GroupBy>("oldCategory");
  const [congSortBy, setCongSortBy] = useState<SortBy>("name");
  const [congSortDir, setCongSortDir] = useState<"asc" | "desc">("asc");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  // One pagination for the whole list (groups included), under the card.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(() => {
    const saved = getPageSize("peopleCongregation", 100);
    return PAGE_SIZES.includes(saved) ? saved : 100;
  });
  const handlePageSizeChange = (size: number) => {
    setPageSizeState(size);
    setPageSize("peopleCongregation", size);
    setPage(1);
  };

  const [congregation, setCongregation] = useState<CongregationMember[]>([]);
  const [loadingCongregation, setLoadingCongregation] = useState(true);
  const [congregationError, setCongregationError] = useState<string | null>(null);

  const canManageCongregation = isAdmin() || isMis();

  const [modal, setModal] = useState<{ open: boolean; editing: CongregationMember | null }>({ open: false, editing: null });

  // Which row shows the "updating" pulse — set right before a per-row mutation (save/delete)
  // and cleared once the silent reload picks it back up.
  const [busyCongregantId, setBusyCongregantId] = useState<number | null>(null);

  // `silent` skips the loading skeleton for a background refresh (e.g. after editing a
  // member) — otherwise the whole list would flicker to a skeleton and lose your scroll position.
  const loadCongregation = async (silent = false) => {
    if (!silent) setLoadingCongregation(true);
    setCongregationError(null);
    try {
      setCongregation(await getCongregation());
    } catch (err) {
      setCongregationError(err instanceof Error ? err.message : "Failed to load congregation");
    } finally {
      if (!silent) setLoadingCongregation(false);
    }
  };

  useEffect(() => {
    loadCongregation();
  }, []);

  // Any change to what's being shown jumps back to page 1 — otherwise a filter/search
  // change could land you on a now-empty or out-of-range page.
  useEffect(
    () => setPage(1),
    [search, congOldFilter, congNewFilter, congGenderFilter, congGroupBy, congSortBy, congSortDir, collapsed],
  );
  // A different grouping means different group names — start with everything open.
  useEffect(() => setCollapsed(new Set()), [congGroupBy]);

  const congOldCategories = useMemo(
    () => Array.from(new Set(congregation.map((m) => m.oldCategory).filter((v): v is string => !!v))).sort(),
    [congregation],
  );
  const congNewCategories = useMemo(
    () => Array.from(new Set(congregation.map((m) => m.newCategory).filter((v): v is string => !!v))).sort(),
    [congregation],
  );
  // The form's chip options merge spellings that only differ in case.
  const oldOptions = useMemo(() => distinctCategories(congregation.map((m) => m.oldCategory)), [congregation]);
  const newOptions = useMemo(() => distinctCategories(congregation.map((m) => m.newCategory)), [congregation]);

  const filteredCongregation = useMemo(() => {
    const q = search.trim().toLowerCase();
    return congregation.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q) && !m.nickname?.toLowerCase().includes(q)) return false;
      if (congOldFilter && (m.oldCategory ?? "") !== congOldFilter) return false;
      if (congNewFilter && (m.newCategory ?? "") !== congNewFilter) return false;
      if (congGenderFilter && (m.gender ?? "") !== congGenderFilter) return false;
      return true;
    });
  }, [congregation, search, congOldFilter, congNewFilter, congGenderFilter]);

  const sortMembers = (members: CongregationMember[]) => {
    const dir = congSortDir === "asc" ? 1 : -1;
    return [...members].sort((a, b) => {
      if (congSortBy === "birthday") {
        if (!a.birthday && !b.birthday) return 0;
        if (!a.birthday) return 1; // no-birthday rows always sort last, regardless of direction
        if (!b.birthday) return -1;
        return dir * (new Date(a.birthday).getTime() - new Date(b.birthday).getTime());
      }
      return dir * a.name.localeCompare(b.name);
    });
  };

  // Groups by the selected field (defaults to Old category, e.g. "Men") — falls back to
  // "Unassigned" for members with no value for that field. "none" is one flat list.
  const groupedCongregation = useMemo(() => {
    if (congGroupBy === "none") {
      return [["All", sortMembers(filteredCongregation)]] as [string, CongregationMember[]][];
    }
    const groups = new Map<string, CongregationMember[]>();
    for (const m of filteredCongregation) {
      const raw = congGroupBy === "oldCategory" ? m.oldCategory : congGroupBy === "newCategory" ? m.newCategory : m.gender;
      const key = raw?.trim() || "Unassigned";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
    return sortedGroups.map(([key, members]) => [key, sortMembers(members)] as [string, CongregationMember[]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCongregation, congGroupBy, congSortBy, congSortDir]);

  const grouped = congGroupBy !== "none";
  const isCollapsed = (key: string) => grouped && collapsed.has(key);
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Page through the rows of open groups; a group continued from the previous page repeats its header.
  const totalRows = groupedCongregation.reduce((n, [key, members]) => n + (isCollapsed(key) ? 0 : members.length), 0);
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const visibleGroups: { key: string; total: number; rows: CongregationMember[]; collapsed: boolean }[] = [];
  let offset = 0;
  for (const [key, members] of groupedCongregation) {
    if (isCollapsed(key)) {
      const lastPageTail = offset === totalRows && safePage === pageCount;
      if (offset >= start && (offset < end || lastPageTail)) visibleGroups.push({ key, total: members.length, rows: [], collapsed: true });
      continue;
    }
    const rows = members.slice(Math.max(0, start - offset), Math.max(0, end - offset));
    if (rows.length > 0) visibleGroups.push({ key, total: members.length, rows, collapsed: false });
    offset += members.length;
  }

  // The grouping field is already the section header, so the category column shows the other one.
  const categoryField = congGroupBy === "newCategory" ? "oldCategory" : "newCategory";
  const categoryLabel = categoryField === "oldCategory" ? "Old category" : "New category";

  const activeFilters = [
    congOldFilter && { key: "old", label: `Old: ${congOldFilter}`, clear: () => setCongOldFilter("") },
    congNewFilter && { key: "new", label: `New: ${congNewFilter}`, clear: () => setCongNewFilter("") },
    congGenderFilter && { key: "gender", label: `Gender: ${congGenderFilter}`, clear: () => setCongGenderFilter("") },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
  const clearFilters = () => {
    setCongOldFilter("");
    setCongNewFilter("");
    setCongGenderFilter("");
  };

  // Desktop filters popover: close on an outside click or Esc.
  const filtersWrapRef = useRef<HTMLDivElement>(null);
  const filtersBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!filtersOpen || isMobile) return;
    const onDown = (e: MouseEvent) => {
      if (!filtersWrapRef.current?.contains(e.target as Node)) setFiltersOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFiltersOpen(false);
        filtersBtnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen, isMobile]);

  const openAdd = () => setModal({ open: true, editing: null });
  const openEdit = (m: CongregationMember) => setModal({ open: true, editing: m });
  const closeModal = () => setModal((s) => ({ ...s, open: false }));

  const handleSaved = async () => {
    const editedId = modal.editing?.id ?? null;
    closeModal();
    setBusyCongregantId(editedId);
    try {
      await loadCongregation(true);
    } finally {
      setBusyCongregantId(null);
    }
  };

  const handleDelete = async (m: CongregationMember) => {
    const ok = await confirm({
      title: "Remove from congregation?",
      description: `This permanently deletes ${m.name}'s record.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setBusyCongregantId(m.id);
    try {
      await deleteCongregant(m.id);
      await loadCongregation(true);
      toast.show({ type: "success", title: "Removed from the congregation" });
    } catch (err) {
      toast.show({ type: "error", title: "Couldn't delete", message: err instanceof Error ? err.message : undefined });
    } finally {
      setBusyCongregantId(null);
    }
  };

  const menuFor = (m: CongregationMember): DropdownMenuItem[] => [
    { label: "Edit", onSelect: () => openEdit(m) },
    { label: "Delete", onSelect: () => handleDelete(m), danger: true, dividerBefore: true },
  ];

  const actions = (m: CongregationMember) =>
    m.id === busyCongregantId ? (
      <span className="wk-kebab-slot">
        <Spinner className="h-4 w-4 text-[var(--color-text-secondary)]" />
      </span>
    ) : canManageCongregation ? (
      <DropdownMenu ariaLabel={`Actions for ${m.name}`} items={menuFor(m)} icon={<KebabIcon />} triggerClassName="wk-kebab" />
    ) : (
      <span className="wk-kebab-slot" />
    );

  const nameEl = (m: CongregationMember, className: string) =>
    canManageCongregation ? (
      <button type="button" className={`${className} wk-name-link`} onClick={() => openEdit(m)}>
        {m.name}
      </button>
    ) : (
      <span className={className}>{m.name}</span>
    );

  const sortDirLabel =
    congSortBy === "birthday"
      ? congSortDir === "asc"
        ? "Sorted oldest first. Switch to youngest first"
        : "Sorted youngest first. Switch to oldest first"
      : congSortDir === "asc"
        ? "Sorted A to Z. Switch to Z to A"
        : "Sorted Z to A. Switch to A to Z";
  const sortDirButton = (
    <button
      type="button"
      className="cg-icon-btn"
      onClick={() => setCongSortDir((d) => (d === "asc" ? "desc" : "asc"))}
      aria-label={sortDirLabel}
      title={sortDirLabel}
    >
      {congSortDir === "asc" ? <ArrowUpIcon /> : <ArrowDownIcon />}
    </button>
  );

  const filterSelects = (
    <>
      <LabeledSelect label="Old category" value={congOldFilter} onChange={setCongOldFilter}>
        <option value="">All</option>
        {congOldCategories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </LabeledSelect>
      <LabeledSelect label="New category" value={congNewFilter} onChange={setCongNewFilter}>
        <option value="">All</option>
        {congNewCategories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </LabeledSelect>
      <LabeledSelect label="Gender" value={congGenderFilter} onChange={setCongGenderFilter}>
        <option value="">All</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
      </LabeledSelect>
    </>
  );
  const groupOptions = (Object.keys(GROUP_LABELS) as GroupBy[]).map((g) => (
    <option key={g} value={g}>
      {GROUP_LABELS[g]}
    </option>
  ));
  const sortOptions = (
    <>
      <option value="name">Name</option>
      <option value="birthday">Birthday</option>
    </>
  );
  const pageSizeOptions = PAGE_SIZES.map((s) => (
    <option key={s} value={s}>
      {s === ALL ? "All" : s}
    </option>
  ));

  const badge = activeFilters.length > 0 && <span className="cg-badge">{activeFilters.length}</span>;

  const groupBand = (g: { key: string; total: number; collapsed: boolean }) =>
    grouped && (
      <button type="button" className="cg-band" aria-expanded={!g.collapsed} onClick={() => toggleGroup(g.key)}>
        <NavChevronIcon className={g.collapsed ? "cg-band-chevron cg-band-chevron--closed" : "cg-band-chevron"} />
        <span className="cg-band-name">{g.key}</span>
        <span className="cg-band-count">{g.total}</span>
      </button>
    );

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="wk-page cg-page">
        <div className="wk-header">
          <div className="min-w-0">
            <h1 className="wk-title cg-title">
              Congregation
              {!loadingCongregation && (
                <span className="wk-count cg-count">
                  <span className="cg-count-dot"> · </span>
                  {congregation.length} {congregation.length === 1 ? "person" : "people"}
                </span>
              )}
            </h1>
            <p className="wk-subtitle">Everyone on the Sunday roster, grouped by category.</p>
          </div>
          {canManageCongregation && (
            <button type="button" className="wk-btn wk-btn--gold wk-add-btn" onClick={openAdd}>
              <PlusIcon />
              <span className="wk-add-long">Add person</span>
              <span className="wk-add-short" aria-hidden="true">
                Add
              </span>
            </button>
          )}
        </div>

        <div className="cg-toolbar">
          <label className="wk-search cg-search">
            <TopbarSearchIcon />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" aria-label="Search by name" />
          </label>

          <div className="cg-filters-wrap" ref={filtersWrapRef}>
            <button
              ref={filtersBtnRef}
              type="button"
              className="cg-filters-btn"
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              aria-label={`Filters${activeFilters.length ? ` (${activeFilters.length} active)` : ""}`}
              onClick={() => setFiltersOpen((o) => !o)}
            >
              <FilterLinesIcon />
              <span className="cg-filters-text">Filters</span>
              {badge}
            </button>
            {filtersOpen && !isMobile && (
              <div className="cg-popover" role="dialog" aria-label="Filters">
                {filterSelects}
                {activeFilters.length > 0 && (
                  <button type="button" className="cg-clear" onClick={clearFilters}>
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="cg-desktop-only cg-sort">
            <LabeledSelect inline label="Group" value={congGroupBy} onChange={(v) => setCongGroupBy(v as GroupBy)}>
              {groupOptions}
            </LabeledSelect>
            <LabeledSelect inline label="Sort" value={congSortBy} onChange={(v) => setCongSortBy(v as SortBy)}>
              {sortOptions}
            </LabeledSelect>
            {sortDirButton}
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="cg-active">
            {activeFilters.map((f) => (
              <span key={f.key} className="cg-active-chip">
                {f.label}
                <button type="button" aria-label={`Remove filter ${f.label}`} onClick={f.clear}>
                  <Icon d="M7 7l10 10M17 7 7 17" />
                </button>
              </span>
            ))}
            <button type="button" className="cg-clear" onClick={clearFilters}>
              Clear all
            </button>
          </div>
        )}

        {congregationError && <p className="error">{congregationError}</p>}

        {loadingCongregation ? (
          <div className="flex flex-col gap-2" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-[16px]" />
            ))}
          </div>
        ) : filteredCongregation.length === 0 ? (
          <p className="helper-text">No congregation members match your search.</p>
        ) : (
          <>
            <div className="cg-card">
              <div className="cg-row cg-row--head">
                <span>Name</span>
                <span>Gender</span>
                <span>Birthday</span>
                <span>{categoryLabel}</span>
                <span />
              </div>

              {visibleGroups.map((g) => (
                <div key={g.key} className="cg-group">
                  {groupBand(g)}
                  {g.rows.map((m, i) => {
                    const category = m[categoryField];
                    const age = ageFrom(m.birthday);
                    const tone = i % 2 === 0 ? "sand" : "mist";
                    const meta = [m.gender ?? null, m.birthday ? formatShortBirthday(m.birthday) : null, age !== null ? `Age ${age}` : null]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <div key={m.id} className={["cg-row", m.id === busyCongregantId && "wk-row--busy"].filter(Boolean).join(" ")}>
                        <div className="cg-name-cell">
                          <InitialAvatar name={m.name} size="row" tone={tone} />
                          <div className="cg-name-block">
                            {nameEl(m, "wk-name cg-name")}
                            <p className="cg-meta">{meta || "No details yet"}</p>
                          </div>
                        </div>
                        <div className="cg-cell cg-desktop-cell">{m.gender ?? <NotSet />}</div>
                        <div className="cg-cell cg-desktop-cell">
                          {m.birthday ? (
                            <span className="cg-birthday">
                              {formatLongBirthday(m.birthday)}
                              {age !== null && <span className="cg-age-line">Age {age}</span>}
                            </span>
                          ) : (
                            <NotSet />
                          )}
                        </div>
                        <div className="cg-cell cg-category-cell">
                          {category ? (
                            <span className="cg-chip" title={category}>
                              {category}
                            </span>
                          ) : (
                            <NotSet>
                              <span className="cg-desktop-text">Not set</span>
                              <span className="cg-mobile-text">No category</span>
                            </NotSet>
                          )}
                        </div>
                        <div className="cg-actions">{actions(m)}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="cg-pager">
              <p className="cg-pager-text">
                Showing{" "}
                <strong>
                  {totalRows === 0 ? 0 : start + 1}–{Math.min(end, totalRows)}
                </strong>{" "}
                of {totalRows}
              </p>
              <div className="cg-pager-controls">
                <label className="cg-select cg-select--inline cg-desktop-only">
                  <span className="cg-select-label">Per page</span>
                  <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
                    {pageSizeOptions}
                  </select>
                </label>
                <button
                  type="button"
                  className="cg-page-btn"
                  aria-label="Previous page"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  <NavChevronIcon className="rotate-90" />
                </button>
                <button
                  type="button"
                  className="cg-page-btn"
                  aria-label="Next page"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage(safePage + 1)}
                >
                  <NavChevronIcon className="-rotate-90" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile: filters, grouping, sort and page size in one bottom sheet. */}
      {isMobile && (
        <Modal
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          size="sm"
          title="Filters"
          footer={
            <>
              <Button type="button" variant="outline" onClick={clearFilters} disabled={activeFilters.length === 0}>
                Clear all
              </Button>
              <Button type="button" onClick={() => setFiltersOpen(false)}>
                Show {filteredCongregation.length} {filteredCongregation.length === 1 ? "person" : "people"}
              </Button>
            </>
          }
        >
          <div className="cg-sheet">
            {filterSelects}
            <LabeledSelect label="Group by" value={congGroupBy} onChange={(v) => setCongGroupBy(v as GroupBy)}>
              {groupOptions}
            </LabeledSelect>
            <div className="cg-sheet-sort">
              <LabeledSelect label="Sort" value={congSortBy} onChange={(v) => setCongSortBy(v as SortBy)}>
                {sortOptions}
              </LabeledSelect>
              {sortDirButton}
            </div>
            <LabeledSelect label="Per page" value={String(pageSize)} onChange={(v) => handlePageSizeChange(Number(v))}>
              {pageSizeOptions}
            </LabeledSelect>
          </div>
        </Modal>
      )}

      <CongregantModal
        open={modal.open}
        editing={modal.editing}
        oldOptions={oldOptions}
        newOptions={newOptions}
        onClose={closeModal}
        onSaved={() => void handleSaved()}
      />
    </AppShell>
  );
}

export default PeopleCongregation;
