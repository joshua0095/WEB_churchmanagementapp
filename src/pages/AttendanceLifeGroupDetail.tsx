import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  addLifeGroupMember,
  currentChurchSessionDate,
  formatLifeGroupDate,
  getLifeGroup,
  getLifeGroupRoster,
  lifeGroupCheckIn,
  openLifeGroupSession,
  undoLifeGroupCheckIn,
  weekOfMonthLabel,
  type LifeGroupDetail,
  type LifeGroupRoster,
} from "../api";
import { isAdmin, isRegistrar } from "../auth";
import ChurchWeekPicker from "../components/ChurchWeekPicker";
import LifeGroupMemberList from "../components/LifeGroupMemberList";
import { AppShell, Button, DatePicker, IconButton, Modal, ProfileMenu, ProgressBar, Skeleton, TextField } from "../components/ui";
import { BackIcon } from "../components/ui/icons";
import { successToast } from "../swal";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function AttendanceLifeGroupDetail() {
  const { id } = useParams();
  const groupId = Number(id);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const overseer = isAdmin() || isRegistrar();
  const date = searchParams.get("date") ?? todayIso();

  const [group, setGroup] = useState<LifeGroupDetail | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [roster, setRoster] = useState<LifeGroupRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const groupDetail = await getLifeGroup(groupId);
      // A Church group's session is always keyed by that week's Sunday, even before a
      // leader has touched the week picker — a Community group's date is used as-is.
      const sessionDate = groupDetail.category === "Community" ? date : currentChurchSessionDate(date);
      if (sessionDate !== date) {
        setSearchParams({ date: sessionDate }, { replace: true });
        return;
      }
      const session = await openLifeGroupSession(groupId, sessionDate);
      setGroup(groupDetail);
      setSessionId(session.id);
      setRoster(await getLifeGroupRoster(session.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load this life group");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, date]);

  const refreshRoster = async () => {
    if (sessionId === null) return;
    setRoster(await getLifeGroupRoster(sessionId));
  };

  // Patches one member's check-in state directly instead of re-fetching the whole roster —
  // the check-in/undo call already tells us everything this needs.
  const patchRosterMember = (memberId: number, recordId: number | null) => {
    setRoster((prev) =>
      prev && {
        ...prev,
        checkedInCount: prev.checkedInCount + (recordId ? 1 : -1),
        people: prev.people.map((p) => (p.memberId === memberId ? { ...p, recordId } : p)),
      },
    );
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    setAddingMember(true);
    try {
      await addLifeGroupMember(groupId, newMemberName.trim());
      setNewMemberName("");
      setAddMemberOpen(false);
      await refreshRoster();
      successToast("Member added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  if (loading) {
    return (
      <AppShell headerRight={<ProfileMenu />}>
        <Skeleton className="h-24 w-full rounded-md" />
      </AppShell>
    );
  }

  if (error || !group) {
    return (
      <AppShell headerRight={<ProfileMenu />}>
        <p className="error">{error ?? "Life group not found."}</p>
      </AppShell>
    );
  }

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconButton
            aria-label={overseer ? "Back to Life Groups" : "Back to Attendance"}
            onClick={() => navigate(overseer ? "/attendance/lifegroups" : "/attendance")}
            className="mt-1 !h-11 !w-11 border border-[var(--color-border)] !text-[var(--color-navy)]"
          >
            <BackIcon />
          </IconButton>
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--color-navy)]">{group.groupName}</h1>
            <p className="mt-1 text-base font-semibold text-[var(--color-text-secondary)]">
              {group.category === "Community" ? formatLifeGroupDate(date) : weekOfMonthLabel(date)}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {group.category === "Community" ? "Community" : "Church"} Life Group · Led by {group.leaderName}
              {group.networkName && ` · ${group.networkName}`}
            </p>
          </div>
        </div>
        <Button type="button" onClick={() => setAddMemberOpen(true)}>
          + Add member
        </Button>
      </div>

      <div className="mb-6 max-w-xs">
        {group.category === "Community" ? (
          <DatePicker label="Attendance date" value={date} onChange={(iso) => setSearchParams({ date: iso })} />
        ) : (
          <ChurchWeekPicker value={date} onChange={(iso) => setSearchParams({ date: iso })} />
        )}
      </div>

      {roster && (
        <div className="mb-6 max-w-xs">
          <p className="mb-1 text-base font-semibold text-[var(--color-text-secondary)]">
            {roster.checkedInCount} of {roster.total} present
          </p>
          <ProgressBar value={roster.checkedInCount} max={roster.total} />
        </div>
      )}

      {roster && sessionId !== null && (
        <LifeGroupMemberList
          people={roster.people}
          onCheckIn={(memberId) => lifeGroupCheckIn(sessionId, memberId)}
          onUndo={undoLifeGroupCheckIn}
          onToggled={patchRosterMember}
        />
      )}

      <Modal
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        title="Add member"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setAddMemberOpen(false)}>
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

export default AttendanceLifeGroupDetail;
