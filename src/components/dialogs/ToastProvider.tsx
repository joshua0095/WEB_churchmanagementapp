import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckThinIcon } from "../ui/shellIcons";
import { CloseXIcon, InfoDotIcon, WarningDotIcon } from "./icons";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  type: ToastType;
  title: string;
  message?: string;
  /** Label for an optional secondary action button (e.g. "Try again", "View"). */
  action?: string;
  onAction?: () => void;
  /** Ignored for type="error" — errors stay until dismissed. Defaults to 5000ms. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
  leaving: boolean;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 3;
const LEAVE_ANIMATION_MS = 180;

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckThinIcon strokeWidth={2.8} />,
  error: <CloseXIcon strokeWidth={2.8} />,
  warning: <WarningDotIcon />,
  info: <InfoDotIcon />,
};

/** One alert in the stack — its own progress bar drives auto-dismiss via onAnimationEnd
 * (paused by :hover in CSS), so there's no JS timer to manage/clear. */
function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const sticky = toast.type === "error";
  const duration = toast.duration ?? 5000;

  return (
    <div
      className={["toast", `toast--${toast.type}`, toast.leaving && "toast--leaving"].filter(Boolean).join(" ")}
      role={sticky ? "alert" : "status"}
    >
      <div className="toast-inner">
        <div className="toast-icon" aria-hidden="true">
          {ICONS[toast.type]}
        </div>
        <div className="toast-text">
          <span className="toast-title">{toast.title}</span>
          {toast.message && <span className="toast-msg">{toast.message}</span>}
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.onAction?.();
                onDismiss();
              }}
            >
              {toast.action}
            </button>
          )}
        </div>
        <button type="button" className="toast-close" aria-label="Dismiss" onClick={onDismiss}>
          <CloseXIcon />
        </button>
      </div>
      {!sticky && !toast.leaving && (
        <div className="toast-progress">
          <span style={{ animationDuration: `${duration}ms` }} onAnimationEnd={onDismiss} />
        </div>
      )}
    </div>
  );
}

/** Mount once at the app root. Renders the alert stack through a portal, desktop top-right
 * (below the 72px top bar) / mobile full-width (below the 64px top bar) per dialogs.css. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, LEAVE_ANIMATION_MS);
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = crypto.randomUUID();
    setToasts((current) => {
      const next = [...current, { ...options, id, leaving: false }];
      return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
    });
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <ToastRow key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
