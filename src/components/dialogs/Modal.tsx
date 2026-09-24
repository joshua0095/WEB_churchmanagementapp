import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckThinIcon } from "../ui/shellIcons";
import { CloseXIcon, TrashTileIcon } from "./icons";

export type ModalVariant = "form" | "confirm" | "success";
export type ModalSize = "sm" | "md";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** "form" (default): a titled panel with a close button and a body for arbitrary fields.
   * "confirm": a short alertdialog with an icon tile — Esc/backdrop click do nothing, the
   * person must pick a footer button. "success": a celebratory centered panel for a big
   * moment (see useConfirm/ToastProvider for everyday confirms/saves instead). */
  variant?: ModalVariant;
  /** Defaults to "sm" for confirm/success, "md" for form — matches every use in the reference. */
  size?: ModalSize;
  title: string;
  description?: string;
  /** Body content — rendered only for variant="form" (confirm/success are short enough that
   * `description` covers it, matching the reference's markup). */
  children?: ReactNode;
  footer?: ReactNode;
  /** confirm: the icon-tile glyph (defaults to a trash icon — every confirm in this app is a
   * delete/remove). success: the check-circle glyph (defaults to a checkmark). Ignored for
   * variant="form". */
  icon?: ReactNode;
  /** confirm only: red icon-tile for a destructive action (default) vs a neutral tile for a
   * non-destructive one. */
  danger?: boolean;
}

// Matches the CSS transition durations (180ms desktop, 240ms mobile) with margin to spare —
// the modal must stay mounted (and body scroll must stay locked) for the full close
// animation, then unmount and hand focus back to whatever opened it.
const CLOSE_ANIMATION_MS = 250;

const FOCUSABLE_SELECTOR = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]";

/** Centered dialog on desktop (≥1024px), a bottom sheet with a drag handle on mobile.
 * Rendered through a portal; traps focus while open and returns it to whatever had focus
 * before opening. Esc and a backdrop click close "form"/"success" but not "confirm" (that
 * variant demands an explicit button choice) — see useConfirm for the common case. */
function Modal({ open, onClose, variant = "form", size, title, description, children, footer, icon, danger = true }: ModalProps) {
  const resolvedSize = size ?? (variant === "form" ? "md" : "sm");
  const dismissible = variant !== "confirm";
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement as HTMLElement | null;
      setRendered(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timeout = setTimeout(() => {
      setRendered(false);
      openerRef.current?.focus();
    }, CLOSE_ANIMATION_MS);
    return () => clearTimeout(timeout);
  }, [open]);

  // Moves focus in once the modal is actually in the DOM (a render after `rendered` flips
  // true), and locks body scroll for as long as it's mounted — including through the close
  // animation, same as the reference.
  useEffect(() => {
    if (!rendered) return;
    const modal = modalRef.current;
    const target = modal?.querySelector<HTMLElement>("[data-autofocus]") ?? modal?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    target?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [rendered]);

  useEffect(() => {
    if (!rendered) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = [...modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [rendered, dismissible, onClose]);

  if (!rendered) return null;

  const resolvedIcon =
    variant === "confirm" ? (icon ?? <TrashTileIcon />) : variant === "success" ? (icon ?? <CheckThinIcon strokeWidth={2.6} />) : null;

  return createPortal(
    <div
      className={["modal-backdrop", visible && "modal-backdrop--open"].filter(Boolean).join(" ")}
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={modalRef}
        role={variant === "confirm" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={["modal", `modal--${variant}`, `modal--${resolvedSize}`].join(" ")}
      >
        <div className="modal-handle" aria-hidden="true">
          <span />
        </div>

        {variant === "form" && (
          <>
            <span className="modal-ribbon" aria-hidden="true" />
            <div className="modal-header">
              <div className="modal-header-text">
                <h2 className="modal-title" id={titleId}>
                  {title}
                </h2>
                {description && (
                  <p className="modal-desc" id={descId}>
                    {description}
                  </p>
                )}
              </div>
              <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
                <CloseXIcon />
              </button>
            </div>
            <div className="modal-body">{children}</div>
          </>
        )}

        {variant === "confirm" && (
          <div className="modal-header">
            <div className={["modal-icon-tile", danger && "modal-icon-tile--danger"].filter(Boolean).join(" ")}>{resolvedIcon}</div>
            <div className="modal-header-text">
              <h2 className="modal-title" id={titleId}>
                {title}
              </h2>
              {description && (
                <p className="modal-desc" id={descId}>
                  {description}
                </p>
              )}
            </div>
          </div>
        )}

        {variant === "success" && (
          <>
            <span className="modal-ribbon modal-ribbon--right" aria-hidden="true" />
            <div className="modal-header">
              <div className="modal-check-circle">{resolvedIcon}</div>
              <h2 className="modal-title" id={titleId}>
                {title}
              </h2>
              {description && (
                <p className="modal-desc" id={descId}>
                  {description}
                </p>
              )}
            </div>
          </>
        )}

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
