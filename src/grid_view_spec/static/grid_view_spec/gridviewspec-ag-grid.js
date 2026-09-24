"use strict";
(() => {
  // src/page-state/page-state.ts
  var ROOT_SELECTOR = "[data-cm-grid-view-spec]";
  var STORAGE_PREFIX = "cmGridViewPageState:v1:";
  var VERSION = 1;
  var FORBIDDEN_OBJECT_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  var INVALID_JSON_VALUE = Symbol("invalid-json-value");
  function isSafeKey(key) {
    return !FORBIDDEN_OBJECT_KEYS.has(key);
  }
  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function isNamespace(value) {
    return value.length > 0 && isSafeKey(value);
  }
  function isIdentityPart(value, required) {
    return !required || value.length > 0;
  }
  function cloneJsonValue(value, seen = /* @__PURE__ */ new WeakSet()) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : INVALID_JSON_VALUE;
    if (typeof value !== "object") return INVALID_JSON_VALUE;
    if (seen.has(value)) return INVALID_JSON_VALUE;
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        const result2 = [];
        for (const item of value) {
          const validated = cloneJsonValue(item, seen);
          if (validated === INVALID_JSON_VALUE) return INVALID_JSON_VALUE;
          result2.push(validated);
        }
        return result2;
      }
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) return INVALID_JSON_VALUE;
      const result = /* @__PURE__ */ Object.create(null);
      for (const [key, item] of Object.entries(value)) {
        if (!isSafeKey(key)) return INVALID_JSON_VALUE;
        const validated = cloneJsonValue(item, seen);
        if (validated === INVALID_JSON_VALUE) return INVALID_JSON_VALUE;
        result[key] = validated;
      }
      return result;
    } catch (e) {
      return INVALID_JSON_VALUE;
    } finally {
      seen.delete(value);
    }
  }
  function emptyState() {
    return { version: VERSION, namespaces: /* @__PURE__ */ Object.create(null) };
  }
  function parseStoredState(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
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
    } catch (e) {
      return null;
    }
  }
  function browserStorage() {
    try {
      return typeof window === "undefined" ? null : window.localStorage;
    } catch (e) {
      return null;
    }
  }
  function readState(storage, key) {
    try {
      return parseStoredState(storage.getItem(key));
    } catch (e) {
      return null;
    }
  }
  function writeState(storage, key, state) {
    try {
      storage.setItem(key, JSON.stringify(state));
    } catch (e) {
    }
  }
  function removeState(storage, key) {
    try {
      storage.removeItem(key);
    } catch (e) {
    }
  }
  function resolveSpecRoot(root) {
    if (!root.isConnected) return null;
    const specRoot = root.matches(ROOT_SELECTOR) ? root : root.closest(ROOT_SELECTOR);
    return specRoot instanceof HTMLElement ? specRoot : null;
  }
  function pageStateIdentity(root) {
    var _a, _b;
    const specId = (_a = root.getAttribute("data-spec-id")) != null ? _a : "";
    const scope = (_b = root.getAttribute("data-cm-page-state-scope")) != null ? _b : "";
    if (!isIdentityPart(specId, true) || !isIdentityPart(scope, false)) return null;
    try {
      return {
        storageKey: `${STORAGE_PREFIX}${encodeURIComponent(specId)}:${encodeURIComponent(scope)}`
      };
    } catch (e) {
      return null;
    }
  }
  var LocalPageStateHandle = class {
    constructor(root, storageKey) {
      this.root = root;
      this.storageKey = storageKey;
    }
    get(namespace) {
      if (!this.isLive() || !isNamespace(namespace)) return void 0;
      const storage = browserStorage();
      const stored = storage ? readState(storage, this.storageKey) : null;
      const value = stored == null ? void 0 : stored.namespaces[namespace];
      if (value === void 0) return void 0;
      const cloned = cloneJsonValue(value);
      return cloned === INVALID_JSON_VALUE ? void 0 : cloned;
    }
    put(namespace, value) {
      var _a;
      if (!this.isLive() || !isNamespace(namespace)) return;
      const validated = cloneJsonValue(value);
      if (validated === INVALID_JSON_VALUE) return;
      const storage = browserStorage();
      if (!storage) return;
      const state = (_a = readState(storage, this.storageKey)) != null ? _a : emptyState();
      state.namespaces[namespace] = validated;
      writeState(storage, this.storageKey, state);
    }
    remove(namespace) {
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
    isLive() {
      return this.root.isConnected;
    }
  };
  var PageState = {
    forRoot(root) {
      if (typeof Element === "undefined" || !(root instanceof Element)) return null;
      const specRoot = resolveSpecRoot(root);
      if (!specRoot) return null;
      const identity = pageStateIdentity(specRoot);
      return identity ? new LocalPageStateHandle(specRoot, identity.storageKey) : null;
    }
  };

  // src/column-settings/page-state.ts
  var WIDTH_PATTERN = /^\d+(?:\.\d+)?(?:px|%|rem|em|vw|vh)?$/i;
  var FORBIDDEN_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  function isRecord2(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function isSafeKey2(key) {
    return !FORBIDDEN_KEYS.has(key);
  }
  function isJsonValue(value, seen = /* @__PURE__ */ new WeakSet()) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value !== "object" || seen.has(value)) return false;
    seen.add(value);
    try {
      if (Array.isArray(value)) return value.every((item) => isJsonValue(item, seen));
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) return false;
      return Object.entries(value).every(
        ([key, item]) => isSafeKey2(key) && isJsonValue(item, seen)
      );
    } finally {
      seen.delete(value);
    }
  }
  function isJsonRecord(value) {
    return isRecord2(value) && isJsonValue(value);
  }
  function normalizeWidth(value) {
    if (value == null) return null;
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
    if (typeof value !== "string") return null;
    const width = value.trim();
    return width.length <= 32 && WIDTH_PATTERN.test(width) ? width : null;
  }
  function normalizeColumnState(value) {
    if (!Array.isArray(value)) return null;
    const seen = /* @__PURE__ */ new Set();
    const normalized = [];
    for (const raw of value) {
      if (!isRecord2(raw) || typeof raw.colId !== "string") return null;
      const colId = raw.colId.trim();
      if (!colId || colId.length > 256 || seen.has(colId)) return null;
      seen.add(colId);
      normalized.push({
        colId,
        hide: raw.hide === true,
        pinned: raw.pinned === "left" || raw.pinned === "right" ? raw.pinned : null,
        width: normalizeWidth(raw.width)
      });
    }
    return normalized;
  }
  function normalizePageColumnState(value) {
    if (!Array.isArray(value)) return null;
    const seen = /* @__PURE__ */ new Set();
    const normalized = [];
    for (const raw of value) {
      if (!isJsonRecord(raw) || typeof raw.id !== "string" || typeof raw.hidden !== "boolean") {
        return null;
      }
      const colId = raw.id.trim();
      if (!colId || colId.length > 256 || seen.has(colId)) return null;
      const pinned = raw.pinned;
      if (pinned !== void 0 && pinned !== "left" && pinned !== "right" && pinned !== null) {
        return null;
      }
      const width = raw.width === void 0 ? null : normalizeWidth(raw.width);
      if (raw.width !== void 0 && width === null) return null;
      seen.add(colId);
      normalized.push({
        colId,
        hide: raw.hidden,
        pinned: pinned === "left" || pinned === "right" ? pinned : null,
        width
      });
    }
    return normalized;
  }
  function statesEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  function pageColumnStoreForRoot(root, gridId) {
    const handle = PageState.forRoot(root);
    if (!handle) return null;
    return {
      handle,
      columnsNamespace: `grid.${gridId}.columns`,
      presetsNamespace: `grid.${gridId}.presets`,
      agGridNamespace: `grid.${gridId}.ag_grid`
    };
  }
  function readPageColumns(store) {
    return normalizePageColumnState(store.handle.get(store.columnsNamespace));
  }
  function serializeColumnState(state) {
    return state.map((column) => {
      const serialized = {
        id: column.colId,
        hidden: column.hide
      };
      if (column.pinned) serialized.pinned = column.pinned;
      if (column.width != null) serialized.width = column.width;
      return serialized;
    });
  }
  function putPageColumns(store, state) {
    const normalized = normalizeColumnState(state);
    if (!normalized) return false;
    store.handle.put(store.columnsNamespace, serializeColumnState(normalized));
    const persisted = readPageColumns(store);
    return persisted !== null && statesEqual(persisted, normalized);
  }
  function readPageAgGridState(store) {
    const value = store.handle.get(store.agGridNamespace);
    return isJsonRecord(value) ? value : null;
  }
  function putPageAgGridState(store, state) {
    if (!isJsonRecord(state)) return false;
    store.handle.put(store.agGridNamespace, state);
    return readPageAgGridState(store) !== null;
  }

  // src/ag-grid/page-state.ts
  function sortStateFromModel(value) {
    if (!Array.isArray(value)) return void 0;
    const seen = /* @__PURE__ */ new Set();
    const sortModel = [];
    for (const raw of value) {
      if (!isJsonRecord(raw) || typeof raw.colId !== "string") return void 0;
      const colId = raw.colId.trim();
      if (!colId || seen.has(colId) || raw.sort !== "asc" && raw.sort !== "desc") {
        return void 0;
      }
      seen.add(colId);
      sortModel.push({ colId, sort: raw.sort });
    }
    return { sortModel };
  }
  function sortStateFromColumnState(value) {
    if (!Array.isArray(value) || !normalizeColumnState(value)) return void 0;
    const seen = /* @__PURE__ */ new Set();
    const candidates = [];
    value.forEach((raw, position) => {
      if (!isJsonRecord(raw) || typeof raw.colId !== "string") return;
      const colId = raw.colId.trim();
      if (!colId || seen.has(colId) || raw.sort !== "asc" && raw.sort !== "desc") return;
      seen.add(colId);
      candidates.push({
        colId,
        sort: raw.sort,
        sortIndex: typeof raw.sortIndex === "number" && Number.isInteger(raw.sortIndex) && raw.sortIndex >= 0 ? raw.sortIndex : null,
        position
      });
    });
    candidates.sort((left, right) => {
      var _a, _b;
      const leftIndex = (_a = left.sortIndex) != null ? _a : Number.MAX_SAFE_INTEGER;
      const rightIndex = (_b = right.sortIndex) != null ? _b : Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex || left.position - right.position;
    });
    return {
      sortModel: candidates.map(({ colId, sort }) => ({ colId, sort }))
    };
  }
  function columnSizingStateFromModel(value) {
    if (!Array.isArray(value)) return void 0;
    const seen = /* @__PURE__ */ new Set();
    const columnSizingModel = [];
    for (const raw of value) {
      if (!isJsonRecord(raw) || typeof raw.colId !== "string") return void 0;
      const colId = raw.colId.trim();
      if (!colId || seen.has(colId) || typeof raw.flex !== "number" || !Number.isFinite(raw.flex) || raw.flex <= 0) {
        return void 0;
      }
      seen.add(colId);
      columnSizingModel.push({ colId, flex: raw.flex });
    }
    return columnSizingModel.length ? { columnSizingModel } : void 0;
  }
  function columnSizingStateFromColumnState(value) {
    if (!Array.isArray(value) || !normalizeColumnState(value)) return void 0;
    const seen = /* @__PURE__ */ new Set();
    const columnSizingModel = [];
    for (const raw of value) {
      if (!isJsonRecord(raw) || typeof raw.colId !== "string") continue;
      const colId = raw.colId.trim();
      if (!colId || seen.has(colId) || typeof raw.flex !== "number" || !Number.isFinite(raw.flex) || raw.flex <= 0) {
        continue;
      }
      seen.add(colId);
      columnSizingModel.push({ colId, flex: raw.flex });
    }
    return columnSizingModel.length ? { columnSizingModel } : void 0;
  }
  function stateFromRecord(value) {
    var _a, _b, _c;
    const filterState = isJsonRecord(value.filterState) ? value.filterState : void 0;
    const pageState = isJsonRecord(value.pageState) ? value.pageState : void 0;
    return {
      colState: (_a = normalizeColumnState(value.colState)) != null ? _a : void 0,
      filterState,
      quickFilter: typeof value.quickFilter === "string" ? value.quickFilter : void 0,
      pageState,
      sort: (_b = sortStateFromModel(isJsonRecord(value.sort) ? value.sort.sortModel : void 0)) != null ? _b : sortStateFromColumnState(value.colState),
      columnSizing: (_c = columnSizingStateFromModel(
        isJsonRecord(value.columnSizing) ? value.columnSizing.columnSizingModel : void 0
      )) != null ? _c : columnSizingStateFromColumnState(value.colState)
    };
  }
  function agOnlyState(state) {
    var _a, _b, _c;
    const result = {};
    if (state.filterState && isJsonRecord(state.filterState)) result.filterState = state.filterState;
    if (typeof state.quickFilter === "string") result.quickFilter = state.quickFilter;
    if (state.pageState && isJsonRecord(state.pageState)) result.pageState = state.pageState;
    const sort = (_a = state.sort) != null ? _a : sortStateFromColumnState(state.colState);
    if (sort) {
      result.sort = {
        sortModel: sort.sortModel.map(({ colId, sort: direction }) => ({
          colId,
          sort: direction
        }))
      };
    }
    const columnSizing = (_b = state.columnSizing) != null ? _b : columnSizingStateFromColumnState(state.colState);
    const flexColumns = ((_c = columnSizing == null ? void 0 : columnSizing.columnSizingModel) != null ? _c : []).filter(
      (item) => typeof item.flex === "number"
    );
    if (flexColumns.length) {
      result.columnSizing = {
        columnSizingModel: flexColumns.map(({ colId, flex }) => ({
          colId,
          flex
        }))
      };
    }
    return result;
  }
  function numericWidth(value) {
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
    if (typeof value !== "string") return null;
    const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/i);
    if (!match) return null;
    const width = Number(match[1]);
    return Number.isFinite(width) && width > 0 ? width : null;
  }
  function initialStateForColumns(columns) {
    return {
      columnOrder: { orderedColIds: columns.map((column) => column.colId) },
      columnVisibility: {
        hiddenColIds: columns.filter((column) => column.hide).map((column) => column.colId)
      },
      columnPinning: {
        leftColIds: columns.filter((column) => column.pinned === "left").map((column) => column.colId),
        rightColIds: columns.filter((column) => column.pinned === "right").map((column) => column.colId)
      },
      columnSizing: {
        columnSizingModel: columns.map((column) => {
          const width = numericWidth(column.width);
          return width === null ? null : { colId: column.colId, width };
        }).filter((column) => column !== null)
      }
    };
  }
  function withFlexSizing(initialState, flexSizing) {
    var _a, _b;
    if (!(flexSizing == null ? void 0 : flexSizing.columnSizingModel.length)) return initialState;
    const sizingModel = ((_b = (_a = initialState.columnSizing) == null ? void 0 : _a.columnSizingModel) != null ? _b : []).map((item) => ({
      ...item
    }));
    const sizingIndex = new Map(sizingModel.map((item, index) => [item.colId, index]));
    flexSizing.columnSizingModel.forEach(({ colId, flex }) => {
      const index = sizingIndex.get(colId);
      if (index === void 0) {
        sizingIndex.set(colId, sizingModel.length);
        sizingModel.push({ colId, flex });
        return;
      }
      sizingModel[index] = { ...sizingModel[index], flex };
    });
    return {
      ...initialState,
      columnSizing: { columnSizingModel: sizingModel }
    };
  }
  function prepareAgGridPageState(root, gridId, configuredInitialState) {
    const store = pageColumnStoreForRoot(root, gridId);
    if (!store) return null;
    const columns = readPageColumns(store);
    const storedAgState = readPageAgGridState(store);
    const initialAgState = storedAgState ? stateFromRecord(storedAgState) : {};
    const hasRestoredInitialState = columns !== null || initialAgState.sort !== void 0 || initialAgState.columnSizing !== void 0;
    const nativeInitialState = withFlexSizing(
      {
        ...configuredInitialState != null ? configuredInitialState : {},
        ...columns ? initialStateForColumns(columns) : {},
        ...initialAgState.sort ? { sort: initialAgState.sort } : {}
      },
      initialAgState.columnSizing
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
      clear: () => store.handle.remove(store.agGridNamespace)
    };
  }

  // src/ag-grid/types.ts
  function readSearchInputValue(el) {
    return el instanceof HTMLInputElement ? el.value : "";
  }
  function readSearchInputTrimmed(el) {
    return readSearchInputValue(el).trim();
  }
  function writeSearchInputValue(el, value) {
    if (el instanceof HTMLInputElement) {
      el.value = value;
    }
  }
  function gridViewT(key, fallback) {
    const catalog2 = window.GridViewI18n;
    if (catalog2 && catalog2[key]) {
      const val = catalog2[key];
      if (val && val !== key) return val;
    }
    return fallback;
  }
  function isInfiniteRowModel(gridApi) {
    if (!gridApi || typeof gridApi.getGridOption !== "function") return false;
    return gridApi.getGridOption("rowModelType") === "infinite";
  }

  // src/ag-grid/host.ts
  function isColumnSettingsHandle(value) {
    if (!value || typeof value !== "object") return false;
    const handle = value;
    return typeof handle.renderSavedPresets === "function";
  }
  function isAgGridHostApi(value) {
    if (!value || typeof value !== "object") return false;
    const api = value;
    return typeof api.getFilterModel === "function" && typeof api.addEventListener === "function";
  }
  var AgGridHost = class {
    constructor(gridId, containerId, optionsVar, initialPresets, initialSearches, groupsOrder) {
      var _a;
      this.gridId = gridId;
      this.containerId = containerId;
      this.gridOptions = optionsVar != null ? optionsVar : {};
      if (!this.gridOptions.overlayLoadingTemplate) {
        this.gridOptions.overlayLoadingTemplate = '<div class="flex flex-col items-center justify-center p-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-2"></div><span class="text-sm text-gray-500 dark:text-gray-400">' + gridViewT("grid.loading", "Loading\u2026") + "</span></div>";
      }
      if (!this.gridOptions.overlayNoRowsTemplate) {
        this.gridOptions.overlayNoRowsTemplate = '<div class="flex flex-col items-center justify-center p-6 text-gray-500 dark:text-gray-400"><svg class="w-10 h-10 mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg><span class="text-base font-medium">' + gridViewT("grid.no_rows", "No records") + "</span></div>";
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
      this.savedColPresets = initialPresets != null ? initialPresets : {};
      this.savedQuickSearches = initialSearches != null ? initialSearches : [];
      this.groupsOrder = groupsOrder != null ? groupsOrder : [];
      this.gridApi = void 0;
      this._colSettings = null;
      this._searchText = "";
      this._columnMeta = {};
      this._pageStateAdapter = null;
      if ((_a = window.GridView) == null ? void 0 : _a.byId) {
        window.GridView.byId.register(this.gridId, this);
      }
    }
    _syncColPresetsFromSettings() {
      if (this._colSettings) {
        this.savedColPresets = this._colSettings.savedColPresets;
      }
    }
    _colOp(method) {
      this._initColSettings();
      const settings = this._colSettings;
      if (!settings) return;
      settings[method]();
      this._syncColPresetsFromSettings();
    }
    _extractColumnMeta() {
      this._columnMeta = {};
      const defs = this.gridOptions.columnDefs;
      if (!defs) return;
      const walk = (list) => {
        list.forEach((col) => {
          var _a;
          if (col.children) {
            walk(col.children);
            return;
          }
          const id = col.field || col.colId;
          if (!id) return;
          const grp = col.menuGroup || col.contextGroup || ((_a = col.cellRendererParams) == null ? void 0 : _a.menuGroup);
          if (grp) {
            this._columnMeta[id] = { menuGroup: grp };
          }
        });
      };
      walk(defs);
    }
    _getContextHooks() {
      var _a;
      return (_a = this.gridOptions.context) != null ? _a : {};
    }
    _resolveSearchInput() {
      var _a, _b;
      const resolver = (_b = (_a = window.GridView) == null ? void 0 : _a.AgGrid) == null ? void 0 : _b.resolveToolbarSearchInput;
      if (typeof resolver === "function") {
        return resolver(this.gridId);
      }
      const legacy = document.getElementById("ag-quick-filter-" + this.gridId);
      return legacy instanceof HTMLInputElement ? legacy : null;
    }
    _collectPageState() {
      var _a;
      const ctx = this._getContextHooks();
      if (typeof ctx.getPageState === "function") {
        try {
          return (_a = ctx.getPageState()) != null ? _a : {};
        } catch (e) {
          console.error("getPageState failed:", e);
        }
      }
      return {};
    }
    _applyPageState(pageState, options) {
      const ctx = this._getContextHooks();
      if (typeof ctx.applyPageState === "function" && Object.keys(pageState).length) {
        try {
          ctx.applyPageState(pageState, options);
        } catch (e) {
          console.error("applyPageState failed:", e);
        }
      }
    }
    _readUrlGridParams() {
      var _a;
      const params = new URLSearchParams(window.location.search);
      const out = {};
      if (params.has("q")) {
        out.hasQ = true;
        out.q = (_a = params.get("q")) != null ? _a : "";
      }
      if (params.has("filters")) {
        out.hasFilterState = true;
        const filters = params.get("filters");
        try {
          const parsed = JSON.parse(filters || "null");
          if (isJsonRecord(parsed)) out.filterState = parsed;
        } catch (_e) {
        }
      }
      return out;
    }
    _pageStateFromUrl() {
      const ctx = this._getContextHooks();
      const keys = ctx.urlPageStateKeys;
      if (!Array.isArray(keys) || !keys.length) return {};
      const params = new URLSearchParams(window.location.search);
      const pageState = {};
      keys.forEach((key) => {
        var _a;
        if (!params.has(key)) return;
        const raw = (_a = params.get(key)) != null ? _a : "";
        pageState[key] = raw.indexOf(",") >= 0 ? raw.split(",").map((value) => value.trim()).filter(Boolean) : raw;
      });
      return pageState;
    }
    syncBrowserUrl() {
      var _a;
      const ctx = this._getContextHooks();
      const api = this.gridApi;
      if (ctx.syncUrlState === false || !api) return;
      const url = new URL(window.location.href);
      const qfEl = this._resolveSearchInput();
      const q = qfEl ? readSearchInputTrimmed(qfEl) : this._searchText;
      if (q) url.searchParams.set("q", q);
      else url.searchParams.delete("q");
      const filterModel = (_a = api.getFilterModel()) != null ? _a : {};
      if (Object.keys(filterModel).length) {
        url.searchParams.set("filters", JSON.stringify(filterModel));
      } else {
        url.searchParams.delete("filters");
      }
      const pageState = this._collectPageState();
      const urlKeys = Array.isArray(ctx.urlPageStateKeys) ? ctx.urlPageStateKeys : Object.keys(pageState);
      urlKeys.forEach((key) => {
        const val = pageState[key];
        if (val == null || val === "" || Array.isArray(val) && !val.length) {
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
    _readStoredGridState() {
      var _a, _b;
      return (_b = (_a = this._pageStateAdapter) == null ? void 0 : _a.read()) != null ? _b : {};
    }
    _preparePageState(gridDiv) {
      var _a;
      this._pageStateAdapter = prepareAgGridPageState(
        gridDiv,
        this.gridId,
        this.gridOptions.initialState
      );
      if ((_a = this._pageStateAdapter) == null ? void 0 : _a.initialState) {
        this.gridOptions.initialState = this._pageStateAdapter.initialState;
      }
    }
    _prepareUrlInitialState() {
      var _a;
      const urlParams = this._readUrlGridParams();
      if (!urlParams.hasFilterState) return;
      this.gridOptions.initialState = {
        ...this.gridOptions.initialState,
        filter: { filterModel: (_a = urlParams.filterState) != null ? _a : {} }
      };
    }
    initGrid() {
      const gridDiv = document.getElementById(this.containerId);
      if (!gridDiv) return;
      const applyTheme = () => {
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
      this._prepareUrlInitialState();
      const agGridLib = window.agGrid;
      if (!agGridLib) throw new Error("AG Grid is not loaded");
      const created = agGridLib.createGrid(gridDiv, this.gridOptions);
      if (!isAgGridHostApi(created)) {
        throw new Error("AG Grid createGrid returned an invalid API");
      }
      this.gridApi = created;
      this.loadState();
      document.dispatchEvent(new CustomEvent("cm-grid-ready", { detail: { gridId: this.gridId } }));
      window.setTimeout(() => {
        gridDiv.classList.add("cm-ag-grid-root--ready");
      }, 50);
      this.gridApi.addEventListener("sortChanged", () => {
        this.saveGridState();
      });
      this.gridApi.addEventListener("columnMoved", () => {
        this.saveGridState();
      });
      this.gridApi.addEventListener("columnResized", (params) => {
        const payload = params;
        if (payload == null ? void 0 : payload.finished) this.saveGridState();
      });
      this.gridApi.addEventListener("filterChanged", () => {
        this.saveGridState();
        this.syncFilterChrome();
        const ctx = this._getContextHooks();
        if (typeof ctx.onFilterChange === "function") {
          ctx.onFilterChange(this);
        } else if (typeof ctx.onFilterChanged === "function") {
          ctx.onFilterChanged(this);
        }
      });
      this.gridApi.addEventListener("modelUpdated", () => {
        const countEl = document.getElementById("grid-row-count-" + this.gridId);
        if (countEl && this.gridApi) {
          countEl.textContent = gridViewT("grid.records_label", "Records:") + " " + this.gridApi.getDisplayedRowCount();
        }
      });
      this._bindInfiniteHeaderCheckbox();
    }
    _bindInfiniteHeaderCheckbox() {
      const gridDiv = document.getElementById(this.containerId);
      if (!gridDiv || !this.gridApi) return;
      const api = this.gridApi;
      const colDefs = api.getColumnDefs();
      const hasCheckbox = colDefs == null ? void 0 : colDefs.some(
        (c) => "checkboxSelection" in c && c.checkboxSelection === true
      );
      if (!hasCheckbox) return;
      const syncHeaderCheckbox = () => {
        const wrapper = gridDiv.querySelector(".ag-header-cell[col-id] .ag-header-select-all");
        if (!wrapper) return;
        wrapper.classList.remove("ag-hidden");
        wrapper.removeAttribute("aria-hidden");
        const input = wrapper.querySelector("input[type='checkbox']");
        if (!input || input.dataset.cmInfiniteBound) return;
        input.dataset.cmInfiniteBound = "1";
        wrapper.addEventListener("click", (e) => {
          e.stopPropagation();
          const selected = api.getSelectedRows().length;
          const nextState = selected === 0;
          api.forEachNode((node) => {
            node.setSelected(nextState);
          });
        });
      };
      const updateHeaderCheckboxState = () => {
        const selected = api.getSelectedRows().length;
        const wrapper = gridDiv.querySelector(".ag-header-cell[col-id] .ag-header-select-all");
        const input = wrapper == null ? void 0 : wrapper.querySelector("input[type='checkbox']");
        if (!wrapper || !input) return;
        if (selected === 0) {
          input.checked = false;
          input.indeterminate = false;
          wrapper.classList.remove("ag-checked");
        } else {
          input.checked = true;
          input.indeterminate = false;
          wrapper.classList.add("ag-checked");
        }
      };
      api.addEventListener("selectionChanged", updateHeaderCheckboxState);
      window.setTimeout(syncHeaderCheckbox, 100);
      api.addEventListener("modelUpdated", syncHeaderCheckbox);
    }
    loadState(options = {}) {
      var _a, _b, _c;
      const api = this.gridApi;
      if (!api) return;
      const state = this._readStoredGridState();
      const urlParams = this._readUrlGridParams();
      const urlPageState = this._pageStateFromUrl();
      const filterState = urlParams.hasFilterState ? urlParams.filterState : state.filterState;
      api.setFilterModel(filterState != null ? filterState : null);
      const qsInput = this._resolveSearchInput();
      if (urlParams.hasQ) {
        const urlQ = (_a = urlParams.q) != null ? _a : "";
        writeSearchInputValue(qsInput, urlQ);
        this._searchText = urlQ;
      } else if (typeof state.quickFilter === "string") {
        writeSearchInputValue(qsInput, state.quickFilter);
        this._searchText = state.quickFilter;
      }
      const pageState = Object.keys(urlPageState).length ? { ...(_b = state.pageState) != null ? _b : {}, ...urlPageState } : (_c = state.pageState) != null ? _c : {};
      this._applyPageState(pageState, {
        fromUrl: Object.keys(urlPageState).length > 0
      });
      if (options.reloadInfinite && isInfiniteRowModel(api)) {
        api.purgeInfiniteCache();
      }
    }
    reapplyPersistedState() {
      if (!this.gridApi) return;
      this.loadState({ reloadInfinite: true });
    }
    saveGridState() {
      const api = this.gridApi;
      if (!api) return;
      const qfEl = this._resolveSearchInput();
      const state = {
        colState: api.getColumnState(),
        filterState: api.getFilterModel(),
        quickFilter: readSearchInputValue(qfEl),
        pageState: this._collectPageState()
      };
      if (this._pageStateAdapter) {
        this._pageStateAdapter.save(state);
      }
      this.syncBrowserUrl();
      document.dispatchEvent(new CustomEvent("cm-grid-state-change", { detail: { gridId: this.gridId } }));
    }
    _initColSettings() {
      var _a;
      if (this._colSettings) return;
      const api = this.gridApi;
      const gridView = window.GridView;
      if (!api || !(gridView == null ? void 0 : gridView.createColumnSettings) || !gridView.createAgGridColumnAdapter) return;
      const ctx = this._getContextHooks();
      const preferencesUrl = (_a = gridView.preferencesUrl) != null ? _a : "";
      const created = gridView.createColumnSettings(
        this.gridId,
        gridView.createAgGridColumnAdapter(api, this._columnMeta),
        {
          groupsOrder: this.groupsOrder,
          initialPresets: this.savedColPresets,
          preferencesUrl,
          pageStateRoot: document.getElementById(this.containerId),
          initialState: api.getColumnState(),
          onStateChange: () => {
            this.saveGridState();
          }
        }
      );
      if (!isColumnSettingsHandle(created)) return;
      this._colSettings = created;
      document.querySelectorAll('[data-cm-export-sync][data-cm-grid-id="' + this.gridId + '"]').forEach((link) => {
        if (!(link instanceof HTMLElement)) return;
        if (link.dataset.cmExportClickBound) return;
        link.dataset.cmExportClickBound = "1";
        link.addEventListener("click", () => {
          var _a2;
          (_a2 = this._colSettings) == null ? void 0 : _a2.syncExportLinks();
        });
      });
    }
    toggleColSelector() {
      this._colOp("toggleColSelector");
    }
    openColSelectorModal() {
      this._colOp("openColSelectorModal");
    }
    closeColSelectorModal() {
      this._colOp("closeColSelectorModal");
    }
    resetColumnsToDefault() {
      this._colOp("resetColumnsToDefault");
    }
    buildColCheckboxes() {
      this._colOp("buildColCheckboxes");
    }
    mountColumnSettings(container) {
      var _a;
      this._initColSettings();
      (_a = this._colSettings) == null ? void 0 : _a.mountColumnSettings(container);
    }
    buildColOrderList() {
      this._colOp("buildColOrderList");
    }
    renderSavedPresets() {
      this._initColSettings();
      const settings = this._colSettings;
      if (!settings) return;
      settings.savedColPresets = this.savedColPresets;
      settings.renderSavedPresets();
    }
    saveCurrentPreset() {
      this._colOp("saveCurrentPreset");
    }
    saveColPresetsToServer() {
      this._initColSettings();
      const settings = this._colSettings;
      if (!settings) return;
      settings.savedColPresets = this.savedColPresets;
      settings.saveColPresetsToServer();
      this._syncColPresetsFromSettings();
    }
    syncSearchToolbarUi() {
      const el = this._resolveSearchInput();
      const wrap = el == null ? void 0 : el.closest("[data-cm-toolbar-search-root]");
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
    reloadData() {
      var _a, _b;
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
      } else if (typeof ((_b = (_a = window.GridView) == null ? void 0 : _a.AgGrid) == null ? void 0 : _b.syncExportLinks) === "function") {
        window.GridView.AgGrid.syncExportLinks(this.gridId);
      }
    }
    onQuickFilterChanged() {
      if (!this.gridApi) return;
      const el = this._resolveSearchInput();
      this._searchText = readSearchInputValue(el);
      this.reloadData();
    }
    clearSearch() {
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
    setRowData(data) {
      var _a;
      (_a = this.gridApi) == null ? void 0 : _a.setGridOption("rowData", data);
    }
    showLoading() {
      var _a;
      (_a = this.gridApi) == null ? void 0 : _a.showLoadingOverlay();
    }
    hideOverlay() {
      var _a;
      (_a = this.gridApi) == null ? void 0 : _a.hideOverlay();
    }
    setQuickFilter(text) {
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
    clearAllFilters() {
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
      }
      this.syncSearchToolbarUi();
      document.dispatchEvent(new CustomEvent("cm-grid-state-change", { detail: { gridId: this.gridId } }));
      if (isInfiniteRowModel(api)) {
        api.purgeInfiniteCache();
      }
    }
    hasActiveFilters() {
      var _a, _b;
      const model = (_b = (_a = this.gridApi) == null ? void 0 : _a.getFilterModel()) != null ? _b : {};
      if (Object.keys(model).length) return true;
      if (this._searchText.trim().length > 0) return true;
      const params = new URLSearchParams(window.location.search);
      return ["q", "filters", "col_q"].some(
        (key) => (params.get(key) || "").trim().length > 0
      );
    }
    syncFilterChrome() {
      this.syncSearchToolbarUi();
      const active = this.hasActiveFilters();
      const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(this.gridId) : this.gridId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      document.querySelectorAll(
        '[data-cm-grid-action="clearAllFilters"][data-cm-grid-id="' + esc + '"]'
      ).forEach((btn) => btn.classList.toggle("is-hidden", !active));
    }
    applyUrlSearchFilter() {
      const queryQ = new URLSearchParams(window.location.search).get("q");
      if (queryQ && this._searchText !== queryQ) {
        this.setQuickFilter(queryQ);
      }
    }
  };
  function installAgGridHost(gv5) {
    var _a;
    gv5.AgGrid = (_a = gv5.AgGrid) != null ? _a : {};
    if (typeof gv5.AgGrid.Host !== "undefined") return;
    gv5.AgGrid.Host = AgGridHost;
  }

  // src/ag-grid-host.ts
  var gv = window.GridView = window.GridView || {};
  installAgGridHost(gv);

  // src/ag-grid/tooltip.ts
  var AgGridTooltip = class {
    init(params) {
      const eGui = document.createElement("div");
      eGui.className = "cm-ellipsis-tip cm-ellipsis-tip--floating";
      eGui.innerHTML = params.value ? params.value : "No data";
      this.eGui = eGui;
    }
    getGui() {
      return this.eGui;
    }
  };
  function installAgGridTooltip(gv5) {
    var _a;
    gv5.AgGrid = (_a = gv5.AgGrid) != null ? _a : {};
    gv5.AgGrid.Tooltip = AgGridTooltip;
  }

  // src/ag-grid-tooltip.ts
  var gv2 = window.GridView = window.GridView || {};
  installAgGridTooltip(gv2);

  // src/grid-view/search/column-scope.ts
  function normalizeColumnLabel(text) {
    return String(text != null ? text : "").toLowerCase().replace(/\s+/g, "");
  }
  function columnKeysForHint(hint, columns) {
    const needle = normalizeColumnLabel(hint);
    if (!needle) return [];
    const keys = [];
    for (const col of columns) {
      const label = normalizeColumnLabel(col.label);
      if (label.includes(needle) || label.startsWith(needle)) {
        keys.push(col.key);
      }
    }
    return keys;
  }
  function parseScopedTerm(term, columns) {
    const raw = String(term != null ? term : "").trim();
    if (!raw || raw.indexOf(":") < 0) return { scope: null, inner: raw };
    const idx = raw.indexOf(":");
    const hint = raw.slice(0, idx).trim();
    const inner = raw.slice(idx + 1).trim();
    if (!hint || !inner) return { scope: null, inner: raw };
    if (columnKeysForHint(hint, columns).length) return { scope: hint, inner };
    return { scope: null, inner: raw };
  }
  function cellsForScope(hint, cellsByKey, columns, allCells) {
    if (!hint) return [...allCells];
    const keys = columnKeysForHint(hint, columns);
    if (!keys.length) return [...allCells];
    const scoped = [];
    for (const key of keys) {
      const val = cellsByKey[key];
      if (val) scoped.push(val);
    }
    return scoped;
  }

  // src/grid-view/search/smart-query.ts
  var EXCLUDE_PREFIXES = ["-", "\u2212", "\u2013", "\u2014"];
  function isExcludePrefix(ch) {
    return EXCLUDE_PREFIXES.includes(ch);
  }
  function splitOrGroups(raw) {
    const groups = [];
    let buf = "";
    let inQuote = false;
    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (ch === '"') {
        inQuote = !inQuote;
        buf += ch;
      } else if (!inQuote && (ch === "/" || ch === "\\" || ch === ",")) {
        const chunk2 = buf.trim();
        if (chunk2) groups.push(chunk2);
        buf = "";
      } else {
        buf += ch;
      }
    }
    const chunk = buf.trim();
    if (chunk) groups.push(chunk);
    return groups;
  }
  function parseGroupAndTerms(group) {
    const terms = [];
    let i = 0;
    const n = group.length;
    while (i < n) {
      while (i < n && group[i] === " ") i += 1;
      if (i >= n) break;
      if (group[i] === "+") {
        i += 1;
        continue;
      }
      let exclude = false;
      if (isExcludePrefix(group[i])) {
        exclude = true;
        i += 1;
      }
      while (i < n && group[i] === " ") i += 1;
      if (i >= n) break;
      if (group[i] === '"') {
        i += 1;
        const start2 = i;
        while (i < n && group[i] !== '"') i += 1;
        const term = group.slice(start2, i);
        if (i < n) i += 1;
        if (term || exclude) terms.push({ term, exclude, quoted: true });
        continue;
      }
      const start = i;
      while (i < n) {
        if (group[i] === '"') break;
        if (group[i] === "+") {
          if (i > start) break;
          i += 1;
          continue;
        }
        if (group[i] === " ") {
          let j = i;
          while (j < n && group[j] === " ") j += 1;
          if (j < n && isExcludePrefix(group[j]) && i > start) break;
          i = j;
          continue;
        }
        i += 1;
      }
      const text = group.slice(start, i).trim();
      if (text) terms.push({ term: text, exclude, quoted: false });
    }
    return terms;
  }
  function tokenizeSmartQuery(text) {
    const raw = String(text != null ? text : "").trim();
    if (!raw) return [];
    return splitOrGroups(raw).map((g) => parseGroupAndTerms(g));
  }

  // src/grid-view/search/term-match.ts
  var NUMERIC_OPS = [">=", "<=", ">", "<", "="];
  var RANGE_SPLIT = "..";
  function parseNumberForColumnFilter(text) {
    const cleaned = String(text != null ? text : "").replace(/\u00a0/g, " ").replace(/[^\d.,-]/g, "").replace(",", ".");
    if (!cleaned || cleaned === "-" || cleaned === ".") return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  function extractNumericValues(text) {
    const hay = String(text != null ? text : "").replace(/\u00a0/g, " ");
    const values = [];
    const pattern = /[\d]+(?:[ \u00a0.,][\d]{3})*(?:[.,][\d]+)?|[\d]+(?:[.,][\d]+)?/g;
    let match;
    while ((match = pattern.exec(hay)) !== null) {
      const chunk = match[0].replace(/[ \u00a0]/g, "");
      const parsed = parseNumberForColumnFilter(chunk);
      if (parsed !== null) values.push(parsed);
    }
    if (!values.length) {
      const parsed = parseNumberForColumnFilter(hay);
      if (parsed !== null) values.push(parsed);
    }
    return values;
  }
  function numericExprMatchesValue(value, query) {
    const q = String(query != null ? query : "").trim();
    const bounds = parseRangeBounds(q);
    if (bounds !== null) return value >= bounds[0] && value <= bounds[1];
    for (const op of NUMERIC_OPS) {
      if (!q.startsWith(op)) continue;
      const right = parseNumberForColumnFilter(q.slice(op.length).trim());
      if (right === null) return false;
      if (op === ">") return value > right;
      if (op === ">=") return value >= right;
      if (op === "<") return value < right;
      if (op === "<=") return value <= right;
      return value === right;
    }
    return false;
  }
  function parseRangeBounds(term) {
    const t2 = String(term != null ? term : "").trim();
    if (t2.indexOf(RANGE_SPLIT) < 0) return null;
    const parts = t2.split(RANGE_SPLIT);
    if (parts.length !== 2) return null;
    const lo = parseNumberForColumnFilter(parts[0]);
    const hi = parseNumberForColumnFilter(parts[1]);
    if (lo === null || hi === null) return null;
    return [Math.min(lo, hi), Math.max(lo, hi)];
  }
  function termIsExpression(term) {
    const t2 = String(term != null ? term : "").trim();
    if (!t2) return false;
    if (parseRangeBounds(t2) !== null) return true;
    for (const op of NUMERIC_OPS) {
      if (t2.startsWith(op)) return t2.slice(op.length).trim().length > 0;
    }
    if (t2.length > 1 && t2.charAt(0) === "^") return true;
    if (t2.length > 1 && t2.charAt(t2.length - 1) === "$") return true;
    return t2.indexOf("%") >= 0;
  }
  function hasSmartSyntax(raw) {
    const text = String(raw != null ? raw : "");
    if (text.indexOf('"') >= 0) return true;
    let inQuote = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (!inQuote) {
        if (ch === "/" || ch === "\\" || ch === "," || ch === "+") return true;
        if ((ch === "-" || ch === "\u2212" || ch === "\u2013" || ch === "\u2014") && (i === 0 || text[i - 1] === " " || text[i - 1] === "+")) {
          return true;
        }
      }
    }
    return false;
  }
  function matchColumnExpression(cellText, query) {
    const q = String(query != null ? query : "").trim();
    if (!q) return true;
    const hay = String(cellText != null ? cellText : "").trim();
    const hayFold = hay.toLowerCase();
    if (q.length > 1 && q.charAt(0) === "^") {
      const prefix = q.slice(1).trim().toLowerCase();
      return !!prefix && hayFold.startsWith(prefix);
    }
    if (q.length > 1 && q.charAt(q.length - 1) === "$") {
      const suffix = q.slice(0, -1).trim().toLowerCase();
      return !!suffix && hayFold.endsWith(suffix);
    }
    const bounds = parseRangeBounds(q);
    if (bounds !== null) {
      const numbers = extractNumericValues(hay);
      if (!numbers.length) return false;
      return numbers.some((val) => val >= bounds[0] && val <= bounds[1]);
    }
    for (const op of NUMERIC_OPS) {
      if (q.startsWith(op)) {
        if (parseNumberForColumnFilter(q.slice(op.length).trim()) === null) return false;
        const numbers = extractNumericValues(hay);
        if (!numbers.length) return false;
        return numbers.some((val) => numericExprMatchesValue(val, q));
      }
    }
    if (q.indexOf("%") >= 0) {
      const pattern = q.toLowerCase();
      if (pattern.charAt(0) === "%" && pattern.charAt(pattern.length - 1) === "%" && pattern.length >= 2) {
        const mid = pattern.slice(1, -1);
        return !!mid && hayFold.indexOf(mid) >= 0;
      }
      if (pattern.charAt(0) === "%") {
        const suffix = pattern.slice(1);
        return !!suffix && hayFold.endsWith(suffix);
      }
      if (pattern.charAt(pattern.length - 1) === "%") {
        const prefix = pattern.slice(0, -1);
        return !!prefix && hayFold.startsWith(prefix);
      }
    }
    return false;
  }
  function literalContains(haystack, term) {
    return haystack.toLowerCase().indexOf(term.toLowerCase()) >= 0;
  }
  function spaceInsensitiveContains(haystack, term) {
    const hayNs = haystack.toLowerCase().replace(/ /g, "");
    const termNs = term.toLowerCase().replace(/ /g, "");
    return !!termNs && hayNs.indexOf(termNs) >= 0;
  }
  function matchQueryTerm(haystack, term, options) {
    const t2 = String(term != null ? term : "").trim();
    if (!t2) return true;
    const hay = String(haystack != null ? haystack : "");
    const quoted = (options == null ? void 0 : options.quoted) === true;
    if (!quoted && t2.length > 1 && t2.charAt(0) === "!") {
      return !matchQueryTerm(hay, t2.slice(1).trim(), options);
    }
    if (termIsExpression(t2)) return matchColumnExpression(hay, t2);
    if (quoted || t2.indexOf(" ") >= 0) return literalContains(hay, t2);
    return spaceInsensitiveContains(hay, t2);
  }

  // src/grid-view/search/contract.ts
  var ALL_EXPR = /* @__PURE__ */ new Set([
    "or_sep" /* OrSep */,
    "and" /* And */,
    "exclude" /* Exclude */,
    "quoted" /* Quoted */,
    "plain_text" /* PlainText */,
    "phrase_text" /* PhraseText */,
    "numeric_cmp" /* NumericCmp */,
    "numeric_range" /* NumericRange */,
    "wildcard" /* Wildcard */
  ]);
  var TEXT_TOKENS = /* @__PURE__ */ new Set([
    "or_sep" /* OrSep */,
    "and" /* And */,
    "exclude" /* Exclude */,
    "quoted" /* Quoted */,
    "plain_text" /* PlainText */,
    "phrase_text" /* PhraseText */,
    "wildcard" /* Wildcard */
  ]);
  var NUMERIC_TOKENS = /* @__PURE__ */ new Set([
    "or_sep" /* OrSep */,
    "and" /* And */,
    "exclude" /* Exclude */,
    "numeric_cmp" /* NumericCmp */,
    "numeric_range" /* NumericRange */,
    "wildcard" /* Wildcard */
  ]);
  var TOOLBAR_TOKENS = /* @__PURE__ */ new Set([...ALL_EXPR, "column_scope" /* ColumnScope */]);
  var COLUMN_FILTER_ALIASES = {
    auto: "default",
    standard: "default",
    column_default: "default",
    column_expr: "default",
    column_text: "text",
    column_numeric: "numeric",
    column_nosearch: "nosearch",
    set: "list",
    expr: "default",
    search: "default",
    none: "nosearch"
  };
  var PROFILE_ENABLED = {
    ["toolbar" /* Toolbar */]: TOOLBAR_TOKENS,
    ["default" /* Default */]: ALL_EXPR,
    ["text" /* Text */]: TEXT_TOKENS,
    ["numeric" /* Numeric */]: NUMERIC_TOKENS,
    ["nosearch" /* Nosearch */]: /* @__PURE__ */ new Set()
  };
  var EXPR_OPS = [">=", "<=", ">", "<", "="];
  function defaultSearchProfile() {
    return "default" /* Default */;
  }
  function resolveColumnFilter(value) {
    const text = String(value != null ? value : "").trim().toLowerCase();
    if (!text) return "default";
    const mapped = COLUMN_FILTER_ALIASES[text];
    if (mapped) return mapped;
    if (text === "default" || text === "text" || text === "numeric" || text === "nosearch" || text === "list") {
      return text;
    }
    return "default";
  }
  function resolveSearchProfile(value) {
    const cf = resolveColumnFilter(value);
    if (cf === "list") return "default" /* Default */;
    if (cf === "nosearch") return "nosearch" /* Nosearch */;
    if (cf === "text") return "text" /* Text */;
    if (cf === "numeric") return "numeric" /* Numeric */;
    if (String(value != null ? value : "").trim().toLowerCase() === "toolbar") return "toolbar" /* Toolbar */;
    return "default" /* Default */;
  }
  function bindSearchProfileForToolbar() {
    return "toolbar" /* Toolbar */;
  }
  function classifyTermTokens(term, quoted = false) {
    const tokens = /* @__PURE__ */ new Set();
    if (quoted) {
      tokens.add("quoted" /* Quoted */);
      return tokens;
    }
    const t2 = String(term != null ? term : "").trim();
    if (!t2) return tokens;
    if (t2.indexOf(" ") >= 0) tokens.add("phrase_text" /* PhraseText */);
    if (parseRangeBounds(t2) !== null) tokens.add("numeric_range" /* NumericRange */);
    for (const op of EXPR_OPS) {
      if (t2.startsWith(op) && t2.slice(op.length).trim()) {
        tokens.add("numeric_cmp" /* NumericCmp */);
        break;
      }
    }
    if (t2.indexOf("%") >= 0) tokens.add("wildcard" /* Wildcard */);
    if (t2.length > 1 && t2.charAt(0) === "^" || t2.length > 1 && t2.charAt(t2.length - 1) === "$" || t2.length > 1 && t2.charAt(0) === "!") {
      tokens.add("wildcard" /* Wildcard */);
    }
    if (!tokens.size) tokens.add("plain_text" /* PlainText */);
    return tokens;
  }
  function classifyQueryTokens(query, options) {
    const raw = String(query != null ? query : "").trim();
    const tokens = /* @__PURE__ */ new Set();
    if (!raw) return tokens;
    if (hasSmartSyntax(raw)) {
      if (/[,/\\]/.test(raw)) tokens.add("or_sep" /* OrSep */);
      if (raw.indexOf("+") >= 0) tokens.add("and" /* And */);
    }
    const columns = options == null ? void 0 : options.columns;
    for (const andTerms of tokenizeSmartQuery(raw)) {
      for (const item of andTerms) {
        if (item.exclude) tokens.add("exclude" /* Exclude */);
        let term = item.term;
        if (columns == null ? void 0 : columns.length) {
          const scoped = parseScopedTerm(term, columns);
          if (scoped.scope) tokens.add("column_scope" /* ColumnScope */);
          term = scoped.inner;
        }
        for (const token of classifyTermTokens(term, item.quoted)) tokens.add(token);
      }
    }
    if (!tokens.size && raw) {
      for (const token of classifyTermTokens(raw)) tokens.add(token);
    }
    return tokens;
  }
  function guardQueryForProfile(query, profile, options) {
    if (profile === "nosearch" /* Nosearch */) {
      return !String(query != null ? query : "").trim();
    }
    const used = classifyQueryTokens(query, options);
    if (!used.size) return true;
    const allowed = PROFILE_ENABLED[profile];
    for (const token of used) {
      if (!allowed.has(token)) return false;
    }
    return true;
  }
  function columnFilterPlaceholderKey(profile) {
    if (profile === "numeric" /* Numeric */) return "column_filter.placeholder_numeric";
    if (profile === "text" /* Text */) return "column_filter.placeholder_text";
    return "column_filter.placeholder";
  }

  // src/grid-view/search/match.ts
  function termIsCellScoped(term) {
    const t2 = String(term != null ? term : "").trim();
    return termIsExpression(t2) || t2.indexOf("%") >= 0;
  }
  function numericExprMatchesValue2(value, query) {
    return matchColumnExpression(String(value), query);
  }
  function matchExprTermsOnSameCell(cell, terms) {
    if (!terms.length) return true;
    const numericTerms = terms.filter((t2) => termIsExpression(t2) && t2.indexOf("%") < 0);
    const otherTerms = terms.filter((t2) => numericTerms.indexOf(t2) < 0);
    for (const term of otherTerms) {
      if (!matchColumnExpression(cell, term)) return false;
    }
    if (!numericTerms.length) return true;
    const numbers = extractNumericValues(cell);
    if (!numbers.length) return false;
    return numbers.some(
      (value) => numericTerms.every((term) => numericExprMatchesValue2(value, term))
    );
  }
  function scopedCellsForTerm(term, haystack, cells, cellsByKey, columns, activeScope) {
    var _a, _b;
    if (!cellsByKey || !(columns == null ? void 0 : columns.length)) {
      return { inner: term, scopedCells: cells, activeScope: activeScope != null ? activeScope : null };
    }
    const { scope: hint, inner } = parseScopedTerm(term, columns);
    const scope = (_a = hint != null ? hint : activeScope) != null ? _a : null;
    const nextScope = (_b = hint != null ? hint : activeScope) != null ? _b : null;
    if (!scope) return { inner: term, scopedCells: cells, activeScope: nextScope };
    return {
      inner,
      scopedCells: cellsForScope(scope, cellsByKey, columns, cells),
      activeScope: nextScope
    };
  }
  function innerTermForMatch(term, columns) {
    if (!(columns == null ? void 0 : columns.length)) return term;
    return parseScopedTerm(term, columns).inner;
  }
  function matchSmartGroup(andTerms, haystack, cells, cellsByKey, columns) {
    const positives = andTerms.filter((item) => !item.exclude);
    const excludes = andTerms.filter((item) => item.exclude);
    let activeScope = null;
    for (const item of andTerms) {
      if (item.exclude) continue;
      const { scope } = parseScopedTerm(item.term, columns != null ? columns : []);
      if (scope) activeScope = scope;
    }
    for (const item of excludes) {
      const { inner, scopedCells } = scopedCellsForTerm(
        item.term,
        haystack,
        cells,
        cellsByKey,
        columns,
        activeScope
      );
      if (matchQueryTerm(scopedCells.join(" "), inner, { quoted: item.quoted })) return false;
    }
    if (!positives.length) return true;
    const textTerms = positives.filter(
      (item) => !termIsCellScoped(innerTermForMatch(item.term, columns))
    );
    const exprTerms = positives.filter(
      (item) => termIsCellScoped(innerTermForMatch(item.term, columns))
    );
    for (const item of textTerms) {
      const resolved = scopedCellsForTerm(
        item.term,
        haystack,
        cells,
        cellsByKey,
        columns,
        activeScope
      );
      activeScope = resolved.activeScope;
      if (!matchQueryTerm(resolved.scopedCells.join(" "), resolved.inner, { quoted: item.quoted })) {
        return false;
      }
    }
    if (!exprTerms.length) return true;
    const innerExprs = exprTerms.map((item) => innerTermForMatch(item.term, columns));
    const hasTermScope = exprTerms.some(
      (item) => !!parseScopedTerm(item.term, columns != null ? columns : []).scope
    );
    if (!hasTermScope && !activeScope && exprTerms.length > 1 && innerExprs.every((term) => termIsExpression(term) && term.indexOf("%") < 0)) {
      return cells.some((cell) => matchExprTermsOnSameCell(cell, innerExprs));
    }
    for (const item of exprTerms) {
      const resolved = scopedCellsForTerm(
        item.term,
        haystack,
        cells,
        cellsByKey,
        columns,
        activeScope
      );
      activeScope = resolved.activeScope;
      const matched = resolved.scopedCells.some(
        (cell) => matchQueryTerm(cell, resolved.inner, { quoted: item.quoted })
      );
      if (!matched) return false;
    }
    return true;
  }
  function matchSmartHaystackClient(haystack, query, options) {
    const raw = String(query != null ? query : "").trim();
    if (!raw) return true;
    const hay = String(haystack != null ? haystack : "");
    const cells = (options == null ? void 0 : options.cells) ? [...options.cells] : [hay];
    const groups = tokenizeSmartQuery(raw);
    if (!groups.length) return matchQueryTerm(hay, raw);
    for (const andTerms of groups) {
      if (!andTerms.length) continue;
      if (matchSmartGroup(andTerms, hay, cells, options == null ? void 0 : options.cellsByKey, options == null ? void 0 : options.columns)) {
        return true;
      }
    }
    return false;
  }
  function matchColumnFilter(cellText, query, options) {
    var _a;
    const q = String(query != null ? query : "").trim();
    if (!q) return true;
    const profile = (_a = options == null ? void 0 : options.profile) != null ? _a : defaultSearchProfile();
    if (!guardQueryForProfile(q, profile, {
      columns: options == null ? void 0 : options.columns
    })) {
      return false;
    }
    const hay = String(cellText != null ? cellText : "").trim();
    const cells = (options == null ? void 0 : options.cells) ? [...options.cells] : [hay];
    if (!hasSmartSyntax(q) && termIsExpression(q)) {
      return cells.some((cell) => matchColumnExpression(cell, q));
    }
    return matchSmartHaystackClient(hay, q, options);
  }

  // src/grid-view/search/filter-engine.ts
  function isEmptyCellValue(val) {
    const tv = String(val === null || val === void 0 ? "" : val).trim();
    return tv === "" || tv === "-" || tv === "\u2014" || tv === "\u2013" || tv === "[]";
  }
  function isNumericZeroCell(val) {
    return parseNumberForColumnFilter(val) === 0;
  }
  function normalizeFilterMatch(match) {
    return match === "any_token" ? "any_token" : "exact";
  }
  function cellTokensFromText(cellText, match) {
    const trimmed = String(cellText === null || cellText === void 0 ? "" : cellText).trim();
    if (isEmptyCellValue(trimmed)) return [];
    if (match === "any_token") {
      return trimmed.split(/\s+/).map((t2) => t2.trim()).filter((t2) => !isEmptyCellValue(t2));
    }
    return [trimmed];
  }
  function resolveSetFilterTokens(cellText, match, options) {
    if ((options == null ? void 0 : options.tokens) !== void 0) {
      return options.tokens.map((t2) => String(t2).trim()).filter((t2) => !isEmptyCellValue(t2));
    }
    return cellTokensFromText(cellText, match);
  }
  function matchSetFilter(cellText, model, options) {
    var _a;
    if (!model) return true;
    const match = normalizeFilterMatch((_a = options == null ? void 0 : options.match) != null ? _a : "match" in model ? model.match : void 0);
    const tokens = resolveSetFilterTokens(cellText, match, options);
    if ("mode" in model) {
      const isEmpty = tokens.length === 0 || (options == null ? void 0 : options.numeric) === true && isNumericZeroCell(cellText);
      if (model.mode === "empty") return isEmpty;
      if (model.mode === "non_empty") return !isEmpty;
    }
    const values = "values" in model ? model.values : void 0;
    if (Array.isArray(values)) {
      if (!values.length) return false;
      if (!tokens.length) return false;
      const selected = values.map((v) => String(v).trim()).filter((v) => !isEmptyCellValue(v));
      if (match === "any_token") {
        return selected.some((v) => tokens.includes(v));
      }
      return tokens.length === 1 && selected.includes(tokens[0]);
    }
    return true;
  }
  function matchColumnFilterEntry(cellText, entry, options) {
    if (typeof entry === "string") {
      return matchColumnFilter(cellText, entry, { profile: options == null ? void 0 : options.profile });
    }
    return matchSetFilter(cellText, entry, {
      tokens: options == null ? void 0 : options.tokens,
      match: options == null ? void 0 : options.match,
      numeric: (options == null ? void 0 : options.profile) === "numeric" /* Numeric */
    });
  }
  function matchToolbarQuery(haystack, query, options) {
    return matchColumnFilter(haystack, query, {
      ...options,
      profile: bindSearchProfileForToolbar()
    });
  }
  function matchAgGridQuickFilter(haystack, query) {
    if (matchToolbarQuery(haystack, query)) return true;
    const raw = String(query != null ? query : "").trim().toLowerCase();
    if (!raw.includes("-")) return false;
    const hay = String(haystack != null ? haystack : "").toLowerCase();
    return hay.replace(/ /g, "").includes(raw.replace(/-/g, ""));
  }

  // src/grid-view/i18n.ts
  var catalog = {};
  function initI18n(next) {
    catalog = next || {};
  }
  function t(key, fallback) {
    if (catalog[key] && catalog[key] !== key) return catalog[key];
    if (fallback !== void 0) return fallback;
    return key;
  }
  var i18n = { initI18n, t };

  // src/grid-view/set-filter-panel.ts
  function formatValueCount(template, count) {
    return template.replace("%(count)s", String(count));
  }
  function requiredElement(root, selector, constructorFn) {
    const element = root.querySelector(selector);
    if (element instanceof constructorFn) return element;
    throw new Error("SetFilterPanel: missing " + selector);
  }
  function isPresetMode(value) {
    return value === "all" || value === "empty" || value === "non_empty";
  }
  var SetFilterPanel = class {
    constructor(options) {
      this.selectedValues = /* @__PURE__ */ new Set();
      this.allValues = [];
      this.valueCounts = /* @__PURE__ */ new Map();
      this.hasEmptyCells = false;
      this.emptyCount = 0;
      this.filterMode = "all";
      this.searchDrivenFilter = false;
      this.searchDebounceTimer = null;
      this.fieldId = options.fieldId;
      this.onChange = options.onChange || (() => {
      });
      this.loadValues = options.loadValues || (() => ({ values: [], hasEmpty: false, emptyCount: 0 }));
      const L = options.labels || {};
      this.labels = {
        listSearchPlaceholder: L.listSearchPlaceholder || i18n.t("filter.list_search", "Search\u2026"),
        valueCountLabel: L.valueCountLabel || i18n.t("filter.value_count", "%(count)s values"),
        selectAll: L.selectAll || i18n.t("filter.select_all", "All"),
        onlyEmpty: L.onlyEmpty || i18n.t("filter.only_empty", "Empty"),
        nonEmpty: L.nonEmpty || i18n.t("filter.non_empty", "Non-empty"),
        loadingValues: L.loadingValues || i18n.t("filter.loading_values", "Loading values\u2026"),
        noMatches: L.noMatches || i18n.t("filter.no_matches", "No matches"),
        emptyModeHint: L.emptyModeHint || i18n.t("filter.empty_mode_hint", "Showing rows with empty cells")
      };
      this.gui = document.createElement("div");
      this.gui.className = "cm-set-filter-panel";
      this.gui.innerHTML = '<div class="cm-set-filter-modes">' + this._modeCheckbox("all", this.labels.selectAll, true) + this._modeCheckbox("empty", this.labels.onlyEmpty, false) + this._modeCheckbox("non_empty", this.labels.nonEmpty, false) + '</div><div class="cm-set-filter-search-row"><input type="search" class="cm-col-filter-input cm-set-filter-list-search" autocomplete="off"><span class="cm-set-filter-value-count"></span></div><div class="cm-set-filter-list"></div>';
      this.listSearchInput = requiredElement(
        this.gui,
        ".cm-set-filter-list-search",
        HTMLInputElement
      );
      this.valueCountEl = requiredElement(this.gui, ".cm-set-filter-value-count", HTMLElement);
      this.listContainer = requiredElement(this.gui, ".cm-set-filter-list", HTMLElement);
      this.modeCheckboxes = Array.from(
        this.gui.querySelectorAll('input[type="checkbox"][data-cm-filter-mode]')
      );
      this.listSearchInput.placeholder = this.labels.listSearchPlaceholder;
      this.listSearchInput.addEventListener("input", () => {
        this.scheduleSearchFilterApply();
        this.updateValueCount();
        this.renderList();
      });
      this.listSearchInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          this.listSearchInput.value = "";
          this.applyListSearchToFilter();
          this.updateValueCount();
          this.renderList();
          this.onChange();
        }
      });
      this.gui.addEventListener("mousedown", (e) => e.stopPropagation());
      this.gui.addEventListener("click", (e) => e.stopPropagation());
      this.modeCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener("mousedown", (e) => e.stopPropagation());
        checkbox.addEventListener("click", (e) => e.stopPropagation());
        checkbox.addEventListener("change", (e) => {
          e.stopPropagation();
          const target = e.target;
          if (!(target instanceof HTMLInputElement) || !isPresetMode(target.value)) return;
          const mode = target.value;
          if (target.checked) {
            this.searchDrivenFilter = false;
            this.modeCheckboxes.forEach((cb) => {
              if (cb !== target) cb.checked = false;
            });
            this.setFilterMode(mode);
            this.updateValueCount();
            this.renderList();
            this.onChange();
            return;
          }
          this.clearPresetModes();
          this.searchDrivenFilter = false;
          if (mode === "all") {
            this.filterMode = "custom";
            this.selectedValues.clear();
          } else {
            this.filterMode = "custom";
          }
          this.updateValueCount();
          this.renderList();
          this.onChange();
        });
      });
    }
    _modeCheckbox(value, label, checked) {
      return '<label class="cm-set-filter-mode"><input type="checkbox" data-cm-filter-mode="1" value="' + value + '"' + (checked ? " checked" : "") + "><span>" + label + "</span></label>";
    }
    getGui() {
      return this.gui;
    }
    clearPresetModes() {
      this.modeCheckboxes.forEach((cb) => {
        cb.checked = false;
      });
    }
    setFilterMode(mode) {
      this.filterMode = mode;
      if (mode === "all" || mode === "non_empty") {
        this.selectAllNonEmptyValues();
      } else if (mode === "empty") {
        this.selectedValues.clear();
      }
      this.syncPresetModesFromState();
    }
    selectAllNonEmptyValues() {
      this.selectedValues.clear();
      this.allValues.forEach((v) => this.selectedValues.add(v));
    }
    syncPresetModesFromState() {
      this.modeCheckboxes.forEach((checkbox) => {
        checkbox.checked = this.filterMode !== "custom" && checkbox.value === this.filterMode;
      });
    }
    ingestScan(raw) {
      if (Array.isArray(raw)) {
        const emptyInValues = raw.filter(isEmptyCellValue).length;
        this.ingestRawValues(raw, emptyInValues > 0, emptyInValues);
        return;
      }
      this.ingestRawValues(raw.values, raw.hasEmpty, raw.emptyCount, raw.counts);
    }
    ingestRawValues(rawValues, hasEmpty, emptyCount = 0, counts) {
      this.valueCounts.clear();
      if (counts) {
        for (const key in counts) this.valueCounts.set(String(key).trim(), counts[key]);
      }
      this.hasEmptyCells = hasEmpty || rawValues.some(isEmptyCellValue);
      this.emptyCount = emptyCount || (this.hasEmptyCells ? 1 : 0);
      this.allValues = Array.from(
        new Set(
          rawValues.map((v) => String(v != null ? v : "").trim()).filter((v) => !isEmptyCellValue(v))
        )
      ).sort();
      this.updateValueCount();
    }
    updateValueCount() {
      const term = this.listSearchInput.value.trim();
      let count;
      if (this.filterMode === "empty") {
        count = this.emptyCount;
      } else if (this.filterMode === "non_empty") {
        count = this.allValues.length;
      } else if (term) {
        count = this.visibleValues().length;
      } else {
        count = this.allValues.length;
      }
      this.valueCountEl.textContent = String(count);
      this.valueCountEl.setAttribute(
        "aria-label",
        formatValueCount(this.labels.valueCountLabel, count)
      );
    }
    scheduleSearchFilterApply() {
      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.searchDebounceTimer = null;
        this.applyListSearchToFilter();
        this.onChange();
      }, 200);
    }
    applyListSearchToFilter() {
      const term = this.listSearchInput.value.toLowerCase().trim();
      if (!term) {
        if (this.searchDrivenFilter) {
          this.searchDrivenFilter = false;
          this.filterMode = "all";
          this.selectAllNonEmptyValues();
          this.syncPresetModesFromState();
        }
        return;
      }
      this.searchDrivenFilter = true;
      this.clearPresetModes();
      this.filterMode = "custom";
      this.selectedValues.clear();
      this.visibleValues().forEach((v) => this.selectedValues.add(v));
    }
    visibleValues() {
      const searchTerm = this.listSearchInput.value.toLowerCase().trim();
      return this.allValues.filter((v) => v.toLowerCase().includes(searchTerm));
    }
    async refreshValues() {
      this.listContainer.innerHTML = '<div class="cm-set-filter-message">' + this.labels.loadingValues + "</div>";
      const raw = await this.loadValues();
      this.ingestScan(raw);
      if (this.filterMode === "all" && this.selectedValues.size === 0) {
        this.selectAllNonEmptyValues();
      }
      this.renderList();
    }
    renderList() {
      this.listContainer.innerHTML = "";
      this.updateValueCount();
      if (this.filterMode === "empty") {
        this.listContainer.innerHTML = '<div class="cm-set-filter-message">' + this.labels.emptyModeHint + "</div>";
        return;
      }
      const filteredValues = this.visibleValues();
      filteredValues.sort((a, b) => {
        const aChecked = this.isValueChecked(a);
        const bChecked = this.isValueChecked(b);
        if (aChecked && !bChecked) return -1;
        if (!aChecked && bChecked) return 1;
        return a.localeCompare(b);
      });
      if (!filteredValues.length) {
        this.listContainer.innerHTML = '<div class="cm-set-filter-message">' + this.noMatchesLabel() + "</div>";
        return;
      }
      let hasChecked = false;
      let hasUnchecked = false;
      filteredValues.forEach((val) => {
        const isChecked = this.isValueChecked(val);
        if (isChecked) hasChecked = true;
        if (!isChecked && hasChecked && !hasUnchecked) {
          const separator = document.createElement("div");
          separator.className = "cm-set-filter-separator";
          this.listContainer.appendChild(separator);
          hasUnchecked = true;
        }
        const safeIdSuffix = btoa(encodeURIComponent(val)).replace(/[^a-zA-Z0-9]/g, "");
        const id = "filter-" + this.fieldId + "-" + safeIdSuffix;
        const item = document.createElement("label");
        item.className = "cm-set-filter-item";
        item.htmlFor = id;
        const count = this.valueCounts.get(val);
        const countHtml = count === void 0 ? "" : '<span class="cm-set-filter-item-count">' + String(count) + "</span>";
        item.innerHTML = '<input type="checkbox" id="' + id + '"' + (isChecked ? " checked" : "") + '><span class="cm-set-filter-item-label">' + val + "</span>" + countHtml;
        const checkbox = requiredElement(item, "input", HTMLInputElement);
        checkbox.addEventListener("mousedown", (e) => e.stopPropagation());
        checkbox.addEventListener("click", (e) => e.stopPropagation());
        checkbox.addEventListener("change", (e) => {
          e.stopPropagation();
          const target = e.target;
          if (!(target instanceof HTMLInputElement)) return;
          this.clearPresetModes();
          this.searchDrivenFilter = false;
          this.filterMode = "custom";
          if (target.checked) this.selectedValues.add(val);
          else this.selectedValues.delete(val);
          this.onChange();
          this.renderList();
        });
        this.listContainer.appendChild(item);
      });
      this.syncPresetModesFromState();
    }
    isValueChecked(val) {
      if (this.filterMode === "non_empty") return true;
      if (this.filterMode === "empty") return false;
      return this.selectedValues.has(val);
    }
    noMatchesLabel() {
      return this.labels.noMatches;
    }
    isFilterActive() {
      if (this.filterMode === "empty" || this.filterMode === "non_empty") return true;
      if (this.filterMode === "custom") {
        if (this.selectedValues.size === 0) return true;
        return this.selectedValues.size !== this.allValues.length;
      }
      return false;
    }
    getModel(match = "exact") {
      if (!this.isFilterActive()) return null;
      if (this.filterMode === "empty") return { mode: "empty", match };
      if (this.filterMode === "non_empty") return { mode: "non_empty", match };
      if (this.selectedValues.size === 0) return { values: [], match };
      return { values: Array.from(this.selectedValues), match };
    }
    setModel(model) {
      this.searchDrivenFilter = false;
      this.listSearchInput.value = "";
      if (!model) {
        this.filterMode = "all";
        this.selectAllNonEmptyValues();
      } else if ("mode" in model && model.mode === "empty") {
        this.filterMode = "empty";
        this.selectedValues.clear();
      } else if ("mode" in model && model.mode === "non_empty") {
        this.filterMode = "non_empty";
        this.selectAllNonEmptyValues();
      } else if ("values" in model && Array.isArray(model.values)) {
        this.filterMode = "custom";
        this.selectedValues.clear();
        model.values.forEach((v) => {
          if (!isEmptyCellValue(v)) this.selectedValues.add(String(v).trim());
        });
      }
      this.syncPresetModesFromState();
      this.renderList();
    }
  };

  // src/ag-grid/smart-filter.ts
  var AgGridSmartFilter = class {
    init(params) {
      this.params = params;
      this.field = params.colDef.field;
      this.filterMatch = normalizeFilterMatch(params.colDef.filterMatch);
      this.panel = new SetFilterPanel({
        fieldId: this.field,
        onChange: () => this.params.filterChangedCallback(),
        loadValues: () => this._loadValues()
      });
      this.gui = this.panel.getGui();
    }
    async _loadValues() {
      var _a, _b;
      const valuesSet = /* @__PURE__ */ new Set();
      const context = this.params.api.getGridOption("context");
      const gridCtx = isGridContext(context) ? context : {};
      const gridId = gridCtx.gridId;
      const qf = gridId && typeof ((_b = (_a = window.GridView) == null ? void 0 : _a.AgGrid) == null ? void 0 : _b.getQuickSearchText) === "function" ? window.GridView.AgGrid.getQuickSearchText(gridId) : "";
      const qfLower = qf ? String(qf).toLowerCase().trim() : "";
      const rowModelType = this.params.api.getGridOption("rowModelType");
      const dictUrl = gridCtx.dictionaryUrl;
      if (rowModelType === "infinite" && dictUrl) {
        try {
          const qs = window.location.search;
          const sep = dictUrl.includes("?") ? "&" : "?";
          let fetchUrl = dictUrl + sep + "field=" + encodeURIComponent(this.field);
          if (gridId) fetchUrl += "&grid=" + encodeURIComponent(gridId);
          if (qs.length > 1) {
            const urlParams = new URLSearchParams(qs);
            urlParams.delete("q");
            const extra = urlParams.toString();
            if (extra) fetchUrl += "&" + extra;
          }
          if (qfLower) fetchUrl += "&q=" + encodeURIComponent(qfLower);
          const response = await fetch(fetchUrl);
          if (response.ok) {
            const data = await response.json();
            if (isDictionaryResponse(data)) {
              const values = [];
              const counts = {};
              let hasCounts = false;
              data.values.forEach((entry) => {
                const parsed = readDictionaryEntry(entry);
                values.push(parsed.value);
                if (parsed.count !== void 0) {
                  counts[parsed.value] = parsed.count;
                  hasCounts = true;
                }
              });
              return {
                values,
                hasEmpty: false,
                emptyCount: 0,
                counts: hasCounts ? counts : void 0
              };
            }
          }
        } catch (err) {
          console.error("Failed to load filter dictionary:", err);
        }
      }
      this.params.api.forEachNode((node) => {
        if (qfLower && node.data) {
          let matches = false;
          for (const key in node.data) {
            const cellVal = node.data[key];
            if (cellVal !== null && cellVal !== void 0 && String(cellVal).toLowerCase().includes(qfLower)) {
              matches = true;
              break;
            }
          }
          if (!matches) return;
        }
        valuesSet.add(this._cellValue({ data: node.data }));
      });
      return Array.from(valuesSet);
    }
    afterGuiAttached() {
      const filterWasActive = this.isFilterActive();
      void this.panel.refreshValues().then(() => {
        if (!filterWasActive && this.panel.filterMode === "all") {
          this.panel.selectAllNonEmptyValues();
          this.panel.renderList();
        }
        window.setTimeout(() => {
          const input = this.gui.querySelector(".cm-set-filter-list-search");
          input == null ? void 0 : input.focus();
        }, 50);
      });
    }
    getGui() {
      return this.gui;
    }
    _cellValue(params) {
      let val;
      if (this.params.valueGetter) {
        val = this.params.valueGetter(params);
      }
      if (val === void 0 && params.data) {
        val = params.data[this.field];
      }
      return String(val === null || val === void 0 ? "" : val).trim();
    }
    doesFilterPass(params) {
      if (!params.data) return false;
      const model = this._activeSetModel();
      const trimmed = this._cellValue(params);
      const tokens = this.filterMatch === "any_token" ? trimmed.split(/\s+/).map((token) => token.trim()).filter((token) => !isEmptyCellValue(token)) : void 0;
      return matchSetFilter(trimmed, model, { tokens, match: this.filterMatch });
    }
    _activeSetModel() {
      return this.panel.getModel(this.filterMatch);
    }
    isFilterActive() {
      return this.panel.isFilterActive();
    }
    getModel() {
      return this._activeSetModel();
    }
    setModel(model) {
      this.panel.setModel(model);
    }
  };
  function isGridContext(value) {
    return !!value && typeof value === "object";
  }
  function isDictionaryResponse(value) {
    if (!value || typeof value !== "object") return false;
    const payload = value;
    return Array.isArray(payload.values) && payload.values.length > 0;
  }
  function readDictionaryEntry(entry) {
    if (entry && typeof entry === "object") {
      const obj = entry;
      const value = obj.value === null || obj.value === void 0 ? "" : String(obj.value).trim();
      const count = typeof obj.count === "number" ? obj.count : void 0;
      return { value, count };
    }
    return { value: entry === null || entry === void 0 ? "" : String(entry).trim() };
  }
  function installAgGridSmartFilter(gv5) {
    var _a;
    gv5.AgGrid = (_a = gv5.AgGrid) != null ? _a : {};
    gv5.AgGrid.SmartFilter = AgGridSmartFilter;
  }

  // src/ag-grid-smart-filter.ts
  var gv3 = window.GridView = window.GridView || {};
  if (window.GridViewI18n) {
    i18n.initI18n(window.GridViewI18n);
  }
  installAgGridSmartFilter(gv3);

  // src/grid-view/expr-filter-panel.ts
  function requiredInput(root, selector) {
    const el = root.querySelector(selector);
    if (el instanceof HTMLInputElement) return el;
    throw new Error("ExprFilterPanel: missing " + selector);
  }
  var ExprFilterPanel = class {
    constructor(options) {
      this.mode = "all";
      this.query = "";
      this.debounceTimer = null;
      var _a, _b;
      this.fieldId = options.fieldId;
      this.profile = (_a = options.profile) != null ? _a : "default" /* Default */;
      this.match = (_b = options.match) != null ? _b : "exact";
      this.onChange = options.onChange || (() => {
      });
      this.gui = document.createElement("div");
      this.gui.className = "cm-set-filter-panel cm-expr-filter-panel";
      this.gui.innerHTML = '<div class="cm-set-filter-modes">' + this._modeCheckbox("all", i18n.t("filter.select_all", "All"), true) + this._modeCheckbox("empty", i18n.t("filter.only_empty", "Empty"), false) + this._modeCheckbox("non_empty", i18n.t("filter.non_empty", "Non-empty"), false) + '</div><div class="cm-set-filter-search-row"><input type="search" class="cm-col-filter-input cm-expr-filter-input" autocomplete="off"></div>';
      this.exprInput = requiredInput(this.gui, ".cm-expr-filter-input");
      this.exprInput.placeholder = i18n.t(
        columnFilterPlaceholderKey(this.profile),
        i18n.t("column_filter.placeholder", "Search: >10, %name%")
      );
      this.modeCheckboxes = Array.from(
        this.gui.querySelectorAll('input[type="checkbox"][data-cm-filter-mode]')
      );
      this.gui.addEventListener("mousedown", (e) => e.stopPropagation());
      this.gui.addEventListener("click", (e) => e.stopPropagation());
      this.exprInput.addEventListener("input", () => {
        this.query = this.exprInput.value;
        if (this.query.trim()) {
          this.mode = "expr";
          this._clearModeCheckboxes();
        } else {
          this.mode = "all";
          this._syncAllChecked();
        }
        this._scheduleApply();
      });
      this.exprInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          this._cancelTimer();
          this.query = this.exprInput.value;
          if (this.query.trim()) {
            this.mode = "expr";
            this._clearModeCheckboxes();
          }
          this.onChange();
        } else if (e.key === "Escape") {
          e.preventDefault();
          this.exprInput.value = "";
          this.query = "";
          this.mode = "all";
          this._cancelTimer();
          this.onChange();
        }
      });
      this.modeCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener("mousedown", (e) => e.stopPropagation());
        checkbox.addEventListener("click", (e) => e.stopPropagation());
        checkbox.addEventListener("change", (e) => {
          e.stopPropagation();
          const target = e.target;
          if (!(target instanceof HTMLInputElement)) return;
          this._cancelTimer();
          this.query = "";
          this.exprInput.value = "";
          if (target.checked && (target.value === "empty" || target.value === "non_empty")) {
            this.mode = target.value;
            this.modeCheckboxes.forEach((cb) => {
              cb.checked = cb === target;
            });
          } else {
            this.mode = "all";
            this._syncAllChecked();
          }
          this.onChange();
        });
      });
    }
    _modeCheckbox(value, label, checked) {
      return '<label class="cm-set-filter-mode"><input type="checkbox" data-cm-filter-mode="1" value="' + value + '"' + (checked ? " checked" : "") + "><span>" + label + "</span></label>";
    }
    _clearModeCheckboxes() {
      this.modeCheckboxes.forEach((cb) => {
        cb.checked = false;
      });
    }
    /** Reflect "no filter" state — only the "All" checkbox is ticked. */
    _syncAllChecked() {
      this.modeCheckboxes.forEach((cb) => {
        cb.checked = cb.value === "all";
      });
    }
    _cancelTimer() {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    }
    _scheduleApply() {
      this._cancelTimer();
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.onChange();
      }, 200);
    }
    getGui() {
      return this.gui;
    }
    getModel() {
      if (this.mode === "empty") return { mode: "empty", match: this.match };
      if (this.mode === "non_empty") return { mode: "non_empty", match: this.match };
      const q = this.query.trim();
      return q ? q : null;
    }
    setModel(entry) {
      this._clearModeCheckboxes();
      if (!entry) {
        this.mode = "all";
        this.query = "";
        this.exprInput.value = "";
        this._syncAllChecked();
      } else if (typeof entry === "string") {
        this.mode = "expr";
        this.query = entry;
        this.exprInput.value = entry;
      } else if ("mode" in entry && (entry.mode === "empty" || entry.mode === "non_empty")) {
        const modeValue = entry.mode;
        this.mode = modeValue;
        this.query = "";
        this.exprInput.value = "";
        const cb = this.modeCheckboxes.find((c) => c.value === modeValue);
        if (cb) cb.checked = true;
      }
    }
    isFilterActive() {
      if (this.mode === "empty" || this.mode === "non_empty") return true;
      return !!this.query.trim();
    }
    focus() {
      window.setTimeout(() => {
        this.exprInput.focus();
        this.exprInput.select();
      }, 0);
    }
  };

  // src/ag-grid/expr-filter.ts
  var EXPR_FILTER_TYPE = "cm-expr";
  function profileForColDef(colDef) {
    if (colDef.columnFilter) return resolveSearchProfile(colDef.columnFilter);
    if (colDef.type === "numericColumn") return "numeric" /* Numeric */;
    return "text" /* Text */;
  }
  var AgGridExprFilter = class {
    constructor() {
      this.numeric = false;
    }
    init(params) {
      this.params = params;
      this.field = params.colDef.field;
      this.filterMatch = normalizeFilterMatch(params.colDef.filterMatch);
      const profile = profileForColDef(params.colDef);
      this.numeric = profile === "numeric" /* Numeric */;
      this.panel = new ExprFilterPanel({
        fieldId: this.field,
        profile,
        match: this.filterMatch,
        onChange: () => this.params.filterChangedCallback()
      });
      this.gui = this.panel.getGui();
    }
    afterGuiAttached() {
      this.panel.focus();
    }
    getGui() {
      return this.gui;
    }
    _cellValue(params) {
      let val;
      if (this.params.valueGetter) val = this.params.valueGetter(params);
      if (val === void 0 && params.data) val = params.data[this.field];
      return String(val === null || val === void 0 ? "" : val).trim();
    }
    doesFilterPass(params) {
      if (!params.data) return false;
      const entry = this.panel.getModel();
      if (!entry) return true;
      return matchColumnFilterEntry(this._cellValue(params), entry, {
        match: this.filterMatch,
        profile: this.numeric ? "numeric" /* Numeric */ : "text" /* Text */
      });
    }
    isFilterActive() {
      return this.panel.isFilterActive();
    }
    getModel() {
      const entry = this.panel.getModel();
      if (!entry) return null;
      if (typeof entry === "string") {
        return { filterType: EXPR_FILTER_TYPE, expr: entry, numeric: this.numeric };
      }
      if ("mode" in entry && (entry.mode === "empty" || entry.mode === "non_empty")) {
        return { filterType: EXPR_FILTER_TYPE, mode: entry.mode, numeric: this.numeric };
      }
      return null;
    }
    setModel(model) {
      if (!model) {
        this.panel.setModel(null);
        return;
      }
      if (model.mode === "empty" || model.mode === "non_empty") {
        this.panel.setModel({ mode: model.mode, match: this.filterMatch });
        return;
      }
      const entry = typeof model.expr === "string" && model.expr.trim() ? model.expr : null;
      this.panel.setModel(entry);
    }
  };
  function installAgGridExprFilter(gv5) {
    var _a;
    gv5.AgGrid = (_a = gv5.AgGrid) != null ? _a : {};
    gv5.AgGrid.ExprFilter = AgGridExprFilter;
  }

  // src/ag-grid-expr-filter.ts
  var gv4 = window.GridView = window.GridView || {};
  installAgGridExprFilter(gv4);

  // src/ag-grid-advanced-search.ts
  (function() {
    var gv5 = window.GridView = window.GridView || {};
    gv5.AgGrid = gv5.AgGrid || {};
    gv5.AgGrid.matchQuickFilter = matchAgGridQuickFilter;
    gv5.AgGrid.createAdvancedSearch = function(inputSelector) {
      if (inputSelector === void 0) inputSelector = "#ag-quick-filter";
      return function(_quickFilterParts, rowQuickFilterAggregateText) {
        const inputElement = document.querySelector(inputSelector);
        const searchExpr = inputElement instanceof HTMLInputElement ? inputElement.value : "";
        if (!searchExpr) return true;
        return matchAgGridQuickFilter(rowQuickFilterAggregateText, searchExpr);
      };
    };
  })();
})();
