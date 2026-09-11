/** AG Grid adapter for renderer-neutral GridViewSpec page state. */

import {
  isJsonRecord,
  legacyScopedKey,
  mergeLegacyWidths,
  normalizeColumnState,
  pageColumnStoreForRoot,
  putPageAgGridState,
  putPageColumns,
  readLegacyJson,
  readPageAgGridState,
  readPageColumns,
  removeLegacyKeys,
  type PageColumnStore,
} from "../column-settings/page-state";
import type { JsonValue } from "../page-state/types";
import type {
  AgGridColumnSizingState,
  AgGridInitialState,
  AgGridSortState,
  ColumnStateItem,
  PersistedGridState,
} from "./types";

interface SortCandidate {
  colId: string;
  sort: "asc" | "desc";
  sortIndex: number | null;
  position: number;
}

function sortStateFromModel(value: unknown): AgGridSortState | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const sortModel: AgGridSortState["sortModel"] = [];
  for (const raw of value) {
    if (!isJsonRecord(raw) || typeof raw.colId !== "string") return undefined;
    const colId = raw.colId.trim();
    if (!colId || seen.has(colId) || (raw.sort !== "asc" && raw.sort !== "desc")) {
      return undefined;
    }
    seen.add(colId);
    sortModel.push({ colId, sort: raw.sort });
  }
  return { sortModel };
}

/** Extract legacy AG Grid sort embedded in its raw getColumnState() output. */
function sortStateFromColumnState(value: unknown): AgGridSortState | undefined {
  if (!Array.isArray(value) || !normalizeColumnState(value)) return undefined;
  const seen = new Set<string>();
  const candidates: SortCandidate[] = [];
  value.forEach((raw, position) => {
    if (!isJsonRecord(raw) || typeof raw.colId !== "string") return;
    const colId = raw.colId.trim();
    if (!colId || seen.has(colId) || (raw.sort !== "asc" && raw.sort !== "desc")) return;
    seen.add(colId);
    candidates.push({
      colId,
      sort: raw.sort,
      sortIndex:
        typeof raw.sortIndex === "number" &&
        Number.isInteger(raw.sortIndex) &&
        raw.sortIndex >= 0
          ? raw.sortIndex
          : null,
      position,
    });
  });
  candidates.sort((left, right) => {
    const leftIndex = left.sortIndex ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = right.sortIndex ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex || left.position - right.position;
  });
  return {
    sortModel: candidates.map(({ colId, sort }) => ({ colId, sort })),
  };
}

function columnSizingStateFromModel(value: unknown): AgGridColumnSizingState | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const columnSizingModel: AgGridColumnSizingState["columnSizingModel"] = [];
  for (const raw of value) {
    if (!isJsonRecord(raw) || typeof raw.colId !== "string") return undefined;
    const colId = raw.colId.trim();
    if (
      !colId ||
      seen.has(colId) ||
      typeof raw.flex !== "number" ||
      !Number.isFinite(raw.flex) ||
      raw.flex <= 0
    ) {
      return undefined;
    }
    seen.add(colId);
    columnSizingModel.push({ colId, flex: raw.flex });
  }
  return columnSizingModel.length ? { columnSizingModel } : undefined;
}

/** Extract AG-only flex sizing from legacy raw getColumnState() output. */
function columnSizingStateFromColumnState(value: unknown): AgGridColumnSizingState | undefined {
  if (!Array.isArray(value) || !normalizeColumnState(value)) return undefined;
  const seen = new Set<string>();
  const columnSizingModel: AgGridColumnSizingState["columnSizingModel"] = [];
  for (const raw of value) {
    if (!isJsonRecord(raw) || typeof raw.colId !== "string") continue;
    const colId = raw.colId.trim();
    if (
      !colId ||
      seen.has(colId) ||
      typeof raw.flex !== "number" ||
      !Number.isFinite(raw.flex) ||
      raw.flex <= 0
    ) {
      continue;
    }
    seen.add(colId);
    columnSizingModel.push({ colId, flex: raw.flex });
  }
  return columnSizingModel.length ? { columnSizingModel } : undefined;
}

