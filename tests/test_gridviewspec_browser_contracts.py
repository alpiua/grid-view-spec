"""Browser-observable contracts for client table search and static charts."""

from __future__ import annotations

import html
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render import render_grid_view_spec
from grid_view_spec.types.filters_v2 import (
    GridViewFilter,
    GridViewFilterDrawerSection,
    GridViewFilterOption,
    GridViewFilters,
    GridViewFilterState,
)
from grid_view_spec.types.host import GridPrefs
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.spec import GridViewSpec
from grid_view_spec.types.table_v2 import GridViewColumn, GridViewTable
from grid_view_spec.types.toolbar import GridViewSearch, GridViewToolbar
from tests.browser_testing import run_headless_chromium

_ROOT = Path(__file__).resolve().parents[1]
_FRONTEND = _ROOT / "frontend"
_BUILD_SCRIPT = _FRONTEND / "scripts" / "build-browser-contract-conformance.mjs"


@pytest.mark.parametrize("dark", [False, True])
def test_filter_search_controls_share_compact_themed_styles(
    browser_context: tuple[str, str, Path], tmp_path: Path, dark: bool
) -> None:
    _, chromium, bundle = browser_context
    standard = GridViewFilters(
        id="standard_filters",
        presentation="drawer",
        schema=(GridViewFilter(id="active", label="Active", param="active", type="boolean"),),
    )
    workspace = GridViewFilters(
        id="workspace_filters",
        presentation="drawer",
        drawer_layout="workspace",
        schema=(
            GridViewFilter(id="available", label="Available", param="available", type="boolean"),
        ),
        drawer_sections=(
            GridViewFilterDrawerSection(
                id="availability",
                label="Availability",
                filter_ids=("available",),
            ),
        ),
    )
    spec = GridViewSpec(
        id="search_styles",
        blocks=(standard, workspace),
        layout=GridViewLayout(
            root=GridViewArea(
                id="root",
                blocks=(standard.id, workspace.id),
            )
        ),
    )
    markup = render_grid_view_spec(
        spec,
        (),
        host=InMemoryHost(translations={"filter.workspace_search": "Search filter"}),
        backend="html",
    )
    static = _ROOT / "src/grid_view_spec/static/grid_view_spec"
    styles = (static / "gridviewspec.css").read_text() + (
        static / "gridviewspec-filter-workspace.css"
    ).read_text()
    styles += """
      :root { --cm-surface: #fff; --cm-border: #cbd5e1; --cm-muted: #64748b; }
      :root.dark { --cm-surface: #161a2b; --cm-border: #334155; --cm-muted: #94a3b8; }
    """
    scenario = """
        try {
          document.documentElement.classList.toggle('dark', DARK);
          const inputs = document.querySelectorAll(
            '[data-cm-filter-drawer-search], [data-cm-filter-workspace-search]');
          if (inputs.length !== 2) throw new Error('both drawer searches must render');
          const controls = Array.from(inputs).map(input => {
            if (input.placeholder !== 'Search filter') throw new Error('incorrect filter label');
            const label = input.parentElement;
            const style = getComputedStyle(label);
            const expectedBackground = DARK ? 'rgb(22, 26, 43)' : 'rgb(255, 255, 255)';
            const expectedBorder = DARK ? 'rgb(51, 65, 85)' : 'rgb(203, 213, 225)';
            if (style.backgroundColor !== expectedBackground ||
                style.borderColor !== expectedBorder) {
              throw new Error('search must use the active host theme tokens');
            }
            if (label.getBoundingClientRect().height !== 32) throw new Error('search height');
            if (getComputedStyle(input).fontSize !== '12px') throw new Error('search font size');
            return [style.color, style.backgroundColor, style.borderColor, style.borderRadius];
          });
          if (JSON.stringify(controls[0]) !== JSON.stringify(controls[1])) {
            throw new Error('drawer search styles differ');
          }
          document.querySelector('#contract-result').dataset.result = 'PASS';
        } catch (error) {
          document.querySelector('#contract-result').dataset.result = `FAIL: ${error.message}`;
        }
    """.replace("DARK", "true" if dark else "false")
    result = _run_browser(chromium, bundle, f"<style>{styles}</style>{markup}", scenario, tmp_path)
    assert result == "PASS"


