import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "./icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * "md" (default): a small dialog, centered on every viewport.
   * "lg": wider on tablet/desktop for forms with a lot of fields, and
   * goes full-screen (no overlay, no rounded corners, fixed header) below
   * the `sm` breakpoint (640px) instead of shrinking into a cramped card.
   */
  size?: "md" | "lg";
  /** Set to false to require the close button or Escape — useful for forms where an
   * accidental outside click shouldn't discard what's been typed. Defaults to true. */
  closeOnBackdropClick?: boolean;
}

/** Centered dialog with a backdrop; closes on backdrop click or Escape. */
function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnBackdropClick = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const large = size === "lg";

  return (
    <div className={large ? "fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4" : "fixed inset-0 z-50 flex items-center justify-center p-4"}>
      <div
        className={large ? "hidden bg-black/50 sm:fixed sm:inset-0 sm:block" : "absolute inset-0 bg-black/50"}
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          large
            ? "relative flex h-full w-full flex-col bg-[var(--color-surface)] sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-2xl sm:rounded-2xl sm:shadow-2xl"
            : "relative flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-[var(--color-surface)] p-6 shadow-2xl"
        }
      >
        <div
          className={
            large
              ? "flex shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] px-4 py-3.5 sm:border-0 sm:px-6 sm:pb-0 sm:pt-6"
              : "mb-4 flex items-center justify-between gap-4"
          }
        >
          <h2 className="font-display text-lg font-bold text-[var(--color-text-primary)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text-primary)]"
          >
            <CloseIcon />
          </button>
        </div>
        <div className={large ? "min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-4" : "min-h-0 overflow-y-auto"}>
          {children}
        </div>
        {footer && (
          <div
            className={
              large
                ? "flex shrink-0 justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3.5 sm:border-0 sm:px-6 sm:pb-6 sm:pt-0"
                : "mt-5 flex justify-end gap-2"
            }
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
