import { useEffect, useState, type FormEvent } from "react";
import { changePassword } from "../api";
import { Modal } from "./dialogs";
import { Button, TextField } from "./ui";
import { successToast } from "../swal";

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY = { current: "", next: "", confirm: "" };

/** Signed-in password change — asks for the current password rather than emailing a reset link. */
function ChangePasswordModal({ open, onClose }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Never keep typed passwords around between openings.
  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError(null);
    }
  }, [open]);

  const update = (key: keyof typeof EMPTY, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.current || !form.next || !form.confirm) return setError("Fill in all three fields.");
    if (form.next.length < 8) return setError("New password must be at least 8 characters.");
    if (form.next !== form.confirm) return setError("The new passwords don't match.");
    if (form.next === form.current) return setError("Choose a new password that's different from your current one.");

    setSaving(true);
    try {
      await changePassword(form.current, form.next);
      successToast("Password changed");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change your password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change password"
      description="Enter your current password, then choose a new one."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="change-password-form" disabled={saving}>
            {saving ? "Saving…" : "Change password"}
          </Button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={form.current}
          onChange={(e) => update("current", e.target.value)}
          autoFocus
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={form.next}
          onChange={(e) => update("next", e.target.value)}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={(e) => update("confirm", e.target.value)}
        />
        <p className="m-0 text-xs text-[var(--color-text-secondary)]">At least 8 characters.</p>
        {error && (
          <p className="m-0 text-sm text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export default ChangePasswordModal;
