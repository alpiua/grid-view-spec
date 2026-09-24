import { confirmDialog, type ConfirmDialogOptions } from "../runtime/dialog";
import { isRecord } from "./dom-guards";

type ConfirmValue = ConfirmDialogOptions | string;

const pendingConfirmations = new WeakSet<Element>();

export function isDisabledElement(element: Element): boolean {
  return element.matches(":disabled") || element.getAttribute("aria-disabled") === "true";
}

function stringValue(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function toneValue(value: unknown): ConfirmDialogOptions["tone"] | undefined {
  return value === "default" || value === "primary" || value === "warning" || value === "danger"
    ? value
    : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function decodeConfirmValue(value: unknown): ConfirmValue | null {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return null;

  const options: ConfirmDialogOptions = {};
  const title = stringValue(value, "title");
  const message = stringValue(value, "message");
  const tone = toneValue(value.tone);
  const confirmText = stringValue(value, "confirmText", "confirm_text");
  const cancelText = stringValue(value, "cancelText", "cancel_text");
  const closeOnBackdrop = booleanValue(value.closeOnBackdrop ?? value.close_on_backdrop);
  if (title !== undefined) options.title = title;
  if (message !== undefined) options.message = message;
  if (tone !== undefined) options.tone = tone;
  if (confirmText !== undefined) options.confirmText = confirmText;
  if (cancelText !== undefined) options.cancelText = cancelText;
  if (closeOnBackdrop !== undefined) options.closeOnBackdrop = closeOnBackdrop;
  return options;
}

/** Serialize a wire/cell confirmation value as the canonical HTML attribute JSON. */
export function serializeConfirmAttribute(value: unknown): string {
  const decoded = decodeConfirmValue(value);
  if (decoded === null) return "";
  if (typeof decoded === "string") return JSON.stringify(decoded);
  return JSON.stringify({
    title: decoded.title ?? "Confirmation",
    message: decoded.message ?? "",
    tone: decoded.tone ?? "default",
    confirm_text: decoded.confirmText ?? "Confirm",
    cancel_text: decoded.cancelText ?? "Cancel",
    close_on_backdrop: decoded.closeOnBackdrop ?? true,
  });
}

/** Decode the canonical snake_case JSON stored in ``data-cm-confirm``. */
export function parseConfirmAttribute(raw: string | null): ConfirmValue | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return decodeConfirmValue(parsed);
  } catch {
    return null;
  }
}

export function confirmAndInvokeFromElement(
  element: Element,
  invoke: () => void,
  preferredElement: Element | null = null,
): void {
  if (pendingConfirmations.has(element)) return;
  const preferredRaw = preferredElement?.getAttribute("data-cm-confirm") ?? null;
  const preferredConfirm = parseConfirmAttribute(preferredRaw);
  if (preferredRaw !== null && preferredConfirm === null) return;
  const raw = element.getAttribute("data-cm-confirm");
  const confirm = preferredConfirm ?? parseConfirmAttribute(raw);
  if (raw !== null && confirm === null) return;
  if (confirm === null) {
    invoke();
    return;
  }
  pendingConfirmations.add(element);
  void confirmDialog(confirm).then(
    (confirmed) => {
      try {
        if (confirmed) invoke();
      } finally {
        pendingConfirmations.delete(element);
      }
    },
    () => {
      pendingConfirmations.delete(element);
    },
  );
}
