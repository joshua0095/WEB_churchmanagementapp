import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  addLifeGroupMember,
  currentChurchSessionDate,
  getLifeGroupRoster,
  getLifeGroups,
  getMyLifeGroups,
  lifeGroupCheckIn,
  openLifeGroupSession,
  undoLifeGroupCheckIn,
  type LifeGroupCategory,
} from "../api";
import { isAdmin, isMis } from "../auth";
import { LIFE_GROUPS_EVENT, isValidIsoDate, setupUrl, todayIso } from "../components/attendance/attendanceFlow";
import CheckInScreen, { type CheckInRoster } from "../components/attendance/CheckInScreen";
import FollowUpModal from "../components/FollowUpModal";
import { Button } from "../components/ui";

interface GroupInfo {
  id: number;
  groupName: string;
  category: LifeGroupCategory;
}

/** /attendance/lifegroups/:groupId/:date/checkin — marks one Life Group's members present.
 * Admin/MIS can open any group; a leader only their own. */
function AttendanceLifeGroupCheckIn() {
  const params = useParams();
  const groupId = Number(params.groupId);
  const requestedDate = params.date ?? "";
  const validParams = Number.isInteger(groupId) && groupId > 0 && isValidIsoDate(requestedDate);
  const overseer = isAdmin() || isMis();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionDate, setSessionDate] = useState(requestedDate);
  const [error, setError] = useState<string | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  useEffect(() => {
    if (!validParams) return;
    let cancelled = false;
    (async () => {
      try {
        const groups: GroupInfo[] = overseer ? await getLifeGroups() : await getMyLifeGroups();
        const found = groups.find((g) => g.id === groupId);
        if (!found) throw new Error(overseer ? "That life group no longer exists." : "You don't lead that life group.");
        // A Church group's session is always keyed by that week's Sunday; a Community
        // group's date is used as-is — same rule the old Life Groups screen used.
        const date = found.category === "Community" ? requestedDate : currentChurchSessionDate(requestedDate);
        const session = await openLifeGroupSession(found.id, date);
        if (cancelled) return;
        setGroup(found);
        setSessionDate(date);
        setSessionId(session.id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to open life group attendance");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [validParams, overseer, groupId, requestedDate]);

  const loadRoster = useCallback(async (): Promise<CheckInRoster> => {
    if (sessionId === null) throw new Error("No session");
    const roster = await getLifeGroupRoster(sessionId);
    return {
      total: roster.total,
      checkedInCount: roster.checkedInCount,
      people: roster.people.map((p) => ({
        id: p.memberId,
        name: p.name,
        recordId: p.recordId,
        checkedInAt: null,
        firstTimer: p.isFirstTimer,
      })),
    };
  }, [sessionId]);

  const backUrl = setupUrl({
    event: LIFE_GROUPS_EVENT,
    group: validParams ? groupId : null,
    date: validParams ? requestedDate : null,
  });

  let blocker = null;
  if (!validParams) blocker = <div className="att-empty"><p>This link is missing its life group or date.</p></div>;
  else if (error) blocker = <div className="att-empty"><p>{error}</p></div>;

  return (
    <CheckInScreen
      title={group?.groupName ?? "Life Group"}
      rosterLabel="Life Group"
      date={isValidIsoDate(sessionDate) ? sessionDate : todayIso()}
      backUrl={backUrl}
      blocker={blocker}
      loadRoster={sessionId !== null ? loadRoster : undefined}
      onCheckIn={async (memberId) => ({ ...(await lifeGroupCheckIn(sessionId!, memberId)), checkedInAt: null })}
      onUndo={undoLifeGroupCheckIn}
      walkIn={
        sessionId !== null
          ? {
              label: "Add member",
              submitLabel: "Add member",
              firstTimerOption: true,
              submit: (name, firstTimer) => addLifeGroupMember(groupId, name, firstTimer),
              successMessage: "Member added",
            }
          : undefined
      }
      toolbarExtra={(people) => (
        <>
          <Button type="button" variant="outline" className="att-toolbar-btn" onClick={() => setFollowUpOpen(true)}>
            Follow up
          </Button>
          <FollowUpModal
            open={followUpOpen}
            onClose={() => setFollowUpOpen(false)}
            sessionId={sessionId}
            people={people.map((p) => ({
              memberId: p.id,
              name: p.name,
              recordId: p.recordId,
              isFirstTimer: !!p.firstTimer,
            }))}
          />
        </>
      )}
    />
  );
}

export default AttendanceLifeGroupCheckIn;
