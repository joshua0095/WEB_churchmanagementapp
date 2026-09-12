import { useEffect, useMemo, useState } from "react";
import {
  createCongregant,
  deleteCongregant,
  getCongregation,
  updateCongregant,
  type CongregationMember,
  type Gender,
} from "../api";
import { isAdmin, isRegistrar } from "../auth";
import { InitialAvatar, formatBirthday } from "../components/PeopleShared";
import {
  AppShell,
  Button,
  Card,
  DropdownMenu,
  FilterBar,
  Modal,
  Pagination,
  ProfileMenu,
  SelectField,
  TextField,
  Skeleton,
  type DropdownMenuItem,
} from "../components/ui";
import { getPageSize, setPageSize } from "../preferences";
import { confirmDialog, infoAlert, successToast } from "../swal";

const emptyCongregantForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  nickname: "",
  birthday: "",
  gender: "" as "" | Gender,
  oldCategory: "",
  newCategory: "",
};

function PeopleCongregation() {
  const [search, setSearch] = useState("");
  const [congOldFilter, setCongOldFilter] = useState("");
  const [congNewFilter, setCongNewFilter] = useState("");
  const [congGenderFilter, setCongGenderFilter] = useState("");
  const [congGroupBy, setCongGroupBy] = useState<"oldCategory" | "newCategory" | "gender" | "none">("oldCategory");
  const [congSortBy, setCongSortBy] = useState<"name" | "birthday">("name");
  const [congSortDir, setCongSortDir] = useState<"asc" | "desc">("asc");

  // One page number per group (keyed by whatever group label is showing), since multiple
  // groups render their own tables simultaneously. Page size is shared across every group —
  // it wouldn't make sense for "Men" and "Women" to paginate differently.
  const [congPages, setCongPages] = useState<Record<string, number>>({});
  const [congPageSize, setCongPageSize] = useState(() => getPageSize("peopleCongregation", 20));

  const handleCongPageSizeChange = (size: number) => {
    setCongPageSize(size);
    setPageSize("peopleCongregation", size);
    setCongPages({});
  };

  const [congregation, setCongregation] = useState<CongregationMember[]>([]);
  const [loadingCongregation, setLoadingCongregation] = useState(true);
  const [congregationError, setCongregationError] = useState<string | null>(null);

  const canManageCongregation = isAdmin() || isRegistrar();

  const [congregantModalOpen, setCongregantModalOpen] = useState(false);
  const [editingCongregantId, setEditingCongregantId] = useState<number | null>(null);
  const [congregantForm, setCongregantForm] = useState(emptyCongregantForm);
  const [savingCongregant, setSavingCongregant] = useState(false);
  const [congregantFormError, setCongregantFormError] = useState<string | null>(null);

  const loadCongregation = async () => {
    setLoadingCongregation(true);
    setCongregationError(null);
    try {
      setCongregation(await getCongregation());
    } catch (err) {
      setCongregationError(err instanceof Error ? err.message : "Failed to load congregation");
    } finally {
      setLoadingCongregation(false);
    }
  };

  useEffect(() => {
    loadCongregation();
  }, []);

  // Any change to what's being shown jumps back to page 1 — otherwise a filter/search
  // change could land you on a now-empty or out-of-range page.
  useEffect(
    () => setCongPages({}),
    [search, congOldFilter, congNewFilter, congGenderFilter, congGroupBy, congSortBy, congSortDir],
  );

  const getCongPage = (key: string) => congPages[key] ?? 1;
  const setCongPage = (key: string, page: number) => setCongPages((prev) => ({ ...prev, [key]: page }));

  const congOldCategories = useMemo(
    () => Array.from(new Set(congregation.map((m) => m.oldCategory).filter((v): v is string => !!v))).sort(),
    [congregation],
  );
  const congNewCategories = useMemo(
    () => Array.from(new Set(congregation.map((m) => m.newCategory).filter((v): v is string => !!v))).sort(),
    [congregation],
  );

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

  // Groups by the selected field (defaults to Old category, e.g. "Men") so each imported
  // network/ministry list reads as its own section — falls back to "Unassigned" for members
  // with no value set for that field yet. "none" shows one flat, ungrouped list.
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

  // The field driving the current grouping is redundant to also show as its own column
  // (it's already the section header) — every other field still shows normally.
  const congFieldDefs = {
    gender: { label: "Gender", render: (m: CongregationMember) => m.gender ?? "—" },
    birthday: { label: "Birthday", render: (m: CongregationMember) => formatBirthday(m.birthday) },
    oldCategory: { label: "Old", render: (m: CongregationMember) => m.oldCategory ?? "—" },
    newCategory: { label: "New", render: (m: CongregationMember) => m.newCategory ?? "—" },
  } as const;
  const allCongFields = ["gender", "birthday", "oldCategory", "newCategory"] as const;
  const congVisibleFields = congGroupBy === "none" ? allCongFields : allCongFields.filter((f) => f !== congGroupBy);
  const congGridCols =
    congGroupBy === "none"
      ? "grid-cols-[2fr_0.7fr_0.9fr_0.8fr_0.8fr_48px]"
      : "grid-cols-[2fr_0.7fr_0.9fr_0.8fr_48px]";
  const congMinWidth = congGroupBy === "none" ? "min-w-[720px]" : "min-w-[620px]";

  const openAddCongregant = () => {
    setEditingCongregantId(null);
    setCongregantForm(emptyCongregantForm);
    setCongregantFormError(null);
    setCongregantModalOpen(true);
  };

  const openEditCongregant = (m: CongregationMember) => {
    setEditingCongregantId(m.id);
    setCongregantForm({
      firstName: m.firstName,
      middleName: m.middleName ?? "",
      lastName: m.lastName,
      nickname: m.nickname ?? "",
      birthday: m.birthday ? m.birthday.slice(0, 10) : "",
      gender: m.gender ?? "",
      oldCategory: m.oldCategory ?? "",
      newCategory: m.newCategory ?? "",
    });
    setCongregantFormError(null);
    setCongregantModalOpen(true);
  };

  const handleSaveCongregant = async () => {
    if (!congregantForm.firstName.trim() || !congregantForm.lastName.trim()) return;
    setSavingCongregant(true);
    setCongregantFormError(null);
    try {
      const payload = {
        firstName: congregantForm.firstName.trim(),
        middleName: congregantForm.middleName.trim() || null,
        lastName: congregantForm.lastName.trim(),
        nickname: congregantForm.nickname.trim() || null,
        birthday: congregantForm.birthday || null,
        gender: congregantForm.gender || null,
        oldCategory: congregantForm.oldCategory.trim() || null,
        newCategory: congregantForm.newCategory.trim() || null,
      };
      if (editingCongregantId === null) {
        await createCongregant(payload);
        successToast("Added to congregation");
      } else {
        await updateCongregant(editingCongregantId, payload);
        successToast("Congregation member updated");
      }
      setCongregantModalOpen(false);
      await loadCongregation();
    } catch (err) {
      setCongregantFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingCongregant(false);
    }
  };

  const handleDeleteCongregant = async (m: CongregationMember) => {
    const confirmed = await confirmDialog({
      title: "Remove from congregation?",
      message: `This permanently deletes ${m.name}'s record.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteCongregant(m.id);
      await loadCongregation();
      successToast("Congregation member deleted");
    } catch (err) {
      await infoAlert(err instanceof Error ? err.message : "Failed to delete", "Error");
    }
  };

  const buildCongregantMenu = (m: CongregationMember): DropdownMenuItem[] => [
    { label: "Edit", onSelect: () => openEditCongregant(m) },
    { label: "Delete", onSelect: () => handleDeleteCongregant(m), danger: true, dividerBefore: true },
  ];

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="page-header">
        <h1>Congregation</h1>
        {canManageCongregation && (
          <Button type="button" onClick={openAddCongregant}>
            + Add to congregation
          </Button>
        )}
      </div>

      <FilterBar
        primary={
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className="h-11 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(242,183,5,0.25)] sm:max-w-xs"
          />
        }
        activeCount={[congOldFilter, congNewFilter, congGenderFilter].filter(Boolean).length}
      >
        <SelectField
          label="Old"
          value={congOldFilter}
          onChange={(e) => setCongOldFilter(e.target.value)}
          className="sm:max-w-[160px]"
        >
          <option value="">All</option>
          {congOldCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="New"
          value={congNewFilter}
          onChange={(e) => setCongNewFilter(e.target.value)}
          className="sm:max-w-[160px]"
        >
          <option value="">All</option>
          {congNewCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Gender"
          value={congGenderFilter}
          onChange={(e) => setCongGenderFilter(e.target.value)}
          className="sm:max-w-[140px]"
        >
          <option value="">All</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </SelectField>
        <SelectField
          label="Group by"
          value={congGroupBy}
          onChange={(e) => setCongGroupBy(e.target.value as typeof congGroupBy)}
          className="sm:max-w-[160px]"
        >
          <option value="none">No grouping</option>
          <option value="oldCategory">Old category</option>
          <option value="newCategory">New category</option>
          <option value="gender">Gender</option>
        </SelectField>
        <SelectField
          label="Sort by"
          value={congSortBy}
          onChange={(e) => setCongSortBy(e.target.value as typeof congSortBy)}
          className="sm:max-w-[140px]"
        >
          <option value="name">Name</option>
          <option value="birthday">Birthday</option>
        </SelectField>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setCongSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          aria-label={`Sort ${congSortDir === "asc" ? "ascending" : "descending"}`}
        >
          {congSortDir === "asc" ? "↑ Asc" : "↓ Desc"}
        </Button>
        <SelectField
          label="Per page"
          value={congPageSize}
          onChange={(e) => handleCongPageSizeChange(Number(e.target.value))}
          className="sm:max-w-[120px]"
        >
          {[10, 20, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </SelectField>
      </FilterBar>

      {congregationError && <p className="error mb-3">{congregationError}</p>}
      {loadingCongregation ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="h-14 w-full rounded-md" />
        </div>
      ) : filteredCongregation.length === 0 ? (
        <p className="helper-text">No congregation members match your search.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groupedCongregation.map(([category, members]) => {
            const page = getCongPage(category);
            const pagedMembers = members.slice((page - 1) * congPageSize, page * congPageSize);
            return (
              <Card key={category} className="!p-0">
                {congGroupBy !== "none" && (
                  <p className="section-title px-4 pt-4">
                    {category}{" "}
                    <span className="font-normal normal-case text-[var(--color-text-secondary)]">
                      ({members.length})
                    </span>
                  </p>
                )}
                <div className={congGroupBy !== "none" ? "mt-2 overflow-x-auto" : "overflow-x-auto"}>
                  <div className={congMinWidth}>
                    <div
                      className={`grid ${congGridCols} gap-3 border-b border-[var(--color-border)] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]`}
                    >
                      <span>Name</span>
                      {congVisibleFields.map((f) => (
                        <span key={f}>{congFieldDefs[f].label}</span>
                      ))}
                      <span />
                    </div>
                    {pagedMembers.map((m) => (
                      <div
                        key={m.id}
                        className={`grid ${congGridCols} items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0`}
                      >
                        <div className="flex items-center gap-3">
                          <InitialAvatar name={m.name} />
                          <p className="truncate font-semibold text-[var(--color-text-primary)]">{m.name}</p>
                        </div>
                        {congVisibleFields.map((f) => (
                          <div key={f} className="text-sm text-[var(--color-text-secondary)]">
                            {congFieldDefs[f].render(m)}
                          </div>
                        ))}
                        {canManageCongregation ? (
                          <DropdownMenu ariaLabel={`Actions for ${m.name}`} items={buildCongregantMenu(m)} />
                        ) : (
                          <span />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <Pagination
                  page={page}
                  pageSize={congPageSize}
                  total={members.length}
                  onPageChange={(p) => setCongPage(category, p)}
                />
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={congregantModalOpen}
        onClose={() => setCongregantModalOpen(false)}
        title={editingCongregantId === null ? "Add to congregation" : "Edit congregation member"}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setCongregantModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveCongregant}
              disabled={savingCongregant || !congregantForm.firstName.trim() || !congregantForm.lastName.trim()}
            >
              {savingCongregant ? "Saving..." : editingCongregantId === null ? "Add" : "Save changes"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="First name"
            value={congregantForm.firstName}
            onChange={(e) => setCongregantForm((f) => ({ ...f, firstName: e.target.value }))}
            autoFocus
            required
          />
          <TextField
            label="Middle name (optional)"
            value={congregantForm.middleName}
            onChange={(e) => setCongregantForm((f) => ({ ...f, middleName: e.target.value }))}
          />
          <TextField
            label="Last name"
            value={congregantForm.lastName}
            onChange={(e) => setCongregantForm((f) => ({ ...f, lastName: e.target.value }))}
            required
          />
          <TextField
            label="Nickname (optional)"
            value={congregantForm.nickname}
            onChange={(e) => setCongregantForm((f) => ({ ...f, nickname: e.target.value }))}
          />
          <SelectField
            label="Gender"
            value={congregantForm.gender}
            onChange={(e) => setCongregantForm((f) => ({ ...f, gender: e.target.value as "" | Gender }))}
          >
            <option value="">Not specified</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </SelectField>
          <TextField
            label="Birthday"
            type="date"
            value={congregantForm.birthday}
            onChange={(e) => setCongregantForm((f) => ({ ...f, birthday: e.target.value }))}
          />
          <TextField
            label="Old category"
            placeholder="e.g. Men"
            value={congregantForm.oldCategory}
            onChange={(e) => setCongregantForm((f) => ({ ...f, oldCategory: e.target.value }))}
          />
          <TextField
            label="New category"
            placeholder="e.g. Adult"
            value={congregantForm.newCategory}
            onChange={(e) => setCongregantForm((f) => ({ ...f, newCategory: e.target.value }))}
          />
          {congregantFormError && <p className="error">{congregantFormError}</p>}
        </div>
      </Modal>
    </AppShell>
  );
}

export default PeopleCongregation;
