/** Column settings — shared Simple Table + AG-Grid types. */

export interface ColumnStateItem {
  colId: string;
  hide: boolean;
  pinned: string | null;
  width?: string | number | null;
}

/** A named view can restore columns together with host-owned page state. */
export interface SavedColumnPreset {
  columns: ColumnStateItem[];
  pageState?: Record<string, unknown>;
}

/** Legacy presets are column-state arrays; new presets use the envelope above. */
export type StoredColumnPreset = ColumnStateItem[] | SavedColumnPreset;

export interface PageStateHooks {
  getPageState?: () => Record<string, unknown>;
  applyPageState?: (pageState: Record<string, unknown>) => void;
}

export interface ColumnMetaInput {
  colId: string;
  label?: string;
  hide?: boolean;
  menuGroup?: string;
  exportable?: boolean;
  isGroup?: boolean;
  columnKeys?: string[];
  leafMeta?: Record<string, { exportable?: boolean; hide?: boolean; label?: string }>;
}

export interface LeafMetaEntry {
  exportable: boolean;
  hide: boolean;
  groupId: string | null;
  label?: string;
}

export interface ColumnDescriptor {
  colId: string;
  label: string;
  defaultHide: boolean;
  menuGroup: string;
  exportable: boolean;
  isGroup?: boolean;
  columnKeys?: string[] | null;
  /** AG-Grid column reference (adapter-internal). */
  _col?: AgGridColumnLike;
}

export interface ColumnAdapter {
  hasGroupedHeaders?: () => boolean;
  getDescriptors: () => ColumnDescriptor[];
  getLeafLabel?: (leafKey: string) => string;
  isVisible: (colId: string) => boolean;
  setVisible: (colId: string, visible: boolean) => void;
  getPinned: (colId: string) => string | null;
  setPinned: (colId: string, pinned: string | null) => void;
  getColumnState: () => ColumnStateItem[];
  applyColumnState: (state: ColumnStateItem[], applyOrder?: boolean) => void;
  resetColumnState: () => void;
  clearWidths?: () => void;
  getDisplayedColumnIds: () => string[];
  syncGroupHeaders?: () => void;
  getColumnsForUi?: () => unknown[];
  uiItemFromDescriptor?: (desc: ColumnDescriptor) => unknown;
}

export interface ColumnSettingsOptions {
  groupsOrder?: string[];
  initialPresets?: Record<string, StoredColumnPreset>;
  preferencesUrl?: string;
  /** Rendered GridViewSpec root that owns portable page preferences. */
  pageStateRoot?: Element | null;
  initialState?: ColumnStateItem[];
  onStateChange?: (state: ColumnStateItem[]) => void;
  pageStateHooks?: PageStateHooks;
}

export interface ColumnSettingsHandle {
  savedColPresets: Record<string, StoredColumnPreset>;
  toggleColSelector: () => void;
  openColSelectorModal: () => void;
  closeColSelectorModal: () => void;
  resetColumnsToDefault: () => void;
  buildColCheckboxes: () => void;
  mountColumnSettings: (container: HTMLElement) => void;
  buildColOrderList: () => void;
  saveCurrentPreset: () => void;
  renderSavedPresets: () => void;
  saveColPresetsToServer: () => void;
  syncExportLinks: () => void;
  getColumnState: () => ColumnStateItem[];
  setPageStateHooks: (hooks: PageStateHooks) => void;
}

export interface AgGridColumnLike {
  getColDef: () => {
    field?: string;
    headerName?: string;
    hide?: boolean;
    pinned?: string;
    width?: number;
    suppressExport?: boolean;
    menuGroup?: string;
    contextGroup?: string;
  };
  getColId: () => string;
  isVisible: () => boolean;
  getPinned: () => string | null;
}

export interface AgGridColumnAdapterApi {
  getColumns: () => AgGridColumnLike[];
  getColumn: (colId: string) => AgGridColumnLike | null | undefined;
  setColumnsVisible: (colIds: string[], visible: boolean) => void;
  applyColumnState: (opts: { state: ColumnStateItem[]; applyOrder?: boolean }) => void;
  getColumnState: () => ColumnStateItem[];
  resetColumnState: () => void;
  getAllDisplayedColumns?: () => { getColId: () => string }[];
}

export interface SortableInstance {
  destroy: () => void;
}

export interface SortableStatic {
  new (el: HTMLElement, options?: Record<string, unknown>): SortableInstance;
}
