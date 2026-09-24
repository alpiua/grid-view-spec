/**
 * Unified confirmation dialog service for GridViewSpec.
 * Uses HTML5 <dialog> when available to leverage the browser's top-layer stacking and focus trap.
 */

export type DialogTone = "default" | "primary" | "warning" | "danger";

export interface ConfirmDialogOptions {
  title?: string;
  message?: string;
  tone?: DialogTone;
  confirmText?: string;
  cancelText?: string;
  closeOnBackdrop?: boolean;
}

let activeDialog: HTMLDialogElement | null = null;
let currentResolver: ((value: boolean) => void) | null = null;

function ensureDialogElement(): HTMLDialogElement {
  if (activeDialog && document.body.contains(activeDialog)) {
    return activeDialog;
  }

  const dialog = document.createElement("dialog");
  dialog.className = "cm-dialog-root";
  dialog.setAttribute("aria-modal", "true");

  dialog.innerHTML = `
    <div class="cm-dialog-panel" data-cm-dialog-panel>
      <div class="cm-dialog-header">
        <h3 class="cm-dialog-title" data-cm-dialog-title></h3>
        <button type="button" class="cm-dialog-close-btn" data-cm-dialog-cancel>&times;</button>
      </div>
      <div class="cm-dialog-body" data-cm-dialog-body></div>
      <div class="cm-dialog-footer">
        <button type="button" class="cm-btn cm-dialog-btn-cancel" data-cm-dialog-cancel></button>
        <button type="button" class="cm-btn cm-dialog-btn-confirm" data-cm-dialog-confirm></button>
      </div>
    </div>
  `;

  // Event handlers
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const closeOnBackdrop = dialog.dataset.cmCloseOnBackdrop !== "0";
      if (closeOnBackdrop) {
        closeWithResult(false);
      }
    }
  });

  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeWithResult(false);
  });

  const cancelButtons = dialog.querySelectorAll("[data-cm-dialog-cancel]");
  cancelButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeWithResult(false);
    });
  });

  const confirmBtn = dialog.querySelector("[data-cm-dialog-confirm]");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeWithResult(true);
    });
  }

  document.body.appendChild(dialog);
  activeDialog = dialog;
  return dialog;
}

function closeWithResult(result: boolean): void {
  if (!activeDialog) return;
  if (activeDialog.open) {
    activeDialog.close();
  }
  if (currentResolver) {
    const resolve = currentResolver;
    currentResolver = null;
    resolve(result);
  }
}

/**
 * Show a modal confirmation dialog and return a Promise resolving to true (confirmed) or false (cancelled).
 */
export function confirmDialog(options: ConfirmDialogOptions | string): Promise<boolean> {
  const opts: ConfirmDialogOptions =
    typeof options === "string" ? { message: options } : { ...options };

  const title = opts.title ?? t("dialog.title", "Confirmation");
  const message = opts.message ?? "";
  const tone = opts.tone ?? "default";
  const confirmText = opts.confirmText ?? t("dialog.confirm", "Confirm");
  const cancelText = opts.cancelText ?? t("dialog.cancel", "Cancel");
  const closeText = t("common.close", "Close");
  const closeOnBackdrop = opts.closeOnBackdrop ?? true;

  // Resolve any hanging previous confirmation safely
  if (currentResolver) {
    closeWithResult(false);
  }

  const dialog = ensureDialogElement();
  dialog.dataset.cmCloseOnBackdrop = closeOnBackdrop ? "1" : "0";
  dialog.dataset.cmTone = tone;

  const titleEl = dialog.querySelector<HTMLElement>("[data-cm-dialog-title]");
  if (titleEl) titleEl.textContent = title;

  const closeBtn = dialog.querySelector<HTMLButtonElement>(".cm-dialog-close-btn");
  if (closeBtn) closeBtn.setAttribute("aria-label", closeText);

  const bodyEl = dialog.querySelector<HTMLElement>("[data-cm-dialog-body]");
  if (bodyEl) bodyEl.textContent = message;

  const cancelBtn = dialog.querySelector<HTMLButtonElement>(".cm-dialog-btn-cancel");
  if (cancelBtn) cancelBtn.textContent = cancelText;

  const confirmBtn = dialog.querySelector<HTMLButtonElement>(".cm-dialog-btn-confirm");
  if (confirmBtn) {
    confirmBtn.textContent = confirmText;
    confirmBtn.className = "cm-btn cm-dialog-btn-confirm";
    if (tone === "danger") {
      confirmBtn.classList.add("cm-btn-danger");
    } else if (tone === "primary") {
      confirmBtn.classList.add("cm-btn-primary");
    } else if (tone === "warning") {
      confirmBtn.classList.add("cm-btn-warning");
    } else {
      confirmBtn.classList.add("cm-btn-default");
    }
  }

  return new Promise<boolean>((resolve) => {
    currentResolver = resolve;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      // Fallback for environments lacking HTMLDialogElement.showModal
      dialog.setAttribute("open", "");
    }
    // Focus confirm or cancel based on destructive tone
    if (tone === "danger") {
      cancelBtn?.focus();
    } else {
      confirmBtn?.focus();
    }
  });
}
import { t } from "../grid-view/i18n";
