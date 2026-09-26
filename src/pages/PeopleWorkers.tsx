import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createUser,
  deleteUser,
  getMinistries,
  getNetworks,
  getUsers,
  resetUserPassword,
  setUserActive,
  updateUser,
  type Ministry,
  type Network,
  type User,
} from "../api";
import { isAdmin } from "../auth";
import { InitialAvatar, PhotoPicker, formatBirthday } from "../components/PeopleShared";
import {
  buildNetworkTree,
  flattenNetworksForSelect,
  getAncestorNetworkIds,
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
  Spinner,
  TextField,
  type DropdownMenuItem,
} from "../components/ui";
import { getPageSize, setPageSize } from "../preferences";
import { confirmDialog, infoAlert, successToast } from "../swal";

const emptyUserForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  nickname: "",
  email: "",
  birthday: "",
  photoDataUrl: null as string | null,
  ministryIds: [] as number[],
  networkIds: [] as number[],
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

const MAX_VISIBLE_NAMES = 2;
const TOOLTIP_WIDTH = 240;

/** Renders a list of names, collapsing to "+N more" once a worker belongs to enough
 * networks/ministries that spelling them all out would clog the row. Hovering (or focusing,
 * for keyboard users) the "+N more" badge reveals the rest in a floating tooltip.
 *
 * The tooltip is rendered through a portal into document.body rather than as a child of the
 * badge — otherwise the table's `overflow-x-auto` wrapper clips it, per the same CSS overflow
 * quirk documented on DropdownMenu (setting overflow-x forces overflow-y to auto too). */
