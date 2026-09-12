import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addLifeGroupMember,
  createLifeGroup,
  currentChurchSessionDate,
  formatLifeGroupDate,
  getLifeGroupRoster,
  getLifeGroups,
  getUsers,
  lifeGroupCheckIn,
  openLifeGroupSession,
  undoLifeGroupCheckIn,
  type LifeGroupRoster,
  type LifeGroupSummary,
  type User,
} from "../api";
import { isAdmin, isRegistrar } from "../auth";
import ChurchWeekPicker from "../components/ChurchWeekPicker";
import LifeGroupMemberList from "../components/LifeGroupMemberList";
import {
  Accordion,
  AppShell,
  Button,
  DatePicker,
  IconButton,
  Modal,
  ProfileMenu,
  ProgressBar,
  SelectField,
  Skeleton,
  TextField,
} from "../components/ui";
import { BackIcon } from "../components/ui/icons";
import { successToast } from "../swal";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface GroupSession {
  sessionId: number;
  date: string;
  roster: LifeGroupRoster;
}

function AttendanceLifeGroups() {
  const navigate = useNavigate();
  const overseer = isAdmin() || isRegistrar();

  const [groups, setGroups] = useState<LifeGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Record<number, GroupSession>>({});
  // A group's chosen session date — a full calendar date for Community, or the date
  // computed from the picked week-of-month for Church. Defaults to today until changed.
  const [groupDates, setGroupDates] = useState<Record<number, string>>({});
  const [expandedLoading, setExpandedLoading] = useState<number | null>(null);

  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newLeaderId, setNewLeaderId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const [addMemberGroupId, setAddMemberGroupId] = useState<number | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // `silent` skips the loading skeleton for a background refresh (e.g. after adding a
  // member) — otherwise every expanded Accordion would unmount/remount and collapse.
  const loadGroups = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setGroups(await getLifeGroups());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load life groups");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // This screen lists and manages every life group system-wide — Admin/Registrar only.
  // A leader who isn't an overseer has their own single/multi-group flow already on the
  // Attendance hub (which lands them straight on their group's management page when they
  // lead only one), so send anyone else back there instead of exposing every group here.
  useEffect(() => {
    if (!overseer) {
      navigate("/attendance", { replace: true });
      return;
    }
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overseer]);

  if (!overseer) return null;

  const loadGroupSession = async (group: LifeGroupSummary, dateOverride?: string) => {
    const requestedDate = dateOverride ?? groupDates[group.id] ?? todayIso();
    // A Church group's session is always keyed by that week's Sunday, even before a
    // leader has touched the week picker — a Community group's date is used as-is.
    const sessionDate =
      group.category === "Community" ? requestedDate : currentChurchSessionDate(requestedDate);
    setExpandedLoading(group.id);
    try {
      const session = await openLifeGroupSession(group.id, sessionDate);
      const roster = await getLifeGroupRoster(session.id);
      setSessions((prev) => ({ ...prev, [group.id]: { sessionId: session.id, date: sessionDate, roster } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load group attendance");
    } finally {
      setExpandedLoading(null);
    }
  };

  const changeGroupDate = (group: LifeGroupSummary, iso: string) => {
    setGroupDates((prev) => ({ ...prev, [group.id]: iso }));
    void loadGroupSession(group, iso);
  };

  const refreshGroupSession = async (groupId: number) => {
    const existing = sessions[groupId];
    if (!existing) return;
    const roster = await getLifeGroupRoster(existing.sessionId);
    setSessions((prev) => ({ ...prev, [groupId]: { ...prev[groupId], roster } }));
  };

  // Patches one member's check-in state directly instead of re-fetching the whole roster —
  // the check-in/undo call already tells us everything this needs.
  const patchGroupMember = (groupId: number, memberId: number, recordId: number | null) => {
    setSessions((prev) => {
      const existing = prev[groupId];
      if (!existing) return prev;
      return {
        ...prev,
        [groupId]: {
          ...existing,
          roster: {
            ...existing.roster,
            checkedInCount: existing.roster.checkedInCount + (recordId ? 1 : -1),
            people: existing.roster.people.map((p) => (p.memberId === memberId ? { ...p, recordId } : p)),
          },
        },
      };
    });
  };

  const openAddGroup = async () => {
    setAddGroupOpen(true);
    if (users.length === 0) {
      try {
        setUsers(await getUsers());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users");
      }
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !newLeaderId) return;
    setCreating(true);
    try {
      await createLifeGroup(Number(newLeaderId), newGroupName.trim());
      setNewGroupName("");
      setNewLeaderId("");
      setAddGroupOpen(false);
      await loadGroups(true);
      successToast("Life group added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create life group");
    } finally {
      setCreating(false);
    }
  };

  const handleAddMember = async () => {
    if (addMemberGroupId === null || !newMemberName.trim()) return;
    setAddingMember(true);
    try {
      await addLifeGroupMember(addMemberGroupId, newMemberName.trim());
      setNewMemberName("");
      const groupId = addMemberGroupId;
      setAddMemberGroupId(null);
      await loadGroups(true);
      await refreshGroupSession(groupId);
      successToast("Member added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconButton
            aria-label="Back to Attendance"
            onClick={() => navigate("/attendance")}
            className="mt-1 !h-11 !w-11 border border-[var(--color-border)] !text-[var(--color-navy)]"
          >
            <BackIcon />
          </IconButton>
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--color-navy)]">Life Groups</h1>
            <p className="mt-1 text-base font-semibold text-[var(--color-text-secondary)]">{formatLifeGroupDate(todayIso())}</p>
          </div>
        </div>
        <Button type="button" onClick={openAddGroup}>
          + Add Life Group
        </Button>
      </div>

      {error && <p className="error mb-4">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
      ) : groups.length === 0 ? (
        <p className="helper-text">No life groups yet. Add one to get started.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const session = sessions[group.id];
            return (
              <Accordion
                key={group.id}
                defaultOpen={false}
                header={
                  <div
                    className="flex flex-1 items-center justify-between gap-4"
                    onClick={() => {
                      if (!sessions[group.id] && expandedLoading !== group.id) void loadGroupSession(group);
                    }}
                  >
                    <div>
                      <p className="text-lg font-bold text-[var(--color-navy)]">{group.groupName}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {group.category === "Community" ? "Community" : "Church"} Life Group · Led by{" "}
                        {group.leaderName}
                        {group.networkName && ` · ${group.networkName}`}
                      </p>
                    </div>
                    <div className="hidden min-w-40 sm:block">
                      {session ? (
                        <>
                          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                            {session.roster.checkedInCount} of {session.roster.total} present
                          </p>
                          <ProgressBar value={session.roster.checkedInCount} max={session.roster.total} />
                        </>
                      ) : (
                        <p className="text-sm text-[var(--color-text-secondary)]">{group.memberCount} members</p>
                      )}
                    </div>
                  </div>
                }
              >
                {expandedLoading === group.id ? (
                  <Skeleton className="h-16 w-full rounded-md" />
                ) : session ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      {group.category === "Community" ? (
                        <DatePicker
                          value={session.date}
                          onChange={(iso) => changeGroupDate(group, iso)}
                          className="max-w-[200px]"
                        />
                      ) : (
                        <ChurchWeekPicker
                          value={session.date}
                          onChange={(iso) => changeGroupDate(group, iso)}
                          className="max-w-[200px]"
                        />
                      )}
                    </div>
                    <LifeGroupMemberList
                      people={session.roster.people}
                      onCheckIn={(memberId) => lifeGroupCheckIn(session.sessionId, memberId)}
                      onUndo={undoLifeGroupCheckIn}
                      onToggled={(memberId, recordId) => patchGroupMember(group.id, memberId, recordId)}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setAddMemberGroupId(group.id)}
                      className="self-start"
                    >
                      + Add member
                    </Button>
                  </div>
                ) : (
                  <p className="helper-text">Tap this section to load attendance.</p>
                )}
              </Accordion>
            );
          })}
        </div>
      )}

      <Modal
        open={addGroupOpen}
        onClose={() => setAddGroupOpen(false)}
        title="Add Life Group"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setAddGroupOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateGroup}
              disabled={creating || !newGroupName.trim() || !newLeaderId}
            >
              {creating ? "Adding..." : "Add Group"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="e.g. Norzagaray Life Group"
          />
          <SelectField
            label="Leader"
            value={newLeaderId}
            onChange={(e) => setNewLeaderId(e.target.value)}
          >
            <option value="">Select a leader...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </SelectField>
        </div>
      </Modal>

      <Modal
        open={addMemberGroupId !== null}
        onClose={() => setAddMemberGroupId(null)}
        title="Add member"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setAddMemberGroupId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddMember} disabled={addingMember || !newMemberName.trim()}>
              {addingMember ? "Adding..." : "Add"}
            </Button>
          </>
        }
      >
        <TextField
          label="Full name"
          value={newMemberName}
          onChange={(e) => setNewMemberName(e.target.value)}
          placeholder="Enter their name"
          autoFocus
        />
      </Modal>
    </AppShell>
  );
}

export default AttendanceLifeGroups;
