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

function assertCurrencyRendererContract(): void {
  const priorDocument = globalThis.document;
  const fakeDocument = {
    createElement: () => {
      let text = "";
      return {
        set textContent(value: string) {
          text = value;
        },
        get innerHTML(): string {
          return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;");
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
    const money = getRegisteredRenderer("money");
    if (!money) throw new Error("Built-in money renderer was not registered");
    const currencyFormatter = {
      currency: "USD",
      locale: "en-US",
      precision: 1,
      showSymbol: false,
    };
    const render = (value: unknown): string => {
      const rendered = money({
        value,
        colDef: { field: "price", cellRendererParams: { currencyFormatter } },
      });
      if (typeof rendered !== "string") {
        throw new Error("Currency renderer returned a DOM node");
      }
      return rendered;
    };
    if (!render(1234.5).includes("1,234.5")) {
      throw new Error("Currency renderer ignored locale or precision");
    }
    for (const value of [null, "", "   ", true, Number.NaN, Number.POSITIVE_INFINITY]) {
      if (render(value) !== "") throw new Error("Currency renderer did not reject an invalid value");
    }
    const withSymbol = money({
      value: 1234.5,
      colDef: {
        field: "price",
        cellRendererParams: {
          currencyFormatter: { ...currencyFormatter, showSymbol: true },
        },
      },
    });
    if (typeof withSymbol !== "string" || !withSymbol.includes("$")) {
      throw new Error("Currency renderer omitted the configured currency symbol");
    }
    const withEmpty = money({
      value: null,
      colDef: {
        field: "price",
        cellRendererParams: {
          currencyFormatter: { ...currencyFormatter, emptyValue: "N/A" },
        },
      },
    });
    if (withEmpty !== "N/A") {
      throw new Error("Currency renderer did not use custom emptyValue");
    }
    const withStrict = money({
      value: "1234.5",
      colDef: {
        field: "price",
        cellRendererParams: {
          currencyFormatter: { ...currencyFormatter, strict: true, emptyValue: "INVALID" },
        },
      },
    });
    if (withStrict !== "INVALID") {
      throw new Error("Currency renderer did not enforce strict mode on string value");
    }
    const mixed = money({
      value: 1234.5,
      data: { price_currency: "USD" },
      colDef: {
        field: "price",
        cellRendererParams: {
          currencyFormatter: {
            currency: "UAH", locale: "en-US", precision: 2, showSymbol: true,
            precisionByCurrency: { UAH: 0 }, symbolColors: { USD: "#22c55e" }, emptyValue: "INVALID",
          },
        },
      },
    });
    if (typeof mixed !== "string" || !mixed.includes('style="color:#22c55e">$</span>') ||
        !mixed.includes("1,234.50")) throw new Error("Mixed row currency or optional symbol color lost");
    const noColor = money({
      value: 1234.5,
      data: { price_currency: "USD" },
      colDef: { field: "price", cellRendererParams: {
        currencyFormatter: { currency: "UAH", locale: "en-US", precision: 2, showSymbol: true },
      } },
    });
    if (typeof noColor !== "string" || !noColor.includes("$1,234.50") || noColor.includes("color:")) {
      throw new Error("Currency without a configured palette gained a default color");
    }
    const malformedCurrency = money({
      value: 42, data: { price_currency: "<img>" },
      colDef: { field: "price", cellRendererParams: {
        currencyFormatter: { currency: "UAH", locale: "en-US", precision: 2, showSymbol: true, emptyValue: "INVALID" },
      } },
    });
    if (malformedCurrency !== "INVALID") throw new Error("Malformed row currency bypassed fallback");
    const legacy = money({ value: 12, data: { price_currency: "USD" }, colDef: { field: "price" } });
    if (typeof legacy !== "string" || legacy.includes("color:")) {
      throw new Error("Unconfigured money renderer retained default currency color");
    }
    const groupedUsd = money({
      value: "1,234",
      colDef: {
        field: "price",
        cellRendererParams: {
          currencyFormatter: { ...currencyFormatter, showSymbol: true, precision: 2 },
        },
      },
    });
    if (!groupedUsd.includes("$1,234.00")) {
      throw new Error("Currency renderer failed to parse en-US grouped string 1,234");
    }
    const groupedDe = money({
      value: "1.234",
      colDef: {
        field: "price",
        cellRendererParams: {
          currencyFormatter: {
            ...currencyFormatter,
            locale: "de-DE",
            currency: "EUR",
            showSymbol: true,
            precision: 2,
          },
        },
      },
    });
    if (!groupedDe.includes("1.234,00")) {
      throw new Error("Currency renderer failed to parse de-DE grouped string 1.234");
    }
    const largeNumber = money({
      value: "9007199254740993",
      colDef: {
        field: "price",
        cellRendererParams: {
          currencyFormatter: { ...currencyFormatter, showSymbol: true, precision: 2 },
        },
      },
    });
    if (!largeNumber.includes("9,007,199,254,740,993.00")) {
      throw new Error(`Large number lost precision: ${largeNumber}`);
    }
    for (const badStr of ["12,34,56", "1.2.3", "12 34 56", "1 2 3", "1 234, 50", "--12"]) {
      const res = money({
        value: badStr,
        colDef: {
          field: "price",
          cellRendererParams: {
            currencyFormatter: { ...currencyFormatter, emptyValue: "N/A" },
          },
        },
      });
      if (res !== "N/A") {
        throw new Error(`Currency renderer failed to reject malformed string '${badStr}'`);
      }
    }
    const throwingParams = money({
      value: 100,
      colDef: {
        get cellRendererParams(): Record<string, unknown> {
          throw new Error("getter failed");
        },
      },
    });
    if (throwingParams !== "") {
      throw new Error("Currency renderer failed zero-exception contract on throwing params getter");
    }
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: priorDocument,
    });
  }
}

assertCurrencyRendererContract();
