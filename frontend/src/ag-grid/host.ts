import type { ColumnMetaInput, StoredColumnPreset } from "../column-settings/types";
import { isJsonRecord } from "../column-settings/page-state";
import {
  legacyAgGridStateKey,
  prepareAgGridPageState,
  readLegacyAgGridState,
  type AgGridPageStateAdapter,
} from "./page-state";
import {
  gridViewT,
  isInfiniteRowModel,
  readSearchInputTrimmed,
  readSearchInputValue,
  writeSearchInputValue,
  type AgGridColumnDef,
  type AgGridColumnSizingState,
  type AgGridContextHooks,
  type AgGridHostApi,
  type AgGridHostGridOptions,
  type AgGridSortState,
  type ColSettingsMethod,
  type ColumnStateItem,
  type ColumnSettingsHandle,
  type LoadStateOptions,
  type PersistedGridState,
  type UrlGridParams,
} from "./types";
import type { GridHandle } from "../grid-view/types";
import { toolbarSearchScopeForTable } from "../grid-view/toolbar-search-input";

function isColumnSettingsHandle(value: unknown): value is ColumnSettingsHandle {
  if (!value || typeof value !== "object") return false;
  const handle = value as ColumnSettingsHandle;
  return typeof handle.renderSavedPresets === "function";
}

function isAgGridHostApi(value: unknown): value is AgGridHostApi {
  if (!value || typeof value !== "object") return false;
  const api = value as AgGridHostApi;
  return (
    typeof api.getFilterModel === "function" &&
    typeof api.addEventListener === "function"
  );
}

type SortableColumnStateItem = ColumnStateItem & {
  flex?: number | null;
  sort?: "asc" | "desc" | null;
  sortIndex?: number | null;
};

/** Reconstruct legacy AG-only state for non-spec hosts. */
function withAgGridState(
  columns: ColumnStateItem[],
  sort: AgGridSortState | undefined,
  columnSizing: AgGridColumnSizingState | undefined,
): ColumnStateItem[] {
  const sortIndexById = new Map(
    sort?.sortModel.map(({ colId, sort }, index) => [colId, { sort, index }]),
  );
  const flexById = new Map(
    columnSizing?.columnSizingModel.map(({ colId, flex }) => [colId, flex]),
  );
  return columns.map((column) => {
    const entry = sortIndexById.get(column.colId);
    const sortable: SortableColumnStateItem = {
      ...column,
      flex: flexById.get(column.colId) ?? null,
      sort: entry?.sort ?? null,
      sortIndex: entry?.index ?? null,
    };
    return sortable;
  });
}

export class AgGridHost implements GridHandle {
  gridId: string;
  containerId: string;
  gridOptions: AgGridHostGridOptions;
  savedColPresets: Record<string, StoredColumnPreset>;
  savedQuickSearches: string[];
  groupsOrder: string[];
  gridApi?: AgGridHostApi;
  _colSettings: ColumnSettingsHandle | null;
  _searchText: string;
  _columnMeta: Record<string, Partial<ColumnMetaInput>>;
  _pageStateAdapter: AgGridPageStateAdapter | null;
  _storageSyncBound: boolean;
  _deferredColStateScheduled: boolean;

