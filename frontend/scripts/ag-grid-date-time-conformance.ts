import { registerRenderer } from "../src/grid-view/registry-api";
import { bootAgGridSpecFromDocument } from "../src/runtime/table-ag-grid";
import { initBuiltinRenderers } from "../src/runtime/renderers/builtins";
import { assertState, isRecord, PageStateBrowserHarness } from "./page-state-browser-fixtures";

const htmlEscapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export async function verifyDateTimeRendererContract(): Promise<void> {
  const globalKeys = ["document", "window", "fetch", "localStorage", "Element", "HTMLElement", "HTMLInputElement", "HTMLAnchorElement", "MutationObserver", "CustomEvent"];
  const priorGlobals = new Map<string, unknown>();
  globalKeys.forEach((key) => priorGlobals.set(key, Reflect.get(globalThis, key)));
  const formatter = {
    format: "date",
    locale: "uk-UA",
    timezone: "UTC",
    emptyValue: '<img src=x onerror="alert(1)">',
    strict: true,
  };
  const customRendererId = "date-time-contract-custom";
  let customFormatter: unknown;
  registerRenderer(customRendererId, (params) => {
    const colDef = params.colDef;
    const cellRendererParams = isRecord(colDef) ? colDef.cellRendererParams : undefined;
    customFormatter = isRecord(cellRendererParams) ? cellRendererParams.dateTimeFormatter : undefined;
    return "custom date renderer";
  });

  const capturedDefs = new Map<string, unknown>();
  class CaptureHost {
    gridApi: null = null;
    constructor(_gridId: string, _containerId: string, options: Record<string, unknown>) {
      const context = options.context;
      if (isRecord(context) && typeof context.gridId === "string") {
        capturedDefs.set(context.gridId, options.columnDefs);
      }
    }
    initGrid(): void {}
  }

  const hostRenderer = (): string => "host renderer";
  const hostColumn = {
    field: "hostDate",
    tooltipField: "hostDate",
    cellRenderer: hostRenderer,
    cellRendererParams: { hostOwned: true },
  };
  const scripts = [
    {
      dataset: {},
      textContent: JSON.stringify({
        gridId: "date-static-contract",
        columns: [
          { id: "created", field: "created", label: "Created", type: "date", dateTimeFormatter: formatter },
          {
            id: "clock",
            field: "clock",
            label: "Clock",
            type: "datetime",
            dateTimeFormatter: { ...formatter, format: "time" },
          },
          { id: "custom", field: "custom", label: "Custom", type: "date", renderer: customRendererId, dateTimeFormatter: formatter },
          { id: "legacy", field: "legacy", label: "Legacy", type: "date", renderer: "date" },
        ],
        columnSource: { endpoint: "/api/date-columns/", method: "get", dependsOn: [], params: {}, anchor: "created" },
      }),
    },
    {
      dataset: {},
      textContent: JSON.stringify({ gridId: "date-host-contract", columnsVar: "hostDateColumns" }),
    },
  ];

  try {
    new PageStateBrowserHarness();
    const documentStub = Reflect.get(globalThis, "document");
    const windowStub = Reflect.get(globalThis, "window");
    assertState(isRecord(documentStub) && isRecord(windowStub), "Browser harness did not initialize");
    Reflect.set(documentStub, "createElement", () => {
      let innerHtml = "";
      return {
        set textContent(value: string) {
          innerHtml = value.replace(/[&<>"']/g, (character) => htmlEscapes[character] ?? character);
        },
        get innerHTML(): string {
          return innerHtml;
        },
      };
    });
    const gridView = Reflect.get(windowStub, "GridView");
    assertState(isRecord(gridView), "Browser harness did not provide GridView");
    Reflect.set(documentStub, "querySelectorAll", () => scripts);
    Reflect.set(gridView, "byId", { get: (): null => null, registerBoot: (): void => {} });
    Reflect.set(gridView, "AgGrid", { Host: CaptureHost });
    Reflect.set(windowStub, "hostDateColumns", [hostColumn]);
    Reflect.set(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        columns: [
          {
            id: "updated",
            field: "updated",
            label: "Updated",
            type: "datetime",
            dateTimeFormatter: {
              format: "datetime",
              locale: "uk-UA",
              timezone: "UTC",
              emptyValue: "N/A",
              strict: false,
            },
          },
        ],
      }),
    }));

    initBuiltinRenderers();
    bootAgGridSpecFromDocument();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const definitionsFor = (id: string): Record<string, unknown>[] => {
      const definitions = capturedDefs.get(id);
      assertState(Array.isArray(definitions), `AG Grid did not boot ${id}`);
      return definitions.filter(isRecord);
    };
    const columnFor = (definitions: Record<string, unknown>[], id: string): Record<string, unknown> => {
      const column = definitions.find((definition) => definition.colId === id);
      assertState(column !== undefined, `AG Grid did not boot the ${id} column`);
      return column;
    };
    const render = (column: Record<string, unknown>, value: unknown): unknown => {
      assertState(typeof column.cellRenderer === "function", `${String(column.colId)} did not select a renderer`);
      return Reflect.apply(column.cellRenderer, undefined, [{ value, colDef: column }]);
    };

    const staticDefs = definitionsFor("date-static-contract");
    const created = columnFor(staticDefs, "created");
    const createdParams = created.cellRendererParams;
    assertState(isRecord(createdParams) && isRecord(createdParams.dateTimeFormatter), "Static date formatter was not forwarded");
    assertState(render(created, "2024-03-05") === "05.03.2024", "Static date renderer did not match the configured layout");
    assertState(render(created, "20240305") === "05.03.2024", "Static date renderer rejected a basic ISO calendar date");
    assertState(render(created, "20240230") === "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;", "Invalid basic ISO date did not render the escaped emptyValue");
    const clock = columnFor(staticDefs, "clock");
    assertState(render(clock, "040506") === "04:05:06", "Static time renderer rejected a basic ISO time");
    assertState(render(clock, "0405") === "04:05:00", "Static time renderer rejected a reduced basic ISO time");
    assertState(render(clock, "040506.123456+0230") === "04:05:06", "Static time renderer rejected a basic ISO time with fraction and offset");
    assertState(render(clock, "246060") === "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;", "Invalid basic ISO time did not render the escaped emptyValue");
    const invalid = render(created, "not-a-date");
    assertState(invalid === "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;", "Invalid date fallback was not escaped");
    const invalidTimezoneColumn = {
      ...created,
      cellRendererParams: {
        dateTimeFormatter: { ...formatter, timezone: "invalid timezone", emptyValue: "<strong>timezone</strong>" },
      },
    };
    assertState(
      render(invalidTimezoneColumn, "2024-03-05") === "&lt;strong&gt;timezone&lt;/strong&gt;",
      "An invalid timezone did not render its escaped emptyValue",
    );
    const corruptConfigColumn = {
      ...created,
      cellRendererParams: {
        dateTimeFormatter: { ...formatter, format: "invalid", emptyValue: "<strong>config</strong>" },
      },
    };
    assertState(
      render(corruptConfigColumn, "2024-03-05") === "&lt;strong&gt;config&lt;/strong&gt;",
      "A corrupt formatter config did not render its escaped emptyValue",
    );

    const dynamic = columnFor(staticDefs, "updated");
    const dynamicParams = dynamic.cellRendererParams;
    assertState(isRecord(dynamicParams) && isRecord(dynamicParams.dateTimeFormatter), "columnSource date formatter was not forwarded");
    assertState(render(dynamic, "2024-03-05T04:05:06Z") === "05.03.2024 04:05:06", "columnSource date renderer did not format its value");
    assertState(render(dynamic, "20240305T040506") === "05.03.2024 04:05:06", "columnSource date renderer rejected a basic ISO datetime");
    assertState(render(dynamic, "20240305T0405") === "05.03.2024 04:05:00", "columnSource date renderer rejected a reduced basic ISO datetime");
    assertState(render(dynamic, "20240305T04") === "05.03.2024 04:00:00", "columnSource date renderer rejected an hour-precision basic ISO datetime");
    assertState(
      render(dynamic, "20240305T040506.123456+0230") === "05.03.2024 01:35:06",
      "columnSource date renderer rejected a basic ISO datetime with fraction and offset",
    );
    assertState(
      render(dynamic, "20240305T246060") === "N/A",
      "Invalid basic ISO datetime did not render the escaped emptyValue",
    );

    const custom = columnFor(staticDefs, "custom");
    assertState(render(custom, "2024-03-05") === "custom date renderer", "Configured date formatter replaced an explicit renderer");
    assertState(isRecord(customFormatter) && customFormatter.format === "date", "Explicit renderer did not receive dateTimeFormatter");
    assertState(render(columnFor(staticDefs, "legacy"), "2024-03-05") === "05.03.2024", "Unconfigured date builtin changed");

    const hostDefs = definitionsFor("date-host-contract");
    assertState(hostDefs.length === 1 && hostDefs[0] === hostColumn, "Host columnsVar definition was rewritten");
  } finally {
    priorGlobals.forEach((value, key) => Reflect.set(globalThis, key, value));
  }
}
