"""AG-Grid spec boot config emission."""

from __future__ import annotations

from grid_view_spec.render.ag_grid import ag_grid_spec_config
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