  constructor(
    gridId: string,
    containerId: string,
    optionsVar: AgGridHostGridOptions | null | undefined,
    initialPresets: Record<string, StoredColumnPreset> | null | undefined,
    initialSearches: string[] | null | undefined,
    groupsOrder: string[] | null | undefined
  ) {
    this.gridId = gridId;
    this.containerId = containerId;
    this.gridOptions = optionsVar ?? {};

    if (!this.gridOptions.overlayLoadingTemplate) {
      this.gridOptions.overlayLoadingTemplate =
        '<div class="flex flex-col items-center justify-center p-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-2"></div><span class="text-sm text-gray-500 dark:text-gray-400">' +
        gridViewT("grid.loading", "Loading…") +
        "</span></div>";
    }
    if (!this.gridOptions.overlayNoRowsTemplate) {
      this.gridOptions.overlayNoRowsTemplate =
        '<div class="flex flex-col items-center justify-center p-6 text-gray-500 dark:text-gray-400"><svg class="w-10 h-10 mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg><span class="text-base font-medium">' +
        gridViewT("grid.no_rows", "No records") +
        "</span></div>";
    }

    if (!this.gridOptions.defaultColDef) {
      this.gridOptions.defaultColDef = {};
    }

    this.gridOptions.enableBrowserTooltips = false;
    this.gridOptions.tooltipShowDelay = 0;

    if (this.gridOptions.columnDefs) {
      this.gridOptions.columnDefs.forEach((col) => {
        if (col.field && !col.tooltipField && !col.tooltipValueGetter) {
          col.tooltipField = col.field;
        }
      });
    }
    this.savedColPresets = initialPresets ?? {};
    this.savedQuickSearches = initialSearches ?? [];
    this.groupsOrder = groupsOrder ?? [];
    this.gridApi = undefined;
    this._colSettings = null;
    this._searchText = "";
    this._columnMeta = {};
    this._pageStateAdapter = null;
    this._storageSyncBound = false;
    this._deferredColStateScheduled = false;

    if (window.GridView?.byId) {
      window.GridView.byId.register(this.gridId, this);
    }
  }

  _syncColPresetsFromSettings(): void {
    if (this._colSettings) {
      this.savedColPresets = this._colSettings.savedColPresets;
    }
  }

  _colOp(method: ColSettingsMethod): void {
    this._initColSettings();
    const settings = this._colSettings;
    if (!settings) return;
    settings[method]();
    this._syncColPresetsFromSettings();
  }

  _extractColumnMeta(): void {
    this._columnMeta = {};
    const defs = this.gridOptions.columnDefs;
    if (!defs) return;

    const walk = (list: AgGridColumnDef[]): void => {
      list.forEach((col) => {
        if (col.children) {
          walk(col.children);
          return;
        }
        const id = col.field || col.colId;
        if (!id) return;
        const grp =
          col.menuGroup ||
          col.contextGroup ||
          col.cellRendererParams?.menuGroup;
        if (grp) {
          this._columnMeta[id] = { menuGroup: grp };
        }
      });
    };
    walk(defs);
  }

  _getContextHooks(): AgGridContextHooks {
    return this.gridOptions.context ?? {};
  }

  _resolveSearchInput(): HTMLInputElement | null {
    const resolver = window.GridView?.AgGrid?.resolveToolbarSearchInput;
    if (typeof resolver === "function") {
      return resolver(this.gridId);
    }
    const legacy = document.getElementById("ag-quick-filter-" + this.gridId);
    return legacy instanceof HTMLInputElement ? legacy : null;
  }

  _collectPageState(): Record<string, unknown> {
    const ctx = this._getContextHooks();
    if (typeof ctx.getPageState === "function") {
      try {
        return ctx.getPageState() ?? {};
      } catch (e) {
        console.error("getPageState failed:", e);
      }
    }
    return {};
  }

  _applyPageState(pageState: Record<string, unknown>, options: Record<string, unknown>): void {
    const ctx = this._getContextHooks();
    if (typeof ctx.applyPageState === "function" && Object.keys(pageState).length) {
      try {
        ctx.applyPageState(pageState, options);
      } catch (e) {
        console.error("applyPageState failed:", e);
      }
    }
  }

  _readUrlGridParams(): UrlGridParams {
    const params = new URLSearchParams(window.location.search);
    const out: UrlGridParams = {};
    if (params.has("q")) {
      out.hasQ = true;
      out.q = params.get("q") ?? "";
    }
    if (params.has("filters")) {
      out.hasFilterState = true;
      const filters = params.get("filters");
      try {
        const parsed: unknown = JSON.parse(filters || "null");
        if (isJsonRecord(parsed)) out.filterState = parsed;
      } catch (_e) {
        /* ignore malformed URL filter payload */
      }
    }
    return out;
  }

