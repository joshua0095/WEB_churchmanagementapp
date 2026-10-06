import { useEffect, useMemo, useState } from "react";
import {
  deleteUser,
  getMinistries,
  getNetworks,
  getUsers,
  resetUserPassword,
  setUserActive,
  type Ministry,
  type Network,
  type User,
} from "../api";
import { isAdmin } from "../auth";
import { useConfirm, useToast } from "../components/dialogs";
import { InitialAvatar, formatBirthdayShort } from "../components/PeopleShared";
import { buildNetworkTree, flattenNetworksForSelect, type NetworkTreeNode } from "../components/networkTree";
import { ChipList, type ChipItem } from "../components/people/PeopleChips";
import WorkerModal from "../components/people/WorkerModal";
import { AppShell, DropdownMenu, Pagination, ProfileMenu, Skeleton, Spinner, type DropdownMenuItem } from "../components/ui";
import { KebabIcon, TopbarSearchIcon } from "../components/ui/shellIcons";
import { getPageSize, setPageSize } from "../preferences";
import { infoAlert } from "../swal";

function CakeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7" />
      <path d="M5 16c1.5 1 2.5 1 3.5 0s2.5-1 3.5 0 2.5 1 3.5 0 2.5-1 3.5 0" />
      <path d="M12 12V8M12 5.5c.8-.9.8-1.7 0-2.5-.8.8-.8 1.6 0 2.5Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function Birthday({ value }: { value: string | null }) {
  const label = formatBirthdayShort(value);
  if (!label) return <span className="wk-empty">—</span>;
  return (
    <span className="wk-birthday">
      <CakeIcon />
      {label}
    </span>
  );
}

/** A worker's networks (in tree order) and ministries as chip items. */
function chipItemsFor(u: User, networkOrder: Map<number, number>, networkById: Map<number, Network>, ministryById: Map<number, Ministry>) {
  const networks: ChipItem[] = [...u.networkIds]
    .sort((a, b) => (networkOrder.get(a) ?? 0) - (networkOrder.get(b) ?? 0))
    .map((id) => ({ key: `n${id}`, kind: "network", name: networkById.get(id)?.name ?? `#${id}` }));
  const ministries: ChipItem[] = u.ministryIds.map((id) => ({ key: `m${id}`, kind: "ministry", name: ministryById.get(id)?.name ?? `#${id}` }));
  return { networks, ministries };
}

