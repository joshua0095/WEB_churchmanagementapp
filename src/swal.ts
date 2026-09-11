import Swal from "sweetalert2";

// Shared brand styling for every SweetAlert2 dialog in the app — colors are
// CSS custom properties so they always match theme.css, not a copy of it.
// Fonts/shape are themed globally in index.css (see the .swal2-* rules there).
const GOLD = "var(--color-gold)";
const NAVY = "var(--color-navy)";
const DANGER = "var(--color-danger)";

// scrollbarPadding: SweetAlert2 otherwise pads the page to compensate for a
// scrollbar it assumes will disappear — on a page that wasn't scrollable to
// begin with, that padding shows up as a blank gutter that looks like a
// stray/invisible scrollbar. Every dialog goes through this shared instance
// so the fix (and any other shared default) only needs to live in one place.
const swal = Swal.mixin({ scrollbarPadding: false });

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  /** Styles the confirm button red instead of gold, for destructive actions. */
  danger?: boolean;
}

/** Replaces window.confirm — resolves true only if the user confirmed. */
export async function confirmDialog({ title, message, confirmLabel = "Yes", danger }: ConfirmOptions): Promise<boolean> {
  const result = await swal.fire({
    title,
    text: message,
    icon: danger ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: confirmLabel,
    cancelButtonText: "Cancel",
    confirmButtonColor: danger ? DANGER : GOLD,
    cancelButtonColor: NAVY,
    reverseButtons: true,
    focusCancel: danger,
  });
  return result.isConfirmed;
}

/** Replaces window.alert — a single-button informational dialog. */
export async function infoAlert(message: string, title?: string): Promise<void> {
  await swal.fire({
    title,
    text: message,
    icon: "info",
    confirmButtonText: "OK",
    confirmButtonColor: GOLD,
  });
}

const toastSwal = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (el) => {
    el.addEventListener("mouseenter", Swal.stopTimer);
    el.addEventListener("mouseleave", Swal.resumeTimer);
  },
});

/** Brief, non-blocking confirmation for a completed action — top-right, auto-dismisses. */
export function successToast(message: string): void {
  void toastSwal.fire({ icon: "success", title: message });
}

/** Brief, non-blocking failure notice — top-right, auto-dismisses (use infoAlert instead for errors that need to stay on screen until dismissed). */
export function errorToast(message: string): void {
  void toastSwal.fire({ icon: "error", title: message });
}