  _pageStateFromUrl(): Record<string, string | string[]> {
    const ctx = this._getContextHooks();
    const keys = ctx.urlPageStateKeys;
    if (!Array.isArray(keys) || !keys.length) return {};
    const params = new URLSearchParams(window.location.search);
    const pageState: Record<string, string | string[]> = {};
    keys.forEach((key) => {
      if (!params.has(key)) return;
      const raw = params.get(key) ?? "";
      pageState[key] =
        raw.indexOf(",") >= 0
          ? raw
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : raw;
    });
    return pageState;
  }

  syncBrowserUrl(): void {
    const ctx = this._getContextHooks();
    const api = this.gridApi;
    if (ctx.syncUrlState === false || !api) return;
    const url = new URL(window.location.href);
    const qfEl = this._resolveSearchInput();
    const q = qfEl ? readSearchInputTrimmed(qfEl) : this._searchText;
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");

    const filterModel = api.getFilterModel() ?? {};
    if (Object.keys(filterModel).length) {
      url.searchParams.set("filters", JSON.stringify(filterModel));
    } else {
      url.searchParams.delete("filters");
    }

    const pageState = this._collectPageState();
    const urlKeys = Array.isArray(ctx.urlPageStateKeys)
      ? ctx.urlPageStateKeys
      : Object.keys(pageState);
    urlKeys.forEach((key) => {
      const val = pageState[key];
      if (val == null || val === "" || (Array.isArray(val) && !val.length)) {
        url.searchParams.delete(key);
        return;
      }
      if (Array.isArray(val)) url.searchParams.set(key, val.join(","));
      else url.searchParams.set(key, String(val));
    });

    const next = url.pathname + url.search;
    const current = window.location.pathname + window.location.search;
    if (next !== current) {
      window.history.replaceState(null, "", next);
    }
  }

  _bindStorageSync(): void {
    if (this._pageStateAdapter) return;
    if (this._storageSyncBound) return;
    this._storageSyncBound = true;
    window.addEventListener("storage", (event) => {
      if (event.key !== this._storageKey() || !event.newValue || !this.gridApi) return;
      this.loadState({ reloadInfinite: true, fromStorageEvent: true });
    });
  }

  _storageKey(): string {
    return legacyAgGridStateKey(this.gridId, this._legacyStorageScope());
  }

  _legacyStorageScope(): string {
    const ctx = this.gridOptions.context ?? {};
    return ctx.legacyStorageScope ?? ctx.storageScope ?? "";
  }

  _readLegacyGridState(): PersistedGridState {
    return readLegacyAgGridState(this.gridId, this._legacyStorageScope());
  }

  _readStoredGridState(): PersistedGridState {
    return this._pageStateAdapter?.read() ?? this._readLegacyGridState();
  }

  _preparePageState(gridDiv: HTMLElement): void {
    this._pageStateAdapter = prepareAgGridPageState(
      gridDiv,
      this.gridId,
      this._legacyStorageScope(),
      this.gridOptions.initialState,
    );
    if (this._pageStateAdapter?.initialState) {
      this.gridOptions.initialState = this._pageStateAdapter.initialState;
    }
  }

  _gridColumnsReady(): boolean {
    const api = this.gridApi;
    if (!api) return false;
    const columns = api.getColumns();
    return columns.length > 0;
  }

  _scheduleDeferredColumnState(): void {
    const api = this.gridApi;
    if (this._deferredColStateScheduled || !api) return;
    const state = this._readLegacyGridState();
    if (!state.colState) return;

    this._deferredColStateScheduled = true;
    const tryApply = (): boolean => {
      if (!this.gridApi || !this._gridColumnsReady()) return false;
      this.loadState({ deferColumnState: false });
      return true;
    };
    if (tryApply()) return;

    const onColumnsChanged = (): void => {
      if (tryApply() && this.gridApi) {
        this.gridApi.removeEventListener("columnEverythingChanged", onColumnsChanged);
      }
    };
    api.addEventListener("columnEverythingChanged", onColumnsChanged);
  }

