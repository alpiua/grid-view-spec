import { AgGridHost } from "../src/ag-grid/host";
import type { ColumnState } from "ag-grid-community";
import { installConfirmationInterceptors } from "../src/grid-view/confirmation-interceptor";
import { bootAgGridSpecFromDocument } from "../src/runtime/table-ag-grid";
import {
  pageColumnStoreForRoot,
  putPageColumnPresets,
  putPageColumns,
  readPageColumnPresets,
  readPageColumns,
} from "../src/column-settings/page-state";
import { PageState } from "../src/page-state/page-state";
import {
  asDomElement,
  assertState,
  isRecord,
  PageStateBrowserHarness,
} from "./page-state-browser-fixtures";

function objectAt(value: unknown, key: string): Record<string, unknown> {
  assertState(isRecord(value) && isRecord(value[key]), `Expected object at ${key}`);
  return value[key];
}

/** Proves scope identity, malformed recovery, and literal page-state namespace support. */
function verifyPageStateIdentityAndRecovery(): void {
  const browser = new PageStateBrowserHarness();
  const firstRoot = browser.specRoot("products", "pim.products");
  const secondRoot = browser.specRoot("products", "pim.stock");
  const thirdRoot = browser.specRoot("stock", "pim.products");
  const first = PageState.forRoot(asDomElement(firstRoot));
  const second = PageState.forRoot(asDomElement(secondRoot));
  const third = PageState.forRoot(asDomElement(thirdRoot));
  assertState(
    first !== null && second !== null && third !== null,
    "Connected spec roots did not receive page-state handles",
  );

  first.put("layout.drawer", { open: true });
  first.put("layout.filters", { open: false });
  second.put("layout.drawer", { open: false });
  third.put("layout.drawer", { open: "stock" });
  assertState(
    JSON.stringify(first.get("layout.drawer")) === JSON.stringify({ open: true }),
    "Same spec id with a distinct scope leaked first page state",
  );
  assertState(
    JSON.stringify(second.get("layout.drawer")) === JSON.stringify({ open: false }),
    "Same spec id with a distinct scope leaked second page state",
  );
  assertState(
    JSON.stringify(third.get("layout.drawer")) === JSON.stringify({ open: "stock" }),
    "A distinct spec id with the same scope leaked page state",
  );
  first.remove("layout.drawer");
  assertState(first.get("layout.drawer") === undefined, "PageState.remove did not delete its namespace");
  assertState(
    JSON.stringify(first.get("layout.filters")) === JSON.stringify({ open: false }),
    "PageState.remove deleted another namespace",
  );
  assertState(
    JSON.stringify(second.get("layout.drawer")) === JSON.stringify({ open: false }) &&
      JSON.stringify(third.get("layout.drawer")) === JSON.stringify({ open: "stock" }),
    "PageState.remove leaked across isolated spec roots",
  );
  first.put("layout.drawer", { open: true });

  const [firstKey] = browser.storage.keys();
  assertState(typeof firstKey === "string", "Page state did not create a scoped browser key");
  browser.storage.setItem(firstKey, "{bad-json");
  assertState(first.get("layout.drawer") === undefined, "Malformed browser state was treated as valid");
  first.put("layout.drawer", { open: true, width: 480 });
  assertState(
    JSON.stringify(first.get("layout.drawer")) === JSON.stringify({ open: true, width: 480 }),
    "A valid put did not replace malformed browser state",
  );

  const longSpecId = "s".repeat(256);
  const longBlockId = "b".repeat(256);
  const literalBlockId = "variant / Black";
  const literalRoot = browser.specRoot(longSpecId, "scope / desktop");
  const literalStore = pageColumnStoreForRoot(asDomElement(literalRoot), literalBlockId);
  const longStore = pageColumnStoreForRoot(asDomElement(literalRoot), longBlockId);
  assertState(literalStore !== null && longStore !== null, "Literal page-state grid ids were rejected");
  assertState(
    putPageColumns(literalStore, [{ colId: "name", hide: false, pinned: null, width: 240 }]),
    "A block id with spaces and slashes could not persist columns",
  );
  assertState(
    putPageColumns(longStore, [{ colId: "sku", hide: false, pinned: null, width: 180 }]),
    "A 256-character block/spec identity could not persist columns",
  );
}