export interface AgGridPageStateAdapter {
  store: PageColumnStore;
  initialState: AgGridInitialState | null;
  read: () => PersistedGridState;
  save: (state: PersistedGridState) => void;
  clear: () => void;
}

function stateFromRecord(value: Record<string, JsonValue>): PersistedGridState {
  const filterState = isJsonRecord(value.filterState) ? value.filterState : undefined;
  const pageState = isJsonRecord(value.pageState) ? value.pageState : undefined;
  return {
    colState: normalizeColumnState(value.colState) ?? undefined,
    filterState,
    quickFilter: typeof value.quickFilter === "string" ? value.quickFilter : undefined,
    pageState,
    sort:
      sortStateFromModel(isJsonRecord(value.sort) ? value.sort.sortModel : undefined) ??
      sortStateFromColumnState(value.colState),
    columnSizing:
      columnSizingStateFromModel(
        isJsonRecord(value.columnSizing) ? value.columnSizing.columnSizingModel : undefined,
      ) ?? columnSizingStateFromColumnState(value.colState),
  };
}

function agOnlyState(state: PersistedGridState): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {};
  if (state.filterState && isJsonRecord(state.filterState)) result.filterState = state.filterState;
  if (typeof state.quickFilter === "string") result.quickFilter = state.quickFilter;
  if (state.pageState && isJsonRecord(state.pageState)) result.pageState = state.pageState;
  const sort = state.sort ?? sortStateFromColumnState(state.colState);
  if (sort) {
    result.sort = {
      sortModel: sort.sortModel.map(({ colId, sort: direction }) => ({
        colId,
        sort: direction,
      })),
    };
  }
  const columnSizing = state.columnSizing ?? columnSizingStateFromColumnState(state.colState);
  const flexColumns = (columnSizing?.columnSizingModel ?? []).filter(
    (item): item is { colId: string; flex: number } => typeof item.flex === "number",
  );
  if (flexColumns.length) {
    result.columnSizing = {
      columnSizingModel: flexColumns.map(({ colId, flex }) => ({
        colId,
        flex,
      })),
    };
  }
  return result;
}

function numericWidth(value: ColumnStateItem["width"]): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/i);
  if (!match) return null;
  const width = Number(match[1]);
  return Number.isFinite(width) && width > 0 ? width : null;
}

function initialStateForColumns(columns: ColumnStateItem[]): AgGridInitialState {
  return {
    columnOrder: { orderedColIds: columns.map((column) => column.colId) },
    columnVisibility: {
      hiddenColIds: columns.filter((column) => column.hide).map((column) => column.colId),
    },
    columnPinning: {
      leftColIds: columns
        .filter((column) => column.pinned === "left")
        .map((column) => column.colId),
      rightColIds: columns
        .filter((column) => column.pinned === "right")
        .map((column) => column.colId),
    },
    columnSizing: {
      columnSizingModel: columns
        .map((column) => {
          const width = numericWidth(column.width);
          return width === null ? null : { colId: column.colId, width };
        })
        .filter((column): column is { colId: string; width: number } => column !== null),
    },
  };
}

/** Overlay AG-only flex on portable width sizing without widening the latter. */
function withFlexSizing(
  initialState: AgGridInitialState,
  flexSizing: AgGridColumnSizingState | undefined,
): AgGridInitialState {
  if (!flexSizing?.columnSizingModel.length) return initialState;
  const sizingModel = (initialState.columnSizing?.columnSizingModel ?? []).map((item) => ({
    ...item,
  }));
  const sizingIndex = new Map(sizingModel.map((item, index) => [item.colId, index]));
  flexSizing.columnSizingModel.forEach(({ colId, flex }) => {
    const index = sizingIndex.get(colId);
    if (index === undefined) {
      sizingIndex.set(colId, sizingModel.length);
      sizingModel.push({ colId, flex });
      return;
    }
    sizingModel[index] = { ...sizingModel[index], flex };
  });
  return {
    ...initialState,
    columnSizing: { columnSizingModel: sizingModel },
  };
}