  initGrid(): void {
    const gridDiv = document.getElementById(this.containerId);
    if (!gridDiv) return;

    const applyTheme = (): void => {
      const dark = document.documentElement.classList.contains("dark");
      if (dark) {
        gridDiv.classList.add("ag-theme-quartz-dark");
        gridDiv.classList.remove("ag-theme-quartz");
      } else {
        gridDiv.classList.add("ag-theme-quartz");
        gridDiv.classList.remove("ag-theme-quartz-dark");
      }
    };
    applyTheme();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") applyTheme();
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    this._extractColumnMeta();
    this._colSettings = null;
    this._preparePageState(gridDiv);

    const agGridLib = window.agGrid;
    if (!agGridLib) throw new Error("AG Grid is not loaded");
    const created = agGridLib.createGrid(gridDiv, this.gridOptions);
    if (!isAgGridHostApi(created)) {
      throw new Error("AG Grid createGrid returned an invalid API");
    }
    this.gridApi = created;
    this.loadState({ deferColumnState: !this._pageStateAdapter });
    if (!this._pageStateAdapter) this._scheduleDeferredColumnState();

    window.setTimeout(() => {
      gridDiv.classList.add("cm-ag-grid-root--ready");
    }, 50);

    this.gridApi.addEventListener("sortChanged", () => {
      this.saveGridState();
    });

    this.gridApi.addEventListener("columnMoved", () => {
      this.saveGridState();
    });

    this.gridApi.addEventListener("columnResized", (params?: unknown) => {
      const payload = params as { finished?: boolean } | undefined;
      if (payload?.finished) this.saveGridState();
    });

    this.gridApi.addEventListener("filterChanged", () => {
      this.saveGridState();
      this.syncFilterChrome();
      const ctx = this._getContextHooks();
      if (typeof ctx.onFilterChanged === "function") {
        ctx.onFilterChanged(this);
      }
    });

    this.gridApi.addEventListener("modelUpdated", () => {
      const countEl = document.getElementById("grid-row-count-" + this.gridId);
      if (countEl && this.gridApi) {
        countEl.textContent =
          gridViewT("grid.records_label", "Records:") +
          " " +
          this.gridApi.getDisplayedRowCount();
      }
    });

    const toolbarScopeId = toolbarSearchScopeForTable(this.gridId) ?? this.gridId;
    window.GridView?.ToolbarSearch?.mount(toolbarScopeId, this.savedQuickSearches);
    this._initColSettings();
    this.renderSavedPresets();
    this._bindStorageSync();
    this.syncFilterChrome();
  }

  loadState(options: LoadStateOptions = {}): void {
    const api = this.gridApi;
    if (!api) return;

    const state = this._readStoredGridState();

    const urlParams = this._readUrlGridParams();
    const urlPageState = this._pageStateFromUrl();
    const hasColumns = this._gridColumnsReady();

    if (state.colState && hasColumns && !options.deferColumnState && !this._pageStateAdapter) {
      api.applyColumnState({
        state: withAgGridState(state.colState, state.sort, state.columnSizing),
        applyOrder: true,
      });
    }

    const filterState = urlParams.hasFilterState ? urlParams.filterState : state.filterState;
    api.setFilterModel(filterState ?? null);

    const qsInput = this._resolveSearchInput();
    if (urlParams.hasQ) {
      const urlQ = urlParams.q ?? "";
      writeSearchInputValue(qsInput, urlQ);
      this._searchText = urlQ;
    } else if (typeof state.quickFilter === "string") {
      writeSearchInputValue(qsInput, state.quickFilter);
      this._searchText = state.quickFilter;
    }

    const pageState = Object.keys(urlPageState).length
      ? { ...(state.pageState ?? {}), ...urlPageState }
      : state.pageState ?? {};
    this._applyPageState(pageState, {
      fromUrl: Object.keys(urlPageState).length > 0,
      fromStorageEvent: !!options.fromStorageEvent,
    });

    if (options.reloadInfinite && isInfiniteRowModel(api)) {
      api.purgeInfiniteCache();
    }
    if (options.fromStorageEvent) {
      this.syncBrowserUrl();
    }
  }

  reapplyPersistedState(): void {
    if (!this.gridApi) return;
    this.loadState({ reloadInfinite: true });
  }

