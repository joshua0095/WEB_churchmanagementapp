import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
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
  removeLifeGroupMember,
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
  CheckTile,
  DropdownMenu,
  Modal,
  SegmentedControl,
  SelectField,
  Skeleton,
  Switch,
  TextField,
  TreeList,
} from "../components/ui";
import { ChevronDownIcon, TrashIcon } from "../components/ui/icons";
import { InfoIcon, KebabIcon, TopbarSearchIcon } from "../components/ui/shellIcons";
import { buildNetworkTree, flattenNetworksForSelect, SINGLE_SELECT_PARENT_NAME } from "../components/networkTree";
import { getBibleVersionId, setBibleVersionId, type BibleModule } from "../preferences";
import { confirmDialog, infoAlert, successToast } from "../swal";

const emptyLifeGroupForm = { groupName: "", leaderId: "", networkId: "", category: "Church" as LifeGroupCategory };

type SettingsTab = "general" | "attendance" | "lifegroups" | "networks" | "access";
const SETTINGS_TABS: { key: SettingsTab; label: string; desc: string }[] = [
  { key: "general", label: "General", desc: "Bible versions" },
  { key: "attendance", label: "Attendance", desc: "Events & rosters" },
  { key: "lifegroups", label: "Life Groups", desc: "Groups & leaders" },
  { key: "networks", label: "Networks", desc: "Networks & ministries" },
  { key: "access", label: "Access", desc: "Module permissions" },
];

// Column headers for the module-access matrix on narrow screens, where the full names
// ("Announcements") can't fit a 56px column without breaking mid-word.
const MODULE_SHORT_LABELS: Record<ModuleName, string> = {
  Attendance: "Attend.",
  Reports: "Reports",
  Announcements: "Announce.",
  People: "People",
};

// Sourced from the real RosterScope union (a Record here means TS errors if that type ever
// gains/drops a member without this being updated) rather than a hardcoded options list.
const ROSTER_LABELS: Record<RosterScope, string> = {
  Both: "Both",
  Workers: "Workers",
  Congregation: "Congregation",
};
const ROSTER_OPTIONS: { value: RosterScope; label: string }[] = (Object.keys(ROSTER_LABELS) as RosterScope[]).map(
  (value) => ({ value, label: ROSTER_LABELS[value] }),
);

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

/** Short display code for a life group, e.g. id 3 → "LG03" — a client-side derivation for the
 * row's badge, not a value the backend stores. */
function lifeGroupCode(id: number): string {
  return `LG${String(id).padStart(2, "0")}`;
}

interface LifeGroupRowProps {
  group: LifeGroupSummary;
  congregation: CongregationMember[];
  onEdit: (group: LifeGroupSummary) => void;
  /** Refreshes the parent's group list — needed so the row's member count updates
   * immediately after adding someone, instead of only after a reload. */
  onMemberAdded: () => void;
}

/** Table-style row: collapsed shows code/leader/type/network/count at a glance; clicking it
 * (anywhere but the kebab) lazily loads and expands into the member list, with a quick way to
 * add one — either an existing Congregation member (picked by name) or someone brand new who
 * isn't in the system yet — the same roster data Attendance uses when taking roll for this
 * group. */
