import type {
  AgGridColumnAdapterApi,
  ColumnAdapter,
  ColumnDescriptor,
  ColumnMetaInput,
  ColumnStateItem,
} from "./types";

export function createAgGridColumnAdapter(
  gridApi: AgGridColumnAdapterApi,
  columnMeta: Record<string, Partial<ColumnMetaInput>> | null | undefined
): ColumnAdapter {
  const meta = columnMeta || {};
  const getDefaultColumnState = (): ColumnStateItem[] => {
    if (!gridApi || !gridApi.getColumns) return [];
    return gridApi.getColumns().map((col) => {
      const colDef = col.getColDef();
      const colId = col.getColId();
      return {
        colId,
        hide: colDef.hide === true,
        pinned: (colDef.pinned === "left" || colDef.pinned === "right") ? colDef.pinned : null,
        ...(colDef.width !== undefined ? { width: colDef.width } : {}),
      };
    });
  };
  return {
    hasGroupedHeaders() {
      return false;
    },
    getDescriptors(): ColumnDescriptor[] {
      if (!gridApi || !gridApi.getColumns) return [];
      return gridApi.getColumns().map((col) => {
        const colDef = col.getColDef();
        const colId = col.getColId();
        const saved = meta[colId] || {};
        return {
          colId,
          label: colDef.headerName || colId,
          defaultHide: colDef.hide === true,
          menuGroup: saved.menuGroup || colDef.menuGroup || colDef.contextGroup || "",
          exportable: colDef.suppressExport !== true,
          _col: col,
        };
      });
    },
    getLeafLabel(colId: string): string {
      if (!gridApi || !gridApi.getColumn) return colId;
      const col = gridApi.getColumn(colId);
      const colDef = col?.getColDef();
      return colDef?.headerName || meta[colId]?.label || colId;
    },
    isVisible(colId: string): boolean {
      const col = gridApi.getColumn(colId);
      return col ? col.isVisible() : false;
    },
    setVisible(colId: string, visible: boolean): void {
      gridApi.setColumnsVisible([colId], visible);
    },
    getPinned(colId: string): string | null {
      const col = gridApi.getColumn(colId);
      return col ? col.getPinned() : null;
    },
    setPinned(colId: string, pinned: string | null): void {
      const hide = gridApi.getColumn(colId)?.isVisible() === false;
      gridApi.applyColumnState({ state: [{ colId, pinned, hide }] });
    },
    getColumnState(): ColumnStateItem[] {
      const state = gridApi.getColumnState();
      return Array.isArray(state) ? state : [];
    },
    applyColumnState(state: ColumnStateItem[], applyOrder?: boolean): void {
      gridApi.applyColumnState({ state, applyOrder: !!applyOrder });
    },
    resetColumnState(): void {
      const defaultState = getDefaultColumnState();
      if (defaultState.length) {
        gridApi.applyColumnState({ state: defaultState, applyOrder: true });
      }
    },
    getDisplayedColumnIds(): string[] {
      if (!gridApi.getAllDisplayedColumns) return [];
      return gridApi.getAllDisplayedColumns().map((col) => col.getColId());
    },
    getColumnsForUi(): unknown[] {
      if (!gridApi.getColumns) return [];
      return gridApi.getColumns();
    },
    uiItemFromDescriptor(desc: ColumnDescriptor): { col: unknown; label: string; colId: string } {
      return { col: desc._col, label: desc.label, colId: desc.colId };
    },
  };
}