def _saved_search_page() -> tuple[str, InMemoryHost]:
    host = InMemoryHost(translations={"search.clear": "Clear search"})
    host.prefs.save("test-subject", "records_table", GridPrefs(searches=("needle",)))
    toolbar = GridViewToolbar(
        id="records_toolbar",
        search=GridViewSearch(backend="client", bind="records_table", saved=True),
        target="records_table",
    )
    table = GridViewTable(
        id="records_table",
        columns=(GridViewColumn(id="name", label="Name", field="name"),),
        rows=({"name": "needle match"}, {"name": "unrelated record"}),
    )
    spec = GridViewSpec(
        id="saved_search_page",
        blocks=(toolbar, table),
        layout=GridViewLayout(
            root=GridViewArea(id="root", blocks=(toolbar.id, table.id)),
        ),
    )
    return render_grid_view_spec(spec, (), host=host, backend="html"), host


def _selected_client_filter_page() -> str:
    filters = GridViewFilters(
        id="catalog_filters",
        target="catalog_table",
        navigate_on_change=False,
        schema=(
            GridViewFilter(
                id="brand_filter",
                label="Brand",
                param="brand",
                type="select",
                scope="client",
                options=(
                    GridViewFilterOption(value="Logitech", label="Logitech"),
                    GridViewFilterOption(value="Anker", label="Anker"),
                ),
            ),
        ),
        state=GridViewFilterState(values={"brand": "Logitech"}),
    )
    table = GridViewTable(
        id="catalog_table",
        columns=(GridViewColumn(id="brand", label="Brand", field="brand"),),
        rows=({"brand": "Logitech"}, {"brand": "Anker"}),
    )
    spec = GridViewSpec(
        id="selected_client_filter_page",
        blocks=(filters, table),
        layout=GridViewLayout(
            root=GridViewArea(id="root", blocks=(filters.id, table.id)),
        ),
    )
    return render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")


def _hidden_middle_column_page() -> str:
    table = GridViewTable(
        id="inventory_table",
        columns=(
            GridViewColumn(id="stock", label="Stock", field="stock", width="105px"),
            GridViewColumn(
                id="availability",
                label="Availability",
                field="availability",
                hidden=True,
            ),
            GridViewColumn(id="price", label="Price", field="price", width="136px"),
        ),
        rows=({"stock": "In", "availability": "Today", "price": "$10"},),
        settings=("drawer",),
    )
    spec = GridViewSpec(
        id="hidden_middle_column_page",
        blocks=(table,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(table.id,))),
    )
    return render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")


def _hidden_middle_column_scenario() -> str:
    return """
      (() => {
        const result = document.querySelector("#contract-result");
        try {
          document.head.insertAdjacentHTML(
            "beforeend",
            '<style>th.cm-col-hidden,td.cm-col-hidden{display:none}</style>',
          );
          window.GridViewSpecContract.init();
          const shell = document.querySelector('[data-grid-id="inventory_table"]');
          const table = shell.querySelector("table");
          const adapter = window.GridViewSpecContract.createDomTableColumnAdapter(
            table, JSON.parse(shell.dataset.cmColumns));
          const col = (key) => table.querySelector(`col[data-cm-col-key="${key}"]`);
          const rect = (selector) => table.querySelector(selector).getBoundingClientRect();
          const assertAligned = (key) => {
            const header = rect(`thead [data-cm-col-key="${key}"]`);
            const cell = rect(`tbody [data-cm-col-key="${key}"]`);
            if (header.width <= 0 || cell.width <= 0 || Math.abs(header.x - cell.x) > 1) {
              throw new Error(`${key} header/cell are not aligned at a visible width`);
            }
          };
          if (col("availability").style.display !== "none") {
            throw new Error("initial hidden column still occupies a table grid slot");
          }
          assertAligned("stock");
          assertAligned("price");

          const state = adapter.getColumnState();
          state.find(({colId}) => colId === "availability").hide = false;
          adapter.applyColumnState(state, true);
          if (col("availability").style.display === "none") {
            throw new Error(
              "showing the column did not restore its table slot",
            );
          }
          assertAligned("stock");
          assertAligned("availability");
          assertAligned("price");

          state.find(({colId}) => colId === "availability").hide = true;
          state.sort((a, b) => ["price", "availability", "stock"].indexOf(a.colId) -
            ["price", "availability", "stock"].indexOf(b.colId));
          adapter.applyColumnState(state, true);
          if (col("availability").style.display !== "none") {
            throw new Error("hiding after reorder left a grid slot");
          }
          assertAligned("price");
          assertAligned("stock");
          if (table.querySelector("thead tr").firstElementChild.dataset.cmColKey !== "price") {
            throw new Error("visible column reorder did not stay aligned with the colgroup");
          }
          result.dataset.result = "PASS";
        } catch (error) {
          result.dataset.result = `FAIL: ${error.message}`;
        }
      })();
    """


