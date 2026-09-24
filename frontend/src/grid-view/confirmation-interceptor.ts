import { isRecord } from "./dom-guards";
import { confirmDialog } from "../runtime/dialog";
import { notify } from "../runtime/notifications";

type ConfirmInterceptor = (message?: string) => Promise<boolean>;
type AlertInterceptor = (message?: string) => void;
type DialogName = "confirm" | "alert";
type HtmxConfirmDetail = {
  question?: string;
  issueRequest: (confirmed?: boolean) => void;
};

let nativeConfirm: ((message?: string) => boolean) | null = null;
let nativeAlert: ((message?: string) => void) | null = null;
let interceptorsBound = false;

function defaultConfirmMessage(message?: string): string {
  return message?.trim() || "Are you sure?";
}

function findDialogDescriptor(name: DialogName): PropertyDescriptor | undefined {
  let owner: object | null = window;
  while (owner) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, name);
    if (descriptor) return descriptor;
    owner = Object.getPrototypeOf(owner);
  }
  return undefined;
}

function defineDialogMethod(
  name: DialogName,
  implementation: ConfirmInterceptor | AlertInterceptor,
): boolean {
  const ownDescriptor = Object.getOwnPropertyDescriptor(window, name);
  const descriptor = ownDescriptor ?? findDialogDescriptor(name);
  if (!descriptor) return false;
  if (ownDescriptor && !ownDescriptor.configurable) {
    if (!("value" in ownDescriptor) || !ownDescriptor.writable) return false;
    try {
      Object.defineProperty(window, name, {
        configurable: false,
        enumerable: ownDescriptor.enumerable,
        value: implementation,
        writable: true,
      });
      return true;
    } catch {
      return false;
    }
  }
  try {
    Object.defineProperty(window, name, {
      configurable: true,
      enumerable: descriptor.enumerable === true,
      value: implementation,
      writable: true,
    });
    return true;
  } catch {
    return false;
  }
}

function fallbackConfirm(message?: string): boolean {
  return nativeConfirm ? nativeConfirm(defaultConfirmMessage(message)) : false;
}

function interceptedConfirm(message?: string): Promise<boolean> {
  const normalizedMessage = defaultConfirmMessage(message);
  try {
    return confirmDialog({ message: normalizedMessage, tone: "danger" }).catch(() => fallbackConfirm(normalizedMessage));
  } catch {
    return Promise.resolve(fallbackConfirm(normalizedMessage));
  }
}

function interceptedAlert(message?: string): void {
  const normalizedMessage = String(message ?? "");
  try {
    notify({ message: normalizedMessage, tone: "error" });
  } catch {
    nativeAlert?.(normalizedMessage);
  }
}

function isHtmxConfirmDetail(value: unknown): value is HtmxConfirmDetail {
  if (!isRecord(value) || typeof value.issueRequest !== "function") return false;
  return value.question === undefined || typeof value.question === "string";
}

export function continueConfirmedLink(link: HTMLAnchorElement): void {
  const target = link.target.trim();
  const reservedTarget = target.toLowerCase();
  if (!target || reservedTarget === "_self") {
    window.location.href = link.href;
    return;
  }
  if (reservedTarget === "_parent" || reservedTarget === "_top") {
    const destination = reservedTarget === "_top" ? window.top : window.parent;
    if (destination) destination.location.href = link.href;
    return;
  }
  if (reservedTarget === "_blank") {
    window.open(link.href, "_blank", "noopener,noreferrer");
    return;
  }
  if (/^[A-Za-z][A-Za-z0-9._:-]*$/.test(target)) {
    window.open(link.href, target, "noopener,noreferrer");
  }
}

function bindHtmxConfirmationBridge(): void {
  document.addEventListener(
    "htmx:confirm",
    (event) => {
      if (!(event instanceof CustomEvent) || !isHtmxConfirmDetail(event.detail)) return;
      event.preventDefault();
      let settled = false;
      const issueRequestOnce = (): void => {
        if (settled) return;
        settled = true;
        event.detail.issueRequest(true);
      };
      const question = defaultConfirmMessage(event.detail.question);
      void confirmDialog({ message: question, tone: "danger" }).then(
        (confirmed) => {
          if (confirmed) issueRequestOnce();
          else settled = true;
        },
        () => {
          settled = true;
        },
      );
    },
    true,
  );
}

function installGlobalDialogInterceptors(): void {
  if (!nativeConfirm) {
    const currentConfirm = window.confirm;
    if (typeof currentConfirm === "function") {
      const originalConfirm = currentConfirm.bind(window);
      if (defineDialogMethod("confirm", interceptedConfirm)) nativeConfirm = originalConfirm;
    }
  }
  if (!nativeAlert) {
    const currentAlert = window.alert;
    if (typeof currentAlert === "function") {
      const originalAlert = currentAlert.bind(window);
      if (defineDialogMethod("alert", interceptedAlert)) nativeAlert = originalAlert;
    }
  }
}

/** Install global dialog adapters and the HTMX confirmation bridge once per document. */
export function installConfirmationInterceptors(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  installGlobalDialogInterceptors();
  if (interceptorsBound) return;
  interceptorsBound = true;
  bindHtmxConfirmationBridge();
}
