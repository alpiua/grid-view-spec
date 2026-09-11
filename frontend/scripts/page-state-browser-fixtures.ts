import type { ColumnStateItem } from "../src/column-settings/types";

export interface GridApiCapture {
  filterModel: Record<string, unknown> | null;
}

export interface CreateGridCapture {
  initialState: unknown;
  api: GridApiCapture;
}

interface MemoryStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  keys: () => string[];
  rejectWrites: (enabled: boolean) => void;
}

export function assertState(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createStorage(): MemoryStorage {
  const entries = new Map<string, string>();
  let writesRejected = false;
  return {
    getItem(key): string | null {
      return entries.get(key) ?? null;
    },
    setItem(key, value): void {
      if (writesRejected) throw new Error("storage write rejected");
      entries.set(key, value);
    },
    removeItem(key): void {
      entries.delete(key);
    },
    keys(): string[] {
      return [...entries.keys()];
    },
    rejectWrites(enabled): void {
      writesRejected = enabled;
    },
  };
}

class FakeClassList {
  private readonly names = new Set<string>();

  add(...names: string[]): void {
    names.forEach((name) => this.names.add(name));
  }

  remove(...names: string[]): void {
    names.forEach((name) => this.names.delete(name));
  }

  contains(name: string): boolean {
    return this.names.has(name);
  }

  toggle(name: string, force?: boolean): boolean {
    const enabled = force ?? !this.names.has(name);
    if (enabled) this.names.add(name);
    else this.names.delete(name);
    return enabled;
  }
}

class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly classList = new FakeClassList();
  readonly dataset: Record<string, string> = {};
  parentElement: FakeElement | null = null;
  isConnected = true;
  id = "";

  constructor(parent: FakeElement | null = null) {
    this.parentElement = parent;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  matches(selector: string): boolean {
    const attribute = selector.match(/^\[([^=\]]+)(?:=[^\]]+)?\]$/)?.[1];
    return attribute ? this.attributes.has(attribute) : false;
  }

  closest(selector: string): FakeElement | null {
    let node: FakeElement | null = this;
    while (node) {
      if (node.matches(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  contains(node: unknown): boolean {
    if (!(node instanceof FakeElement)) return false;
    let current: FakeElement | null = node;
    while (current) {
      if (current === this) return true;
      current = current.parentElement;
    }
    return false;
  }

  addEventListener(): void {}

  removeEventListener(): void {}

  querySelector(): null {
    return null;
  }

  querySelectorAll(): [] {
    return [];
  }
}

class FakeHtmlElement extends FakeElement {}

class FakeInputElement extends FakeHtmlElement {
  value = "";
}

/** Narrow a browser test double only where a public DOM API is exercised. */
export function asDomElement(element: FakeHtmlElement): Element {
  return element as unknown as Element;
}

class FakeMutationObserver {
  constructor(_callback: () => void) {}

  observe(): void {}

  disconnect(): void {}
}

class FakeCustomEvent {
  constructor(
    readonly type: string,
    readonly init: { detail?: unknown } = {},
  ) {}
}

/** Minimal browser surface for public page-state and grid-host conformance. */
export class PageStateBrowserHarness {
  readonly storage = createStorage();
  readonly documentElement = new FakeHtmlElement();
  readonly elements = new Map<string, FakeHtmlElement>();
  private capture: CreateGridCapture | null = null;

  constructor(search = "") {
    const documentStub = {
      cookie: "",
      readyState: "complete",
      documentElement: this.documentElement,
      addEventListener(): void {},
      removeEventListener(): void {},
      dispatchEvent(): boolean {
        return true;
      },
      getElementById: (id: string): FakeHtmlElement | null => this.elements.get(id) ?? null,
      querySelector(): null {
        return null;
      },
      querySelectorAll(): [] {
        return [];
      },
    };
    const location = {
      href: `http://example.test/catalog/${search}`,
      origin: "http://example.test",
      pathname: "/catalog/",
      search,
    };
    const windowStub = {
      localStorage: this.storage,
      location,
      history: { replaceState(): void {} },
      addEventListener(): void {},
      removeEventListener(): void {},
      setTimeout,
      setInterval,
      clearInterval,
      GridView: { byId: { register(): void {} } },
      agGrid: {
        createGrid: (_element: unknown, options: { initialState?: unknown }) => this.createGrid(options),
      },
    };

    Reflect.set(globalThis, "localStorage", this.storage);
    Reflect.set(globalThis, "document", documentStub);
    Reflect.set(globalThis, "window", windowStub);
    Reflect.set(globalThis, "Element", FakeElement);
    Reflect.set(globalThis, "HTMLElement", FakeHtmlElement);
    Reflect.set(globalThis, "HTMLInputElement", FakeInputElement);
    Reflect.set(globalThis, "HTMLAnchorElement", FakeHtmlElement);
    Reflect.set(globalThis, "MutationObserver", FakeMutationObserver);
    Reflect.set(globalThis, "CustomEvent", FakeCustomEvent);
  }

  specRoot(specId: string, scope: string): FakeHtmlElement {
    const root = new FakeHtmlElement();
    root.setAttribute("data-cm-grid-view-spec", "");
    root.setAttribute("data-spec-id", specId);
    root.setAttribute("data-cm-page-state-scope", scope);
    return root;
  }

  child(parent: FakeHtmlElement, id = ""): FakeHtmlElement {
    const child = new FakeHtmlElement(parent);
    child.id = id;
    if (id) this.elements.set(id, child);
    return child;
  }

  input(id: string): FakeInputElement {
    const input = new FakeInputElement();
    input.id = id;
    this.elements.set(id, input);
    return input;
  }

  inputValue(id: string): string | null {
    const input = this.elements.get(id);
    return input instanceof FakeInputElement ? input.value : null;
  }

  capturedGrid(): CreateGridCapture {
    assertState(this.capture !== null, "AG Grid createGrid was not called");
    return this.capture;
  }

  private createGrid(options: { initialState?: unknown }): {
    getColumns: () => object[];
    getColumnState: () => ColumnStateItem[];
    applyColumnState: () => void;
    getFilterModel: () => Record<string, unknown>;
    setFilterModel: (model: Record<string, unknown> | null) => void;
    getDisplayedRowCount: () => number;
    getGridOption: () => undefined;
    purgeInfiniteCache: () => void;
    setGridOption: () => void;
    showLoadingOverlay: () => void;
    hideOverlay: () => void;
    addEventListener: () => void;
    removeEventListener: () => void;
    getColumn: () => null;
    setColumnsVisible: () => void;
    resetColumnState: () => void;
  } {
    const api: GridApiCapture = { filterModel: null };
    this.capture = {
      initialState: JSON.parse(JSON.stringify(options.initialState ?? null)) as unknown,
      api,
    };
    return {
      getColumns: (): object[] => [{}],
      getColumnState: (): ColumnStateItem[] => [],
      applyColumnState(): void {},
      getFilterModel: (): Record<string, unknown> => api.filterModel ?? {},
      setFilterModel(model): void {
        api.filterModel = model;
      },
      getDisplayedRowCount: (): number => 0,
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
  }
}