@pytest.fixture(scope="module")
def browser_context(tmp_path_factory: pytest.TempPathFactory) -> tuple[str, str, Path]:
    node = shutil.which("node")
    chromium = shutil.which("chromium")
    if not node or not chromium or not (_FRONTEND / "node_modules" / "esbuild").is_dir():
        pytest.skip("browser contract tests require Node, esbuild, and Chromium")
    temp_dir = tmp_path_factory.mktemp("gridviewspec-browser-contracts")
    bundle = temp_dir / "browser-contracts.js"
    _build_bundle(node, bundle)
    return node, chromium, bundle


def _build_bundle(node: str, output: Path) -> None:
    subprocess.run(
        [node, str(_BUILD_SCRIPT), str(output)],
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )


def _run_browser(
    chromium: str,
    bundle: Path,
    markup: str,
    scenario: str,
    temp_dir: Path,
    mutation: str | None = None,
    url_query: str = "",
) -> str:
    page = temp_dir / "contract.html"
    bundle_url = html.escape(bundle.resolve().as_uri(), quote=True)
    mutation_attribute = (
        f' data-contract-mutation="{html.escape(mutation, quote=True)}"' if mutation else ""
    )
    page.write_text(
        f"<!doctype html><html><body{mutation_attribute}>"
        + markup
        + '<output id="contract-result"></output>'
        + f'<script src="{bundle_url}"></script><script>{scenario}</script>'
        + "</body></html>",
        encoding="utf-8",
    )
    result = run_headless_chromium(
        chromium,
        page,
        temp_dir,
        virtual_time_budget=500,
        url_query=url_query,
    )
    assert result.returncode == 0, result.stderr
    match = re.search(
        r'<output\b(?=[^>]*id="contract-result")(?=[^>]*data-result="([^"]+)")[^>]*>',
        result.stdout,
    )
    assert match is not None, f"Chromium did not report a contract result: {result.stderr}"
    return html.unescape(match.group(1))


def _saved_search_scenario() -> str:
    return """
      (() => {
        const result = document.querySelector("#contract-result");
        try {
          const runtime = window.GridViewSpecContract;
          runtime.init();
          runtime.bindDelegatedGridActions();
          const input = document.querySelector('[data-cm-toolbar-search]');
          document.querySelector('#cm-saved-searches-btn-records_toolbar').click();
          const presetSelector = '#cm-saved-searches-container-records_toolbar ' +
            '.cm-toolbar-search-saved-item';
          const preset = document.querySelector(presetSelector);
          if (!input || !preset) throw new Error("rendered saved-search preset is missing");
          if (document.body.dataset.contractMutation === "drop-client-input-event") {
            const dispatch = input.dispatchEvent.bind(input);
            input.dispatchEvent = (event) => event.type === "input" ? true : dispatch(event);
          }
          preset.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          const rows = Array.from(document.querySelectorAll('[data-cm-table] tbody tr'));
          const visibleRows = rows.filter((row) => getComputedStyle(row).display !== "none");
          if (input.value !== "needle") {
            throw new Error("preset query is not visible in the search input");
          }
          if (visibleRows.length !== 1 || !visibleRows[0].textContent.includes("needle match")) {
            throw new Error("visible rows do not match the selected preset");
          }
          result.dataset.result = "PASS";
        } catch (error) {
          result.dataset.result = `FAIL: ${error.message}`;
        }
      })();
    """


