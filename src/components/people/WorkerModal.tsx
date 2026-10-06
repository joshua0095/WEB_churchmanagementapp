import { useEffect, useId, useRef, useState } from "react";
import { createUser, updateUser, type Ministry, type Network, type User } from "../../api";
import { Modal } from "../dialogs";
import type { NetworkTreeNode } from "../networkTree";
import { PhotoField } from "../PeopleShared";
import Button from "../ui/Button";
import NetworkAssignments, { type Assignments } from "./NetworkAssignments";

const emptyForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  nickname: "",
  email: "",
  birthday: "",
  photoDataUrl: null as string | null,
};

type Form = typeof emptyForm;
type FieldKey = "firstName" | "lastName" | "email";
type Tab = "details" | "assign";

function validate(form: Form): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  if (!form.firstName.trim()) errors.firstName = "Enter a first name.";
  if (!form.lastName.trim()) errors.lastName = "Enter a last name.";
  // Required only, as before — some existing records hold placeholder emails, and a format
  // check here would block every other edit to them. The server has the final say.
  if (!form.email.trim()) errors.email = "Enter an email address.";
  return errors;
}

interface WorkerModalProps {
  open: boolean;
  /** The worker being edited, or null to add one. */
  editing: User | null;
  networks: Network[];
  ministries: Ministry[];
  tree: NetworkTreeNode[];
  onClose: () => void;
  /** Called after a successful save. A new worker comes with their temporary password. */
  onSaved: (result: { kind: "updated"; user: User } | { kind: "created"; user: User; temporaryPassword: string }) => void;
}

/** Add / Edit worker: a Details tab (photo + name/contact fields) and a Networks & ministries
 * tab, switched by a segmented control pinned under the title. */
function WorkerModal({ open, editing, networks, ministries, tree, onClose, onSaved }: WorkerModalProps) {
  const [tab, setTab] = useState<Tab>("details");
  const [form, setForm] = useState<Form>(emptyForm);
  const [assignments, setAssignments] = useState<Assignments>({ networkIds: [], ministryIds: [] });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Bumped on every open, so the assignments card list (its expanded state) starts fresh.
  const [session, setSession] = useState(0);
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLInputElement | null>>>({});
  const uid = useId();

  useEffect(() => {
    if (!open) return;
    setTab("details");
    setForm(
      editing
        ? {
            firstName: editing.firstName,
            middleName: editing.middleName ?? "",
            lastName: editing.lastName,
            nickname: editing.nickname ?? "",
            email: editing.email,
            birthday: editing.birthday ? editing.birthday.slice(0, 10) : "",
            photoDataUrl: editing.photoDataUrl,
          }
        : emptyForm,
    );
    setAssignments(editing ? { networkIds: editing.networkIds, ministryIds: editing.ministryIds } : { networkIds: [], ministryIds: [] });
    setErrors({});
    setFormError(null);
    setSession((s) => s + 1);
  }, [open, editing]);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [key]: v }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const save = async () => {
    const found = validate(form);
    setErrors(found);
    const firstBad = (["firstName", "lastName", "email"] as FieldKey[]).find((k) => found[k]);
    if (firstBad) {
      // The problem is on Details — go there (if we're on the other tab) and put the cursor in it.
      setTab("details");
      requestAnimationFrame(() => fieldRefs.current[firstBad]?.focus());
      return;
    }

    setSaving(true);
    setFormError(null);
    const payload = {
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || null,
      lastName: form.lastName.trim(),
      nickname: form.nickname.trim() || null,
      email: form.email.trim(),
      birthday: form.birthday || null,
      photoDataUrl: form.photoDataUrl,
      ministryIds: assignments.ministryIds,
      networkIds: assignments.networkIds,
    };
    try {
      if (editing) {
        const user = await updateUser(editing.id, payload);
        onSaved({ kind: "updated", user });
      } else {
        const result = await createUser(payload);
        onSaved({ kind: "created", user: result.user, temporaryPassword: result.temporaryPassword });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save the worker.");
    } finally {
      setSaving(false);
    }
  };

  const count = assignments.networkIds.length + assignments.ministryIds.length;
  const displayName = `${form.firstName} ${form.lastName}`.trim() || "Worker";

  const field = (key: keyof Form, label: string, opts: { optional?: boolean; type?: string; autoComplete?: string } = {}) => {
    const id = `${uid}-${key}`;
    const error = key in errors ? errors[key as FieldKey] : undefined;
    return (
      <div className="wk-field">
        <label className="wk-label" htmlFor={id}>
          {label}
          {opts.optional && <span className="wk-label-hint"> · optional</span>}
        </label>
        <input
          id={id}
          ref={(el) => {
            if (key === "firstName" || key === "lastName" || key === "email") fieldRefs.current[key] = el;
          }}
          className="wk-input"
          type={opts.type ?? "text"}
          autoComplete={opts.autoComplete ?? "off"}
          value={form[key] ?? ""}
          onChange={set(key)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && (
          <p id={`${id}-error`} className="wk-field-error">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      size="lg"
      title={editing ? "Edit worker" : "Add worker"}
      headerExtra={
        <div className="wk-tabs" role="tablist" aria-label="Worker sections">
          <button
            type="button"
            role="tab"
            id={`${uid}-tab-details`}
            aria-selected={tab === "details"}
            aria-controls={`${uid}-panel-details`}
            className="wk-tab"
            onClick={() => setTab("details")}
          >
            Details
          </button>
          <button
            type="button"
            role="tab"
            id={`${uid}-tab-assign`}
            aria-selected={tab === "assign"}
            aria-controls={`${uid}-panel-assign`}
            className="wk-tab"
            onClick={() => setTab("assign")}
          >
            Networks &amp; ministries
            {count > 0 && (
              <span className="wk-tab-badge">
                {count}
                <span className="sr-only"> assigned</span>
              </span>
            )}
          </button>
        </div>
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add worker"}
          </Button>
        </>
      }
    >
      {/* Both panels stay mounted (just hidden) so switching tabs keeps scroll and expanded cards. */}
      <div
        role="tabpanel"
        id={`${uid}-panel-details`}
        aria-labelledby={`${uid}-tab-details`}
        hidden={tab !== "details"}
        className="wk-panel"
      >
        <PhotoField name={displayName} photoUrl={form.photoDataUrl} onChange={(photoDataUrl) => setForm((f) => ({ ...f, photoDataUrl }))} />
        <div className="wk-grid">
          {field("firstName", "First name", { autoComplete: "given-name" })}
          {field("lastName", "Last name", { autoComplete: "family-name" })}
          {field("middleName", "Middle name", { optional: true, autoComplete: "additional-name" })}
          {field("nickname", "Nickname", { optional: true })}
          {field("email", "Email", { type: "email", autoComplete: "email" })}
          {field("birthday", "Birthday", { type: "date", optional: true })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${uid}-panel-assign`}
        aria-labelledby={`${uid}-tab-assign`}
        hidden={tab !== "assign"}
        className="wk-panel"
      >
        <NetworkAssignments
          key={session}
          tree={tree}
          networks={networks}
          ministries={ministries}
          value={assignments}
          onChange={setAssignments}
        />
      </div>

      {formError && (
        <p className="wk-field-error" role="alert">
          {formError}
        </p>
      )}
    </Modal>
  );
}

export default WorkerModal;
