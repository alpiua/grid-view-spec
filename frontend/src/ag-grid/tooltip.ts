import type { AgGridTooltipInitParams } from "./types";

export class AgGridTooltip {
  eGui!: HTMLElement;

  init(params: AgGridTooltipInitParams): void {
    const eGui = document.createElement("div");
    const value = params.value;
    const val =
      value === null || value === undefined || typeof value === "object" ? "" : String(value).trim();
    eGui.className = "cm-ellipsis-tip cm-ellipsis-tip--floating";
    if (!val) {
      eGui.style.display = "none";
    } else {
      eGui.textContent = val;
    }
    this.eGui = eGui;
  }

  getGui(): HTMLElement {
    return this.eGui;
  }
}

export function installAgGridTooltip(gv: Window["GridView"]): void {
  gv.AgGrid = gv.AgGrid ?? {};
  gv.AgGrid.Tooltip = AgGridTooltip;
}
