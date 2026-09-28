"""Chart bundle detection from GridViewSpec blocks."""

from __future__ import annotations

import pytest

from grid_view_spec.render.block_registry import blocks_require_charts
from grid_view_spec.render.chart_spec import grid_view_chart_to_chart_spec
from grid_view_spec.render.charts_bind import build_chart_runtime, resolve_chart_data
from grid_view_spec.types.chart_server import ChartSpec, ChartType
from grid_view_spec.types.content import GridViewChart, GridViewCharts, GridViewTemplate
from grid_view_spec.types.spec import GridViewSpec


def test_blocks_require_charts_from_charts_block() -> None:
    spec = GridViewSpec(
        id="page",
        blocks=(GridViewCharts(id="charts", charts=()),),
    )
    assert blocks_require_charts(spec.blocks)


def test_blocks_require_charts_from_template_context() -> None:
    spec = GridViewSpec(
        id="page",
        blocks=(
            GridViewTemplate(
                id="pnl",
                template="dashboard/pnl.html",
                context={"chart_config_json": "{}", "chart_rows_json": "[]"},
            ),
        ),
    )
    assert blocks_require_charts(spec.blocks)


def test_blocks_require_charts_false_without_chart_payload() -> None:
    spec = GridViewSpec(
        id="page",
        blocks=(
            GridViewTemplate(
                id="plain",
                template="dashboard/plain.html",
                context={"title": "Hello"},
            ),
        ),
    )
    assert not blocks_require_charts(spec.blocks)


def test_chart_runtime_preserves_the_spec_title_for_the_browser_renderer() -> None:
    runtime = build_chart_runtime(
        ChartSpec(id="revenue", chart_type=ChartType.BAR, title="Revenue by region"),
        (),
    )
    assert runtime.to_dict().get("title") == "Revenue by region"


def test_donut_group_by_aggregates_visible_table_rows() -> None:
    spec = ChartSpec(
        id="status",
        chart_type=ChartType.DONUT,
        label_key="status",
        value_key="qty",
        group_by="status",
    )
    resolved = resolve_chart_data(
        spec,
        (
            {"status": "shipped", "qty": 5},
            {"status": "pending", "qty": 2},
            {"status": "shipped", "qty": 3},
        ),
    )
    bind = build_chart_runtime(spec, ()).to_dict().get("bind")
    assert bind is not None
    assert bind.get("groupBy") == "status"
    assert resolved.get("slices") == [
        {"label": "shipped", "value": 8.0, "color": "#22c55e"},
        {"label": "pending", "value": 2.0, "color": "#f59e0b"},
    ]


def test_donut_group_by_uses_its_group_key_not_the_display_label() -> None:
    spec = ChartSpec(
        id="status",
        chart_type=ChartType.DONUT,
        label_key="product",
        value_key="qty",
        group_by="status",
    )
    resolved = resolve_chart_data(
        spec,
        (
            {"status": "shipped", "product": "Mouse", "qty": 5},
            {"status": "pending", "product": "Hub", "qty": 2},
            {"status": "shipped", "product": "Keyboard", "qty": 3},
        ),
    )
    assert resolved.get("slices") == [
        {"label": "shipped", "value": 8.0, "color": "#22c55e"},
        {"label": "pending", "value": 2.0, "color": "#f59e0b"},
    ]


def test_donut_palette_has_eight_distinct_colors_and_preserves_first_three() -> None:
    spec = ChartSpec(
        id="collections",
        chart_type=ChartType.DONUT,
        value_key="stock",
        group_by="collection",
    )
    rows = tuple({"collection": f"Collection {index}", "stock": index + 1} for index in range(8))

    slices = resolve_chart_data(spec, rows).get("slices")
    assert slices is not None
    colors = [item.get("color") for item in slices]
    assert colors[:3] == ["#22c55e", "#f59e0b", "#ef4444"]
    assert len(set(colors)) == 8


@pytest.mark.parametrize("theme", ["auto", "registered-site-theme"])
def test_chart_runtime_carries_theme_from_chart_options(theme: str) -> None:
    chart = GridViewChart(
        id="collections",
        type="donut",
        options={"echarts_theme": theme},
    )

    spec = grid_view_chart_to_chart_spec(chart)
    runtime = build_chart_runtime(spec, ()).to_dict()

    assert spec.echarts_theme == theme
    assert runtime.get("echartsTheme") == theme
