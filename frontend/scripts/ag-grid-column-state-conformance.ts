import { AgGridHost } from "../src/ag-grid/host";
import { ColumnSettingsHost } from "../src/column-settings/host";
import type { ColumnAdapter, ColumnStateItem } from "../src/column-settings/types";

interface MemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function assertState(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function createStorage(): MemoryStorage {
  const entries = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return entries.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      entries.set(key, value);
    },
  };
}

/** Proves AG Grid state remains authoritative when a legacy settings snapshot conflicts. */
export function verifyAgGridColumnStateAuthority(): void {
  const storage = createStorage();
  const authoritativeState: ColumnStateItem[] = [
    { colId: "supplier", hide: true, pinned: null, width: 240 },
  ];
  const obsoleteSettingsState: ColumnStateItem[] = [
    { colId: "supplier", hide: false, pinned: null },
  ];
  const scope = "pim.stock";
  storage.setItem("agGridState_stock__" + scope, JSON.stringify({ colState: authoritativeState }));
  storage.setItem("cmColState_stock__" + scope, JSON.stringify(obsoleteSettingsState));

  let appliedState = authoritativeState;
  const adapter: ColumnAdapter = {
    getDescriptors(): [] {
      return [];
    },
    isVisible(): boolean {
      return !appliedState[0].hide;
    },
    setVisible(): void {},
    getPinned(): null {
      return null;
    },
    setPinned(): void {},
    getColumnState(): ColumnStateItem[] {
      return appliedState;
    },
    applyColumnState(state: ColumnStateItem[]): void {
      appliedState = state;
    },
    resetColumnState(): void {},
    getDisplayedColumnIds(): string[] {
      return appliedState.filter((column) => !column.hide).map((column) => column.colId);
    },
  };
  const api = {
    getColumns(): [object] {
      return [{}];
    },
    getColumnState(): ColumnStateItem[] {
      return appliedState;
    },
    applyColumnState(options: { state: ColumnStateItem[] }): void {
      appliedState = options.state;
    },
    getFilterModel(): Record<string, unknown> {
      return {};
    },
    setFilterModel(): void {},
    getDisplayedRowCount(): number {
      return 0;
    },
    getGridOption(): undefined {
      return undefined;
    },
    purgeInfiniteCache(): void {},
    setGridOption(): void {},
    showLoadingOverlay(): void {},
    hideOverlay(): void {},
    addEventListener(): void {},
    removeEventListener(): void {},
    getColumn(): null {
      return null;
    },
    setColumnsVisible(): void {},
    resetColumnState(): void {},
  };

  const documentStub = {
    cookie: "",
    addEventListener(): void {},
    dispatchEvent(): boolean {
      return true;
    },
    getElementById(): null {
      return null;
    },
    querySelector(): null {
      return null;
    },
    querySelectorAll(): [] {
      return [];
    },
  };
  const windowStub = {
    GridView: {
      byId: { register(): void {} },
      createAgGridColumnAdapter(): ColumnAdapter {
        return adapter;
      },
      createColumnSettings(
        gridId: string,
        settingsAdapter: ColumnAdapter,
        options: ConstructorParameters<typeof ColumnSettingsHost>[2],
      ): ColumnSettingsHost {
        return new ColumnSettingsHost(gridId, settingsAdapter, options);
      },
    },
    location: {
      href: "http://example.test/stock/",
      origin: "http://example.test",
      pathname: "/stock/",
      search: "",
    },
    history: { replaceState(): void {} },
    addEventListener(): void {},
  };

  Reflect.set(globalThis, "localStorage", storage);
  Reflect.set(globalThis, "document", documentStub);
  Reflect.set(globalThis, "window", windowStub);
  Reflect.set(globalThis, "HTMLElement", class HTMLElementStub {});
  Reflect.set(globalThis, "HTMLInputElement", class HTMLInputElementStub {});
  Reflect.set(globalThis, "HTMLAnchorElement", class HTMLAnchorElementStub {});
  Reflect.set(globalThis, "CustomEvent", class CustomEventStub {});

  const host = new AgGridHost("stock", "stock-grid", { context: { storageScope: scope } }, null, null, null);
  host.gridApi = api;
  host.loadState();
  assertState(appliedState[0].hide, "AG Grid state did not restore before column settings initialized");

  host._initColSettings();
  assertState(
    appliedState[0].hide,
    "legacy cmColState overrode the already-restored authoritative AG Grid column state",
  );

  host._colSettings?.saveState();
  const legacyAfterSave = storage.getItem("cmColState_stock__" + scope);
  assertState(
    legacyAfterSave === JSON.stringify(obsoleteSettingsState),
    "AG Grid column settings rewrote the legacy cmColState snapshot",
  );
  const storedAgState = JSON.parse(storage.getItem("agGridState_stock__" + scope) || "{}") as {
    colState?: ColumnStateItem[];
  };
  assertState(storedAgState.colState?.[0]?.hide === true, "AG Grid did not persist the authoritative state");
}