def _selected_client_filter_scenario() -> str:
    return """
      (() => {
        const result = document.querySelector("#contract-result");
        try {
          window.GridViewSpecContract.init();
          const selected = document.querySelector(
            '[data-filter-id="brand_filter"] input[value="Logitech"]');
          if (!selected?.checked || !location.search.includes("brand=Logitech")) {
            throw new Error("host-selected client filter was not restored from URL state");
          }
          const table = document.querySelector('#cm-table-catalog_table [data-cm-table]');
          if (document.body.dataset.contractMutation === "drop-initial-client-filter-replay") {
            table.dataset.cmClientFilters = "{}";
            table.querySelectorAll('tbody .cm-row').forEach((row) => { row.hidden = false; });
          }
          const visible = Array.from(table.querySelectorAll('tbody .cm-row'))
            .filter((row) => getComputedStyle(row).display !== "none");
          if (visible.length !== 1 || !visible[0].textContent.includes("Logitech")) {
            throw new Error("initial client filter did not narrow rendered rows");
          }
          if (performance.getEntriesByType("navigation")[0]?.type !== "reload") {
            location.reload();
            return;
          }
          result.dataset.result = "PASS";
        } catch (error) {
          result.dataset.result = `FAIL: ${error.message}`;
        }
      })();
    """


def _chart_markup(
    *, include_rows: bool = True, rows: list[dict[str, str | int]] | None = None
) -> str:
    config = json.dumps(
        {
            "chartType": "bar",
            "dataSource": "static",
            "bind": {
                "xKey": "region",
                "valueKey": "revenue",
                "rows": [{"region": "Stale", "revenue": 999}],
            },
        }
    )
    dom_rows = (
        rows
        if rows is not None
        else [
            {"region": "North", "revenue": 42},
            {"region": "South", "revenue": 17},
        ]
    )
    rows_attribute = (
        f' data-cm-chart-rows="{html.escape(json.dumps(dom_rows), quote=True)}"'
        if include_rows
        else ""
    )
    return (
        f'<div data-cm-chart-config="{html.escape(config, quote=True)}"{rows_attribute}>'
        "<div data-cm-chart-empty hidden></div>"
        "<div data-cm-chart-root></div></div>"
    )


def _chart_scenario(
    expected_categories: tuple[str, ...] = ("North", "South"),
    expected_series_values: tuple[tuple[int, ...], ...] = ((42, 17),),
) -> str:
    scenario = """
      (() => {
        const result = document.querySelector("#contract-result");
        try {
          const chartNode = document.querySelector("[data-cm-chart-config]");
          if (document.body.dataset.contractMutation === "use-chart-bind-rows") {
            const config = JSON.parse(chartNode.dataset.cmChartConfig);
            chartNode.dataset.cmChartRows = JSON.stringify(config.bind.rows);
          }
          window.echarts = {
            init: () => ({
              setOption: (option) => { window.contractChartOption = option; },
              dispose: () => {},
              resize: () => {},
            }),
          };
          window.GridViewSpecContract.initAllCharts(document);
          const option = window.contractChartOption;
          if (JSON.stringify(option?.xAxis?.data) !== JSON.stringify(EXPECTED_CATEGORIES)) {
            throw new Error("chart categories did not use DOM rows");
          }
          const seriesValues = option?.series?.map(({ data }) => data);
          if (JSON.stringify(seriesValues) !== JSON.stringify(EXPECTED_SERIES_VALUES)) {
            throw new Error("chart values did not use DOM rows");
          }
          result.dataset.result = "PASS";
        } catch (error) {
          result.dataset.result = `FAIL: ${error.message}`;
        }
      })();
    """
    return scenario.replace("EXPECTED_CATEGORIES", json.dumps(expected_categories)).replace(
        "EXPECTED_SERIES_VALUES", json.dumps(expected_series_values)
    )


def _empty_chart_scenario() -> str:
    return """
      (() => {
        const result = document.querySelector("#contract-result");
        try {
          const chartNode = document.querySelector("[data-cm-chart-config]");
          if (document.body.dataset.contractMutation === "use-chart-bind-rows-for-empty") {
            const config = JSON.parse(chartNode.dataset.cmChartConfig);
            chartNode.dataset.cmChartRows = JSON.stringify(config.bind.rows);
          }
          window.echarts = {
            init: () => ({ setOption: () => {}, dispose: () => {}, resize: () => {} }),
          };
          window.GridViewSpecContract.initAllCharts(document);
          const emptyPlate = chartNode.querySelector("[data-cm-chart-empty]");
          if (!emptyPlate || emptyPlate.hidden) {
            throw new Error("explicit empty rows were overridden by bind rows");
          }
          result.dataset.result = "PASS";
        } catch (error) {
          result.dataset.result = `FAIL: ${error.message}`;
        }
      })();
    """


