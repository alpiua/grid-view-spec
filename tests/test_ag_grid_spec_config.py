"""AG-Grid spec boot config emission."""

from __future__ import annotations

import json
from html.parser import HTMLParser

from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render.ag_grid import ag_grid_spec_config, ag_grid_spec_config_json
from grid_view_spec.render.spec_renderer import render_grid_view_spec
from grid_view_spec.types.formatters import DateTimeFormatter
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.spec import GridViewSpec
from grid_view_spec.types.table_v2 import (
    GridViewColumn,
    GridViewColumnSource,
    GridViewDataSource,
    GridViewTable,
)


def test_ag_grid_spec_config_emits_column_source() -> None:
    table = GridViewTable(
        id="stock",
        backend="ag_grid",
        columns=(GridViewColumn(id="sku", label="SKU", field="sku"),),
        datasource=GridViewDataSource(endpoint="/api/"),
        column_source=GridViewColumnSource(
            endpoint="/api/columns/",
            depends_on=("region",),
            anchor="sku",
        ),
    )
    config = ag_grid_spec_config(table, "stock")
    assert config["columns"] == [
        {
            "id": "sku",
            "field": "sku",
            "label": "SKU",
            "hidden": False,
            "type": "text",
            "renderer": "",
            "editable": False,
            "width": "",
            "minWidth": "",
            "sortable": True,
            "pinned": "",
            "menuGroup": "",
            "agFilter": "",
            "checkboxSelection": False,
            "extra": {},
        }
    ]
    assert config["columnSource"] == {
        "endpoint": "/api/columns/",
        "method": "get",
        "dependsOn": ["region"],
        "params": {},
        "anchor": "sku",
    }


def test_ag_grid_spec_config_emits_entire_row_drag() -> None:
    table = GridViewTable(
        id="brand_products",
        backend="ag_grid",
        columns=(GridViewColumn(id="title", label="Product", field="title"),),
        extra={
            "row_selection": "multiple",
            "row_drag_entire_row": True,
            "row_drag_multi_row": True,
            "row_click_selection": "toggle",
        },
    )

    config = ag_grid_spec_config(table, "brand_products")

    assert config["rowSelection"] == "multiple"
    assert config["rowDragEntireRow"] is True
    assert config["rowDragMultiRow"] is True
    assert config["rowClickSelection"] == "toggle"


def test_ag_grid_spec_config_emits_date_time_formatter_as_camel_case_boot_json() -> None:
    empty_value = '</script><script id="breakout">x</script><img src=x onerror="noop">'
    table = GridViewTable(
        id="events",
        backend="ag_grid",
        columns=(
            GridViewColumn(
                id="created",
                label="Created",
                field="created_at",
                type="date",
                date_time_formatter=DateTimeFormatter(
                    format="date",
                    locale="en-US",
                    timezone="Europe/Kyiv",
                    empty_value=empty_value,
                    strict=True,
                ),
            ),
        ),
    )

    config = ag_grid_spec_config(table, "events")

    assert config["columns"] == [
        {
            "id": "created",
            "field": "created_at",
            "label": "Created",
            "hidden": False,
            "type": "date",
            "renderer": "",
            "editable": False,
            "width": "",
            "minWidth": "",
            "sortable": True,
            "pinned": "",
            "menuGroup": "",
            "agFilter": "",
            "checkboxSelection": False,
            "extra": {},
            "dateTimeFormatter": {
                "format": "date",
                "locale": "en-US",
                "timezone": "Europe/Kyiv",
                "emptyValue": empty_value,
                "strict": True,
            },
        }
    ]
    boot_json = ag_grid_spec_config_json(table, "events")
    assert '"dateTimeFormatter"' in boot_json
    assert '"date_time_formatter"' not in boot_json
    assert "<" not in boot_json
    assert json.loads(boot_json)["columns"][0]["dateTimeFormatter"]["emptyValue"] == empty_value

    class ScriptReader(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self.scripts: list[tuple[dict[str, str | None], str]] = []
            self._script_attrs: dict[str, str | None] | None = None
            self._script_text = ""

        def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
            if tag == "script":
                self._script_attrs = dict(attrs)
                self._script_text = ""

        def handle_data(self, data: str) -> None:
            if self._script_attrs is not None:
                self._script_text += data

        def handle_endtag(self, tag: str) -> None:
            if tag == "script" and self._script_attrs is not None:
                self.scripts.append((self._script_attrs, self._script_text))
                self._script_attrs = None

    rendered = render_grid_view_spec(
        GridViewSpec(
            id="events",
            blocks=(table,),
            layout=GridViewLayout(root=GridViewArea(id="root", blocks=("events",))),
        ),
        (),
        host=InMemoryHost(),
        backend="html",
    )
    assert isinstance(rendered, str)
    parser = ScriptReader()
    parser.feed(rendered)
    assert len(parser.scripts) == 1
    script_attrs, script_text = parser.scripts[0]
    assert script_attrs.get("type") == "application/json"
    assert script_attrs.get("class") == "cm-ag-grid-spec-config"
    assert json.loads(script_text)["columns"][0]["dateTimeFormatter"]["emptyValue"] == empty_value