  saveGridState(): void {
    const api = this.gridApi;
    if (!api) return;
    const qfEl = this._resolveSearchInput();
    const state: PersistedGridState = {
      colState: api.getColumnState(),
      filterState: api.getFilterModel(),
      quickFilter: readSearchInputValue(qfEl),
      pageState: this._collectPageState(),
    };
    if (this._pageStateAdapter) {
      this._pageStateAdapter.save(state);
    } else {
      try {
        localStorage.setItem(this._storageKey(), JSON.stringify(state));
      } catch {
        // Browser preferences remain optional when storage is unavailable.
      }
    }
    this.syncBrowserUrl();
    document.dispatchEvent(new CustomEvent("cm-grid-state-change", { detail: { gridId: this.gridId } }));
  }

  _initColSettings(): void {
    if (this._colSettings) return;
    const api = this.gridApi;
    const gridView = window.GridView;
    if (!api || !gridView?.createColumnSettings || !gridView.createAgGridColumnAdapter) return;
    const ctx = this._getContextHooks();
    const preferencesUrl = gridView.preferencesUrl ?? "";
    const created = gridView.createColumnSettings(
      this.gridId,
      gridView.createAgGridColumnAdapter(api, this._columnMeta),
      {
        groupsOrder: this.groupsOrder,
        initialPresets: this.savedColPresets,
        preferencesUrl,
        legacyStorageScope: ctx.legacyStorageScope ?? ctx.storageScope ?? "",
        pageStateRoot: document.getElementById(this.containerId),
        initialState: api.getColumnState(),
        persistLocalState: false,
        onStateChange: () => {
          this.saveGridState();
        },
      }
    );
    if (!isColumnSettingsHandle(created)) return;
    this._colSettings = created;

    document
      .querySelectorAll('[data-cm-export-sync][data-cm-grid-id="' + this.gridId + '"]')
      .forEach((link) => {
        if (!(link instanceof HTMLElement)) return;
        if (link.dataset.cmExportClickBound) return;
        link.dataset.cmExportClickBound = "1";
        link.addEventListener("click", () => {
          this._colSettings?.syncExportLinks();
        });
      });
  }

  toggleColSelector(): void {
    this._colOp("toggleColSelector");
  }
  openColSelectorModal(): void {
    this._colOp("openColSelectorModal");
  }
  closeColSelectorModal(): void {
    this._colOp("closeColSelectorModal");
  }
  resetColumnsToDefault(): void {
    this._colOp("resetColumnsToDefault");
  }
  buildColCheckboxes(): void {
    this._colOp("buildColCheckboxes");
  }
  buildColOrderList(): void {
    this._colOp("buildColOrderList");
  }

  renderSavedPresets(): void {
    this._initColSettings();
    const settings = this._colSettings;
    if (!settings) return;
    settings.savedColPresets = this.savedColPresets;
    settings.renderSavedPresets();
  }

  saveCurrentPreset(): void {
    this._colOp("saveCurrentPreset");
  }

  saveColPresetsToServer(): void {
    this._initColSettings();
    const settings = this._colSettings;
    if (!settings) return;
    settings.savedColPresets = this.savedColPresets;
    settings.saveColPresetsToServer();
    this._syncColPresetsFromSettings();
  }

  syncSearchToolbarUi(): void {
    const el = this._resolveSearchInput();
    const wrap = el?.closest("[data-cm-toolbar-search-root]");
    if (!wrap) return;
    const val = readSearchInputTrimmed(el);
    const clearBtn = wrap.querySelector(".cm-toolbar-search-clear");
    if (clearBtn) clearBtn.classList.toggle("is-visible", val.length > 0);
    const saveBtn = wrap.querySelector(
      '.cm-toolbar-search-action--save, [data-cm-grid-action="saveSearch"]'
    );
    if (saveBtn) {
      saveBtn.classList.toggle("is-active", !!(val && this.savedQuickSearches.includes(val)));
    }
  }

