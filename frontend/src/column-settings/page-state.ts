/** Renderer-neutral page-state bridge for table column adapters. */

import { PageState } from "../page-state/page-state";
import type { JsonValue, PageStateHandle } from "../page-state/types";
import type { ColumnStateItem, StoredColumnPreset } from "./types";

const WIDTH_PATTERN = /^\d+(?:\.\d+)?(?:px|%|rem|em|vw|vh)?$/i;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export interface PageColumnStore {
  handle: PageStateHandle;
  columnsNamespace: string;
  presetsNamespace: string;
  agGridNamespace: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeKey(key: string): boolean {
  return !FORBIDDEN_KEYS.has(key);
}

/** Accept only JSON-shaped data from legacy localStorage values. */
export function isJsonValue(value: unknown, seen = new WeakSet<object>()): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.every((item) => isJsonValue(item, seen));
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    return Object.entries(value).every(
      ([key, item]) => isSafeKey(key) && isJsonValue(item, seen),
    );
  } finally {
    seen.delete(value);
  }
}

export function isJsonRecord(value: unknown): value is Record<string, JsonValue> {
  return isRecord(value) && isJsonValue(value);
}

function normalizeWidth(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const width = value.trim();
  return width.length <= 32 && WIDTH_PATTERN.test(width) ? width : null;
}

/**
 * Normalize both native AG Grid state and SimpleTable state to the portable
 * column subset. Unknown or malformed entries invalidate the whole value.
 */
export function normalizeColumnState(value: unknown): ColumnStateItem[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const normalized: ColumnStateItem[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.colId !== "string") return null;
    const colId = raw.colId.trim();
    if (!colId || colId.length > 256 || seen.has(colId)) return null;
    seen.add(colId);
    normalized.push({
      colId,
      hide: raw.hide === true,
      pinned: raw.pinned === "left" || raw.pinned === "right" ? raw.pinned : null,
      width: normalizeWidth(raw.width),
    });
  }
  return normalized;
}

/** Decode renderer-neutral persisted columns into the adapter-native shape. */
function normalizePageColumnState(value: unknown): ColumnStateItem[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const normalized: ColumnStateItem[] = [];
  for (const raw of value) {
    if (!isJsonRecord(raw) || typeof raw.id !== "string" || typeof raw.hidden !== "boolean") {
      return null;
    }
    const colId = raw.id.trim();
    if (!colId || colId.length > 256 || seen.has(colId)) return null;
    const pinned = raw.pinned;
    if (pinned !== undefined && pinned !== "left" && pinned !== "right" && pinned !== null) {
      return null;
    }
    const width = raw.width === undefined ? null : normalizeWidth(raw.width);
    if (raw.width !== undefined && width === null) return null;
    seen.add(colId);
    normalized.push({
      colId,
      hide: raw.hidden,
      pinned: pinned === "left" || pinned === "right" ? pinned : null,
      width,
    });
  }
  return normalized;
}

function statesEqual(left: ColumnStateItem[], right: ColumnStateItem[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function pageColumnStoreForRoot(
  root: Element | null | undefined,
  gridId: string,
): PageColumnStore | null {
  const handle = PageState.forRoot(root);
  if (!handle) return null;
  return {
    handle,
    columnsNamespace: `grid.${gridId}.columns`,
    presetsNamespace: `grid.${gridId}.presets`,
    agGridNamespace: `grid.${gridId}.ag_grid`,
  };
}

export function readPageColumns(store: PageColumnStore): ColumnStateItem[] | null {
  return normalizePageColumnState(store.handle.get(store.columnsNamespace));
}

function serializeColumnState(state: ColumnStateItem[]): JsonValue[] {
  return state.map((column) => {
    const serialized: Record<string, JsonValue> = {
      id: column.colId,
      hidden: column.hide,
    };
    if (column.pinned) serialized.pinned = column.pinned;
    if (column.width != null) serialized.width = column.width;
    return serialized;
  });
}

export function putPageColumns(store: PageColumnStore, state: unknown): boolean {
  const normalized = normalizeColumnState(state);
  if (!normalized) return false;
  store.handle.put(store.columnsNamespace, serializeColumnState(normalized));
  const persisted = readPageColumns(store);
  return persisted !== null && statesEqual(persisted, normalized);
}

export function readPageColumnPresets(store: PageColumnStore): Record<string, StoredColumnPreset> {
  const value = store.handle.get(store.presetsNamespace);
  if (!isJsonRecord(value)) return {};
  const presets: Record<string, StoredColumnPreset> = {};
  for (const [name, rawPreset] of Object.entries(value)) {
    if (!isSafeKey(name)) continue;
    const columns = Array.isArray(rawPreset)
      ? normalizePageColumnState(rawPreset)
      : isJsonRecord(rawPreset)
        ? normalizePageColumnState(rawPreset.columns)
        : null;
    if (!columns) continue;
    if (!Array.isArray(rawPreset) && isJsonRecord(rawPreset) && rawPreset.pageState !== undefined) {
      if (!isJsonRecord(rawPreset.pageState)) continue;
      presets[name] = { columns, pageState: rawPreset.pageState };
    } else {
      presets[name] = columns;
    }
  }
  return presets;
}

export function putPageColumnPresets(
  store: PageColumnStore,
  presets: Record<string, StoredColumnPreset>,
): void {
  const serializable: Record<string, JsonValue> = {};
  for (const [name, preset] of Object.entries(presets)) {
    if (!isSafeKey(name)) continue;
    const columns = normalizeColumnState(Array.isArray(preset) ? preset : preset.columns);
    if (!columns) continue;
    const value: Record<string, JsonValue> = { columns: serializeColumnState(columns) };
    if (Array.isArray(preset)) {
      serializable[name] = value.columns;
    } else if (preset.pageState === undefined || isJsonRecord(preset.pageState)) {
      if (preset.pageState !== undefined) value.pageState = preset.pageState;
      serializable[name] = value;
    }
  }
  store.handle.put(store.presetsNamespace, serializable);
}

export function readPageAgGridState(store: PageColumnStore): Record<string, JsonValue> | null {
  const value = store.handle.get(store.agGridNamespace);
  return isJsonRecord(value) ? value : null;
}

export function putPageAgGridState(store: PageColumnStore, state: Record<string, JsonValue>): boolean {
  if (!isJsonRecord(state)) return false;
  store.handle.put(store.agGridNamespace, state);
  return readPageAgGridState(store) !== null;
}
