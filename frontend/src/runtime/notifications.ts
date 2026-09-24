/**
 * Unified toast notification system for GridViewSpec.
 * Manages toast queue, auto-dismiss timers, tone-based styling, and cm:notify event listening.
 */

export type ToastTone = "info" | "success" | "warning" | "error" | "danger";

export interface ToastAction {
  label: string;
  onClick: (toast: ToastInstance) => void;
}

export interface ToastOptions {
  id?: string;
  title?: string;
  message: string;
  tone?: ToastTone;
  duration?: number; // ms, default 4000. 0 or negative = sticky
  action?: ToastAction;
}

export interface ToastInstance {
  id: string;
  element: HTMLElement;
  dismiss: () => void;
}

let toastContainer: HTMLElement | null = null;
let toastCount = 0;
let channelBound = false;

function ensureToastContainer(): HTMLElement {
  if (toastContainer && document.body.contains(toastContainer)) {
    return toastContainer;
  }
  const el = document.createElement("div");
  el.id = "cm-toast-container";
  el.className = "cm-toast-container";
  el.setAttribute("aria-live", "polite");
  el.setAttribute("role", "status");
  document.body.appendChild(el);
  toastContainer = el;
  return el;
}

function resolveIcon(tone: ToastTone): string {
  switch (tone) {
    case "success":
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    case "warning":
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    case "error":
    case "danger":
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    case "info":
    default:
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }
}

/**
 * Display a toast notification.
 */
export function notify(options: ToastOptions | string): ToastInstance {
  const opts: ToastOptions =
    typeof options === "string" ? { message: options } : { ...options };

  const id = opts.id || `cm-toast-${++toastCount}`;
  const tone = opts.tone ?? "info";
  const duration = opts.duration ?? 4000;
  const container = ensureToastContainer();

  const toastEl = document.createElement("div");
  toastEl.id = id;
  toastEl.className = `cm-toast cm-toast-${tone}`;
  toastEl.dataset.cmToastId = id;

  const headerHtml = opts.title
    ? `<div class="cm-toast-title">${escapeHtml(opts.title)}</div>`
    : "";

  const actionHtml = opts.action
    ? `<button type="button" class="cm-toast-action-btn" data-cm-toast-action>${escapeHtml(opts.action.label)}</button>`
    : "";

  toastEl.innerHTML = `
    <div class="cm-toast-icon">${resolveIcon(tone)}</div>
    <div class="cm-toast-content">
      ${headerHtml}
      <div class="cm-toast-message">${escapeHtml(opts.message)}</div>
      ${actionHtml}
    </div>
    <button type="button" class="cm-toast-close" data-cm-toast-close aria-label="Close">&times;</button>
  `;

  let timer: number | null = null;
  let remainingMs = duration;
  let startedAt = Date.now();

  const dismiss = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    toastEl.classList.add("is-exiting");
    toastEl.addEventListener(
      "animationend",
      () => {
        if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
      },
      { once: true }
    );
    // Fallback cleanup if animationend does not fire
    window.setTimeout(() => {
      if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    }, 300);
  };

  const instance: ToastInstance = { id, element: toastEl, dismiss };

  if (opts.action) {
    const actionBtn = toastEl.querySelector("[data-cm-toast-action]");
    actionBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      opts.action?.onClick(instance);
    });
  }

  const closeBtn = toastEl.querySelector("[data-cm-toast-close]");
  closeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    dismiss();
  });

  if (duration > 0) {
    const startTimer = () => {
      startedAt = Date.now();
      timer = window.setTimeout(dismiss, remainingMs);
    };

    const pauseTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
        remainingMs -= Date.now() - startedAt;
      }
    };

    toastEl.addEventListener("mouseenter", pauseTimer);
    toastEl.addEventListener("mouseleave", () => {
      if (remainingMs > 0) startTimer();
      else dismiss();
    });

    startTimer();
  }

  container.appendChild(toastEl);
  return instance;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Bind global event listeners for `cm:notify` so that HTMX response headers,
 * background tasks, and Alpine micro-UIs can post notifications decoupled from GVS code.
 */
export function bindNotificationChannel(): void {
  if (channelBound || typeof window === "undefined") return;
  channelBound = true;

  window.addEventListener("cm:notify", ((event: CustomEvent<ToastOptions | string>) => {
    if (event.detail) {
      notify(event.detail);
    }
  }) as EventListener);
}
