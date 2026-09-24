"""Python↔JS KPI parity — shared ``tests/fixtures/kpi_conformance.json``."""

from __future__ import annotations

import json
from pathlib import Path

from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render import render_grid_view_spec
from grid_view_spec.render.bind import resolve_kpi_value
from grid_view_spec.types.chart_server import KpiAggregate
from grid_view_spec.types.content import ColumnFormat, GridViewKpi, KpiSpec
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.spec import GridViewSpec

_FIXTURE = Path(__file__).resolve().parent / "fixtures" / "kpi_conformance.json"


def _spec_from_wire(raw: dict[str, object]) -> KpiSpec:
    aggregate = str(raw.get("aggregate", "count"))
    column_key = raw.get("column_key")
    return KpiSpec(
        label=str(raw.get("label", "")),
        aggregate=KpiAggregate(aggregate),
        column_key=str(column_key) if isinstance(column_key, str) else None,
    )


def test_kpi_conformance_fixtures() -> None:
    cases = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    for case in cases:
        rows = tuple(dict(row) for row in case["rows"])
        for spec_wire, expect in zip(case["specs"], case["expect"], strict=True):
            spec = _spec_from_wire(spec_wire)
            got = resolve_kpi_value(spec, rows)
            assert got == expect["rawValue"], f"{case['id']}: {spec.label}"


def test_explicit_kpi_value_renders_with_its_format() -> None:
    kpi = GridViewKpi(
        id="totals",
        items=(KpiSpec(label="Revenue", format=ColumnFormat.CURRENCY, value=12345),),
    )
    spec = GridViewSpec(
        id="kpi_page",
        blocks=(kpi,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(kpi.id,))),
    )

    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")

    assert '<span class="cm-kpi-value">12 345</span>' in html
