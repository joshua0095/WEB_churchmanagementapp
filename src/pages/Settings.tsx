import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addLifeGroupMember,
  createLifeGroup,
  createMinistry,
  createNetwork,
  deleteMinistry,
  deleteNetwork,
  getAttendanceEvents,
  getBibleVersions,
  getCongregation,
  getLifeGroup,
  getLifeGroups,
  getMinistries,
  getModuleAccess,
  getNetworks,
  getUsers,
  MODULES as ACCESS_MODULES,
  setEventRosterScope,
  setEventSundayOnly,
  setModuleAccessRule,
  updateLifeGroup,
  updateMinistry,
  updateNetwork,
  type AttendanceEvent,
  type BibleVersion,
  type CongregationMember,
  type LifeGroupCategory,
  type LifeGroupMember,
  type LifeGroupSummary,
  type Ministry,
  type ModuleAccessRow,
  type ModuleName,
  type Network,
  type RosterScope,
  type User,
} from "../api";
import { isAdmin } from "../auth";
import {
  AppShell,
  Button,
  Card,
  DropdownMenu,
  Modal,
  Skeleton,
  SelectField,
  Tabs,
  TextField,
} from "../components/ui";
import { ChevronDownIcon } from "../components/ui/icons";
import {
  buildNetworkTree,
  flattenNetworksForSelect,
  SINGLE_SELECT_PARENT_NAME,
  type NetworkTreeNode,
} from "../components/networkTree";
import { getBibleVersionId, setBibleVersionId, type BibleModule } from "../preferences";
import { confirmDialog, infoAlert, successToast } from "../swal";

const emptyLifeGroupForm = { groupName: "", leaderId: "", networkId: "", category: "Church" as LifeGroupCategory };

type SettingsTab = "general" | "attendance" | "lifegroups" | "networks" | "access";
const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
  { key: "general", label: "General" },
  { key: "attendance", label: "Attendance" },
  { key: "lifegroups", label: "Life Groups" },
  { key: "networks", label: "Networks" },
  { key: "access", label: "Access" },
];

interface LeaderPickerProps {
  users: User[];
  value: string;
  onChange: (leaderId: string) => void;
  isLifeGroupLeader: (u: User) => boolean;
}

/** A field-styled button that opens a popover list of workers — like a <select>, but able to
 * show a "Life Group Leader" badge per row (native <option> elements can't render markup). */