/** Proves generic persisted columns do not retain AG Grid-only fields. */
function verifyPortableColumnState(): void {
  const browser = new PageStateBrowserHarness();
  const root = browser.specRoot("products", "pim.products");
  const store = pageColumnStoreForRoot(asDomElement(root), "catalog");
  assertState(store !== null, "Column store did not resolve from a spec root");
  assertState(
    putPageColumns(store, [
      {
        colId: "price",
        hide: true,
        pinned: "right",
        width: 144,
        flex: 1,
        sort: "desc",
        sortIndex: 0,
      },
    ]),
    "Native column state could not be persisted through the portable adapter",
  );
  const raw = store.handle.get(store.columnsNamespace);
  assertState(Array.isArray(raw) && raw.length === 1 && isRecord(raw[0]), "Portable columns were not stored");
  assertState(
    JSON.stringify(Object.keys(raw[0]).sort()) === JSON.stringify(["hidden", "id", "pinned", "width"]),
    "Portable columns retained renderer-specific fields",
  );
  const restored = readPageColumns(store);
  assertState(
    JSON.stringify(restored) ===
      JSON.stringify([{ colId: "price", hide: true, pinned: "right", width: 144 }]),
    "Portable columns did not decode into the adapter-native shape",
  );
  putPageColumnPresets(store, {
    compact: { columns: [{ colId: "price", hide: false, pinned: null }], pageState: { search: "tent" } },
  });
  assertState(
    JSON.stringify(readPageColumnPresets(store)) ===
      JSON.stringify({ compact: { columns: [{ colId: "price", hide: false, pinned: null, width: null }], pageState: { search: "tent" } } }),
    "Local preset state did not round-trip through PageState",
  );
}

