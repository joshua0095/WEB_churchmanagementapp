import { useState } from "react";
import {
  currentChurchSessionDate,
  getLifeGroupRoster,
  openLifeGroupSession,
  type LifeGroupCategory,
  type LifeGroupRoster,
} from "../api";

export interface GroupSession {
  sessionId: number;
  date: string;
  roster: LifeGroupRoster;
}

interface GroupLike {
  id: number;
  category: LifeGroupCategory;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Loads and tracks each Life Group's currently-open attendance session, keyed by group id —
 * shared between the Admin/Registrar all-groups view and a leader's own-groups view, since
 * both open sessions and check members in/out the same way.
 */
export function useLifeGroupSessions() {
  const [sessions, setSessions] = useState<Record<number, GroupSession>>({});
  // A group's chosen session date — a full calendar date for Community, or the date
  // computed from the picked week-of-month for Church. Defaults to today until changed.
  const [groupDates, setGroupDates] = useState<Record<number, string>>({});
  const [expandedLoading, setExpandedLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadGroupSession = async (group: GroupLike, dateOverride?: string) => {
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

  const changeGroupDate = (group: GroupLike, iso: string) => {
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
  // the check-in/undo call already tells us everything this needs. Undoing a check-in also
  // clears first-timer, since that flag only makes sense on an actual attendance record.
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
            people: existing.roster.people.map((p) =>
              p.memberId === memberId ? { ...p, recordId, isFirstTimer: recordId ? p.isFirstTimer : false } : p,
            ),
          },
        },
      };
    });
  };

  return {
    sessions,
    groupDates,
    expandedLoading,
    error,
    setError,
    loadGroupSession,
    changeGroupDate,
    refreshGroupSession,
    patchGroupMember,
  };
}