function LeaderPicker({ users, value, onChange, isLifeGroupLeader }: LeaderPickerProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = users.find((u) => String(u.id) === value);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    updatePosition();

    const onClickAway = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onClickAway);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  return (
    <div className="ui-field">
      <span className="ui-field-label">Leader</span>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="ui-field-input flex cursor-pointer items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{selected ? selected.name : "Select a leader..."}</span>
        <ChevronDownIcon
          className={["h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform", open ? "rotate-180" : ""].join(
            " ",
          )}
        />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
            className="z-50 max-h-64 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)]"
          >
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                role="option"
                aria-selected={String(u.id) === value}
                onClick={() => {
                  onChange(String(u.id));
                  setOpen(false);
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-black/5"
              >
                <span className="truncate">{u.name}</span>
                {isLifeGroupLeader(u) && (
                  <span className="shrink-0 rounded-full bg-[var(--color-gold)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--color-text-on-gold)]">
                    Life Group Leader
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

// Maps LGN's demographic sub-networks to the same age/gender classification the Attendance
// breakdown report uses (see CongregationCategory.ByLifeGroup on the backend) — so the "Add
// member" picker for e.g. a Men's Network life group only offers congregation members who'd
// actually classify as "Men", instead of the entire congregation.
const LGN_NETWORK_TO_CATEGORY: Record<string, string> = {
  "Children's Network": "Children",
  "Christian Youth for the Nations / KKB": "KKB",
  "Young Adult Network": "YAN",
  "Men's Network": "Men",
  "Women's Network": "Women",
};

/** Mirrors the backend's CongregationCategory.ByLifeGroup exactly: Children 4-12, KKB 13-22,
 * YAN 23-29, Men/Women 30+ split by gender. Returns null for anyone outside those bounds. */
function categorizeForLifeGroup(member: CongregationMember, asOf: Date): string | null {
  if (!member.birthday) return null;
  const birthday = new Date(member.birthday);
  let age = asOf.getFullYear() - birthday.getFullYear();
  const m = asOf.getMonth() - birthday.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < birthday.getDate())) age--;

  if (age < 4) return null;
  if (age <= 12) return "Children";
  if (age <= 22) return "KKB";
  if (age <= 29) return "YAN";
  if (member.gender === "Female") return "Women";
  if (member.gender === "Male") return "Men";
  return null;
}

interface LifeGroupRowProps {
  group: LifeGroupSummary;
  congregation: CongregationMember[];
  onEdit: (group: LifeGroupSummary) => void;
  /** Refreshes the parent's group list — needed so the collapsed row's member count updates
   * immediately after adding someone, instead of only after a reload. */
  onMemberAdded: () => void;
}

/** Expandable row: collapsed shows leader/network/type/count at a glance; expanded lazily
 * loads and lists members, with a quick way to add one — either an existing Congregation
 * member (picked by name) or someone brand new who isn't in the system yet — the same
 * roster data Attendance uses when taking roll for this group. */
function LifeGroupRow({ group, congregation, onEdit, onMemberAdded }: LifeGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState<LifeGroupMember[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Only offer congregation members who'd actually classify into this group's own LGN
  // sub-network (e.g. only "Men" for a Men's Network group) — falls back to the whole
  // congregation when the group's network isn't one of LGN's demographic sub-networks.
  const categoryFilter = group.networkName ? LGN_NETWORK_TO_CATEGORY[group.networkName] : undefined;
  const eligibleCongregation = useMemo(() => {
    if (!categoryFilter) return congregation;
    const asOf = new Date();
    return congregation.filter((c) => categorizeForLifeGroup(c, asOf) === categoryFilter);
  }, [congregation, categoryFilter]);

  const suggestions = useMemo(() => {
    const q = newMemberName.trim().toLowerCase();
    return [...eligibleCongregation]
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20);
  }, [eligibleCongregation, newMemberName]);

  const loadMembers = async () => {
    setLoadingMembers(true);
    setMembersError(null);
    try {
      const detail = await getLifeGroup(group.id);
      setMembers(detail.members);
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoadingMembers(false);
    }
  };

  const toggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && members === null) void loadMembers();
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    setAddingMember(true);
    setMembersError(null);
    try {
      await addLifeGroupMember(group.id, newMemberName.trim());
      setNewMemberName("");
      await loadMembers();
      onMemberAdded();
      successToast("Member added");
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  return (
    <div className="rounded-md border border-[var(--color-border)]">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <button
          type="button"
          onClick={toggleExpand}
          className="flex flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left"
        >
          <ChevronDownIcon
            className={[
              "h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform",
              expanded ? "rotate-180" : "",
            ].join(" ")}
          />
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">{group.groupName}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {group.category === "Community" ? "Community" : "Church"} Life Group · Led by {group.leaderName}
              {group.networkName && ` · ${group.networkName}`} · {group.memberCount} member
              {group.memberCount === 1 ? "" : "s"}
            </p>
          </div>
        </button>
        <DropdownMenu
          ariaLabel={`Actions for ${group.groupName}`}
          items={[{ label: "Edit", onSelect: () => onEdit(group) }]}
        />
      </div>

      {expanded && (
        <div className="border-t border-[var(--color-border)] px-3 py-3">
          {membersError && <p className="error mb-2">{membersError}</p>}
          {loadingMembers ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <div className="flex flex-col gap-2">
              {members && members.length > 0 ? (
                members.map((m) => (
                  <p key={m.id} className="text-sm text-[var(--color-text-secondary)]">
                    {m.name}
                  </p>
                ))
              ) : (
                <p className="helper-text">No members yet.</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="relative flex-1">
                  <TextField
                    label="Add member"
                    value={newMemberName}
                    onChange={(e) => {
                      setNewMemberName(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setShowSuggestions(false)}
                    placeholder="Search the congregation or type a new name"
                    autoComplete="off"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)]">
                      {suggestions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setNewMemberName(c.name);
                            setShowSuggestions(false);
                          }}
                          className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-black/5"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleAddMember}
                  disabled={addingMember || !newMemberName.trim()}
                >
                  {addingMember ? "Adding..." : "Add"}
                </Button>
              </div>
              {categoryFilter && (
                <p className="helper-text">
                  Showing congregation members classified as "{categoryFilter}" for{" "}
                  {group.networkName} — type a name not listed to add someone new.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const BIBLE_MODULES: { key: BibleModule; label: string }[] = [
  { key: "verseOfTheDay", label: "Verse of the Day" },
  { key: "devotion", label: "Devotion" },
];

const emptyNetworkForm = { name: "", parentNetworkId: "" };
const emptyMinistryForm = { name: "", networkId: "" };

interface ManageNetworkNodeProps {
  node: NetworkTreeNode;
  depth: number;
  onEditNetwork: (network: Network) => void;
  onDeleteNetwork: (network: Network) => void;
  onEditMinistry: (ministry: Ministry) => void;
  onDeleteMinistry: (ministry: Ministry) => void;
}

function ManageNetworkNode({
  node,
  depth,
  onEditNetwork,
  onDeleteNetwork,
  onEditMinistry,
  onDeleteMinistry,
}: ManageNetworkNodeProps) {
  return (
    <div className={depth > 0 ? "ml-6 mt-2" : ""}>
      <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] px-3 py-2">
        <p className="font-semibold text-[var(--color-text-primary)]">{node.network.name}</p>
        <DropdownMenu
          ariaLabel={`Actions for ${node.network.name}`}
          items={[
            { label: "Edit", onSelect: () => onEditNetwork(node.network) },
            { label: "Delete", onSelect: () => onDeleteNetwork(node.network), danger: true, dividerBefore: true },
          ]}
        />
      </div>

      {node.ministries.length > 0 && (
        <div className="ml-6 mt-2 flex flex-col gap-2">
          {node.ministries.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-md border border-dashed border-[var(--color-border)] px-3 py-2"
            >
              <p className="text-sm text-[var(--color-text-secondary)]">{m.name}</p>
              <DropdownMenu
                ariaLabel={`Actions for ${m.name}`}
                items={[
                  { label: "Edit", onSelect: () => onEditMinistry(m) },
                  { label: "Delete", onSelect: () => onDeleteMinistry(m), danger: true, dividerBefore: true },
                ]}
              />
            </div>
          ))}
        </div>
      )}

      {node.children.map((child) => (
        <ManageNetworkNode
          key={child.network.id}
          node={child}
          depth={depth + 1}
          onEditNetwork={onEditNetwork}
          onDeleteNetwork={onDeleteNetwork}
          onEditMinistry={onEditMinistry}
          onDeleteMinistry={onDeleteMinistry}
        />
      ))}
    </div>
  );
}

function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [selected, setSelected] = useState<Record<BibleModule, string>>({
    verseOfTheDay: getBibleVersionId("verseOfTheDay") ?? "",
    devotion: getBibleVersionId("devotion") ?? "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManageAccess = isAdmin();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [accessRows, setAccessRows] = useState<ModuleAccessRow[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(canManageAccess);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const networkTree = useMemo(() => buildNetworkTree(networks, ministries), [networks, ministries]);
  const topLevelNetworks = useMemo(() => networks.filter((n) => n.parentNetworkId === null), [networks]);

  // A Life Group can only roll up under one of LGN's demographic sub-networks (Men's,
  // Women's, etc.) — both because a leader must be assigned to one (a worker belongs to
  // exactly one, enforced as a radio-select on their profile), and because that's what
  // drives the Congregation "eligible member" filter when adding someone to the group.
  const lgnNetworks = useMemo(() => {
    const lgn = networkTree.find((n) => n.network.name === SINGLE_SELECT_PARENT_NAME);
    return lgn?.children.map((c) => c.network) ?? [];
  }, [networkTree]);
  const lgnChildNetworkIds = useMemo(() => new Set(lgnNetworks.map((n) => n.id)), [lgnNetworks]);

  const getLeaderLgnNetworkId = (leaderId: number): number | null => {
    const leader = users.find((u) => Number(u.id) === leaderId);
    return leader?.networkIds.find((id) => lgnChildNetworkIds.has(id)) ?? null;
  };

  // Same rule as above, phrased as a predicate for the Leader picker's per-row badge.
  const isLifeGroupLeader = (u: User) => u.networkIds.some((id) => lgnChildNetworkIds.has(id));

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

  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(canManageAccess);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [savingEventId, setSavingEventId] = useState<number | null>(null);

  const [lifeGroups, setLifeGroups] = useState<LifeGroupSummary[]>([]);
  const [loadingLifeGroups, setLoadingLifeGroups] = useState(canManageAccess);
  const [lifeGroupsError, setLifeGroupsError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [congregation, setCongregation] = useState<CongregationMember[]>([]);

  const [lifeGroupModalOpen, setLifeGroupModalOpen] = useState(false);
  const [editingLifeGroupId, setEditingLifeGroupId] = useState<number | null>(null);
  const [lifeGroupForm, setLifeGroupForm] = useState(emptyLifeGroupForm);
  const [savingLifeGroup, setSavingLifeGroup] = useState(false);
  const [lifeGroupFormError, setLifeGroupFormError] = useState<string | null>(null);

  useEffect(() => {
    getBibleVersions()
      .then((v) => {
        setVersions(v);
        setSelected((current) => ({
          verseOfTheDay: current.verseOfTheDay || v[0]?.id || "",
          devotion: current.devotion || v[0]?.id || "",
        }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Bible versions"))
      .finally(() => setLoading(false));
  }, []);

  const loadDirectoryAndAccess = async () => {
    setLoadingAccess(true);
    setAccessError(null);
    try {
      const [networkList, ministryList, rows] = await Promise.all([getNetworks(), getMinistries(), getModuleAccess()]);
      setNetworks(networkList);
      setMinistries(ministryList);
      setAccessRows(rows);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Failed to load networks/ministries");
    } finally {
      setLoadingAccess(false);
    }
  };

  useEffect(() => {
    if (!canManageAccess) return;
    loadDirectoryAndAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageAccess]);

  useEffect(() => {
    if (!canManageAccess) return;
    getAttendanceEvents()
      .then(setEvents)
      .catch((err) => setEventsError(err instanceof Error ? err.message : "Failed to load events"))
      .finally(() => setLoadingEvents(false));
  }, [canManageAccess]);

  // `silent` skips the loading skeleton for a background refresh (e.g. after adding a member)
  // — otherwise the whole list would flicker to a skeleton and collapse any expanded row.
  const loadLifeGroups = async (silent = false) => {
    if (!silent) setLoadingLifeGroups(true);
    setLifeGroupsError(null);
    try {
      setLifeGroups(await getLifeGroups());
    } catch (err) {
      setLifeGroupsError(err instanceof Error ? err.message : "Failed to load life groups");
    } finally {
      if (!silent) setLoadingLifeGroups(false);
    }
  };

  useEffect(() => {
    if (!canManageAccess) return;
    loadLifeGroups();
    getUsers()
      .then(setUsers)
      .catch((err) => setLifeGroupsError(err instanceof Error ? err.message : "Failed to load users"));
    getCongregation()
      .then(setCongregation)
      .catch(() => {
        // Congregation only feeds the "choose from Congregation" member picker below —
        // if it fails to load, adding members by typing a name still works fine.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageAccess]);

  const openAddLifeGroup = () => {
    setEditingLifeGroupId(null);
    setLifeGroupForm(emptyLifeGroupForm);
    setLifeGroupFormError(null);
    setLifeGroupModalOpen(true);
  };

  const openEditLifeGroup = (group: LifeGroupSummary) => {
    setEditingLifeGroupId(group.id);
    setLifeGroupForm({
      groupName: group.groupName,
      leaderId: String(group.leaderId),
      networkId: group.networkId === null ? "" : String(group.networkId),
      category: group.category,
    });
    setLifeGroupFormError(null);
    setLifeGroupModalOpen(true);
  };

  // Re-picking the leader re-defaults the group's network to that leader's own LGN
  // sub-network — an admin can still override it manually afterward if needed.
  const handleLeaderChange = (leaderIdStr: string) => {
    const leaderId = leaderIdStr ? Number(leaderIdStr) : null;
    const lgnNetworkId = leaderId !== null ? getLeaderLgnNetworkId(leaderId) : null;
    setLifeGroupForm((f) => ({
      ...f,
      leaderId: leaderIdStr,
      networkId: lgnNetworkId !== null ? String(lgnNetworkId) : f.networkId,
    }));
  };

  const selectedLeaderId = lifeGroupForm.leaderId ? Number(lifeGroupForm.leaderId) : null;
  const leaderMissingLgnNetwork =
    selectedLeaderId !== null && getLeaderLgnNetworkId(selectedLeaderId) === null;

  const handleSaveLifeGroup = async () => {
    if (!lifeGroupForm.groupName.trim() || !lifeGroupForm.leaderId) return;
    if (leaderMissingLgnNetwork) {
      setLifeGroupFormError(
        "This leader isn't assigned to a Life Group Network (LGN) sub-network yet — assign one for them under People → Workers first.",
      );
      return;
    }
    setSavingLifeGroup(true);
    setLifeGroupFormError(null);
    try {
      const networkId = lifeGroupForm.networkId ? Number(lifeGroupForm.networkId) : null;
      if (editingLifeGroupId === null) {
        await createLifeGroup(Number(lifeGroupForm.leaderId), lifeGroupForm.groupName.trim(), {
          networkId,
          category: lifeGroupForm.category,
        });
        successToast("Life group added");
      } else {
        await updateLifeGroup(editingLifeGroupId, {
          leaderId: Number(lifeGroupForm.leaderId),
          groupName: lifeGroupForm.groupName.trim(),
          networkId,
          category: lifeGroupForm.category,
        });
        successToast("Life group updated");
      }
      setLifeGroupModalOpen(false);
      await loadLifeGroups();
    } catch (err) {
      setLifeGroupFormError(err instanceof Error ? err.message : "Failed to save life group");
    } finally {
      setSavingLifeGroup(false);
    }
  };

  const handleToggleSundayOnly = async (event: AttendanceEvent) => {
    setSavingEventId(event.id);
    setEventsError(null);
    try {
      const updated = await setEventSundayOnly(event.id, !event.sundayOnly);
      setEvents((current) => current.map((e) => (e.id === updated.id ? updated : e)));
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : "Failed to update event");
    } finally {
      setSavingEventId(null);
    }
  };

  const handleChangeRosterScope = async (event: AttendanceEvent, rosterScope: RosterScope) => {
    setSavingEventId(event.id);
    setEventsError(null);
    try {
      const updated = await setEventRosterScope(event.id, rosterScope);
      setEvents((current) => current.map((e) => (e.id === updated.id ? updated : e)));
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : "Failed to update event");
    } finally {
      setSavingEventId(null);
    }
  };

  const handleChange = (module: BibleModule, id: string) => {
    setSelected((current) => ({ ...current, [module]: id }));
    setBibleVersionId(module, id);
  };

  const openAddNetwork = () => {
    setEditingNetworkId(null);
    setNetworkForm(emptyNetworkForm);
    setNetworkFormError(null);
    setNetworkModalOpen(true);
  };

  const openEditNetwork = (n: Network) => {
    setEditingNetworkId(n.id);
    setNetworkForm({ name: n.name, parentNetworkId: n.parentNetworkId === null ? "" : String(n.parentNetworkId) });
    setNetworkFormError(null);
    setNetworkModalOpen(true);
  };

  const handleSaveNetwork = async () => {
    if (!networkForm.name.trim()) return;
    setSavingNetwork(true);
    setNetworkFormError(null);
    try {
      const payload = {
        name: networkForm.name.trim(),
        parentNetworkId: networkForm.parentNetworkId ? Number(networkForm.parentNetworkId) : null,
      };
      if (editingNetworkId === null) {
        await createNetwork(payload);
        successToast("Network added");
      } else {
        await updateNetwork(editingNetworkId, payload);
        successToast("Network updated");
      }
      setNetworkModalOpen(false);
      await loadDirectoryAndAccess();
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
      await loadDirectoryAndAccess();
      successToast("Network deleted");
    } catch (err) {
      await infoAlert(err instanceof Error ? err.message : "Failed to delete network", "Error");
    }
  };

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
        successToast("Ministry added");
      } else {
        await updateMinistry(editingMinistryId, payload);
        successToast("Ministry updated");
      }
      setMinistryModalOpen(false);
      await loadDirectoryAndAccess();
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
      await loadDirectoryAndAccess();
      successToast("Ministry deleted");
    } catch (err) {
      await infoAlert(err instanceof Error ? err.message : "Failed to delete ministry", "Error");
    }
  };

  const isAllowed = (networkId: number, module: ModuleName) =>
    accessRows.find((r) => r.networkId === networkId && r.module === module)?.isAllowed ?? true;

  const handleToggleAccess = async (networkId: number, module: ModuleName) => {
    const cellKey = `${networkId}-${module}`;
    const nextValue = !isAllowed(networkId, module);
    setSavingCell(cellKey);
    setAccessError(null);
    try {
      const updated = await setModuleAccessRule({ networkId, module, isAllowed: nextValue });
      setAccessRows((rows) => {
        const withoutThisCell = rows.filter((r) => !(r.networkId === networkId && r.module === module));
        return [...withoutThisCell, updated];
      });
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Failed to update module access");
    } finally {
      setSavingCell(null);
    }
  };

  return (
    <AppShell>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      {canManageAccess && (
        <Tabs items={SETTINGS_TABS} activeKey={activeTab} onChange={setActiveTab} className="mb-6" />
      )}

      {(!canManageAccess || activeTab === "general") && (
        <Card>
          <h2 className="section-title">Bible Version</h2>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Choose a translation for each module — they can be set independently.
          </p>
          {loading && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          {!loading && !error && (
            <div className="flex flex-col gap-4">
              {BIBLE_MODULES.map((mod) => (
                <SelectField
                  key={mod.key}
                  label={mod.label}
                  value={selected[mod.key]}
                  onChange={(e) => handleChange(mod.key, e.target.value)}
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({v.abbreviation})
                    </option>
                  ))}
                </SelectField>
              ))}
            </div>
          )}
        </Card>
      )}

      {canManageAccess && activeTab === "attendance" && (
        <Card>
          <h2 className="section-title">Attendance Events</h2>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            "Roster" controls which named check-in this event accepts — some events (like
            Worker's Empowerment) only ever take Worker attendance. When "Sunday only" is on,
            that event's date picker refuses every other day — for a service (like WHS) that
            only ever happens on a Sunday.
          </p>
          {eventsError && <p className="error mb-3">{eventsError}</p>}
          {loadingEvents ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="font-semibold text-[var(--color-text-primary)]">{event.name}</p>
                  <div className="flex flex-wrap items-center gap-4">
                    <SelectField
                      label="Roster"
                      value={event.rosterScope}
                      disabled={savingEventId === event.id}
                      onChange={(e) => handleChangeRosterScope(event, e.target.value as RosterScope)}
                      className="sm:max-w-[160px]"
                    >
                      <option value="Both">Workers &amp; Congregation</option>
                      <option value="Workers">Workers only</option>
                      <option value="Congregation">Congregation only</option>
                    </SelectField>
                    <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                      Sunday only
                      <input
                        type="checkbox"
                        checked={event.sundayOnly}
                        disabled={savingEventId === event.id}
                        onChange={() => handleToggleSundayOnly(event)}
                        aria-label={`${event.name} is Sunday-only`}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {canManageAccess && activeTab === "lifegroups" && (
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="section-title !mb-0">Life Groups</h2>
            <Button type="button" onClick={openAddLifeGroup}>
              + Add Life Group
            </Button>
          </div>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Leader, network, and whether it's a church or community Life Group — this is the
            data that shows up on the Attendance side when taking roll for a group.
          </p>
          {lifeGroupsError && <p className="error mb-3">{lifeGroupsError}</p>}
          {loadingLifeGroups ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          ) : lifeGroups.length === 0 ? (
            <p className="helper-text">No life groups yet. Add one to get started.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {lifeGroups.map((group) => (
                <LifeGroupRow
                  key={group.id}
                  group={group}
                  congregation={congregation}
                  onEdit={openEditLifeGroup}
                  onMemberAdded={() => loadLifeGroups(true)}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {canManageAccess && activeTab === "networks" && (
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="section-title !mb-0">Networks &amp; Ministries</h2>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={openAddNetwork}>
                + Add network
              </Button>
              <Button type="button" onClick={openAddMinistry}>
                + Add ministry
              </Button>
            </div>
          </div>
          {accessError && <p className="error mb-3">{accessError}</p>}
          {loadingAccess ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          ) : networkTree.length === 0 ? (
            <p className="helper-text">No networks yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {networkTree.map((root) => (
                <ManageNetworkNode
                  key={root.network.id}
                  node={root}
                  depth={0}
                  onEditNetwork={openEditNetwork}
                  onDeleteNetwork={handleDeleteNetwork}
                  onEditMinistry={openEditMinistry}
                  onDeleteMinistry={handleDeleteMinistry}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {canManageAccess && activeTab === "access" && (
        <Card>
          <h2 className="section-title">Module Access by Network</h2>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Control which modules each network can use. Admins always have full access. A network with no
            explicit rule below defaults to allowed.
          </p>
          {loadingAccess && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {accessError && <p className="error mb-3">{accessError}</p>}
          {!loadingAccess && networks.length === 0 && (
            <p className="helper-text">No networks yet — add one above first.</p>
          )}
          {!loadingAccess && networks.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-[var(--color-border)] px-3 py-2 text-left font-bold text-[var(--color-text-secondary)]">
                      Network
                    </th>
                    {ACCESS_MODULES.map((mod) => (
                      <th
                        key={mod}
                        className="border-b border-[var(--color-border)] px-3 py-2 text-center font-bold text-[var(--color-text-secondary)]"
                      >
                        {mod}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flattenNetworksForSelect(networkTree).map(({ id, name, depth }) => (
                    <tr key={id}>
                      <td className="border-b border-[var(--color-border)] px-3 py-2">
                        <p className="font-semibold text-[var(--color-text-primary)]" style={{ paddingLeft: depth * 16 }}>
                          {depth > 0 && "– "}
                          {name}
                        </p>
                      </td>
                      {ACCESS_MODULES.map((mod) => {
                        const cellKey = `${id}-${mod}`;
                        return (
                          <td key={mod} className="border-b border-[var(--color-border)] px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={isAllowed(id, mod)}
                              disabled={savingCell === cellKey}
                              onChange={() => handleToggleAccess(id, mod)}
                              aria-label={`${name} access to ${mod}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

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
            onChange={(e) => setNetworkForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
            required
          />
          <SelectField
            label="Parent network"
            value={networkForm.parentNetworkId}
            onChange={(e) => setNetworkForm((f) => ({ ...f, parentNetworkId: e.target.value }))}
          >
            <option value="">None (top-level)</option>
            {topLevelNetworks
              .filter((n) => n.id !== editingNetworkId)
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
          </SelectField>
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
            {flattenNetworksForSelect(networkTree).map(({ id, name, depth }) => (
              <option key={id} value={id}>
                {"  ".repeat(depth)}
                {depth > 0 ? "– " : ""}
                {name}
              </option>
            ))}
          </SelectField>
          {ministryFormError && <p className="error">{ministryFormError}</p>}
        </div>
      </Modal>

      <Modal
        open={lifeGroupModalOpen}
        onClose={() => setLifeGroupModalOpen(false)}
        title={editingLifeGroupId === null ? "Add Life Group" : "Edit Life Group"}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setLifeGroupModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveLifeGroup}
              disabled={
                savingLifeGroup ||
                !lifeGroupForm.groupName.trim() ||
                !lifeGroupForm.leaderId ||
                leaderMissingLgnNetwork
              }
            >
              {savingLifeGroup ? "Saving..." : editingLifeGroupId === null ? "Add" : "Save changes"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="Group name"
            value={lifeGroupForm.groupName}
            onChange={(e) => setLifeGroupForm((f) => ({ ...f, groupName: e.target.value }))}
            autoFocus
            required
          />
          <LeaderPicker
            users={users}
            value={lifeGroupForm.leaderId}
            onChange={handleLeaderChange}
            isLifeGroupLeader={isLifeGroupLeader}
          />
          {leaderMissingLgnNetwork && (
            <p className="error">
              This leader isn't assigned to a Life Group Network (LGN) sub-network yet — assign
              one for them under People → Workers first.
            </p>
          )}
          <SelectField
            label="Network"
            value={lifeGroupForm.networkId}
            onChange={(e) => setLifeGroupForm((f) => ({ ...f, networkId: e.target.value }))}
          >
            <option value="">None</option>
            {lgnNetworks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Type"
            value={lifeGroupForm.category}
            onChange={(e) =>
              setLifeGroupForm((f) => ({ ...f, category: e.target.value as LifeGroupCategory }))
            }
          >
            <option value="Church">Church Life Group</option>
            <option value="Community">Community Life Group</option>
          </SelectField>
          {lifeGroupFormError && <p className="error">{lifeGroupFormError}</p>}
        </div>
      </Modal>
    </AppShell>
  );
}

export default Settings;