function LifeGroupRow({ group, congregation, onEdit, onMemberAdded }: LifeGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState<LifeGroupMember[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberIsFirstTimer, setNewMemberIsFirstTimer] = useState(false);
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
      await addLifeGroupMember(group.id, newMemberName.trim(), newMemberIsFirstTimer);
      setNewMemberName("");
      setNewMemberIsFirstTimer(false);
      await loadMembers();
      onMemberAdded();
      successToast("Member added");
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (member: LifeGroupMember) => {
    const confirmed = await confirmDialog({
      title: "Remove member?",
      message: `Remove ${member.name} from ${group.groupName}? This also removes their past attendance and follow-up records for this group.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;
    setMembersError(null);
    try {
      await removeLifeGroupMember(group.id, member.id);
      await loadMembers();
      onMemberAdded();
      successToast("Member removed");
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  return (
    <div>
      <div
        className="settings-trow settings-cols-lifegroups cursor-pointer"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggleExpand}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpand();
          }
        }}
      >
        <span className="settings-code">{lifeGroupCode(group.id)}</span>
        <span className="min-w-0">
          <span className="settings-group-name block">{group.groupName}</span>
          <span className="settings-group-leader block">Led by {group.leaderName}</span>
          {/* Narrow screens hide the Type/Network/Members columns, so they're summarized here. */}
          <span className="settings-group-meta">
            {group.category} · {group.networkName ?? "No network"} · {group.memberCount}{" "}
            {group.memberCount === 1 ? "member" : "members"}
          </span>
        </span>
        <span className={["settings-chip", group.category === "Community" ? "settings-chip--community" : "settings-chip--church"].join(" ")}>
          {group.category}
        </span>
        <span className="settings-network-cell">{group.networkName ?? "—"}</span>
        <span className="settings-members">{group.memberCount}</span>
        <DropdownMenu
          icon={<KebabIcon />}
          triggerClassName="settings-kebab"
          ariaLabel={`Actions for ${group.groupName}`}
          items={[{ label: "Edit", onSelect: () => onEdit(group) }]}
        />
      </div>

      {expanded && (
        <div className="border-t border-[var(--color-line)] px-7 py-4">
          {membersError && <p className="error mb-2">{membersError}</p>}
          {loadingMembers ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <div className="flex flex-col gap-2">
              {members && members.length > 0 ? (
                members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <p className="text-sm text-[var(--color-text-secondary)]">{m.name}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveMember(m);
                      }}
                      aria-label={`Remove ${m.name}`}
                      title="Remove member"
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="helper-text">No members yet.</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end" onClick={(e) => e.stopPropagation()}>
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
                <Button type="button" onClick={handleAddMember} disabled={addingMember || !newMemberName.trim()}>
                  {addingMember ? "Adding..." : "Add"}
                </Button>
              </div>
              <label
                className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={newMemberIsFirstTimer}
                  onChange={(e) => setNewMemberIsFirstTimer(e.target.checked)}
                />
                First-timer
              </label>
              {categoryFilter && (
                <p className="helper-text">
                  Showing congregation members classified as "{categoryFilter}" for {group.networkName} — type a
                  name not listed to add someone new.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const BIBLE_MODULES: { key: BibleModule; label: string; hint: string }[] = [
  { key: "verseOfTheDay", label: "Verse of the Day", hint: "Shown on everyone's Home screen." },
  { key: "devotion", label: "Devotion", hint: "Used when members look up a verse in their SOAP devotion." },
];

const emptyNetworkForm = { name: "", parentNetworkId: "" };
const emptyMinistryForm = { name: "", networkId: "" };

function Settings() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const canManageAccess = isAdmin();
  const activeTab: SettingsTab =
    canManageAccess && SETTINGS_TABS.some((t) => t.key === tab) ? (tab as SettingsTab) : "general";

  // Keeps the URL canonical — redirects a bogus/disallowed tab segment (or a non-admin
  // landing on an admin-only one) back to whichever tab is actually showing.
  useEffect(() => {
    if (tab !== activeTab) navigate(`/settings/${activeTab}`, { replace: true });
  }, [tab, activeTab, navigate]);

  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [selected, setSelected] = useState<Record<BibleModule, string>>({
    verseOfTheDay: getBibleVersionId("verseOfTheDay") ?? "",
    devotion: getBibleVersionId("devotion") ?? "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const [lgSearch, setLgSearch] = useState("");
  const [lgFilter, setLgFilter] = useState<"All" | LifeGroupCategory>("All");
  const [users, setUsers] = useState<User[]>([]);
  const [congregation, setCongregation] = useState<CongregationMember[]>([]);

  const [lifeGroupModalOpen, setLifeGroupModalOpen] = useState(false);
  const [editingLifeGroupId, setEditingLifeGroupId] = useState<number | null>(null);
  const [lifeGroupForm, setLifeGroupForm] = useState(emptyLifeGroupForm);
  const [savingLifeGroup, setSavingLifeGroup] = useState(false);
  const [lifeGroupFormError, setLifeGroupFormError] = useState<string | null>(null);

  const visibleLifeGroups = useMemo(() => {
    const q = lgSearch.trim().toLowerCase();
    return lifeGroups.filter(
      (g) =>
        (lgFilter === "All" || g.category === lgFilter) &&
        (!q || g.groupName.toLowerCase().includes(q) || g.leaderName.toLowerCase().includes(q)),
    );
  }, [lifeGroups, lgFilter, lgSearch]);

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
  const leaderMissingLgnNetwork = selectedLeaderId !== null && getLeaderLgnNetworkId(selectedLeaderId) === null;

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
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="m-0 font-display text-[2.1rem] font-semibold text-[var(--color-text-primary)]">Settings</h1>
          <p className="m-0 mt-1.5 text-[0.9375rem] text-[var(--color-text-secondary)]">
            Church-wide setup. Changes here apply to everyone using the app.
          </p>
        </div>

        <div className={canManageAccess ? "settings-layout" : ""}>
          {canManageAccess && (
            <div className="settings-nav" role="tablist" aria-label="Settings sections" aria-orientation="vertical">
              {SETTINGS_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`tab-${t.key}`}
                  aria-controls={`panel-${t.key}`}
                  aria-selected={activeTab === t.key}
                  className="settings-tab"
                  onClick={() => navigate(`/settings/${t.key}`)}
                >
                  <span className="app-nav-ribbon" aria-hidden="true" />
                  <span className="settings-tab-label">{t.label}</span>
                  <span className="settings-tab-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-6">
            {activeTab === "general" && (
              <Card className="settings-panel !rounded-2xl !p-0" id="panel-general" role="tabpanel" aria-labelledby="tab-general">
                <div className="card-head border-b border-[var(--color-line)] px-7 pb-5 pt-6">
                  <div>
                    <h2 className="m-0 font-display text-xl font-semibold text-[var(--color-text-primary)]">Bible version</h2>
                    <p className="m-0 mt-1 text-sm text-[var(--color-text-secondary)]">
                      Pick a translation for each module. They can be set independently.
                    </p>
                  </div>
                </div>
                {loading && (
                  <div className="flex flex-col gap-4 p-7">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                )}
                {error && <p className="error px-7 py-4">{error}</p>}
                {!loading &&
                  !error &&
                  BIBLE_MODULES.map((mod) => (
                    <div key={mod.key} className="setting-row">
                      <div className="setting-row-text">
                        <label className="setting-row-label" htmlFor={mod.key}>
                          {mod.label}
                        </label>
                        <span className="setting-row-hint">{mod.hint}</span>
                      </div>
                      <select
                        id={mod.key}
                        className="settings-select"
                        value={selected[mod.key]}
                        onChange={(e) => handleChange(mod.key, e.target.value)}
                      >
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.title} ({v.abbreviation})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
              </Card>
            )}

            {canManageAccess && activeTab === "attendance" && (
              <Card className="settings-panel !rounded-2xl !p-0" id="panel-attendance" role="tabpanel" aria-labelledby="tab-attendance">
                <div className="card-head px-7 pb-5 pt-6">
                  <div>
                    <h2 className="m-0 font-display text-xl font-semibold text-[var(--color-text-primary)]">Attendance events</h2>
                    <p className="m-0 mt-1 text-sm text-[var(--color-text-secondary)]">
                      Set who can be checked in for each event, and whether it only happens on Sundays.
                    </p>
                  </div>
                </div>
                <div className="settings-thead settings-cols-attendance">
                  <span>Event</span>
                  <span>Roster</span>
                  <span className="settings-cell-center">Sunday only</span>
                </div>
                {eventsError && <p className="error px-7 py-3">{eventsError}</p>}
                {loadingEvents ? (
                  <div className="flex flex-col gap-2 p-7">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="settings-trow settings-cols-attendance settings-att-row">
                      <span className="settings-event-name">{event.name}</span>
                      <SegmentedControl
                        aria-label={`Roster for ${event.name}`}
                        options={ROSTER_OPTIONS}
                        value={event.rosterScope}
                        disabled={savingEventId === event.id}
                        onChange={(value) => handleChangeRosterScope(event, value)}
                      />
                      <div className="settings-att-sunday">
                        {/* Stands in for the hidden column header on narrow screens. */}
                        <span className="settings-att-sunday-label" aria-hidden="true">
                          Sunday only
                        </span>
                        <Switch
                          checked={event.sundayOnly}
                          disabled={savingEventId === event.id}
                          onChange={() => handleToggleSundayOnly(event)}
                          aria-label={`Sunday only for ${event.name}`}
                        />
                      </div>
                    </div>
                  ))
                )}
                <div className="settings-legend">
                  <span>
                    <strong>Roster:</strong> which check-in list the event accepts.
                  </span>
                  <span>
                    <strong>Sunday only:</strong> the date picker allows Sundays only.
                  </span>
                </div>
              </Card>
            )}

            {canManageAccess && activeTab === "lifegroups" && (
              <Card className="settings-panel !rounded-2xl !p-0" id="panel-lifegroups" role="tabpanel" aria-labelledby="tab-lifegroups">
                <div className="card-head px-7 pb-5 pt-6">
                  <div>
                    <h2 className="m-0 font-display text-xl font-semibold text-[var(--color-text-primary)]">
                      Life Groups <span className="font-sans text-sm font-medium text-[var(--color-text-secondary)]">· {lifeGroups.length} groups</span>
                    </h2>
                    <p className="m-0 mt-1 text-sm text-[var(--color-text-secondary)]">
                      Leaders, networks and group type. This is what shows up when taking roll for a group.
                    </p>
                  </div>
                  <div className="settings-head-actions">
                    <Button type="button" onClick={openAddLifeGroup}>
                      + Add Life Group
                    </Button>
                  </div>
                </div>
                <div className="settings-toolbar">
                  <label className="app-search">
                    <TopbarSearchIcon />
                    <input
                      type="search"
                      placeholder="Search by group or leader"
                      aria-label="Search life groups"
                      value={lgSearch}
                      onChange={(e) => setLgSearch(e.target.value)}
                    />
                  </label>
                  <SegmentedControl
                    aria-label="Filter by type"
                    variant="dark"
                    inline
                    options={[
                      { value: "All", label: "All" },
                      { value: "Church", label: "Church" },
                      { value: "Community", label: "Community" },
                    ]}
                    value={lgFilter}
                    onChange={setLgFilter}
                  />
                </div>
                <div className="settings-thead settings-cols-lifegroups">
                  <span>Group</span>
                  <span>Leader</span>
                  <span>Type</span>
                  <span>Network</span>
                  <span className="settings-cell-right">Members</span>
                  <span />
                </div>
                {lifeGroupsError && <p className="error px-7 py-3">{lifeGroupsError}</p>}
                {loadingLifeGroups ? (
                  <div className="flex flex-col gap-2 p-7">
                    <Skeleton className="h-14 w-full rounded-md" />
                    <Skeleton className="h-14 w-full rounded-md" />
                  </div>
                ) : visibleLifeGroups.length === 0 ? (
                  <p className="px-7 py-6 text-sm text-[var(--color-text-secondary)]">
                    {lifeGroups.length === 0
                      ? "No life groups yet. Add one to get started."
                      : "No groups match. Try a different name or filter."}
                  </p>
                ) : (
                  visibleLifeGroups.map((group) => (
                    <LifeGroupRow
                      key={group.id}
                      group={group}
                      congregation={congregation}
                      onEdit={openEditLifeGroup}
                      onMemberAdded={() => loadLifeGroups(true)}
                    />
                  ))
                )}
                <div className="h-3" />
              </Card>
            )}

            {canManageAccess && activeTab === "networks" && (
              <Card className="settings-panel !rounded-2xl !p-0 pb-3" id="panel-networks" role="tabpanel" aria-labelledby="tab-networks">
                <div className="card-head px-7 pb-5 pt-6">
                  <div>
                    <h2 className="m-0 font-display text-xl font-semibold text-[var(--color-text-primary)]">Networks &amp; ministries</h2>
                    <p className="m-0 mt-1 text-sm text-[var(--color-text-secondary)]">
                      Each network holds its ministries. Members are assigned to these on their profile.
                    </p>
                  </div>
                  <div className="settings-head-actions">
                    <Button type="button" variant="outline" onClick={openAddMinistry}>
                      + Add ministry
                    </Button>
                    <Button type="button" onClick={openAddNetwork}>
                      + Add network
                    </Button>
                  </div>
                </div>
                {accessError && <p className="error px-7 py-3">{accessError}</p>}
                {loadingAccess ? (
                  <div className="flex flex-col gap-2 px-7 pb-4">
                    <Skeleton className="h-14 w-full rounded-md" />
                    <Skeleton className="h-14 w-full rounded-md" />
                  </div>
                ) : (
                  <TreeList
                    tree={networkTree}
                    onEditNetwork={openEditNetwork}
                    onDeleteNetwork={handleDeleteNetwork}
                    onEditMinistry={openEditMinistry}
                    onDeleteMinistry={handleDeleteMinistry}
                  />
                )}
              </Card>
            )}

            {canManageAccess && activeTab === "access" && (
              <Card className="settings-panel !rounded-2xl !p-0 pb-2" id="panel-access" role="tabpanel" aria-labelledby="tab-access">
                <div className="card-head px-7 pb-4 pt-6">
                  <div>
                    <h2 className="m-0 font-display text-xl font-semibold text-[var(--color-text-primary)]">Module access</h2>
                    <p className="m-0 mt-1 text-sm text-[var(--color-text-secondary)]">
                      Choose which modules each network can open.
                    </p>
                  </div>
                </div>
                <div className="settings-callout">
                  <InfoIcon className="h-[18px] w-[18px]" />
                  <span>Admins always have full access. A network without a rule is allowed by default.</span>
                </div>
                <div className="settings-thead settings-cols-access">
                  <span>Network</span>
                  {ACCESS_MODULES.map((mod) => (
                    <span key={mod} className="settings-cell-center" title={mod}>
                      <span className="settings-mod-full">{mod}</span>
                      <span className="settings-mod-short" aria-hidden="true">
                        {MODULE_SHORT_LABELS[mod]}
                      </span>
                    </span>
                  ))}
                </div>
                {accessError && <p className="error px-7 py-3">{accessError}</p>}
                {loadingAccess && (
                  <div className="flex flex-col gap-2 px-7 py-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                )}
                {!loadingAccess && networks.length === 0 && (
                  <p className="px-7 py-6 text-sm text-[var(--color-text-secondary)]">No networks yet — add one above first.</p>
                )}
                {!loadingAccess &&
                  flattenNetworksForSelect(networkTree).map(({ id, name, depth }) => (
                    <div
                      key={id}
                      className={["settings-trow settings-cols-access settings-acc-row", depth === 0 ? "settings-acc-row--parent" : "settings-acc-row--child"].join(
                        " ",
                      )}
                    >
                      <span className="settings-acc-name">{name}</span>
                      {ACCESS_MODULES.map((mod) => {
                        const cellKey = `${id}-${mod}`;
                        return (
                          <CheckTile
                            key={mod}
                            checked={isAllowed(id, mod)}
                            disabled={savingCell === cellKey}
                            onChange={() => handleToggleAccess(id, mod)}
                            aria-label={`${mod} access for ${name}`}
                          />
                        );
                      })}
                    </div>
                  ))}
              </Card>
            )}
          </div>
        </div>
      </div>

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
              disabled={savingLifeGroup || !lifeGroupForm.groupName.trim() || !lifeGroupForm.leaderId || leaderMissingLgnNetwork}
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
              This leader isn't assigned to a Life Group Network (LGN) sub-network yet — assign one for them under
              People → Workers first.
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
            onChange={(e) => setLifeGroupForm((f) => ({ ...f, category: e.target.value as LifeGroupCategory }))}
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
