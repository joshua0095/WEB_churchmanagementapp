import { useState } from "react";
import { AppShell, Button, ProfileMenu, SegmentedControl, SelectField, TextField } from "../components/ui";
import { Modal, useConfirm, useToast } from "../components/dialogs";

/** Preview-only playground for the new Modal/Toast/useConfirm system — not linked from
 * navigation, reachable at /dev/modals. Mirrors the design reference's own demo buttons so
 * the three modal variants and four alert types can all be tried without wiring up any real
 * form yet (that migration is a separate step). */
function DevModalsDemo() {
  const [formOpen, setFormOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [groupType, setGroupType] = useState<"Church" | "Community">("Church");
  const confirm = useConfirm();
  const toast = useToast();

  const handleConfirm = async () => {
    const ok = await confirm({
      title: "Remove Church Planting?",
      description: "It will be removed from Church Development Network. This can't be undone.",
      confirmLabel: "Remove ministry",
      danger: true,
    });
    if (ok) toast.show({ type: "success", title: "Ministry removed" });
  };

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="m-0 font-display text-3xl font-semibold text-[var(--color-text-primary)]">Modals &amp; alerts</h1>
          <p className="m-0 mt-1 text-sm text-[var(--color-text-secondary)]">Preview only — not linked from navigation.</p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button onClick={() => setFormOpen(true)}>Form modal</Button>
          <Button variant="outline" onClick={handleConfirm}>
            Confirm modal
          </Button>
          <Button variant="outline" onClick={() => setSuccessOpen(true)}>
            Success modal
          </Button>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="outline"
            onClick={() =>
              toast.show({
                type: "success",
                title: "Devotion saved",
                message: "Your devotion for Friday, 25 September is in your list.",
              })
            }
          >
            Success alert
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.show({
                type: "error",
                title: "Couldn't save changes",
                message: "Check your connection and try again.",
                action: "Try again",
              })
            }
          >
            Error alert
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.show({
                type: "warning",
                title: "You have unsaved changes",
                message: "Save before leaving this page.",
              })
            }
          >
            Warning alert
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.show({ type: "info", title: "New announcement", message: "[Announcement title]", action: "View" })
            }
          >
            Info alert
          </Button>
        </div>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        variant="form"
        size="md"
        title="Add Life Group"
        description="It will show up in Attendance when taking roll."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setFormOpen(false);
                toast.show({ type: "success", title: "Life group added" });
              }}
            >
              Add Life Group
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Group code" defaultValue="LG06" />
          <div className="ui-field">
            <span className="ui-field-label">Type</span>
            <SegmentedControl
              aria-label="Type"
              options={[
                { value: "Church", label: "Church" },
                { value: "Community", label: "Community" },
              ]}
              value={groupType}
              onChange={setGroupType}
            />
          </div>
        </div>
        <SelectField label="Leader">
          <option>Choose a member</option>
        </SelectField>
        <SelectField label="Network">
          <option>Heterogeneous Network</option>
        </SelectField>
        <label className="ui-field">
          <span className="ui-field-label">
            Meeting notes <span className="font-normal text-[var(--color-text-secondary)]">· optional</span>
          </span>
          <textarea className="ui-field-input" placeholder="Where and when the group meets" />
        </label>
      </Modal>

      <Modal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        variant="success"
        title="Welcome to JIL Connect"
        description="Your account is ready. Use success modals only for big moments; use a success alert for everyday saves."
        footer={
          <Button type="button" onClick={() => setSuccessOpen(false)}>
            Done
          </Button>
        }
      />
    </AppShell>
  );
}

export default DevModalsDemo;