/** Proves AG Grid receives restored native state before createGrid and URL state wins. */
function verifyAgGridInitialStateAndUrlPrecedence(): void {
  const browser = new PageStateBrowserHarness(
    `?q=url%20query&filters=${encodeURIComponent(JSON.stringify({ brand: { filter: "URL" } }))}`,
  );
  const root = browser.specRoot("products", "pim.products");
  const grid = browser.child(root, "catalog-grid");
  browser.input("ag-quick-filter-catalog");
  const handle = PageState.forRoot(asDomElement(root));
  assertState(handle !== null, "AG Grid test root did not receive page state");
  handle.put("grid.catalog.columns", [
    { id: "title", hidden: false, width: 320 },
    { id: "price", hidden: true, pinned: "right", width: 115 },
  ]);
  handle.put("grid.catalog.ag_grid", {
    sort: { sortModel: [{ colId: "price", sort: "desc" }] },
    columnSizing: { columnSizingModel: [{ colId: "title", flex: 1 }] },
    filterState: { brand: { filter: "stored" } },
    quickFilter: "stored query",
  });

  const host = new AgGridHost(
    "catalog",
    grid.id,
    { context: { syncUrlState: false } },
    null,
    null,
    null,
  );
  host.initGrid();

  const capture = browser.capturedGrid();
  const initial = capture.initialState;
  assertState(isRecord(initial), "AG Grid did not receive native initial state before creation");
  assertState(
    JSON.stringify(objectAt(initial, "sort")) === JSON.stringify({ sortModel: [{ colId: "price", sort: "desc" }] }),
    "Restored sort was not passed into AG Grid initialState",
  );
  const sizing = objectAt(initial, "columnSizing").columnSizingModel;
  assertState(Array.isArray(sizing), "Restored sizing did not reach AG Grid initialState");
  assertState(
    JSON.stringify(sizing) ===
      JSON.stringify([{ colId: "title", width: 320, flex: 1 }, { colId: "price", width: 115 }]),
    "Restored widths and flex sizing were not combined before AG Grid creation",
  );
  assertState(
    JSON.stringify(capture.api.filterModel) === JSON.stringify({ brand: { filter: "URL" } }),
    "URL filters did not override saved browser filters",
  );
  assertState(
    JSON.stringify(objectAt(objectAt(initial, "filter"), "filterModel")) ===
      JSON.stringify({ brand: { filter: "URL" } }),
    "URL filters were not passed to AG Grid before grid creation",
  );
  assertState(
    browser.inputValue("ag-quick-filter-catalog") === "url query",
    "URL q did not override saved browser quick filter",
  );

  const savedFilterBrowser = new PageStateBrowserHarness();
  const savedFilterRoot = savedFilterBrowser.specRoot("products", "pim.products");
  const savedFilterGrid = savedFilterBrowser.child(savedFilterRoot, "saved-filter-grid");
  const savedFilterHandle = PageState.forRoot(asDomElement(savedFilterRoot));
  assertState(savedFilterHandle !== null, "Saved-filter root did not receive page state");
  savedFilterHandle.put("grid.saved_filter.ag_grid", {
    filterState: { brand: { filter: "stored" } },
  });
  new AgGridHost(
    "saved_filter",
    savedFilterGrid.id,
    { context: { syncUrlState: false } },
    null,
    null,
    null,
  ).initGrid();
  const savedFilterInitial = savedFilterBrowser.capturedGrid().initialState;
  assertState(
    isRecord(savedFilterInitial) &&
      JSON.stringify(objectAt(objectAt(savedFilterInitial, "filter"), "filterModel")) ===
        JSON.stringify({ brand: { filter: "stored" } }),
    "Saved browser filters were not passed to AG Grid before grid creation",
  );

  const emptySortBrowser = new PageStateBrowserHarness();
  const emptyRoot = emptySortBrowser.specRoot("products", "pim.products");
  const emptyGrid = emptySortBrowser.child(emptyRoot, "empty-sort-grid");
  const emptyHandle = PageState.forRoot(asDomElement(emptyRoot));
  assertState(emptyHandle !== null, "Empty-sort root did not receive page state");
  emptyHandle.put("grid.empty_sort.ag_grid", { sort: { sortModel: [] } });
  new AgGridHost(
    "empty_sort",
    emptyGrid.id,
    { context: { syncUrlState: false } },
    null,
    null,
    null,
  ).initGrid();
  const emptyInitial = emptySortBrowser.capturedGrid().initialState;
  assertState(
    isRecord(emptyInitial) && JSON.stringify(emptyInitial.sort) === JSON.stringify({ sortModel: [] }),
    "An explicit empty saved sort was not passed to AG Grid as a clear",
  );
}

/** Proves reinitialization drops transient URL filters and retains configured initial filters. */
function verifyAgGridFilterStateReinitialization(): void {
  const urlFilter = { brand: { filter: "URL" } };
  const search = `?filters=${encodeURIComponent(JSON.stringify(urlFilter))}`;

  const browser = new PageStateBrowserHarness(search);
  const root = browser.specRoot("products", "pim.products");
  const grid = browser.child(root, "reinitialized-grid");
  const host = new AgGridHost(
    "reinitialized",
    grid.id,
    { context: { syncUrlState: false } },
    null,
    null,
    null,
  );
  host.initGrid();
  assertState(
    JSON.stringify(browser.capturedGrid().api.filterModel) === JSON.stringify(urlFilter),
    "URL filters were not applied before the first grid creation",
  );
  host.clearAllFilters();
  host.initGrid();

  const emptyReinit = browser.capturedGrids()[1];
  assertState(emptyReinit !== undefined, "The same host did not create a second grid");
  assertState(
    emptyReinit.api.filterModel === null && emptyReinit.initialState === null,
    "A cleared URL filter remained in the reinitialized grid initial state",
  );
  assertState(
    emptyReinit.api.setFilterModelCalls.length === 0,
    "An empty filter state was cleared again after grid creation",
  );

  const configuredFilter = { brand: { filter: "configured" } };
  const configuredBrowser = new PageStateBrowserHarness(search);
  const configuredRoot = configuredBrowser.specRoot("products", "pim.products");
  const configuredGrid = configuredBrowser.child(configuredRoot, "configured-grid");
  const configuredHost = new AgGridHost(
    "configured",
    configuredGrid.id,
    {
      context: { syncUrlState: false },
      initialState: { filter: { filterModel: configuredFilter } },
    },
    null,
    null,
    null,
  );
  configuredHost.initGrid();
  assertState(
    JSON.stringify(configuredBrowser.capturedGrid().api.filterModel) === JSON.stringify(urlFilter),
    "URL filters did not override the configured initial filter",
  );
  configuredHost.clearAllFilters();
  configuredHost.initGrid();

  const configuredReinit = configuredBrowser.capturedGrids()[1];
  assertState(configuredReinit !== undefined, "The configured host did not create a second grid");
  assertState(
    JSON.stringify(configuredReinit.api.filterModel) === JSON.stringify(configuredFilter),
    "Reinitialization did not restore the configured initial filter",
  );
  assertState(
    configuredReinit.api.setFilterModelCalls.length === 0,
    "The configured initial filter was cleared after grid creation",
  );
}

