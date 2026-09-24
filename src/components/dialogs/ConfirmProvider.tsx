import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import Button from "../ui/Button";
import Modal from "./Modal";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red icon-tile/confirm button for a destructive action (default) vs a neutral/gold one. */
  danger?: boolean;
  /** Overrides the default trash icon (every confirm in this app today is a delete/remove). */
  icon?: ReactNode;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

/** Mount once at the app root. Renders the single shared confirm dialog (variant="confirm" —
 * Esc/backdrop click do nothing, per Modal's own rule for that variant); useConfirm() is how
 * the rest of the app asks for it. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [open, setOpen] = useState(false);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
      setOpen(true);
    });
  }, []);

  const settle = (value: boolean) => {
    setOpen(false);
    pending?.resolve(value);
  };

  const danger = pending?.options.danger ?? true;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={open}
        onClose={() => settle(false)}
        variant="confirm"
        title={pending?.options.title ?? ""}
        description={pending?.options.description}
        icon={pending?.options.icon}
        danger={danger}
        footer={
          <>
            <Button type="button" variant="outline" data-autofocus onClick={() => settle(false)}>
              {pending?.options.cancelLabel ?? "Cancel"}
            </Button>
            <Button type="button" variant={danger ? "danger" : "primary"} onClick={() => settle(true)}>
              {pending?.options.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

/** Returns a `confirm(options)` function resolving true/false — replaces window.confirm and
 * the old swal-based confirmDialog(): `if (await confirm({ title, description, confirmLabel:
 * "Remove ministry", danger: true })) { ... }`. */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
