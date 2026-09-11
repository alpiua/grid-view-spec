import type { JsonValue, PageStateApi, PageStateHandle } from "./types";

const ROOT_SELECTOR = "[data-cm-grid-view-spec]";
const STORAGE_PREFIX = "cmGridViewPageState:v1:";
const VERSION = 1;
const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const INVALID_JSON_VALUE = Symbol("invalid-json-value");

type ValidatedJsonValue = JsonValue | typeof INVALID_JSON_VALUE;

interface StoredPageState {
  version: typeof VERSION;
  namespaces: Record<string, JsonValue>;
}

interface PageStateIdentity {
  storageKey: string;
}

function isSafeKey(key: string): boolean {
  return !FORBIDDEN_OBJECT_KEYS.has(key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNamespace(value: string): boolean {
  return value.length > 0 && isSafeKey(value);
}

function isIdentityPart(value: string, required: boolean): boolean {
  return !required || value.length > 0;
}

function cloneJsonValue(value: unknown, seen = new WeakSet<object>()): ValidatedJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : INVALID_JSON_VALUE;
  if (typeof value !== "object") return INVALID_JSON_VALUE;

  if (seen.has(value)) return INVALID_JSON_VALUE;
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      const result: JsonValue[] = [];
      for (const item of value) {
        const validated = cloneJsonValue(item, seen);
        if (validated === INVALID_JSON_VALUE) return INVALID_JSON_VALUE;
        result.push(validated);
      }
      return result;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return INVALID_JSON_VALUE;

    const result: Record<string, JsonValue> = Object.create(null);
    for (const [key, item] of Object.entries(value)) {
      if (!isSafeKey(key)) return INVALID_JSON_VALUE;
      const validated = cloneJsonValue(item, seen);
      if (validated === INVALID_JSON_VALUE) return INVALID_JSON_VALUE;
      result[key] = validated;
    }
    return result;
  } catch {
    return INVALID_JSON_VALUE;
  } finally {
    seen.delete(value);
  }
}

function emptyState(): StoredPageState {
  return { version: VERSION, namespaces: Object.create(null) };
}

function parseStoredState(raw: string | null): StoredPageState | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const envelope = parsed;
    if (envelope.version !== VERSION) return null;
    const namespaces = envelope.namespaces;
    if (!isRecord(namespaces)) return null;

    const validState = emptyState();
    for (const [namespace, value] of Object.entries(namespaces)) {
      if (!isNamespace(namespace)) return null;
      const validated = cloneJsonValue(value);
      if (validated === INVALID_JSON_VALUE) return null;
      validState.namespaces[namespace] = validated;
    }
    return validState;
  } catch {
    return null;
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readState(storage: Storage, key: string): StoredPageState | null {
  try {
    return parseStoredState(storage.getItem(key));
  } catch {
    return null;
  }
}

function writeState(storage: Storage, key: string, state: StoredPageState): void {
  try {
    storage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage can be unavailable, disabled, or full. Preferences are optional.
  }
}

function removeState(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Storage can be unavailable or disabled. Preferences are optional.
  }
}

function resolveSpecRoot(root: Element): HTMLElement | null {
  if (!root.isConnected) return null;
  const specRoot = root.matches(ROOT_SELECTOR) ? root : root.closest(ROOT_SELECTOR);
  return specRoot instanceof HTMLElement ? specRoot : null;
}

function pageStateIdentity(root: HTMLElement): PageStateIdentity | null {
  const specId = root.getAttribute("data-spec-id") ?? "";
  const scope = root.getAttribute("data-cm-page-state-scope") ?? "";
  if (!isIdentityPart(specId, true) || !isIdentityPart(scope, false)) return null;

  try {
    return {
      storageKey: `${STORAGE_PREFIX}${encodeURIComponent(specId)}:${encodeURIComponent(scope)}`,
    };
  } catch {
    return null;
  }
}

class LocalPageStateHandle implements PageStateHandle {
  constructor(
    private readonly root: HTMLElement,
    private readonly storageKey: string,
  ) {}

  get(namespace: string): JsonValue | undefined {
    if (!this.isLive() || !isNamespace(namespace)) return undefined;
    const storage = browserStorage();
    const stored = storage ? readState(storage, this.storageKey) : null;
    const value = stored?.namespaces[namespace];
    if (value === undefined) return undefined;

    const cloned = cloneJsonValue(value);
    return cloned === INVALID_JSON_VALUE ? undefined : cloned;
  }

  put(namespace: string, value: JsonValue): void {
    if (!this.isLive() || !isNamespace(namespace)) return;
    const validated = cloneJsonValue(value);
    if (validated === INVALID_JSON_VALUE) return;

    const storage = browserStorage();
    if (!storage) return;
    const state = readState(storage, this.storageKey) ?? emptyState();
    state.namespaces[namespace] = validated;
    writeState(storage, this.storageKey, state);
  }

  remove(namespace: string): void {
    if (!this.isLive() || !isNamespace(namespace)) return;
    const storage = browserStorage();
    if (!storage) return;

    const state = readState(storage, this.storageKey);
    if (!state) {
      removeState(storage, this.storageKey);
      return;
    }
    if (!(namespace in state.namespaces)) return;

    delete state.namespaces[namespace];
    if (Object.keys(state.namespaces).length === 0) {
      removeState(storage, this.storageKey);
      return;
    }
    writeState(storage, this.storageKey, state);
  }

  private isLive(): boolean {
    return this.root.isConnected;
  }
}

/** Renderer-neutral browser persistence for one rendered GridViewSpec root. */
export const PageState: PageStateApi = {
  forRoot(root): PageStateHandle | null {
    if (typeof Element === "undefined" || !(root instanceof Element)) return null;
    const specRoot = resolveSpecRoot(root);
    if (!specRoot) return null;
    const identity = pageStateIdentity(specRoot);
    return identity ? new LocalPageStateHandle(specRoot, identity.storageKey) : null;
  },
};
