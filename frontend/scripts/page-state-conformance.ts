import { AgGridHost } from "../src/ag-grid/host";
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
    browser.inputValue("ag-quick-filter-catalog") === "url query",
    "URL q did not override saved browser quick filter",
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

/** Public conformance entry for renderer-neutral PageState persistence. */
export function verifyPageStateContract(): void {
  verifyPageStateIdentityAndRecovery();
  verifyPortableColumnState();
  verifyAgGridInitialStateAndUrlPrecedence();
}