function NameListCell({ ids, nameById }: { ids: number[]; nameById: (id: number) => string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const hide = () => setOpen(false);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);

  if (ids.length === 0) return <>—</>;
  const names = ids.map(nameById);
  if (names.length <= MAX_VISIBLE_NAMES) return <>{names.join(", ")}</>;

  const remaining = names.length - MAX_VISIBLE_NAMES;

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - TOOLTIP_WIDTH - 8) });
    setOpen(true);
  };

  return (
    <span>
      {names.slice(0, MAX_VISIBLE_NAMES).join(", ")}{" "}
      <span
        ref={triggerRef}
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        className="cursor-default font-semibold text-[var(--color-text-secondary)] underline decoration-dotted underline-offset-2"
      >
        +{remaining} more
      </span>
      {open &&
        position &&
        createPortal(
          <div
            role="tooltip"
            style={{ position: "fixed", top: position.top, left: position.left, width: TOOLTIP_WIDTH }}
            className="z-50 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-lg"
          >
            {names.join(", ")}
          </div>,
          document.body,
        )}
    </span>
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
        // Networks/ministries only drive filters and the assignment picker below —
        // if they fail to load, the worker list itself still works fine.
      });
  }, []);

  const networkNameMap = useMemo(() => new Map(networks.map((n) => [n.id, n.name])), [networks]);
  const ministryNameMap = useMemo(() => new Map(ministries.map((m) => [m.id, m.name])), [ministries]);
  const networkNameById = (id: number) => networkNameMap.get(id) ?? `#${id}`;
  const ministryNameById = (id: number) => ministryNameMap.get(id) ?? `#${id}`;

  const networkTree = useMemo(() => buildNetworkTree(networks, ministries), [networks, ministries]);
  const networkSelectOptions = useMemo(() => flattenNetworksForSelect(networkTree), [networkTree]);

  // Any change to what's being shown jumps back to page 1 — otherwise a filter/search
  // change could land you on a now-empty or out-of-range page.
  useEffect(() => setUsersPage(1), [search, ministryFilter, networkFilter]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (
        q &&
        !u.name.toLowerCase().includes(q) &&
        !u.email.toLowerCase().includes(q) &&
        !u.nickname?.toLowerCase().includes(q)
      ) {
        return false;
      }
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
      firstName: u.firstName,
      middleName: u.middleName ?? "",
      lastName: u.lastName,
      nickname: u.nickname ?? "",
      email: u.email,
      birthday: u.birthday ? u.birthday.slice(0, 10) : "",
      photoDataUrl: u.photoDataUrl,
      ministryIds: u.ministryIds,
      networkIds: u.networkIds,
    });
    setUserFormError(null);
    setUserModalOpen(true);
  };

  const toggleMinistry = (id: number) => {
    setUserForm((f) => {
      const adding = !f.ministryIds.includes(id);
      const ministryIds = adding ? [...f.ministryIds, id] : f.ministryIds.filter((x) => x !== id);
      if (!adding) return { ...f, ministryIds };

      // Picking a ministry implies membership in its network and every network above it
      // too (e.g. JAM/VIA/TEAM -> WAN -> MDN).
      const ministry = ministries.find((m) => m.id === id);
      if (!ministry) return { ...f, ministryIds };
      const impliedNetworkIds = [ministry.networkId, ...getAncestorNetworkIds(ministry.networkId, networks)].filter(
        (nid) => !f.networkIds.includes(nid),
      );
      return { ...f, ministryIds, networkIds: [...f.networkIds, ...impliedNetworkIds] };
    });
  };

  const toggleNetwork = (id: number) => {
    setUserForm((f) => {
      if (f.networkIds.includes(id)) return { ...f, networkIds: f.networkIds.filter((x) => x !== id) };

      // Selecting a sub-network implies membership in every network above it too (e.g. WAN -> MDN).
      const ancestorIds = getAncestorNetworkIds(id, networks).filter((a) => !f.networkIds.includes(a));
      return { ...f, networkIds: [...f.networkIds, id, ...ancestorIds] };
    });
  };

  // LGN's sub-networks are mutually exclusive (a member belongs to exactly one demographic group),
  // so picking one replaces any other sibling already selected instead of just adding to the list.
  const selectSingleNetwork = (siblingIds: number[], id: number) => {
    setUserForm((f) => {
      const ancestorIds = getAncestorNetworkIds(id, networks).filter(
        (a) => !f.networkIds.includes(a) && !siblingIds.includes(a),
      );
      return {
        ...f,
        networkIds: [...f.networkIds.filter((x) => !siblingIds.includes(x)), id, ...ancestorIds],
      };
    });
  };

  const handleSaveUser = async () => {
    if (!userForm.firstName.trim() || !userForm.lastName.trim() || !userForm.email.trim()) return;
    setSavingUser(true);
    setUserFormError(null);
    try {
      const payload = {
        firstName: userForm.firstName.trim(),
        middleName: userForm.middleName.trim() || null,
        lastName: userForm.lastName.trim(),
        nickname: userForm.nickname.trim() || null,
        email: userForm.email.trim(),
        birthday: userForm.birthday || null,
        photoDataUrl: userForm.photoDataUrl,
        ministryIds: userForm.ministryIds,
        networkIds: userForm.networkIds,
      };

      if (editingUserId === null) {
        const result = await createUser(payload);
        setUserModalOpen(false);
        await loadUsers(true);
        await infoAlert(
          `Temporary password: ${result.temporaryPassword}\n\nShare this with ${result.user.name} so they can log in. They should change it from Settings afterward.`,
          "Worker created",
        );
      } else {
        await updateUser(editingUserId, payload);
        setUserModalOpen(false);
        setBusyUserId(editingUserId);
        await loadUsers(true);
        successToast("Worker updated");
      }
    } catch (err) {
      setUserFormError(err instanceof Error ? err.message : "Failed to save worker");
    } finally {
      setSavingUser(false);
      setBusyUserId(null);
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
    setBusyUserId(u.id);
    try {
      await setUserActive(u.id, activating);
      await loadUsers(true);
      successToast(activating ? "Worker activated" : "Worker deactivated");
    } catch (err) {
      await infoAlert(err instanceof Error ? err.message : "Failed to update account status", "Error");
    } finally {
      setBusyUserId(null);
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
    setBusyUserId(u.id);
    try {
      await deleteUser(u.id);
      await loadUsers(true);
      successToast("Worker deleted");
    } catch (err) {
      await infoAlert(err instanceof Error ? err.message : "Failed to delete worker", "Error");
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
        <Card className="!p-0 card-bleed">
          {/* Desktop: column table. */}
          <div className="hidden overflow-x-auto min-[900px]:block">
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
                  className={[
                    "grid grid-cols-[2fr_1.4fr_1.6fr_1fr_48px] items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 transition-opacity",
                    u.id === busyUserId && "pointer-events-none animate-pulse opacity-60",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <InitialAvatar name={u.name} photoUrl={u.photoDataUrl} />
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
                    <NameListCell ids={u.networkIds} nameById={networkNameById} />
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    <NameListCell ids={u.ministryIds} nameById={ministryNameById} />
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)]">{formatBirthday(u.birthday)}</div>
                  {u.id === busyUserId ? (
                    <Spinner className="h-4 w-4 text-[var(--color-text-secondary)]" />
                  ) : canManageUsers ? (
                    <DropdownMenu ariaLabel={`Actions for ${u.name}`} items={buildUserMenu(u)} />
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: stacked cards — a grid row would force sideways scrolling to see every field. */}
          <ul className="min-[900px]:hidden">
            {pagedUsers.map((u) => (
              <li
                key={u.id}
                className={[
                  "border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 transition-opacity",
                  u.id === busyUserId && "pointer-events-none animate-pulse opacity-60",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="flex items-start gap-3">
                  <InitialAvatar name={u.name} photoUrl={u.photoDataUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-[var(--color-text-primary)]">{u.name}</p>
                      {!u.isActive && (
                        <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[0.7rem] font-bold text-[var(--color-text-secondary)]">
                          Deactivated
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5 text-xs text-[var(--color-text-secondary)]">
                      <p className="min-w-0 flex-1 truncate">{u.email}</p>
                      {u.birthday && <p className="shrink-0">{formatBirthday(u.birthday)}</p>}
                    </div>
                    <dl className="mt-1.5 flex flex-col gap-1 text-sm">
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <dt className="shrink-0 text-[0.68rem] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                          Network
                        </dt>
                        <dd className="text-[var(--color-text-primary)]">
                          <NameListCell ids={u.networkIds} nameById={networkNameById} />
                        </dd>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <dt className="shrink-0 text-[0.68rem] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                          Ministry
                        </dt>
                        <dd className="text-[var(--color-text-primary)]">
                          <NameListCell ids={u.ministryIds} nameById={ministryNameById} />
                        </dd>
                      </div>
                    </dl>
                  </div>
                  {u.id === busyUserId ? (
                    <Spinner className="mt-1 h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                  ) : (
                    canManageUsers && <DropdownMenu ariaLabel={`Actions for ${u.name}`} items={buildUserMenu(u)} />
                  )}
                </div>
              </li>
            ))}
          </ul>

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
              disabled={savingUser || !userForm.firstName.trim() || !userForm.lastName.trim() || !userForm.email.trim()}
            >
              {savingUser ? "Saving..." : editingUserId === null ? "Add worker" : "Save changes"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <PhotoPicker
            name={`${userForm.firstName} ${userForm.lastName}`.trim() || "Worker"}
            photoUrl={userForm.photoDataUrl}
            onChange={(photoDataUrl) => setUserForm((f) => ({ ...f, photoDataUrl }))}
          />
          <TextField
            label="First name"
            value={userForm.firstName}
            onChange={(e) => setUserForm((f) => ({ ...f, firstName: e.target.value }))}
            required
          />
          <TextField
            label="Middle name (optional)"
            value={userForm.middleName}
            onChange={(e) => setUserForm((f) => ({ ...f, middleName: e.target.value }))}
          />
          <TextField
            label="Last name"
            value={userForm.lastName}
            onChange={(e) => setUserForm((f) => ({ ...f, lastName: e.target.value }))}
            required
          />
          <TextField
            label="Nickname (optional)"
            value={userForm.nickname}
            onChange={(e) => setUserForm((f) => ({ ...f, nickname: e.target.value }))}
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
