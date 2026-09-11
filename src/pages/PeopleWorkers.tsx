import { useEffect, useMemo, useState } from "react";
import {
  createUser,
  deleteUser,
  getMinistries,
  getNetworks,
  getUsers,
  resetUserPassword,
  setUserActive,
  setUserRegistrar,
  updateUser,
  type Ministry,
  type Network,
  type User,
} from "../api";
import { isAdmin } from "../auth";
import { InitialAvatar, formatBirthday } from "../components/PeopleShared";
import {
  buildNetworkTree,
  flattenNetworksForSelect,
  SINGLE_SELECT_PARENT_NAME,
  type NetworkTreeNode,
} from "../components/networkTree";
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
  Skeleton,
  TextField,
  type DropdownMenuItem,
} from "../components/ui";
import { getPageSize, setPageSize } from "../preferences";
import { confirmDialog, infoAlert, successToast } from "../swal";

const emptyUserForm = {
  name: "",
  email: "",
  birthday: "",
  ministryIds: [] as number[],
  networkIds: [] as number[],
  isRegistrar: false,
};

interface NetworkPickerNodeProps {
  node: NetworkTreeNode;
  depth: number;
  /** Non-null when this node is one of several mutually-exclusive siblings (e.g. under LGN) — renders a radio instead of a checkbox. */
  singleSelectSiblingIds: number[] | null;
  networkIds: number[];
  ministryIds: number[];
  onToggleNetwork: (id: number) => void;
  onSelectSingleNetwork: (siblingIds: number[], id: number) => void;
  onToggleMinistry: (id: number) => void;
}

