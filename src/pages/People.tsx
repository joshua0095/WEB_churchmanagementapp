import { useEffect, useMemo, useState } from "react";
import {
  createCongregant,
  createMinistry,
  createNetwork,
  createUser,
  deleteCongregant,
  deleteMinistry,
  deleteNetwork,
  deleteUser,
  getCongregation,
  getMinistries,
  getNetworks,
  getUsers,
  resetUserPassword,
  setUserActive,
  setUserRegistrar,
  updateCongregant,
  updateMinistry,
  updateNetwork,
  updateUser,
  type CongregationMember,
  type Gender,
  type Ministry,
  type Network,
  type User,
} from "../api";
import { isAdmin, isRegistrar } from "../auth";
import {
  AppShell,
  Button,
  Card,
  Chip,
  DropdownMenu,
  Modal,
  Pagination,
  ProfileMenu,
  SelectField,
  Skeleton,
  TextField,
  type DropdownMenuItem,
} from "../components/ui";
import { getPageSize, setPageSize } from "../preferences";
import { confirmDialog, infoAlert } from "../swal";

type Section = "users" | "congregation" | "directory";

function InitialAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-navy)] text-sm font-bold text-white">
      {initials || "?"}
    </span>
  );
}

function formatBirthday(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const emptyUserForm = {
  name: "",
  email: "",
  birthday: "",
  ministryIds: [] as number[],
  networkIds: [] as number[],
  isRegistrar: false,
};

const emptyCongregantForm = {
  name: "",
  birthday: "",
  gender: "" as "" | Gender,
  oldCategory: "",
  newCategory: "",
};

const emptyNetworkForm = { name: "" };
const emptyMinistryForm = { name: "", networkId: "" };

function People() {
  const [section, setSection] = useState<Section>("users");
  const [search, setSearch] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("");
  const [networkFilter, setNetworkFilter] = useState("");

  const [congOldFilter, setCongOldFilter] = useState("");
  const [congNewFilter, setCongNewFilter] = useState("");
  const [congGenderFilter, setCongGenderFilter] = useState("");
  const [congGroupBy, setCongGroupBy] = useState<"oldCategory" | "newCategory" | "gender" | "none">("oldCategory");
  const [congSortBy, setCongSortBy] = useState<"name" | "birthday">("name");
  const [congSortDir, setCongSortDir] = useState<"asc" | "desc">("asc");

  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(() => getPageSize("peopleUsers", 20));
  // One page number per Congregation group (keyed by whatever group label is showing),
  // since multiple groups render their own tables simultaneously. Page size is shared
  // across every group — it wouldn't make sense for "Men" and "Women" to paginate differently.
  const [congPages, setCongPages] = useState<Record<string, number>>({});
  const [congPageSize, setCongPageSize] = useState(() => getPageSize("peopleCongregation", 20));
  const [networksPage, setNetworksPage] = useState(1);
  const [networksPageSize, setNetworksPageSize] = useState(() => getPageSize("peopleNetworks", 10));
  const [ministriesPage, setMinistriesPage] = useState(1);
  const [ministriesPageSize, setMinistriesPageSize] = useState(() => getPageSize("peopleMinistries", 10));

  const handleUsersPageSizeChange = (size: number) => {
    setUsersPageSize(size);
    setPageSize("peopleUsers", size);
    setUsersPage(1);
  };
  const handleCongPageSizeChange = (size: number) => {
    setCongPageSize(size);
    setPageSize("peopleCongregation", size);
    setCongPages({});
  };
  const handleNetworksPageSizeChange = (size: number) => {
    setNetworksPageSize(size);
    setPageSize("peopleNetworks", size);
    setNetworksPage(1);
  };
  const handleMinistriesPageSizeChange = (size: number) => {
    setMinistriesPageSize(size);
    setPageSize("peopleMinistries", size);
    setMinistriesPage(1);
  };

  const [networks, setNetworks] = useState<Network[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [congregation, setCongregation] = useState<CongregationMember[]>([]);
  const [loadingCongregation, setLoadingCongregation] = useState(true);
  const [congregationError, setCongregationError] = useState<string | null>(null);

  const canManageUsers = isAdmin();
  const canManageCongregation = isAdmin() || isRegistrar();

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | string | null>(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [savingUser, setSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);

  const [congregantModalOpen, setCongregantModalOpen] = useState(false);
  const [editingCongregantId, setEditingCongregantId] = useState<number | null>(null);
  const [congregantForm, setCongregantForm] = useState(emptyCongregantForm);
  const [savingCongregant, setSavingCongregant] = useState(false);
  const [congregantFormError, setCongregantFormError] = useState<string | null>(null);

  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [editingNetworkId, setEditingNetworkId] = useState<number | null>(null);
  const [networkForm, setNetworkForm] = useState(emptyNetworkForm);
  const [savingNetwork, setSavingNetwork] = useState(false);
  const [networkFormError, setNetworkFormError] = useState<string | null>(null);

  const [ministryModalOpen, setMinistryModalOpen] = useState(false);
  const [editingMinistryId, setEditingMinistryId] = useState<number | null>(null);
  const [ministryForm, setMinistryForm] = useState(emptyMinistryForm);
  const [savingMinistry, setSavingMinistry] = useState(false);
  const [ministryFormError, setMinistryFormError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      setUsers(await getUsers());
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

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

  const loadDirectory = async () => {
    setLoadingDirectory(true);
    setDirectoryError(null);
    try {
      const [networkList, ministryList] = await Promise.all([getNetworks(), getMinistries()]);
      setNetworks(networkList);
      setMinistries(ministryList);
    } catch (err) {
      setDirectoryError(err instanceof Error ? err.message : "Failed to load networks/ministries");
    } finally {
      setLoadingDirectory(false);
    }
  };

  useEffect(() => {
    loadDirectory();
    loadUsers();
    loadCongregation();
  }, []);

  const switchSection = (next: Section) => {
    setSection(next);
    setSearch("");
    setMinistryFilter("");
    setNetworkFilter("");
    setCongOldFilter("");
    setCongNewFilter("");
    setCongGenderFilter("");
  };

  const networkNameById = (id: number) => networks.find((n) => n.id === id)?.name ?? `#${id}`;
  const ministryNameById = (id: number) => ministries.find((m) => m.id === id)?.name ?? `#${id}`;

  // Any change to what's being shown jumps back to page 1 — otherwise a filter/search
  // change could land you on a now-empty or out-of-range page.
  useEffect(() => setUsersPage(1), [search, ministryFilter, networkFilter]);
  useEffect(
    () => setCongPages({}),
    [search, congOldFilter, congNewFilter, congGenderFilter, congGroupBy, congSortBy, congSortDir],
  );
  useEffect(() => setNetworksPage(1), [networks.length]);
  useEffect(() => setMinistriesPage(1), [ministries.length]);

  const getCongPage = (key: string) => congPages[key] ?? 1;
  const setCongPage = (key: string, page: number) => setCongPages((prev) => ({ ...prev, [key]: page }));

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (ministryFilter && !u.ministryIds.includes(Number(ministryFilter))) return false;
      if (networkFilter && !u.networkIds.includes(Number(networkFilter))) return false;
      return true;
    });
  }, [users, search, ministryFilter, networkFilter]);

  const pagedUsers = filteredUsers.slice((usersPage - 1) * usersPageSize, usersPage * usersPageSize);

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
      if (q && !m.name.toLowerCase().includes(q)) return false;
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

  // ---------- Users ----------

  const openAddUser = () => {
    setEditingUserId(null);
    setUserForm(emptyUserForm);
    setUserFormError(null);
    setUserModalOpen(true);
  };

  const openEditUser = (u: User) => {
    setEditingUserId(u.id);
    setUserForm({
      name: u.name,
      email: u.email,
      birthday: u.birthday ? u.birthday.slice(0, 10) : "",
      ministryIds: u.ministryIds,
      networkIds: u.networkIds,
      isRegistrar: u.isRegistrar,
    });
    setUserFormError(null);
    setUserModalOpen(true);
  };

  const toggleMinistry = (id: number) => {
    setUserForm((f) => ({
      ...f,
      ministryIds: f.ministryIds.includes(id) ? f.ministryIds.filter((x) => x !== id) : [...f.ministryIds, id],
    }));
  };

  const toggleNetwork = (id: number) => {
    setUserForm((f) => ({
      ...f,
      networkIds: f.networkIds.includes(id) ? f.networkIds.filter((x) => x !== id) : [...f.networkIds, id],
    }));
  };

  const handleSaveUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) return;
    setSavingUser(true);
    setUserFormError(null);
    try {
      const payload = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        birthday: userForm.birthday || null,
        ministryIds: userForm.ministryIds,
        networkIds: userForm.networkIds,
      };

      if (editingUserId === null) {
        const result = await createUser(payload);
        await setUserRegistrar(result.user.id, userForm.isRegistrar);
        setUserModalOpen(false);
        await loadUsers();
        await infoAlert(
          `Temporary password: ${result.temporaryPassword}\n\nShare this with ${payload.name} so they can log in. They should change it from Settings afterward.`,
          "User created",
        );
      } else {
        await updateUser(editingUserId, payload);
        await setUserRegistrar(editingUserId, userForm.isRegistrar);
        setUserModalOpen(false);
        await loadUsers();
      }
    } catch (err) {
      setUserFormError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSavingUser(false);
    }
  };

  const handleResetPassword = async (u: User) => {
    const confirmed = await confirmDialog({
      title: "Reset password?",
      message: `This generates a new temporary password for ${u.name}. Their current password stops working immediately.`,
      confirmLabel: "Reset password",
    });
    if (!confirmed) return;
    try {
      const { temporaryPassword } = await resetUserPassword(u.id);
      await infoAlert(
        `Temporary password: ${temporaryPassword}\n\nShare this with ${u.name} so they can log back in.`,
        "Password reset",
      );
    } catch (err) {
      await infoAlert(err instanceof Error ? err.message : "Failed to reset password", "Error");
    }
  };

  const handleToggleActive = async (u: User) => {
    const activating = !u.isActive;
    const confirmed = await confirmDialog({
      title: activating ? "Activate account?" : "Deactivate account?",
      message: activating
        ? `${u.name} will be able to log in again.`
        : `${u.name} won't be able to log in until reactivated. If they're already logged in, their current session can stay valid for up to 8 hours.`,
      confirmLabel: activating ? "Activate" : "Deactivate",
      danger: !activating,
    });
    if (!confirmed) return;
    try {
      await setUserActive(u.id, activating);
      await loadUsers();
    } catch (err) {
      await infoAlert(err instanceof Error ? err.message : "Failed to update account status", "Error");
    }
  };

  const handleDeleteUser = async (u: User) => {
    const confirmed = await confirmDialog({
      title: "Delete user?",
      message: `This permanently deletes ${u.name}'s account. This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteUser(u.id);
      await loadUsers();
    } catch (err) {
      await infoAlert(err instanceof Error ? err.message : "Failed to delete user", "Error");
    }
  };

  const buildUserMenu = (u: User): DropdownMenuItem[] => [
    { label: "Edit", onSelect: () => openEditUser(u) },
    { label: "Reset password", onSelect: () => handleResetPassword(u) },
    { label: u.isActive ? "Deactivate account" : "Activate account", onSelect: () => handleToggleActive(u) },
    { label: "Delete", onSelect: () => handleDeleteUser(u), danger: true, dividerBefore: true },
  ];

  // ---------- Congregation ----------

  const openAddCongregant = () => {
    setEditingCongregantId(null);
    setCongregantForm(emptyCongregantForm);
    setCongregantFormError(null);
    setCongregantModalOpen(true);
  };

  const openEditCongregant = (m: CongregationMember) => {
    setEditingCongregantId(m.id);
    setCongregantForm({
      name: m.name,
      birthday: m.birthday ? m.birthday.slice(0, 10) : "",
      gender: m.gender ?? "",
      oldCategory: m.oldCategory ?? "",
      newCategory: m.newCategory ?? "",
    });
    setCongregantFormError(null);
    setCongregantModalOpen(true);
  };

  const handleSaveCongregant = async () => {
    if (!congregantForm.name.trim()) return;
    setSavingCongregant(true);
    setCongregantFormError(null);
    try {
      const payload = {
        name: congregantForm.name.trim(),
        birthday: congregantForm.birthday || null,
        gender: congregantForm.gender || null,
        oldCategory: congregantForm.oldCategory.trim() || null,
        newCategory: congregantForm.newCategory.trim() || null,
      };
      if (editingCongregantId === null) {
        await createCongregant(payload);
      } else {
        await updateCongregant(editingCongregantId, payload);
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
    } catch (err) {
      await infoAlert(err instanceof Error ? err.message : "Failed to delete", "Error");
    }
  };

  const buildCongregantMenu = (m: CongregationMember): DropdownMenuItem[] => [
    { label: "Edit", onSelect: () => openEditCongregant(m) },
    { label: "Delete", onSelect: () => handleDeleteCongregant(m), danger: true, dividerBefore: true },
  ];

  // ---------- Networks & Ministries ----------

  const openAddNetwork = () => {
    setEditingNetworkId(null);
    setNetworkForm(emptyNetworkForm);
    setNetworkFormError(null);
    setNetworkModalOpen(true);
  };

  const openEditNetwork = (n: Network) => {
    setEditingNetworkId(n.id);
    setNetworkForm({ name: n.name });
    setNetworkFormError(null);
    setNetworkModalOpen(true);
  };

  const handleSaveNetwork = async () => {
    if (!networkForm.name.trim()) return;
    setSavingNetwork(true);
    setNetworkFormError(null);
    try {
      const payload = { name: networkForm.name.trim() };
      if (editingNetworkId === null) {
        await createNetwork(payload);
      } else {
        await updateNetwork(editingNetworkId, payload);
      }
      setNetworkModalOpen(false);
      await loadDirectory();
    } catch (err) {
      setNetworkFormError(err instanceof Error ? err.message : "Failed to save network");
    } finally {
      setSavingNetwork(false);
    }
  };

  const handleDeleteNetwork = async (n: Network) => {
    const confirmed = await confirmDialog({
      title: "Delete network?",
      message: `This permanently deletes "${n.name}". This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteNetwork(n.id);
      await loadDirectory();
    } catch (err) {
      await infoAlert(err instanceof Error ? err.message : "Failed to delete network", "Error");
    }
  };

  const buildNetworkMenu = (n: Network): DropdownMenuItem[] => [
    { label: "Edit", onSelect: () => openEditNetwork(n) },
    { label: "Delete", onSelect: () => handleDeleteNetwork(n), danger: true, dividerBefore: true },
  ];

  const openAddMinistry = () => {
    setEditingMinistryId(null);
    setMinistryForm({ name: "", networkId: networks[0] ? String(networks[0].id) : "" });
    setMinistryFormError(null);
    setMinistryModalOpen(true);
  };

  const openEditMinistry = (m: Ministry) => {
    setEditingMinistryId(m.id);
    setMinistryForm({ name: m.name, networkId: String(m.networkId) });
    setMinistryFormError(null);
    setMinistryModalOpen(true);
  };

  const handleSaveMinistry = async () => {
    if (!ministryForm.name.trim() || !ministryForm.networkId) return;
    setSavingMinistry(true);
    setMinistryFormError(null);
    try {
      const payload = { name: ministryForm.name.trim(), networkId: Number(ministryForm.networkId) };
      if (editingMinistryId === null) {
        await createMinistry(payload);
      } else {
        await updateMinistry(editingMinistryId, payload);
      }
      setMinistryModalOpen(false);
      await loadDirectory();
    } catch (err) {
      setMinistryFormError(err instanceof Error ? err.message : "Failed to save ministry");
    } finally {
      setSavingMinistry(false);
    }
  };

  const handleDeleteMinistry = async (m: Ministry) => {
    const confirmed = await confirmDialog({
      title: "Delete ministry?",
      message: `This permanently deletes "${m.name}". This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteMinistry(m.id);
      await loadDirectory();
    } catch (err) {
      await infoAlert(err instanceof Error ? err.message : "Failed to delete ministry", "Error");
    }
  };

  const buildMinistryMenu = (m: Ministry): DropdownMenuItem[] => [
    { label: "Edit", onSelect: () => openEditMinistry(m) },
    { label: "Delete", onSelect: () => handleDeleteMinistry(m), danger: true, dividerBefore: true },
  ];

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="page-header">
        <h1>People</h1>
        {section === "users" && canManageUsers && (
          <Button type="button" onClick={openAddUser}>
            + Add user
          </Button>
        )}
        {section === "congregation" && canManageCongregation && (
          <Button type="button" onClick={openAddCongregant}>
            + Add to congregation
          </Button>
        )}
        {section === "directory" && canManageUsers && (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={openAddNetwork}>
              + Add network
            </Button>
            <Button type="button" onClick={openAddMinistry}>
              + Add ministry
            </Button>
          </div>
        )}
      </div>

      <div className="mb-5 flex gap-3">
        <Chip label="Users" active={section === "users"} onClick={() => switchSection("users")} />
        <Chip label="Congregation" active={section === "congregation"} onClick={() => switchSection("congregation")} />
        {canManageUsers && (
          <Chip label="Networks & Ministries" active={section === "directory"} onClick={() => switchSection("directory")} />
        )}
      </div>

      {section !== "directory" && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={section === "users" ? "Search by name or email" : "Search by name"}
            className="h-11 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(242,183,5,0.25)] sm:max-w-xs"
          />
          {section === "users" && (
            <>
              <SelectField
                label="Network"
                value={networkFilter}
                onChange={(e) => setNetworkFilter(e.target.value)}
                className="sm:max-w-[220px]"
              >
                <option value="">All networks</option>
                {networks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Ministry"
                value={ministryFilter}
                onChange={(e) => setMinistryFilter(e.target.value)}
                className="sm:max-w-[220px]"
              >
                <option value="">All ministries</option>
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </SelectField>
            </>
          )}
          {section === "congregation" && (
            <>
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
            </>
          )}
        </div>
      )}

      {section === "users" ? (
        <>
          {usersError && <p className="error mb-3">{usersError}</p>}
          {loadingUsers ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="helper-text">No users match your search.</p>
          ) : (
            <Card className="!p-0">
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[2fr_1.4fr_1.6fr_1fr_48px] gap-3 border-b border-[var(--color-border)] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    <span>Name</span>
                    <span>Network</span>
                    <span>Ministry</span>
                    <span>Birthday</span>
                    <span />
                  </div>
                  {pagedUsers.map((u) => (
                    <div
                      key={u.id}
                      className="grid grid-cols-[2fr_1.4fr_1.6fr_1fr_48px] items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <InitialAvatar name={u.name} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--color-text-primary)]">{u.name}</p>
                          <p className="truncate text-xs text-[var(--color-text-secondary)]">{u.email}</p>
                        </div>
                        {!u.isActive && (
                          <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[0.7rem] font-bold text-[var(--color-text-secondary)]">
                            Deactivated
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        {u.networkIds.length > 0 ? u.networkIds.map(networkNameById).join(", ") : "—"}
                      </div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        {u.ministryIds.length > 0 ? u.ministryIds.map(ministryNameById).join(", ") : "—"}
                      </div>
                      <div className="text-sm text-[var(--color-text-secondary)]">{formatBirthday(u.birthday)}</div>
                      {canManageUsers ? (
                        <DropdownMenu ariaLabel={`Actions for ${u.name}`} items={buildUserMenu(u)} />
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <Pagination
                page={usersPage}
                pageSize={usersPageSize}
                total={filteredUsers.length}
                onPageChange={setUsersPage}
                onPageSizeChange={handleUsersPageSizeChange}
              />
            </Card>
          )}
        </>
      ) : section === "congregation" ? (
        <>
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
        </>
      ) : (
        <>
          {directoryError && <p className="error mb-3">{directoryError}</p>}
          {loadingDirectory ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <Card className="!p-0">
                <p className="section-title px-4 pt-4">Networks</p>
                <div className="mt-2">
                  {networks.length === 0 && <p className="helper-text px-4 pb-4">No networks yet.</p>}
                  {networks
                    .slice((networksPage - 1) * networksPageSize, networksPage * networksPageSize)
                    .map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0"
                      >
                        <p className="font-semibold text-[var(--color-text-primary)]">{n.name}</p>
                        <DropdownMenu ariaLabel={`Actions for ${n.name}`} items={buildNetworkMenu(n)} />
                      </div>
                    ))}
                </div>
                <Pagination
                  page={networksPage}
                  pageSize={networksPageSize}
                  total={networks.length}
                  onPageChange={setNetworksPage}
                  onPageSizeChange={handleNetworksPageSizeChange}
                />
              </Card>

              <Card className="!p-0">
                <p className="section-title px-4 pt-4">Ministries</p>
                <div className="mt-2">
                  {ministries.length === 0 && <p className="helper-text px-4 pb-4">No ministries yet.</p>}
                  {ministries
                    .slice((ministriesPage - 1) * ministriesPageSize, ministriesPage * ministriesPageSize)
                    .map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0"
                      >
                        <div>
                          <p className="font-semibold text-[var(--color-text-primary)]">{m.name}</p>
                          <p className="text-xs text-[var(--color-text-secondary)]">{networkNameById(m.networkId)}</p>
                        </div>
                        <DropdownMenu ariaLabel={`Actions for ${m.name}`} items={buildMinistryMenu(m)} />
                      </div>
                    ))}
                </div>
                <Pagination
                  page={ministriesPage}
                  pageSize={ministriesPageSize}
                  total={ministries.length}
                  onPageChange={setMinistriesPage}
                  onPageSizeChange={handleMinistriesPageSizeChange}
                />
              </Card>
            </div>
          )}
        </>
      )}

      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editingUserId === null ? "Add user" : "Edit user"}
        size="lg"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setUserModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveUser}
              disabled={savingUser || !userForm.name.trim() || !userForm.email.trim()}
            >
              {savingUser ? "Saving..." : editingUserId === null ? "Add user" : "Save changes"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="Name"
            value={userForm.name}
            onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <TextField
            label="Email"
            type="email"
            value={userForm.email}
            onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <TextField
            label="Birthday"
            type="date"
            value={userForm.birthday}
            onChange={(e) => setUserForm((f) => ({ ...f, birthday: e.target.value }))}
          />

          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <input
              type="checkbox"
              checked={userForm.isRegistrar}
              onChange={(e) => setUserForm((f) => ({ ...f, isRegistrar: e.target.checked }))}
            />
            Registrar (can manage attendance)
          </label>

          <div>
            <p className="section-title">Networks &amp; ministries</p>
            <div className="flex flex-col gap-3">
              {networks.map((net) => {
                const netMinistries = ministries.filter((m) => m.networkId === net.id);
                return (
                  <div key={net.id} className="rounded-md border border-[var(--color-border)] p-3">
                    <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-navy)]">
                      <input
                        type="checkbox"
                        checked={userForm.networkIds.includes(net.id)}
                        onChange={() => toggleNetwork(net.id)}
                      />
                      {net.name}
                    </label>
                    {netMinistries.length > 0 && (
                      <div className="ml-6 mt-2 flex flex-col gap-1.5">
                        {netMinistries.map((m) => (
                          <label
                            key={m.id}
                            className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"
                          >
                            <input
                              type="checkbox"
                              checked={userForm.ministryIds.includes(m.id)}
                              onChange={() => toggleMinistry(m.id)}
                            />
                            {m.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {userFormError && <p className="error">{userFormError}</p>}
        </div>
      </Modal>

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
              disabled={savingCongregant || !congregantForm.name.trim()}
            >
              {savingCongregant ? "Saving..." : editingCongregantId === null ? "Add" : "Save changes"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="Full name"
            value={congregantForm.name}
            onChange={(e) => setCongregantForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
            required
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

      <Modal
        open={networkModalOpen}
        onClose={() => setNetworkModalOpen(false)}
        title={editingNetworkId === null ? "Add network" : "Edit network"}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setNetworkModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveNetwork} disabled={savingNetwork || !networkForm.name.trim()}>
              {savingNetwork ? "Saving..." : editingNetworkId === null ? "Add" : "Save changes"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="Network name"
            value={networkForm.name}
            onChange={(e) => setNetworkForm({ name: e.target.value })}
            autoFocus
            required
          />
          {networkFormError && <p className="error">{networkFormError}</p>}
        </div>
      </Modal>

      <Modal
        open={ministryModalOpen}
        onClose={() => setMinistryModalOpen(false)}
        title={editingMinistryId === null ? "Add ministry" : "Edit ministry"}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setMinistryModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveMinistry}
              disabled={savingMinistry || !ministryForm.name.trim() || !ministryForm.networkId}
            >
              {savingMinistry ? "Saving..." : editingMinistryId === null ? "Add" : "Save changes"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="Ministry name"
            value={ministryForm.name}
            onChange={(e) => setMinistryForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
            required
          />
          <SelectField
            label="Network"
            value={ministryForm.networkId}
            onChange={(e) => setMinistryForm((f) => ({ ...f, networkId: e.target.value }))}
          >
            <option value="">Select a network...</option>
            {networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </SelectField>
          {ministryFormError && <p className="error">{ministryFormError}</p>}
        </div>
      </Modal>
    </AppShell>
  );
}

export default People;
