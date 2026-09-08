import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addLifeGroupMember,
  getLifeGroup,
  getLifeGroupRoster,
  lifeGroupCheckIn,
  openLifeGroupSession,
  undoLifeGroupCheckIn,
  type LifeGroupDetail,
  type LifeGroupRoster,
} from "../api";
import { isAdmin, isRegistrar } from "../auth";
import LifeGroupMemberList from "../components/LifeGroupMemberList";
import { AppShell, Button, IconButton, Modal, ProfileMenu, ProgressBar, Skeleton, TextField } from "../components/ui";
import { BackIcon } from "../components/ui/icons";

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
  const overseer = isAdmin() || isRegistrar();
  const date = todayIso();

  const [group, setGroup] = useState<LifeGroupDetail | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
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
      const [groupDetail, session] = await Promise.all([
        getLifeGroup(groupId),
        openLifeGroupSession(groupId, date),
      ]);
      setGroup(groupDetail);
      setSessionId(session.id);
      setWeekNumber(session.weekNumber);
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
  }, [groupId]);

  const refreshRoster = async () => {
    if (sessionId === null) return;
    setRoster(await getLifeGroupRoster(sessionId));
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    setAddingMember(true);
    try {
      await addLifeGroupMember(groupId, newMemberName.trim());
      setNewMemberName("");
      setAddMemberOpen(false);
      await refreshRoster();
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
          {overseer && (
            <IconButton
              aria-label="Back to Life Groups"
              onClick={() => navigate("/attendance/lifegroups")}
              className="mt-1 !h-11 !w-11 border border-[var(--color-border)] !text-[var(--color-navy)]"
            >
              <BackIcon />
            </IconButton>
          )}
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--color-navy)]">{group.groupName}</h1>
            <p className="mt-1 text-base font-semibold text-[var(--color-text-secondary)]">
              Week {weekNumber} — {date}
            </p>
          </div>
        </div>
        <Button type="button" onClick={() => setAddMemberOpen(true)}>
          + Add member
        </Button>
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
          onChanged={refreshRoster}
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