function NetworkPickerNode({
  node,
  depth,
  singleSelectSiblingIds,
  networkIds,
  ministryIds,
  onToggleNetwork,
  onSelectSingleNetwork,
  onToggleMinistry,
}: NetworkPickerNodeProps) {
  const childSiblingIds =
    node.network.name === SINGLE_SELECT_PARENT_NAME ? node.children.map((c) => c.network.id) : null;

  return (
    <div className={depth > 0 ? "ml-6 mt-2" : ""}>
      <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-navy)]">
        <input
          type={singleSelectSiblingIds ? "radio" : "checkbox"}
          name={singleSelectSiblingIds ? `network-group-${singleSelectSiblingIds[0]}` : undefined}
          checked={networkIds.includes(node.network.id)}
          onChange={() =>
            singleSelectSiblingIds
              ? onSelectSingleNetwork(singleSelectSiblingIds, node.network.id)
              : onToggleNetwork(node.network.id)
          }
        />
        {node.network.name}
      </label>

      {node.ministries.length > 0 && (
        <div className="ml-6 mt-2 flex flex-col gap-1.5">
          {node.ministries.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <input type="checkbox" checked={ministryIds.includes(m.id)} onChange={() => onToggleMinistry(m.id)} />
              {m.name}
            </label>
          ))}
        </div>
      )}

      {node.children.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {node.children.map((child) => (
            <NetworkPickerNode
              key={child.network.id}
              node={child}
              depth={depth + 1}
              singleSelectSiblingIds={childSiblingIds}
              networkIds={networkIds}
              ministryIds={ministryIds}
              onToggleNetwork={onToggleNetwork}
              onSelectSingleNetwork={onSelectSingleNetwork}
              onToggleMinistry={onToggleMinistry}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PeopleWorkers() {
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

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | string | null>(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [savingUser, setSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      setUsers(await getUsers());
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "Failed to load workers");
    } finally {
      setLoadingUsers(false);
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
        // Networks/ministries only drive filters and the assignment picker below —
        // if they fail to load, the worker list itself still works fine.
      });
  }, []);

  const networkNameById = (id: number) => networks.find((n) => n.id === id)?.name ?? `#${id}`;
  const ministryNameById = (id: number) => ministries.find((m) => m.id === id)?.name ?? `#${id}`;

  const networkTree = useMemo(() => buildNetworkTree(networks, ministries), [networks, ministries]);
  const networkSelectOptions = useMemo(() => flattenNetworksForSelect(networkTree), [networkTree]);

  // Any change to what's being shown jumps back to page 1 — otherwise a filter/search
  // change could land you on a now-empty or out-of-range page.
  useEffect(() => setUsersPage(1), [search, ministryFilter, networkFilter]);

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
    setUserForm((f) => {
      const adding = !f.ministryIds.includes(id);
      const ministryIds = adding ? [...f.ministryIds, id] : f.ministryIds.filter((x) => x !== id);
      if (!adding) return { ...f, ministryIds };

      // Picking a ministry implies membership in its parent network too (e.g. JAM/VIA/TEAM -> WAN).
      const ministry = ministries.find((m) => m.id === id);
      const networkIds =
        ministry && !f.networkIds.includes(ministry.networkId) ? [...f.networkIds, ministry.networkId] : f.networkIds;
      return { ...f, ministryIds, networkIds };
    });
  };

  const toggleNetwork = (id: number) => {
    setUserForm((f) => ({
      ...f,
      networkIds: f.networkIds.includes(id) ? f.networkIds.filter((x) => x !== id) : [...f.networkIds, id],
    }));
  };

  // LGN's sub-networks are mutually exclusive (a member belongs to exactly one demographic group),
  // so picking one replaces any other sibling already selected instead of just adding to the list.
  const selectSingleNetwork = (siblingIds: number[], id: number) => {
    setUserForm((f) => ({
      ...f,
      networkIds: [...f.networkIds.filter((x) => !siblingIds.includes(x)), id],
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
          "Worker created",
        );
      } else {
        await updateUser(editingUserId, payload);
        await setUserRegistrar(editingUserId, userForm.isRegistrar);
        setUserModalOpen(false);
        await loadUsers();
        successToast("Worker updated");
      }
    } catch (err) {
      setUserFormError(err instanceof Error ? err.message : "Failed to save worker");
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
      successToast(activating ? "Worker activated" : "Worker deactivated");
    } catch (err) {
      await infoAlert(err instanceof Error ? err.message : "Failed to update account status", "Error");
    }
  };

  const handleDeleteUser = async (u: User) => {
    const confirmed = await confirmDialog({
      title: "Delete worker?",
      message: `This permanently deletes ${u.name}'s account. This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteUser(u.id);
      await loadUsers();
      successToast("Worker deleted");
    } catch (err) {
      await infoAlert(err instanceof Error ? err.message : "Failed to delete worker", "Error");
    }
  };

  const buildUserMenu = (u: User): DropdownMenuItem[] => [
    { label: "Edit", onSelect: () => openEditUser(u) },
    { label: "Reset password", onSelect: () => handleResetPassword(u) },
    { label: u.isActive ? "Deactivate account" : "Activate account", onSelect: () => handleToggleActive(u) },
    { label: "Delete", onSelect: () => handleDeleteUser(u), danger: true, dividerBefore: true },
  ];

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="page-header">
        <h1>Workers / Users</h1>
        {canManageUsers && (
          <Button type="button" onClick={openAddUser}>
            + Add worker
          </Button>
        )}
      </div>

      <FilterBar
        primary={
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="h-11 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(242,183,5,0.25)] sm:max-w-xs"
          />
        }
        activeCount={[networkFilter, ministryFilter].filter(Boolean).length}
      >
        <SelectField
          label="Network"
          value={networkFilter}
          onChange={(e) => setNetworkFilter(e.target.value)}
          className="sm:max-w-[220px]"
        >
          <option value="">All networks</option>
          {networkSelectOptions.map(({ id, name, depth }) => (
            <option key={id} value={id}>
              {"  ".repeat(depth)}
              {depth > 0 ? "– " : ""}
              {name}
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
      </FilterBar>

      {usersError && <p className="error mb-3">{usersError}</p>}
      {loadingUsers ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="h-14 w-full rounded-md" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <p className="helper-text">No workers match your search.</p>
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

      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editingUserId === null ? "Add worker" : "Edit worker"}
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
              {savingUser ? "Saving..." : editingUserId === null ? "Add worker" : "Save changes"}
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
              {networkTree.map((root) => (
                <div key={root.network.id} className="rounded-md border border-[var(--color-border)] p-3">
                  <NetworkPickerNode
                    node={root}
                    depth={0}
                    singleSelectSiblingIds={null}
                    networkIds={userForm.networkIds}
                    ministryIds={userForm.ministryIds}
                    onToggleNetwork={toggleNetwork}
                    onSelectSingleNetwork={selectSingleNetwork}
                    onToggleMinistry={toggleMinistry}
                  />
                </div>
              ))}
            </div>
          </div>

          {userFormError && <p className="error">{userFormError}</p>}
        </div>
      </Modal>
    </AppShell>
  );
}

export default PeopleWorkers;
