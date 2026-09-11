import { legacyAgGridStateKey, legacyColumnStateKey, prepareAgGridPageState } from "../src/ag-grid/page-state";
import { ColumnSettingsHost } from "../src/column-settings/host";
import { pageColumnStoreForRoot, readPageColumns } from "../src/column-settings/page-state";
import type { ColumnAdapter, ColumnStateItem } from "../src/column-settings/types";
import { PageState } from "../src/page-state/page-state";
import { asDomElement, assertState, PageStateBrowserHarness } from "./page-state-browser-fixtures";

function createColumnAdapter(initial: ColumnStateItem[]): {
  adapter: ColumnAdapter;
  columns: () => ColumnStateItem[];
} {
  let state = initial;
  return {
    adapter: {
      getDescriptors: (): [] => [],
      isVisible: (): boolean => true,
      setVisible(): void {},
      getPinned(): null {
        return null;
      },
      setPinned(): void {},
      getColumnState: (): ColumnStateItem[] => state,
      applyColumnState: (next): void => {
        state = next;
      },
      resetColumnState(): void {},
      getDisplayedColumnIds: (): string[] => state.map((column) => column.colId),
    },
    columns: (): ColumnStateItem[] => state,
  };
}

/** Proves existing portable state is authoritative over every old automatic snapshot. */
function verifyExistingPageStateWinsLegacySnapshots(): void {
  const browser = new PageStateBrowserHarness();
  const root = browser.specRoot("stock", "pim.stock");
  const grid = browser.child(root);
  const handle = PageState.forRoot(asDomElement(root));
  assertState(handle !== null, "Portable state root did not receive a PageState handle");
  handle.put("grid.stock.columns", [{ id: "product", hidden: true, width: 420 }]);
  handle.put("grid.stock.ag_grid", { quickFilter: "portable" });

  const agKey = legacyAgGridStateKey("stock", "pim.stock");
  const columnKey = legacyColumnStateKey("stock", "pim.stock");
  browser.storage.setItem(
    agKey,
    JSON.stringify({
      colState: [{ colId: "product", hide: false, pinned: null, width: 220 }],
      quickFilter: "legacy-ag",
    }),
  );
  browser.storage.setItem(
    columnKey,
    JSON.stringify([{ colId: "product", hide: false, pinned: "right", width: 200 }]),
  );

  const migrated = prepareAgGridPageState(asDomElement(grid), "stock", "pim.stock", undefined);
  const store = pageColumnStoreForRoot(asDomElement(grid), "stock");
  assertState(migrated !== null && store !== null, "AG Grid did not resolve portable page state");
  assertState(
    JSON.stringify(readPageColumns(store)) ===
      JSON.stringify([{ colId: "product", hide: true, pinned: null, width: 420 }]),
    "Legacy column snapshots overrode populated portable columns",
  );
  assertState(
    migrated.read().quickFilter === "portable",
    "Legacy AG state overrode populated portable AG state",
  );
  assertState(
    browser.storage.getItem(agKey) === null && browser.storage.getItem(columnKey) === null,
    "Superseded legacy snapshots were not removed after portable state won",
  );

  migrated.save({
    colState: [{ colId: "product", hide: true, pinned: null, width: 460 }],
    quickFilter: "saved",
  });
  assertState(
    browser.storage.getItem(agKey) === null && browser.storage.getItem(columnKey) === null,
    "Saving portable state dual-wrote legacy snapshots",
  );
}