/** Proves restored quick search is present before AG Grid can request rows. */
function verifyQuickSearchBeforeGridCreation(): void {
  const browser = new PageStateBrowserHarness();
  const root = browser.specRoot("products", "pim.products");
  const grid = browser.child(root, "restored-search-grid");
  browser.input("ag-quick-filter-restored_search");
  const state = PageState.forRoot(asDomElement(root));
  assertState(state !== null, "Restored-search root did not receive page state");
  state.put("grid.restored_search.ag_grid", { quickFilter: "saved search" });

  const agGrid = window.agGrid;
  assertState(agGrid !== undefined, "AG Grid test harness was not installed");
  const createGrid = agGrid.createGrid;
  let optionAtCreate: unknown;
  let inputAtCreate: string | null = null;
  agGrid.createGrid = (element, options) => {
    optionAtCreate = Reflect.get(options, "quickFilterText");
    inputAtCreate = browser.inputValue("ag-quick-filter-restored_search");
    return createGrid(element, options);
  };
  try {
    new AgGridHost(
      "restored_search",
      grid.id,
      { context: { syncUrlState: false } },
      null,
      null,
      null,
    ).initGrid();
  } finally {
    agGrid.createGrid = createGrid;
  }
  assertState(optionAtCreate === "saved search", "Restored search was not passed to initial grid options");
  assertState(inputAtCreate === "saved search", "Restored search input was not populated before grid creation");
}

/** Proves theme observation stays root-scoped and disconnects on HTMX cleanup. */
function verifyThemeObserverCleanup(): void {
  const browser = new PageStateBrowserHarness();
  const grid = browser.child(browser.specRoot("products", "pim.products"), "theme-grid");
  let disconnected = false;
  let rootScoped = false;
  const mutationObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "MutationObserver");
  class TrackingObserver {
    constructor(_callback: MutationCallback) {}
    observe(_target: Node, options?: MutationObserverInit): void {
      rootScoped = options?.attributes === true && !options.childList && !options.subtree;
    }
    disconnect(): void { disconnected = true; }
    takeRecords(): MutationRecord[] { return []; }
  }
  Object.defineProperty(globalThis, "MutationObserver", {
    configurable: true,
    value: TrackingObserver,
  });
  let cleanup: EventListenerOrEventListenerObject | undefined;
  const addEventListener = document.addEventListener;
  Object.defineProperty(document, "addEventListener", {
    configurable: true,
    value: (type: string, listener: EventListenerOrEventListenerObject): void => {
      if (type === "htmx:beforeCleanupElement") cleanup = listener;
      else addEventListener.call(document, type, listener);
    },
  });
  try {
    new AgGridHost("theme", grid.id, { context: { syncUrlState: false } }, null, null, null).initGrid();
    assertState(rootScoped, "Theme observer watched descendant mutations");
    assertState(cleanup !== undefined, "HTMX cleanup hook was not installed");
    const event = new Event("htmx:beforeCleanupElement");
    Object.defineProperty(event, "target", { value: grid });
    if (typeof cleanup === "function") cleanup.call(document, event);
    else cleanup.handleEvent(event);
    assertState(disconnected, "HTMX grid cleanup left the theme observer connected");
  } finally {
    Object.defineProperty(document, "addEventListener", { configurable: true, value: addEventListener });
    if (mutationObserverDescriptor) {
      Object.defineProperty(globalThis, "MutationObserver", mutationObserverDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "MutationObserver");
    }
  }
}

