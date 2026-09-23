import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addLifeGroupMember,
  createLifeGroup,
  formatLifeGroupDate,
  getLifeGroups,
  getUsers,
  lifeGroupCheckIn,
  undoLifeGroupCheckIn,
  type LifeGroupSummary,
  type User,
} from "../api";
import { isAdmin, isRegistrar } from "../auth";
import ChurchWeekPicker from "../components/ChurchWeekPicker";
import FollowUpModal from "../components/FollowUpModal";
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
import { useLifeGroupSessions } from "../hooks/useLifeGroupSessions";
import { successToast } from "../swal";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function AttendanceLifeGroups() {
  const navigate = useNavigate();
  const overseer = isAdmin() || isRegistrar();

  const [groups, setGroups] = useState<LifeGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    sessions,
    expandedLoading,
    error: sessionError,
    loadGroupSession,
    changeGroupDate,
    refreshGroupSession,
    patchGroupMember,
  } = useLifeGroupSessions();

  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newLeaderId, setNewLeaderId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const [addMemberGroupId, setAddMemberGroupId] = useState<number | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberIsFirstTimer, setNewMemberIsFirstTimer] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [followUpGroupId, setFollowUpGroupId] = useState<number | null>(null);

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
      await addLifeGroupMember(addMemberGroupId, newMemberName.trim(), newMemberIsFirstTimer);
      setNewMemberName("");
      setNewMemberIsFirstTimer(false);
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

      {(error || sessionError) && <p className="error mb-4">{error ?? sessionError}</p>}

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
                onToggle={(open) => {
                  if (open && !sessions[group.id] && expandedLoading !== group.id) void loadGroupSession(group);
                }}
                header={
                  <div className="flex flex-1 items-center justify-between gap-4">
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
                {session ? (
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
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setAddMemberGroupId(group.id)}
                        className="self-start"
                      >
                        + Add member
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setFollowUpGroupId(group.id)}
                        className="self-start"
                      >
                        Follow up
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Skeleton className="h-16 w-full rounded-md" />
                )}
              </Accordion>
            );
          })}
        </div>
      )}

      <FollowUpModal
        open={followUpGroupId !== null}
        onClose={() => setFollowUpGroupId(null)}
        sessionId={followUpGroupId !== null ? (sessions[followUpGroupId]?.sessionId ?? null) : null}
        people={followUpGroupId !== null ? (sessions[followUpGroupId]?.roster.people ?? []) : []}
      />

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
        onClose={() => {
          setAddMemberGroupId(null);
          setNewMemberIsFirstTimer(false);
        }}
        title="Add member"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setAddMemberGroupId(null);
                setNewMemberIsFirstTimer(false);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddMember} disabled={addingMember || !newMemberName.trim()}>
              {addingMember ? "Adding..." : "Add"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField
            label="Full name"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            placeholder="Enter their name"
            autoFocus
          />
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <input
              type="checkbox"
              checked={newMemberIsFirstTimer}
              onChange={(e) => setNewMemberIsFirstTimer(e.target.checked)}
            />
            First-timer
          </label>
        </div>
      </Modal>
    </AppShell>
  );
}

export default AttendanceLifeGroups;