  reloadData(): void {
    const api = this.gridApi;
    if (!api) return;
    const el = this._resolveSearchInput();
    this._searchText = readSearchInputTrimmed(el);
    this.syncFilterChrome();
    this.saveGridState();
    if (isInfiniteRowModel(api)) {
      api.purgeInfiniteCache();
    }
    const ctx = this._getContextHooks();
    if (typeof ctx.onDataReload === "function") {
      ctx.onDataReload(this);
    } else if (typeof window.GridView?.AgGrid?.syncExportLinks === "function") {
      window.GridView.AgGrid.syncExportLinks(this.gridId);
    }
  }

  onQuickFilterChanged(): void {
    if (!this.gridApi) return;
    const el = this._resolveSearchInput();
    this._searchText = readSearchInputValue(el);
    this.reloadData();
  }

  clearSearch(): void {
    const el = this._resolveSearchInput();
    const wasEmpty = !el || readSearchInputTrimmed(el) === "";
    writeSearchInputValue(el, "");
    this._searchText = "";
    const url = new URL(window.location.href);
    if (url.searchParams.has("q")) {
      url.searchParams.delete("q");
      window.history.replaceState({}, "", url);
    }
    if (wasEmpty && this.gridApi) {
      this.gridApi.setFilterModel(null);
    }
    this.syncSearchToolbarUi();
    this.reloadData();
  }

  setRowData(data: unknown): void {
    this.gridApi?.setGridOption("rowData", data);
  }

  showLoading(): void {
    this.gridApi?.showLoadingOverlay();
  }

  hideOverlay(): void {
    this.gridApi?.hideOverlay();
  }

  setQuickFilter(text: string): void {
    const api = this.gridApi;
    if (!api) return;
    const input = this._resolveSearchInput();
    writeSearchInputValue(input, text);
    this._searchText = text;
    this.syncSearchToolbarUi();
    this.saveGridState();
    if (isInfiniteRowModel(api)) {
      api.purgeInfiniteCache();
    }
  }

  clearAllFilters(): void {
    const api = this.gridApi;
    if (!api) return;
    api.setFilterModel(null);
    writeSearchInputValue(this._resolveSearchInput(), "");
    this._searchText = "";

    const url = new URL(window.location.href);
    ["q", "filters", "col_q"].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState({}, "", url);
    if (this._pageStateAdapter) {
      this._pageStateAdapter.clear();
    } else {
      try {
        localStorage.removeItem(this._storageKey());
      } catch {
        // Browser preferences remain optional when storage is unavailable.
      }
    }
    this.syncSearchToolbarUi();
    document.dispatchEvent(new CustomEvent("cm-grid-state-change", { detail: { gridId: this.gridId } }));
    if (isInfiniteRowModel(api)) {
      api.purgeInfiniteCache();
    }
  }

  hasActiveFilters(): boolean {
    const el = this._resolveSearchInput();
    if (el && readSearchInputTrimmed(el)) return true;
    if (this._searchText.trim()) return true;
    const model = this.gridApi?.getFilterModel() ?? {};
    if (Object.keys(model).length) return true;
    const params = new URLSearchParams(window.location.search);
    if (params.has("q") || params.has("filters")) return true;
    return false;
  }

  syncFilterChrome(): void {
    this.syncSearchToolbarUi();
    const active = this.hasActiveFilters();
    const esc =
      typeof CSS !== "undefined" && CSS.escape
        ? CSS.escape(this.gridId)
        : this.gridId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    document
      .querySelectorAll<HTMLElement>(
        '[data-cm-grid-action="clearAllFilters"][data-cm-grid-id="' + esc + '"]'
      )
      .forEach((btn) => btn.classList.toggle("is-hidden", !active));
  }

  applyUrlSearchFilter(): void {
    const queryQ = new URLSearchParams(window.location.search).get("q");
    if (queryQ && this._searchText !== queryQ) {
      this.setQuickFilter(queryQ);
    }
  }
}

export function installAgGridHost(gv: Window["GridView"]): void {
  gv.AgGrid = gv.AgGrid ?? {};
  if (typeof gv.AgGrid.Host !== "undefined") return;
  gv.AgGrid.Host = AgGridHost;
}
