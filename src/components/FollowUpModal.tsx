import { useEffect, useState } from "react";
import {
  getLifeGroupFollowUps,
  removeLifeGroupFollowUp,
  saveLifeGroupFollowUp,
  type FollowUpMode,
  type LifeGroupPerson,
} from "../api";
import { Button, Modal, SelectField, Skeleton, TextField } from "./ui";
import { successToast } from "../swal";

interface FollowUpEntry {
  checked: boolean;
  savedBeforeOpen: boolean;
  mode: FollowUpMode;
  reason: string;
}

interface FollowUpModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: number | null;
  people: LifeGroupPerson[];
}

const MODE_OPTIONS: { value: FollowUpMode; label: string }[] = [
  { value: "Call", label: "Call" },
  { value: "Text", label: "Text" },
  { value: "Chat", label: "Chat" },
  { value: "Personal", label: "Personal" },
];

/** Lets a leader log how (and why) they followed up with members of their Life Group. */
function FollowUpModal({ open, onClose, sessionId, people }: FollowUpModalProps) {
  const [entries, setEntries] = useState<Record<number, FollowUpEntry>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || sessionId === null) return;
    setLoading(true);
    setError(null);
    getLifeGroupFollowUps(sessionId)
      .then((followUps) => {
        const byMemberId = new Map(followUps.map((f) => [f.memberId, f]));
        const next: Record<number, FollowUpEntry> = {};
        for (const person of people) {
          const existing = byMemberId.get(person.memberId);
          next[person.memberId] = existing
            ? { checked: true, savedBeforeOpen: true, mode: existing.mode, reason: existing.reason ?? "" }
            : { checked: false, savedBeforeOpen: false, mode: "Call", reason: "" };
        }
        setEntries(next);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load follow-ups"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId]);

  const updateEntry = (memberId: number, patch: Partial<FollowUpEntry>) => {
    setEntries((prev) => ({ ...prev, [memberId]: { ...prev[memberId], ...patch } }));
  };

  const handleSave = async () => {
    if (sessionId === null) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        Object.entries(entries).map(([memberIdStr, entry]) => {
          const memberId = Number(memberIdStr);
          if (entry.checked) {
            return saveLifeGroupFollowUp(sessionId, memberId, {
              mode: entry.mode,
              reason: entry.reason.trim() || null,
            });
          }
          if (entry.savedBeforeOpen) {
            return removeLifeGroupFollowUp(sessionId, memberId);
          }
          return Promise.resolve();
        }),
      );
      successToast("Follow-ups saved");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save follow-ups");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Follow up"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      {error && <p className="error mb-4">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {people.map((person) => {
            const entry = entries[person.memberId];
            if (!entry) return null;
            return (
              <div key={person.memberId} className="border-b border-[var(--color-border)] pb-4 last:border-b-0 last:pb-0">
                <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    checked={entry.checked}
                    onChange={(e) => updateEntry(person.memberId, { checked: e.target.checked })}
                  />
                  {person.name}
                </label>

                {entry.checked && (
                  <div className="mt-3 flex flex-col gap-3 pl-6">
                    <SelectField
                      label="Mode of contact"
                      value={entry.mode}
                      onChange={(e) => updateEntry(person.memberId, { mode: e.target.value as FollowUpMode })}
                    >
                      {MODE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </SelectField>
                    <TextField
                      label="Reason for absent"
                      value={entry.reason}
                      onChange={(e) => updateEntry(person.memberId, { reason: e.target.value })}
                      placeholder="e.g. Out of town"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

export default FollowUpModal;