/** Proves non-confirm HTMX requests pass through and native confirm stays synchronous. */
function verifyConfirmationPassThrough(): void {
  const nativeConfirm = (): boolean => true;
  Object.defineProperty(window, "confirm", { configurable: true, writable: true, value: nativeConfirm });
  let handler: EventListenerOrEventListenerObject | undefined;
  const addEventListener = document.addEventListener;
  Object.defineProperty(document, "addEventListener", {
    configurable: true,
    value: (type: string, listener: EventListenerOrEventListenerObject): void => {
      if (type === "htmx:confirm") handler = listener;
      else addEventListener.call(document, type, listener);
    },
  });
  try {
    installConfirmationInterceptors();
    assertState(window.confirm === nativeConfirm && window.confirm() === true, "Native confirm was intercepted");
    assertState(handler !== undefined, "HTMX confirmation listener was not installed");
    const event = new CustomEvent("htmx:confirm", {
      detail: { issueRequest: (): void => { throw new Error("Non-confirm request was intercepted"); } },
    });
    if (typeof handler === "function") handler.call(document, event);
    else handler.handleEvent(event);
  } finally {
    Object.defineProperty(document, "addEventListener", { configurable: true, value: addEventListener });
  }
}

/** Exercises filter-driven column refresh through the spec boot event path. */
async function verifyDynamicColumnRefreshPreservesState(): Promise<void> {
  const browser = new PageStateBrowserHarness();
  const root = browser.specRoot("products", "pim.products");
  const script = browser.child(root, "dynamic-column-config");
  const gridId = "dynamic_column_state";
  Reflect.set(
    script,
    "textContent",
    JSON.stringify({
      gridId,
      columns: [
        { id: "sku", label: "SKU" },
        { id: "name", label: "Name" },
      ],
      columnSource: { endpoint: "/columns/", anchor: "sku" },
    }),
  );
  const bar = browser.child(root);
  bar.setAttribute("data-cm-filter-bar", "");

  const gridView = Reflect.get(window, "GridView");
  assertState(isRecord(gridView) && isRecord(gridView.byId), "GridView registry was unavailable");
  const registry = gridView.byId;
  Reflect.set(registry, "registerBoot", (): void => {});
  let stateSnapshot: unknown = [
    { colId: "name", hide: true, width: 240, flex: 1, pinned: "left", sort: "desc", sortIndex: 0 },
    { colId: "sku", hide: false, width: 155, pinned: null },
    { colId: "dynamic_1", hide: false, width: 120 },
    { colId: "removed", hide: true, width: 80 },
  ] satisfies ColumnState[];
  const calls: string[] = [];
  let appliedState: ColumnState[] | undefined;
  let appliedOrder: boolean | undefined;
  let updatedColumnDefs: unknown;
  let columnStateUnavailable = false;
  const gridApi = {
    getColumnState(): unknown {
      if (columnStateUnavailable) throw new Error("Column state unavailable");
      return stateSnapshot;
    },
    setGridOption(key: string, value: unknown): void {
      assertState(key === "columnDefs", "Refresh updated an unexpected grid option");
      calls.push("set");
      updatedColumnDefs = value;
    },
    applyColumnState(params: { state: ColumnState[]; applyOrder?: boolean }): boolean {
      calls.push("apply");
      appliedState = params.state;
      appliedOrder = params.applyOrder;
      stateSnapshot = [...params.state];
      return true;
    },
  };
  let host: { gridApi: typeof gridApi; reloadData: () => void } | null = null;
  class DynamicGridHost {
    readonly gridApi = gridApi;
    reloadData(): void {}
    constructor() {
      host = this;
    }
  }
  Reflect.set(registry, "get", () => host);
  Reflect.set(gridView, "AgGrid", { Host: DynamicGridHost });

  let fetchCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(
      JSON.stringify({ columns: [{ id: `dynamic_${fetchCount}`, label: `Dynamic ${fetchCount}` }] }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  let filterListener: EventListenerOrEventListenerObject | undefined;
  const querySelectorAllDescriptor = Object.getOwnPropertyDescriptor(document, "querySelectorAll");
  const addEventListenerDescriptor = Object.getOwnPropertyDescriptor(document, "addEventListener");
  Object.defineProperty(document, "querySelectorAll", {
    configurable: true,
    value: () => [script],
  });
  Object.defineProperty(document, "addEventListener", {
    configurable: true,
    value: (type: string, listener: EventListenerOrEventListenerObject): void => {
      if (type === "cm-filter-change") filterListener = listener;
      else addEventListenerDescriptor?.value.call(document, type, listener);
    },
  });

  const fireFilterChange = async (): Promise<void> => {
    assertState(filterListener !== undefined, "Spec boot did not install the filter listener");
    const listener = filterListener;
    const event = new Event("cm-filter-change");
    Object.defineProperty(event, "detail", { value: { bar } });
    if (typeof listener === "function") listener.call(document, event);
    else listener.handleEvent(event);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  };

  try {
    bootAgGridSpecFromDocument();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    assertState(fetchCount === 1 && host !== null, "Spec boot did not create the dynamic grid");

    await fireFilterChange();
    assertState(
      JSON.stringify(calls.slice(-2)) === JSON.stringify(["set", "apply"]),
      "Column state was not restored after replacing definitions",
    );
    assertState(appliedOrder === true, "Refresh did not restore column order");
    assertState(
      JSON.stringify(appliedState?.filter(({ colId }) => colId === "name" || colId === "sku")) ===
        JSON.stringify([
          { colId: "name", hide: true, width: 240, flex: 1, pinned: "left", sort: "desc", sortIndex: 0 },
          { colId: "sku", hide: false, width: 155, pinned: null },
        ]),
      "Refresh did not retain live state for surviving columns",
    );
    assertState(
      JSON.stringify(appliedState?.map(({ colId }) => colId)) ===
        JSON.stringify(["dynamic_2", "name", "sku"]),
      "Refresh did not insert new columns while dropping removed columns",
    );
    assertState(
      JSON.stringify(
        Array.isArray(updatedColumnDefs)
          ? updatedColumnDefs.filter(isRecord).map((column) => column.colId)
          : [],
      ) === JSON.stringify(["sku", "dynamic_2", "name"]),
      "New dynamic columns were not installed with refreshed definitions",
    );

    await fireFilterChange();
    assertState(
      JSON.stringify(appliedState?.map(({ colId }) => colId)) ===
        JSON.stringify(["dynamic_3", "name", "sku"]),
      "A repeated refresh retained stale dynamic columns",
    );

    columnStateUnavailable = true;
    await fireFilterChange();
    assertState(fetchCount === 4, "Refresh stopped when column state could not be read");
    assertState(
      JSON.stringify(calls.slice(-2)) === JSON.stringify(["set", "apply"]),
      "Column definitions were not refreshed after a column-state read failure",
    );
    assertState(
      JSON.stringify(appliedState?.map(({ colId }) => colId)) ===
        JSON.stringify(["sku", "dynamic_4", "name"]),
      "Refresh reused stale column state after a read failure",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (querySelectorAllDescriptor) {
      Object.defineProperty(document, "querySelectorAll", querySelectorAllDescriptor);
    } else {
      Reflect.deleteProperty(document, "querySelectorAll");
    }
    if (addEventListenerDescriptor) {
      Object.defineProperty(document, "addEventListener", addEventListenerDescriptor);
    } else {
      Reflect.deleteProperty(document, "addEventListener");
    }
  }
}

/** Public conformance entry for renderer-neutral PageState persistence. */
export async function verifyPageStateContract(): Promise<void> {
  verifyPageStateIdentityAndRecovery();
  verifyPortableColumnState();
  verifyAgGridInitialStateAndUrlPrecedence();
  verifyAgGridFilterStateReinitialization();
  verifyQuickSearchBeforeGridCreation();
  verifyThemeObserverCleanup();
  verifyConfirmationPassThrough();
  await verifyDynamicColumnRefreshPreservesState();
}