def _auto_theme_donut_markup(width: int = 600, theme: str = "auto") -> str:
    config = json.dumps(
        {
            "id": "collections_chart",
            "title": "Stock by collection",
            "chartType": "donut",
            "dataSource": "static",
            "echartsTheme": theme,
            "bind": {"groupBy": "collection", "valueKey": "stock", "aggregate": "sum"},
        }
    )
    rows = json.dumps(
        [
            {"collection": "Accessories", "stock": 141},
            {"collection": "Ergonomics", "stock": 105},
            {"collection": "Connectivity", "stock": 42},
            {"collection": "Input Devices", "stock": 6},
            {"collection": "Displays", "stock": 27},
            {"collection": "Video", "stock": 63},
        ]
    )
    return (
        f'<div data-cm-chart-config="{html.escape(config, quote=True)}" '
        f'data-cm-chart-rows="{html.escape(rows, quote=True)}">'
        "<div data-cm-chart-empty hidden></div>"
        f'<div data-cm-chart-root style="width:{width}px;height:300px"></div></div>'
    )


def _auto_theme_donut_scenario(external_labels: bool) -> str:
    scenario = """
      (() => {
        const result = document.querySelector("#contract-result");
        const root = document.querySelector("[data-cm-chart-root]");
        window.contractOptions = [];
        document.documentElement.dataset.theme = "light";
        window.echarts = {
          init: (_root, theme) => {
            window.contractInitTheme = theme || "light";
            return {
              setOption: (option) => window.contractOptions.push(option),
              dispose: () => {},
              resize: () => {},
            };
          },
        };
        try {
          window.GridViewSpecContract.initAllCharts(document);
          const initial = window.contractOptions.at(-1);
          const pie = initial.series[0];
          if (window.contractInitTheme !== "light" ||
              initial.title.textStyle.color !== "#64748b" ||
              initial.legend.textStyle.color !== "#64748b" ||
              pie.itemStyle.borderColor !== "#ffffff" ||
              pie.label.show !== EXPECT_EXTERNAL_LABELS || pie.data.length !== 6 ||
              new Set(pie.data.map((item) => item.itemStyle.color)).size !== 6) {
            throw new Error("light theme or six-color donut options are incorrect");
          }
          document.documentElement.dataset.theme = "dark";
          setTimeout(() => {
            const dark = window.contractOptions.at(-1);
            if (window.contractInitTheme !== "dark" ||
                dark.title.textStyle.color !== "#94a3b8" ||
                dark.legend.textStyle.color !== "#94a3b8" ||
                dark.series[0].itemStyle.borderColor !== "#1e293b") {
              result.dataset.result = "FAIL: automatic theme change did not restyle the donut";
              return;
            }
            result.dataset.result = "PASS";
          }, 0);
        } catch (error) {
          result.dataset.result = `FAIL: ${error.message}`;
        }
      })();
    """
    return scenario.replace("EXPECT_EXTERNAL_LABELS", json.dumps(external_labels))


def _custom_chart_theme_scenario() -> str:
    return """
      (() => {
        const result = document.querySelector("#contract-result");
        window.echarts = {
          init: (_root, theme) => {
            window.contractInitTheme = theme;
            return { setOption: () => {}, dispose: () => {}, resize: () => {} };
          },
        };
        try {
          window.GridViewSpecContract.initAllCharts(document);
          if (window.contractInitTheme !== "registered-site-theme") {
            throw new Error("explicit ECharts theme name was not preserved");
          }
          result.dataset.result = "PASS";
        } catch (error) {
          result.dataset.result = `FAIL: ${error.message}`;
        }
      })();
    """


def test_client_saved_search_selection_filters_rendered_simple_table(
    browser_context: tuple[str, str, Path], tmp_path: Path
) -> None:
    _, chromium, bundle = browser_context
    markup, _ = _saved_search_page()

    result = _run_browser(chromium, bundle, markup, _saved_search_scenario(), tmp_path)

    assert result == "PASS"


def test_initial_selected_client_filter_narrows_rows_and_survives_reload(
    browser_context: tuple[str, str, Path], tmp_path: Path
) -> None:
    _, chromium, bundle = browser_context
    result = _run_browser(
        chromium,
        bundle,
        _selected_client_filter_page(),
        _selected_client_filter_scenario(),
        tmp_path,
        url_query="?brand=Logitech",
    )

    assert result == "PASS"