function PeopleWorkers() {
  const toast = useToast();
  const confirm = useConfirm();

  const [search, setSearch] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("");
  const [networkFilter, setNetworkFilter] = useState("");

  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(() => getPageSize("peopleUsers", 20));

  const handleUsersPageSizeChange = (size: number) => {
    setUsersPageSize(size);
    setPageSize("peopleUsers", size);
    setUsersPage(1);
  };

  const [networks, setNetworks] = useState<Network[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const canManageUsers = isAdmin();

  const [modal, setModal] = useState<{ open: boolean; editing: User | null }>({ open: false, editing: null });

  // Which row shows the "updating" pulse — set right before a per-row mutation (save/toggle/
  // delete) and cleared once the silent reload picks it back up.
  const [busyUserId, setBusyUserId] = useState<number | string | null>(null);

  // `silent` skips the loading skeleton for a background refresh (e.g. after editing a worker)
  // — otherwise the whole list would flicker to a skeleton and lose your page/scroll position.
  const loadUsers = async (silent = false) => {
    if (!silent) setLoadingUsers(true);
    setUsersError(null);
    try {
      setUsers(await getUsers());
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "Failed to load workers");
    } finally {
      if (!silent) setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
    Promise.all([getNetworks(), getMinistries()])
      .then(([networkList, ministryList]) => {
        setNetworks(networkList);
        setMinistries(ministryList);
      })
      .catch(() => {
        // Networks/ministries only drive filters, chips and the assignment picker —
        // if they fail to load, the worker list itself still works fine.
      });
  }, []);

  const networkById = useMemo(() => new Map(networks.map((n) => [n.id, n])), [networks]);
  const ministryById = useMemo(() => new Map(ministries.map((m) => [m.id, m])), [ministries]);
  const networkTree: NetworkTreeNode[] = useMemo(() => buildNetworkTree(networks, ministries), [networks, ministries]);
  const networkSelectOptions = useMemo(() => flattenNetworksForSelect(networkTree), [networkTree]);
  const networkOrder = useMemo(() => new Map(networkSelectOptions.map((o, i) => [o.id, i])), [networkSelectOptions]);

  // Any change to what's being shown jumps back to page 1 — otherwise a filter/search
  // change could land you on a now-empty or out-of-range page.
  useEffect(() => setUsersPage(1), [search, ministryFilter, networkFilter]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !u.nickname?.toLowerCase().includes(q)) {
        return false;
      }
      if (ministryFilter && !u.ministryIds.includes(Number(ministryFilter))) return false;
      if (networkFilter && !u.networkIds.includes(Number(networkFilter))) return false;
      return true;
    });
  }, [users, search, ministryFilter, networkFilter]);

  const pageStart = (usersPage - 1) * usersPageSize;
  const pagedUsers = filteredUsers.slice(pageStart, pageStart + usersPageSize);

  const openAddUser = () => setModal({ open: true, editing: null });
  const openEditUser = (u: User) => setModal({ open: true, editing: u });
  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  const handleSaved = async (
    result: { kind: "updated"; user: User } | { kind: "created"; user: User; temporaryPassword: string },
  ) => {
    closeModal();
    if (result.kind === "created") {
      await loadUsers(true);
      toast.show({ type: "success", title: "Worker saved" });
      await infoAlert(
        `Temporary password: ${result.temporaryPassword}\n\nShare this with ${result.user.name} so they can log in. They should change it from Settings afterward.`,
        "Worker created",
      );
      return;
    }
    setBusyUserId(result.user.id);
    try {
      await loadUsers(true);
      toast.show({ type: "success", title: "Worker saved" });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleResetPassword = async (u: User) => {
    const ok = await confirm({
      title: "Reset password?",
      description: `This generates a new temporary password for ${u.name}. Their current password stops working immediately.`,
      confirmLabel: "Reset password",
      danger: false,
    });
    if (!ok) return;
    try {
      const { temporaryPassword } = await resetUserPassword(u.id);
      await infoAlert(`Temporary password: ${temporaryPassword}\n\nShare this with ${u.name} so they can log back in.`, "Password reset");
    } catch (err) {
      toast.show({ type: "error", title: "Couldn't reset the password", message: err instanceof Error ? err.message : undefined });
    }
  };

  const handleToggleActive = async (u: User) => {
    const activating = !u.isActive;
    const ok = await confirm({
      title: activating ? "Activate account?" : "Deactivate account?",
      description: activating
        ? `${u.name} will be able to log in again.`
        : `${u.name} won't be able to log in until reactivated. If they're already logged in, their current session can stay valid for up to 8 hours.`,
      confirmLabel: activating ? "Activate" : "Deactivate",
      danger: !activating,
    });
    if (!ok) return;
    setBusyUserId(u.id);
    try {
      await setUserActive(u.id, activating);
      await loadUsers(true);
      toast.show({ type: "success", title: activating ? "Worker activated" : "Worker deactivated" });
    } catch (err) {
      toast.show({ type: "error", title: "Couldn't update the account", message: err instanceof Error ? err.message : undefined });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDeleteUser = async (u: User) => {
    const ok = await confirm({
      title: "Delete worker?",
      description: `This permanently deletes ${u.name}'s account. This can't be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setBusyUserId(u.id);
    try {
      await deleteUser(u.id);
      await loadUsers(true);
      toast.show({ type: "success", title: "Worker deleted" });
    } catch (err) {
      toast.show({ type: "error", title: "Couldn't delete the worker", message: err instanceof Error ? err.message : undefined });
    } finally {
      setBusyUserId(null);
    }
  };

  const buildUserMenu = (u: User): DropdownMenuItem[] => [
    { label: "Edit", onSelect: () => openEditUser(u) },
    { label: "Reset password", onSelect: () => handleResetPassword(u) },
    { label: u.isActive ? "Deactivate account" : "Activate account", onSelect: () => handleToggleActive(u) },
    { label: "Delete", onSelect: () => handleDeleteUser(u), danger: true, dividerBefore: true },
  ];

  const actions = (u: User) =>
    u.id === busyUserId ? (
      <span className="wk-kebab-slot">
        <Spinner className="h-4 w-4 text-[var(--color-text-secondary)]" />
      </span>
    ) : canManageUsers ? (
      <DropdownMenu ariaLabel={`Actions for ${u.name}`} items={buildUserMenu(u)} icon={<KebabIcon />} triggerClassName="wk-kebab" />
    ) : (
      <span className="wk-kebab-slot" />
    );

  const nameButton = (u: User, className: string) =>
    canManageUsers ? (
      <button type="button" className={`${className} wk-name-link`} onClick={() => openEditUser(u)}>
        {u.name}
      </button>
    ) : (
      <span className={className}>{u.name}</span>
    );

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="wk-page">
        <div className="wk-header">
          <div className="min-w-0">
            <h1 className="wk-title">
              Workers
              {!loadingUsers && (
                <span className="wk-count">
                  {" "}
                  · {users.length} {users.length === 1 ? "person" : "people"}
                </span>
              )}
            </h1>
            <p className="wk-subtitle">Everyone who serves, and the networks and ministries they belong to.</p>
          </div>
          {canManageUsers && (
            <button type="button" className="wk-btn wk-btn--gold wk-add-btn" onClick={openAddUser}>
              <PlusIcon />
              <span className="wk-add-long">Add worker</span>
              <span className="wk-add-short" aria-hidden="true">
                Add
              </span>
            </button>
          )}
        </div>

        <div className="wk-toolbar">
          <label className="wk-search">
            <TopbarSearchIcon />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              aria-label="Search workers by name or email"
            />
          </label>
          <div className="wk-filters">
            <label className="wk-filter">
              <span className="wk-filter-label">Network</span>
              <select value={networkFilter} onChange={(e) => setNetworkFilter(e.target.value)} aria-label="Filter by network">
                <option value="">All networks</option>
                {networkSelectOptions.map(({ id, name, depth }) => (
                  <option key={id} value={id}>
                    {"  ".repeat(depth)}
                    {depth > 0 ? "– " : ""}
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="wk-filter">
              <span className="wk-filter-label">Ministry</span>
              <select value={ministryFilter} onChange={(e) => setMinistryFilter(e.target.value)} aria-label="Filter by ministry">
                <option value="">All ministries</option>
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {usersError && <p className="error">{usersError}</p>}

        {loadingUsers ? (
          <div className="flex flex-col gap-2" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-[16px]" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="helper-text">No workers match your search.</p>
        ) : (
          <>
            {/* Desktop: one table card */}
            <div className="wk-table" role="table" aria-label="Workers">
              <div className="wk-row wk-row--head" role="row">
                <span role="columnheader">Name</span>
                <span role="columnheader">Networks</span>
                <span role="columnheader">Ministries</span>
                <span role="columnheader">Birthday</span>
                <span role="columnheader">
                  <span className="sr-only">Actions</span>
                </span>
              </div>
              {pagedUsers.map((u, i) => {
                const chips = chipItemsFor(u, networkOrder, networkById, ministryById);
                return (
                  <div key={u.id} role="row" className={["wk-row", u.id === busyUserId && "wk-row--busy"].filter(Boolean).join(" ")}>
                    <div role="cell" className="wk-name-cell">
                      <InitialAvatar name={u.name} photoUrl={u.photoDataUrl} size="row" tone={(pageStart + i) % 2 === 0 ? "sand" : "mist"} />
                      <div className="min-w-0">
                        <div className="wk-name-line">
                          {nameButton(u, "wk-name")}
                          {!u.isActive && <span className="wk-inactive">Deactivated</span>}
                        </div>
                        <p className="wk-email">{u.email}</p>
                      </div>
                    </div>
                    <div role="cell">
                      <ChipList items={chips.networks} />
                    </div>
                    <div role="cell">
                      <ChipList items={chips.ministries} />
                    </div>
                    <div role="cell">
                      <Birthday value={u.birthday} />
                    </div>
                    <div role="cell" className="wk-actions-cell">
                      {actions(u)}
                    </div>
                  </div>
                );
              })}
              <Pagination
                page={usersPage}
                pageSize={usersPageSize}
                total={filteredUsers.length}
                onPageChange={setUsersPage}
                onPageSizeChange={handleUsersPageSizeChange}
              />
            </div>

            {/* Mobile: fixed-height cards */}
            <ul className="wk-cards">
              {pagedUsers.map((u, i) => {
                const chips = chipItemsFor(u, networkOrder, networkById, ministryById);
                const birthday = formatBirthdayShort(u.birthday);
                return (
                  <li key={u.id} className={["wk-card", u.id === busyUserId && "wk-row--busy"].filter(Boolean).join(" ")}>
                    <InitialAvatar name={u.name} photoUrl={u.photoDataUrl} size="row" tone={(pageStart + i) % 2 === 0 ? "sand" : "mist"} />
                    <div className="wk-card-main">
                      <div className="wk-name-line">
                        {nameButton(u, "wk-name wk-name--card")}
                        {!u.isActive && <span className="wk-inactive">Deactivated</span>}
                      </div>
                      <p className="wk-email">{u.email}</p>
                      <div className="wk-card-chips">
                        <ChipList items={[...chips.networks, ...chips.ministries]} empty="No network yet" />
                        {birthday && (
                          <span className="wk-birthday wk-birthday--end">
                            <CakeIcon />
                            {birthday}
                          </span>
                        )}
                      </div>
                    </div>
                    {actions(u)}
                  </li>
                );
              })}
            </ul>
            <div className="wk-cards-pagination">
              <Pagination
                page={usersPage}
                pageSize={usersPageSize}
                total={filteredUsers.length}
                onPageChange={setUsersPage}
                onPageSizeChange={handleUsersPageSizeChange}
              />
            </div>
          </>
        )}
      </div>

      <WorkerModal
        open={modal.open}
        editing={modal.editing}
        networks={networks}
        ministries={ministries}
        tree={networkTree}
        onClose={closeModal}
        onSaved={(r) => void handleSaved(r)}
      />
    </AppShell>
  );
}

export default PeopleWorkers;
