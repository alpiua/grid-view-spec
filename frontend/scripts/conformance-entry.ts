export {
  matchColumnFilter,
  matchSetFilter,
  matchSmartHaystackClient as matchSmartHaystack,
  matchToolbarQuery,
  matchAgGridQuickFilter,
} from "../src/grid-view/search/filter-engine";
export { resolveKpis } from "../src/grid-view/kpi";
export { verifyPageStateContract } from "./page-state-conformance";

import { initBuiltinRenderers } from "../src/runtime/renderers/builtins";
import { createAgGridColumnAdapter } from "../src/column-settings/ag-grid-adapter";
import { getRegisteredRenderer } from "../src/grid-view/registry-api";

export function verifyAgGridColumnStateFallback(): void {
  const adapter = createAgGridColumnAdapter({
    getColumns: () => [],
    getColumn: () => undefined,
    setColumnsVisible: () => {},
    applyColumnState: () => {},
    getColumnState: () => undefined,
    resetColumnState: () => {},
  }, null);
  if (adapter.getColumnState().length !== 0) {
    throw new Error("AG Grid column adapter did not normalize unavailable column state");
  }
}

function hasMessage(value: unknown): value is { message: unknown } {
  return typeof value === "object" && value !== null && "message" in value;
}

function assertActionRendererContract(): void {
  const priorDocument = globalThis.document;
  const fakeDocument = {
    createElement: () => {
      let text = "";
      return {
        set textContent(value: string) {
          text = value;
        },
        get innerHTML(): string {
          return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
        },
      };
    },
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: fakeDocument,
  });
  try {
    initBuiltinRenderers();
    const link = getRegisteredRenderer("link");
    const button = getRegisteredRenderer("button");
    if (!link || !button) throw new Error("Built-in action renderers were not registered");
    const confirm = { message: "Delete", tone: "danger" };
    const linkHtml = link({
      value: "Ada",
      data: { id: 7, name__url: "/records/7/" },
      colDef: { field: "name", cellRendererParams: { action: "open", confirm } },
    });
    const buttonHtml = button({
      value: "Delete",
      data: { id: 7 },
      colDef: { field: "name", cellRendererParams: { action: "delete", confirm } },
    });
    for (const html of [linkHtml, buttonHtml]) {
      if (typeof html !== "string" || !html.includes("data-cm-confirm=\"")) {
        throw new Error("Action renderer omitted confirmation metadata");
      }
      const encoded = html.match(/data-cm-confirm=\"([^\"]+)\"/)?.[1] ?? "";
      const decoded = encoded.replace(/&quot;/g, "\"").replace(/&amp;/g, "&");
      const parsed: unknown = JSON.parse(decoded);
      if (
        !hasMessage(parsed) ||
        parsed.message !== "Delete"
      ) {
        throw new Error("Action renderer changed confirmation meaning");
      }
    }
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: priorDocument,
    });
  }
}

assertActionRendererContract();