def test_hidden_middle_simple_table_column_preserves_grid_alignment(
    browser_context: tuple[str, str, Path], tmp_path: Path
) -> None:
    _, chromium, bundle = browser_context

    result = _run_browser(
        chromium, bundle, _hidden_middle_column_page(), _hidden_middle_column_scenario(), tmp_path
    )

    assert result == "PASS"


def test_static_chart_initialization_passes_dom_rows_to_echarts(
    browser_context: tuple[str, str, Path], tmp_path: Path
) -> None:
    _, chromium, bundle = browser_context

    result = _run_browser(chromium, bundle, _chart_markup(), _chart_scenario(), tmp_path)

    assert result == "PASS"


@pytest.mark.parametrize(("width", "external_labels"), [(600, True), (320, False)])
def test_auto_themed_donut_restyles_for_theme_and_width(
    browser_context: tuple[str, str, Path],
    tmp_path: Path,
    width: int,
    external_labels: bool,
) -> None:
    _, chromium, bundle = browser_context
    result = _run_browser(
        chromium,
        bundle,
        _auto_theme_donut_markup(width),
        _auto_theme_donut_scenario(external_labels),
        tmp_path,
    )

    assert result == "PASS"


def test_custom_echarts_theme_name_reaches_echarts_init(
    browser_context: tuple[str, str, Path], tmp_path: Path
) -> None:
    _, chromium, bundle = browser_context
    result = _run_browser(
        chromium,
        bundle,
        _auto_theme_donut_markup(theme="registered-site-theme"),
        _custom_chart_theme_scenario(),
        tmp_path,
    )

    assert result == "PASS"


def test_static_chart_without_dom_rows_attribute_uses_legacy_bind_rows(
    browser_context: tuple[str, str, Path], tmp_path: Path
) -> None:
    _, chromium, bundle = browser_context

    result = _run_browser(
        chromium,
        bundle,
        _chart_markup(include_rows=False),
        _chart_scenario(("Stale",), ((999,),)),
        tmp_path,
    )

    assert result == "PASS"


def test_static_chart_explicit_empty_dom_rows_do_not_fall_back_to_bind_rows(
    browser_context: tuple[str, str, Path], tmp_path: Path
) -> None:
    _, chromium, bundle = browser_context

    result = _run_browser(
        chromium, bundle, _chart_markup(rows=[]), _empty_chart_scenario(), tmp_path
    )

    assert result == "PASS"


def test_rendered_search_clear_button_has_the_translated_accessible_name() -> None:
    markup, _ = _saved_search_page()
    button = re.search(r'<button\b(?=[^>]*class="[^"]*\bcm-toolbar-search-clear\b)[^>]*>', markup)

    assert button is not None
    assert 'aria-label="Clear search"' in button.group()
    assert "title=" not in button.group()


@pytest.mark.parametrize(
    ("mutation", "scenario_name", "expected_failure"),
    [
        (
            "drop-client-input-event",
            "saved-search",
            "FAIL: visible rows do not match the selected preset",
        ),
        (
            "drop-initial-client-filter-replay",
            "selected-client-filter",
            "FAIL: initial client filter did not narrow rendered rows",
        ),
        ("use-chart-bind-rows", "chart", "FAIL: chart categories did not use DOM rows"),
        (
            "use-chart-bind-rows-for-empty",
            "chart-empty",
            "FAIL: explicit empty rows were overridden by bind rows",
        ),
    ],
)
def test_browser_contracts_reject_named_sensitivity_mutations(
    browser_context: tuple[str, str, Path],
    tmp_path: Path,
    mutation: str,
    scenario_name: str,
    expected_failure: str,
) -> None:
    _, chromium, bundle = browser_context
    if scenario_name == "saved-search":
        markup, _ = _saved_search_page()
        scenario = _saved_search_scenario()
        url_query = ""
    elif scenario_name == "selected-client-filter":
        markup = _selected_client_filter_page()
        scenario = _selected_client_filter_scenario()
        url_query = "?brand=Logitech"
    elif scenario_name == "chart-empty":
        markup = _chart_markup(rows=[])
        scenario = _empty_chart_scenario()
        url_query = ""
    else:
        markup = _chart_markup()
        scenario = _chart_scenario()
        url_query = ""

    result = _run_browser(chromium, bundle, markup, scenario, tmp_path, mutation, url_query)

    assert result == expected_failure, f"sensitivity mutation result for {mutation}: {result}"