/** Proves AG's old snapshot wins only when portable state does not exist, then cannot return. */
function verifyLegacyAgWinsThenMigratesOnce(): void {
  const browser = new PageStateBrowserHarness();
  const root = browser.specRoot("stock", "pim.stock");
  const grid = browser.child(root);
  const agKey = legacyAgGridStateKey("stock", "pim.stock");
  const columnKey = legacyColumnStateKey("stock", "pim.stock");
  const agColumns = [{ colId: "product", hide: false, pinned: null, width: 240 }];
  browser.storage.setItem(agKey, JSON.stringify({ colState: agColumns, quickFilter: "legacy-ag" }));
  browser.storage.setItem(
    columnKey,
    JSON.stringify([{ colId: "product", hide: true, pinned: "right", width: 180 }]),
  );

  const migrated = prepareAgGridPageState(asDomElement(grid), "stock", "pim.stock", undefined);
  const store = pageColumnStoreForRoot(asDomElement(grid), "stock");
  assertState(migrated !== null && store !== null, "AG Grid migration did not resolve a portable store");
  assertState(
    JSON.stringify(readPageColumns(store)) === JSON.stringify(agColumns),
    "Legacy cmColState overrode the authoritative legacy AG column snapshot",
  );
  assertState(migrated.read().quickFilter === "legacy-ag", "Legacy AG quick filter was not migrated");
  assertState(
    browser.storage.getItem(agKey) === null && browser.storage.getItem(columnKey) === null,
    "Migrated legacy keys were retained for a later re-import",
  );

  migrated.save({
    colState: [{ colId: "product", hide: true, pinned: null, width: 260 }],
    quickFilter: "saved",
  });
  migrated.clear();
  const reopened = prepareAgGridPageState(asDomElement(grid), "stock", "pim.stock", undefined);
  assertState(reopened !== null, "AG Grid page state did not reopen after a clear");
  assertState(
    reopened.read().quickFilter === undefined,
    "Clearing portable AG state re-imported an old legacy quick filter",
  );
  assertState(
    JSON.stringify(readPageColumns(store)) ===
      JSON.stringify([{ colId: "product", hide: true, pinned: null, width: 260 }]),
    "Saved portable columns were not retained after reopening",
  );
}

/** Proves legacy widths are additive only and remain recoverable when persistence fails. */
function verifyWidthMigrationPreservesNewerValuesAndLegacyOnFailure(): void {
  const browser = new PageStateBrowserHarness();
  const root = browser.specRoot("stock", "pim.stock");
  const grid = browser.child(root);
  const columnKey = legacyColumnStateKey("stock", "pim.stock");
  const widthKey = "cmColWidths_stock";
  browser.storage.setItem(
    columnKey,
    JSON.stringify([
      { colId: "product", hide: false, pinned: null, width: 220 },
      { colId: "sku", hide: false, pinned: null },
    ]),
  );
  browser.storage.setItem(widthKey, JSON.stringify({ product: 280, sku: 180 }));
  const successAdapter = createColumnAdapter([
    { colId: "product", hide: false, pinned: null },
    { colId: "sku", hide: false, pinned: null },
  ]);
  new ColumnSettingsHost("stock", successAdapter.adapter, {
    pageStateRoot: asDomElement(grid),
    legacyStorageScope: "pim.stock",
  });
  const store = pageColumnStoreForRoot(asDomElement(grid), "stock");
  assertState(store !== null, "Column settings did not use portable page state");
  assertState(
    JSON.stringify(readPageColumns(store)) ===
      JSON.stringify([
        { colId: "product", hide: false, pinned: null, width: 220 },
        { colId: "sku", hide: false, pinned: null, width: 180 },
      ]),
    "Legacy width overwrote an existing width instead of only filling a missing value",
  );
  assertState(
    browser.storage.getItem(columnKey) === null && browser.storage.getItem(widthKey) === null,
    "Successful width migration did not remove exact old keys",
  );

  const rejectedBrowser = new PageStateBrowserHarness();
  const rejectedRoot = rejectedBrowser.specRoot("stock", "pim.stock");
  const rejectedGrid = rejectedBrowser.child(rejectedRoot);
  const oldColumns = JSON.stringify([{ colId: "product", hide: false, pinned: null }]);
  const oldWidths = JSON.stringify({ product: 300 });
  rejectedBrowser.storage.setItem(columnKey, oldColumns);
  rejectedBrowser.storage.setItem(widthKey, oldWidths);
  rejectedBrowser.storage.rejectWrites(true);
  const rejectedAdapter = createColumnAdapter([{ colId: "product", hide: false, pinned: null }]);
  new ColumnSettingsHost("stock", rejectedAdapter.adapter, {
    pageStateRoot: asDomElement(rejectedGrid),
    legacyStorageScope: "pim.stock",
  });
  assertState(
    rejectedBrowser.storage.getItem(columnKey) === oldColumns &&
      rejectedBrowser.storage.getItem(widthKey) === oldWidths,
    "Failed portable persistence removed recoverable legacy width state",
  );
}

/** Public conformance entry for automatic legacy-to-PageState migration. */
export function verifyPageStateMigrationContract(): void {
  verifyExistingPageStateWinsLegacySnapshots();
  verifyLegacyAgWinsThenMigratesOnce();
  verifyWidthMigrationPreservesNewerValuesAndLegacyOnFailure();
}
