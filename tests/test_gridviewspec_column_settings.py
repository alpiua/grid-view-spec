"""Column settings metadata + HTML wiring for GridViewSpec tables."""

from __future__ import annotations

import json

import pytest

from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render import build_render_context, render_grid_view_spec
from grid_view_spec.render.column_settings import column_filter_wire, table_column_settings_meta
from grid_view_spec.types.filters_v2 import GridViewFilter, GridViewFilters
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.spec import GridViewSpec
from grid_view_spec.types.table_v2 import (
    GridViewColumn,
    GridViewColumnGroup,
    GridViewTable,
    GridViewTableHeader,
    GridViewTableSettings,
)
from grid_view_spec.types.toolbar import GridViewToolbar
from grid_view_spec.validate import codes as c
from grid_view_spec.validate import validate_spec


def test_column_filter_wire_maps_vnext_set_to_list() -> None:
    column = GridViewColumn(
        id="name",
        label="Name",
        field="name",
        filter=GridViewFilter(id="name_filter", label="Name", param="name", type="set"),
    )
    assert column_filter_wire(column) == "list"
    meta = table_column_settings_meta(
        GridViewTable(
            id="demo",
            columns=(column,),
            settings=("drawer", "modal"),
        )
    )
    assert meta[0].get("columnFilter") == "list"


def test_rendered_table_set_filter_wires_list_kind() -> None:
    spec = GridViewSpec(
        id="set_filter_page",
        blocks=(
            GridViewTable(
                id="doctors",
                columns=(
                    GridViewColumn(
                        id="name",
                        label="Name",
                        field="name",
                        filter=GridViewFilter(
                            id="name_filter", label="Name", param="name", type="set"
                        ),
                    ),
                ),
                rows=({"name": "Alpha", "name__filter_tokens": '["Alpha"]'},),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("doctors",))),
    )
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    assert 'data-cm-column-filter="list"' in html
    assert "data-cm-filter-tokens=" in html and "Alpha" in html


def test_table_column_settings_meta_flat_columns() -> None:
    table = GridViewTable(
        id="demo",
        columns=(
            GridViewColumn(id="a", label="A"),
            GridViewColumn(id="b", label="B", hidden=True, menu_group="Stats"),
        ),
        settings=("drawer", "modal"),
    )
    meta = table_column_settings_meta(table)
    assert meta[0].get("colId") == "a"
    assert meta[1].get("hide") is True
    assert meta[1].get("menuGroup") == "Stats"


def test_table_column_settings_meta_emits_group_units() -> None:
    table = GridViewTable(
        id="demo",
        columns=(
            GridViewColumn(id="name", label="Name"),
            GridViewColumn(id="x", label="X", hidden=True, menu_group="G"),
            GridViewColumn(id="y", label="Y", hidden=True, menu_group="G"),
        ),
        header=GridViewTableHeader(
            groups=(GridViewColumnGroup(id="grp", label="Group", columns=("x", "y")),),
            groups_order=("Group",),
        ),
        settings=("drawer", "modal"),
    )
    meta = table_column_settings_meta(table)
    assert meta[0].get("colId") == "name"
    assert meta[1].get("isGroup") is True
    assert meta[1].get("colId") == "group:grp"
    assert meta[1].get("columnKeys") == ["x", "y"]


def test_rendered_ag_grid_table_wires_column_settings_panel() -> None:
    from grid_view_spec.types.table_v2 import GridViewDataSource

    spec = GridViewSpec(
        id="ag_settings_page",
        blocks=(
            GridViewTable(
                id="records",
                backend="ag_grid",
                datasource=GridViewDataSource(endpoint="/api/rows"),
                settings=("drawer", "modal"),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("records",))),
    )
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    assert 'id="col-selector-panel-records"' in html
    assert "cm-col-selector-panel" in html


@pytest.mark.parametrize(
    ("settings", "drawer_visible", "modal_visible"),
    (
        (None, False, False),
        (("drawer",), True, False),
        (("modal",), False, True),
        (("drawer", "modal"), True, True),
        (("modal", "drawer"), True, True),
    ),
)
def test_table_settings_surface_selection(
    settings: GridViewTableSettings | None,
    drawer_visible: bool,
    modal_visible: bool,
) -> None:
    """The drawer tab and toolbar modal are separate table settings surfaces."""
    table = GridViewTable(
        id="records",
        columns=(GridViewColumn(id="name", label="Name", field="name"),),
        settings=settings,
    )
    filters = GridViewFilters(id="record_filters", presentation="drawer", target=table.id)
    toolbar = GridViewToolbar(id="record_toolbar", target=table.id)
    spec = GridViewSpec(
        id="settings_surfaces",
        blocks=(toolbar, filters, table),
        layout=GridViewLayout(
            root=GridViewArea(id="root", blocks=(toolbar.id, filters.id, table.id))
        ),
    )

    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")

    assert ('data-cm-filter-drawer-tab="settings"' in html) is drawer_visible
    assert ('data-cm-filter-drawer-settings data-cm-grid-id="records"' in html) is drawer_visible
    assert ('id="col-selector-panel-records"' in html) is modal_visible
    assert ('id="col-selector-btn-records"' in html) is modal_visible
    assert ('data-cm-col-action="toggle-modal"' in html) is modal_visible


@pytest.mark.parametrize(
    "invalid_settings",
    ((), ("drawer", "drawer"), ("unknown",), ["drawer"], "drawer"),
)
def test_invalid_table_settings_validate_and_do_not_render(invalid_settings: object) -> None:
    table = GridViewTable(
        id="records",
        columns=(GridViewColumn(id="name", label="Name", field="name"),),
    )
    object.__setattr__(table, "settings", invalid_settings)
    spec = GridViewSpec(
        id="invalid_settings",
        blocks=(table,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(table.id,))),
    )

    result = validate_spec(spec)
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")

    assert not result.ok
    assert any(d.code == c.INVALID_TABLE_SETTINGS for d in result.diagnostics)
    assert 'data-cm-column-settings="1"' not in html
    assert "col-selector-panel-records" not in html


def test_build_render_context_includes_column_settings_extra() -> None:
    spec = GridViewSpec(
        id="settings_page",
        blocks=(
            GridViewTable(
                id="records",
                columns=(GridViewColumn(id="name", label="Name", field="name"),),
                settings=("drawer", "modal"),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("records",))),
    )
    ctx = build_render_context(spec, (), host=InMemoryHost())
    extra = ctx.blocks["records"].extra
    assert extra.get("column_meta_json")
    meta = json.loads(str(extra["column_meta_json"]))
    assert meta[0]["colId"] == "name"


def test_rendered_table_shell_wires_column_settings_attrs() -> None:
    spec = GridViewSpec(
        id="settings_page",
        blocks=(
            GridViewTable(
                id="doctors",
                columns=(GridViewColumn(id="name", label="Name", field="name"),),
                settings=("drawer", "modal"),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("doctors",))),
    )
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    assert 'data-cm-column-settings="1"' in html
    assert 'data-cm-columns="' in html
    assert 'id="col-selector-panel-doctors"' in html
    assert "cm-col-selector-panel" in html
    assert "is-hidden" in html
    assert "fixed inset-0" not in html
    assert "flex items-center" not in html