export function legacyAgGridStateKey(gridId: string, scope: string): string {
  return legacyScopedKey("agGridState_", gridId, scope);
}

export function legacyColumnStateKey(gridId: string, scope: string): string {
  return legacyScopedKey("cmColState_", gridId, scope);
}

export function readLegacyAgGridState(gridId: string, scope: string): PersistedGridState {
  const stored = readLegacyJson(legacyAgGridStateKey(gridId, scope));
  return isJsonRecord(stored) ? stateFromRecord(stored) : {};
}

/**
 * Migrate one exact legacy grid key set once, then supply native initial state
 * before AG Grid creates DOM so restored columns do not visibly reflow.
 */
export function prepareAgGridPageState(
  root: Element,
  gridId: string,
  legacyScope: string,
  configuredInitialState: AgGridInitialState | undefined,
): AgGridPageStateAdapter | null {
  const store = pageColumnStoreForRoot(root, gridId);
  if (!store) return null;

  const agKey = legacyAgGridStateKey(gridId, legacyScope);
  const columnKey = legacyColumnStateKey(gridId, legacyScope);
  const widthKey = "cmColWidths_" + gridId;
  let columns = readPageColumns(store);
  const legacyAgRaw = readLegacyJson(agKey);
  const hasLegacyAgState = isJsonRecord(legacyAgRaw);
  const legacyAgState = hasLegacyAgState ? stateFromRecord(legacyAgRaw) : {};
  const legacyColumns = normalizeColumnState(readLegacyJson(columnKey));
  const legacyWidths = readLegacyJson(widthKey);
  let persistedColumns = columns !== null;

  if (!columns) {
    const source = legacyAgState.colState ?? legacyColumns;
    if (source) {
      const migrated = mergeLegacyWidths(source, legacyWidths);
      if (putPageColumns(store, migrated)) {
        columns = readPageColumns(store) ?? migrated;
        persistedColumns = true;
        if (!legacyAgState.colState) removeLegacyKeys([columnKey, widthKey]);
      } else {
        columns = migrated;
      }
    }
  }
  if (persistedColumns && legacyColumns) removeLegacyKeys([columnKey, widthKey]);

  let storedAgState = readPageAgGridState(store);
  let persistedAgState = storedAgState !== null;
  if (!persistedAgState) {
    const migratedAgState = agOnlyState(legacyAgState);
    if (!Object.keys(migratedAgState).length) {
      persistedAgState = true;
    } else if (putPageAgGridState(store, migratedAgState)) {
      persistedAgState = true;
      storedAgState = readPageAgGridState(store);
    }
  }
  const legacyColumnsHandled = legacyAgState.colState === undefined || persistedColumns;
  if (hasLegacyAgState && legacyColumnsHandled && persistedAgState) {
    removeLegacyKeys([agKey]);
    if (legacyAgState.colState !== undefined) removeLegacyKeys([widthKey]);
  }

  const initialAgState = storedAgState ? stateFromRecord(storedAgState) : legacyAgState;
  const hasRestoredInitialState =
    columns !== null ||
    initialAgState.sort !== undefined ||
    initialAgState.columnSizing !== undefined;
  const nativeInitialState = withFlexSizing(
    {
      ...(configuredInitialState ?? {}),
      ...(columns ? initialStateForColumns(columns) : {}),
      ...(initialAgState.sort ? { sort: initialAgState.sort } : {}),
    },
    initialAgState.columnSizing,
  );

  return {
    store,
    initialState: hasRestoredInitialState ? nativeInitialState : null,
    read: () => {
      const stored = readPageAgGridState(store);
      return stored ? stateFromRecord(stored) : {};
    },
    save: (state) => {
      if (state.colState) putPageColumns(store, state.colState);
      const agState = agOnlyState(state);
      if (Object.keys(agState).length) putPageAgGridState(store, agState);
      else store.handle.remove(store.agGridNamespace);
    },
    clear: () => store.handle.remove(store.agGridNamespace),
  };
}
