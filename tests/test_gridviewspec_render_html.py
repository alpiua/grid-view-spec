"""Golden HTML tests for Jinja2 spec renderer."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render import render_grid_view_spec
from grid_view_spec.render.jinja import template_dir_exists
from grid_view_spec.types.actions import GridViewActions
from grid_view_spec.types.blocks import GridViewBlock
from grid_view_spec.types.content import (
    GridViewCards,
    GridViewCharts,
    GridViewContent,
    GridViewKpi,
    GridViewTab,
    GridViewTabs,
    GridViewTemplate,
)
from grid_view_spec.types.filters_v2 import (
    GridViewFilter,
    GridViewFilterDrawerSection,
    GridViewFilterOption,
    GridViewFilters,
    GridViewFilterState,
)
from grid_view_spec.types.form import GridViewForm
from grid_view_spec.types.header import GridViewHeader
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.media import GridViewGallery, GridViewImage, GridViewImageSource
from grid_view_spec.types.nav import GridViewNav, GridViewNavItem
from grid_view_spec.types.overlay import GridViewOverlay
from grid_view_spec.types.spec import GridViewSpec
from grid_view_spec.types.spec_meta import GridViewConfig
from grid_view_spec.types.table_v2 import (
    GridViewColumn,
    GridViewDataSource,
    GridViewTable,
)
from grid_view_spec.types.toolbar import GridViewToolbar
from tests.gridviewspec_fixtures import minimal_valid_spec

_TEMPLATE_DIR = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "grid_view_spec"
    / "templates"
    / "grid_view"
    / "spec"
)
BLOCK_TEMPLATE_FILES = (
    "spec.html",
    "block.html",
    "header.html",
    "toolbar.html",
    "filters.html",
    "actions.html",
    "table.html",
    "charts.html",
    "kpi.html",
    "cards.html",
    "tabs.html",
    "nav.html",
    "content.html",
    "form.html",
    "overlay.html",
    "template.html",
    "gallery.html",
    "image.html",
    "lazy_placeholder.html",
)


def _minimal_block(block_type: str) -> GridViewBlock:
    blocks: dict[str, GridViewBlock] = {
        "header": GridViewHeader(id="h1"),
        "toolbar": GridViewToolbar(id="t1"),
        "filters": GridViewFilters(id="f1"),
        "actions": GridViewActions(id="a1"),
        "table": GridViewTable(id="tbl1", columns=(GridViewColumn(id="c1", label="C", field="c"),)),
        "charts": GridViewCharts(id="c1", charts=()),
        "kpi": GridViewKpi(id="k1", items=()),
        "cards": GridViewCards(id="cd1", cards=()),
        "gallery": GridViewGallery(id="g1"),
        "image": GridViewImage(id="i1", image=GridViewImageSource(id="img1")),
        "tabs": GridViewTabs(id="tb1", tabs=(GridViewTab(id="t", label="T"),)),
        "nav": GridViewNav(id="n1", items=(GridViewNavItem(id="n", label="N"),)),
        "content": GridViewContent(id="cnt1"),
        "form": GridViewForm(id="frm1"),
        "overlay": GridViewOverlay(id="ov1"),
        "template": GridViewTemplate(id="tpl1"),
    }
    return blocks[block_type]


@pytest.mark.parametrize("filename", BLOCK_TEMPLATE_FILES)
def test_spec_template_files_exist(filename: str) -> None:
    assert (_TEMPLATE_DIR / filename).is_file()


def test_minimal_spec_renders_html() -> None:
    assert template_dir_exists()
    host = InMemoryHost()
    html = render_grid_view_spec(minimal_valid_spec(), (), host=host, backend="html")
    assert isinstance(html, str)
    assert 'class="cm-grid-view-spec"' in html
    assert 'data-spec-id="page_records"' in html
    assert "cm-table-surface" in html
    assert 'data-cm-table-backend="simple"' in html
    assert "Records" in html


def test_root_renders_page_state_scope_attribute() -> None:
    """The rendered root exposes the browser page-state namespace."""
    spec = GridViewSpec(
        id="page_state_scope_render",
        config=GridViewConfig(page_state_scope="orders:active"),
    )

    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")

    root = re.search(r'<div\b[^>]*\bid="cm-spec-page_state_scope_render"[^>]*>', html)
    assert root is not None
    assert 'data-cm-page-state-scope="orders:active"' in root.group()


def test_facets_refresh_mode_renders_on_filter_bar_and_workspace_roots() -> None:
    """Both filter presentations expose the opt-in mode while legacy bars default to spec."""
    bar = GridViewFilters(id="faceted_bar", facets=True, facets_refresh_mode="in_place")
    workspace = GridViewFilters(
        id="faceted_workspace",
        facets=True,
        facets_refresh_mode="in_place",
        presentation="drawer",
        drawer_layout="workspace",
        schema=(
            GridViewFilter(
                id="category",
                label="Category",
                param="category",
                type="select",
                options=(GridViewFilterOption(value="outdoor", label="Outdoor"),),
            ),
        ),
        drawer_sections=(
            GridViewFilterDrawerSection(
                id="categories",
                label="Categories",
                filter_ids=("category",),
            ),
        ),
    )
    legacy = GridViewFilters(id="legacy_filter_bar")
    spec = GridViewSpec(
        id="facets_refresh_mode_render",
        blocks=(bar, workspace, legacy),
        layout=GridViewLayout(
            root=GridViewArea(id="root", blocks=(bar.id, workspace.id, legacy.id))
        ),
    )

    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    roots = re.findall(r"<div\b[^>]*data-cm-filter-bar[^>]*>", html)

    assert len(roots) == 3
    assert sum('data-cm-facets-refresh-mode="in_place"' in root for root in roots) == 2
    assert sum('data-cm-facets-refresh-mode="spec"' in root for root in roots) == 1


def test_facet_params_and_endpoint_render_on_filter_bar_and_workspace() -> None:
    """Scoped facet params and dedicated fragment endpoints render onto both bar templates."""
    bar = GridViewFilters(
        id="scoped_bar",
        facets=True,
        facets_refresh_mode="in_place",
        facet_params=("category_id",),
        facets_endpoint="/catalog/filters-fragment/",
    )
    workspace = GridViewFilters(
        id="scoped_workspace",
        facets=True,
        facets_refresh_mode="in_place",
        facet_params=("category_id", "brand"),
        facets_endpoint="/catalog/filters-fragment/",
        presentation="drawer",
        drawer_layout="workspace",
        schema=(
            GridViewFilter(
                id="category_id",
                label="Category",
                param="category_id",
                type="select",
                options=(GridViewFilterOption(value="outdoor", label="Outdoor"),),
            ),
        ),
        drawer_sections=(
            GridViewFilterDrawerSection(
                id="categories",
                label="Categories",
                filter_ids=("category_id",),
            ),
        ),
    )
    spec = GridViewSpec(
        id="scoped_facets_render",
        blocks=(bar, workspace),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(bar.id, workspace.id))),
    )

    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    roots = re.findall(r"<div\b[^>]*data-cm-filter-bar[^>]*>", html)

    assert len(roots) == 2
    assert 'data-cm-facet-params="category_id"' in roots[0]
    assert 'data-cm-facet-params="category_id,brand"' in roots[1]
    assert all('data-cm-facets-endpoint="/catalog/filters-fragment/"' in root for root in roots)


def test_filter_drawer_renders_filter_search_and_target_settings_tab() -> None:
    """A target table exposes its column controls in the drawer's settings tab."""
    table = GridViewTable(
        id="records",
        columns=(GridViewColumn(id="name", label="Name", field="name"),),
        settings=("drawer", "modal"),
    )
    filters = GridViewFilters(
        id="record_filters",
        title="Record filters",
        presentation="drawer",
        target=table.id,
        schema=(
            GridViewFilter(id="minimum", label="Minimum", param="minimum", type="number"),
            GridViewFilter(id="active", label="Active", param="active", type="boolean"),
        ),
        state=GridViewFilterState(values={"active": True}),
    )
    spec = GridViewSpec(
        id="filter_drawer",
        blocks=(filters, table),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(filters.id, table.id))),
    )

    html = render_grid_view_spec(
        spec,
        (),
        host=InMemoryHost(translations={"filter.workspace_search": "Search filter"}),
        backend="html",
    )

    assert 'data-cm-filter-drawer-id="record_filters"' in html
    assert "data-cm-filter-drawer-search" in html
    assert re.search(
        r'<input[^>]*data-cm-filter-drawer-search[^>]*placeholder="Search filter"', html
    )
    assert "data-cm-filter-drawer-close-label" in html
    assert 'data-cm-filter-drawer-tab="settings"' in html
    assert 'data-cm-filter-drawer-settings data-cm-grid-id="records"' in html
    assert "data-cm-filter-input" in html
    assert 'value=""' in html
    assert 'value="1" data-cm-filter-input checked' in html


def test_workspace_filter_drawer_renders_grouped_cards_and_canonical_filter_bar() -> None:
    """The workspace layout keeps the normal filter transport contract."""
    table = GridViewTable(
        id="records",
        columns=(GridViewColumn(id="name", label="Name", field="name"),),
        settings=("drawer", "modal"),
    )
    filters = GridViewFilters(
        id="catalog_filters",
        presentation="drawer",
        drawer_layout="workspace",
        target=table.id,
        schema=(
            GridViewFilter(
                id="category",
                label="Category",
                param="category_id",
                type="multiselect",
                drawer_control="tree",
                options=(
                    GridViewFilterOption(
                        value="outdoor",
                        label="Outdoor",
                        children=(GridViewFilterOption(value="tents", label="Tents"),),
                    ),
                ),
            ),
            GridViewFilter(
                id="view",
                label="View",
                param="view",
                type="select",
                options=(GridViewFilterOption(value="list", label="List"),),
            ),
        ),
        drawer_sections=(
            GridViewFilterDrawerSection(
                id="category",
                label="Category",
                filter_ids=("category",),
                searchable=True,
                list_size="lg",
            ),
            GridViewFilterDrawerSection(
                id="display",
                label="Display",
                filter_ids=("view",),
                panel="settings",
            ),
        ),
        state=GridViewFilterState(values={"category_id": ("tents",)}),
    )
    spec = GridViewSpec(
        id="workspace_filter_drawer",
        blocks=(filters, table),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(filters.id, table.id))),
    )

    html = render_grid_view_spec(
        spec,
        (),
        host=InMemoryHost(translations={"filter.workspace_search": "Search filter"}),
        backend="html",
    )

    assert "data-cm-filter-drawer-workspace" in html
    assert "data-cm-filter-bar" in html
    assert 'data-cm-filter-workspace-panel="filters"' in html
    assert 'data-cm-filter-workspace-panel="settings"' in html
    assert "data-cm-filter-workspace-search" in html
    assert re.search(
        r'<input[^>]*data-cm-filter-workspace-search[^>]*placeholder="Search filter"', html
    )
    assert "data-cm-filter-tree-node" in html
    assert 'data-filter-param="view"' in html
    assert re.search(r'<input[^>]*value="tents"[^>]*checked', html)


def test_grouped_select_filter_renders_one_native_select_per_named_group() -> None:
    """Grouped choices retain one CSV-backed query control per option group."""
    filters = GridViewFilters(
        id="price_tiers",
        schema=(
            GridViewFilter(
                id="wholesale",
                label="Wholesale tiers",
                param="wholesale_price_columns",
                type="grouped_select",
                options=(
                    GridViewFilterOption(
                        value="supplier-a",
                        label="Supplier A",
                        children=(
                            GridViewFilterOption(
                                value="a:standard",
                                label="Standard",
                                disabled=True,
                            ),
                            GridViewFilterOption(value="a:partner", label="Partner"),
                        ),
                    ),
                ),
            ),
        ),
        state=GridViewFilterState(values={"wholesale_price_columns": ("a:partner",)}),
    )
    spec = GridViewSpec(
        id="grouped_select_filter",
        blocks=(filters,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(filters.id,))),
    )

    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")

    assert "data-cm-grouped-select" in html
    assert 'value="a:standard" disabled' in html
    assert 'value="a:partner" selected' in html


def _toolbar_spec_with_table(toolbar: GridViewToolbar) -> GridViewSpec:
    """Helper: spec with the given toolbar wired to a simple table."""
    table = GridViewTable(id="tbl_target", columns=(GridViewColumn(id="c1", label="C", field="c"),))
    return GridViewSpec(
        id="page_toolbar_test",
        blocks=(toolbar, table),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(toolbar.id, table.id))),
    )


def test_toolbar_clear_all_true_with_target_renders_button() -> None:
    """clear_all=True (default) + target set → clear-all button present in HTML."""
    toolbar = GridViewToolbar(id="tb1", clear_all=True, target="tbl_target")
    html = render_grid_view_spec(
        _toolbar_spec_with_table(toolbar), (), host=InMemoryHost(), backend="html"
    )
    assert 'data-cm-grid-action="clearAllFilters"' in html


def test_toolbar_clear_all_false_suppresses_button() -> None:
    """clear_all=False → clear-all button must NOT appear in HTML."""
    toolbar = GridViewToolbar(id="tb1", clear_all=False, target="tbl_target")
    html = render_grid_view_spec(
        _toolbar_spec_with_table(toolbar), (), host=InMemoryHost(), backend="html"
    )
    assert 'data-cm-grid-action="clearAllFilters"' not in html


def test_toolbar_clear_all_true_without_target_suppresses_button() -> None:
    """clear_all=True but no target → template condition requires both, button absent."""
    toolbar = GridViewToolbar(id="tb1", clear_all=True, target=None)
    spec = GridViewSpec(
        id="page_toolbar_notarget",
        blocks=(toolbar,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(toolbar.id,))),
    )
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    assert 'data-cm-grid-action="clearAllFilters"' not in html


def test_table_backend_attribute_present() -> None:
    """Table blocks must carry data-cm-table-backend attribute (regression guard)."""
    html = render_grid_view_spec(minimal_valid_spec(), (), host=InMemoryHost(), backend="html")
    assert 'data-cm-table-backend="simple"' in html


@pytest.mark.parametrize(
    "block_type",
    [
        "header",
        "toolbar",
        "filters",
        "actions",
        "table",
        "charts",
        "kpi",
        "cards",
        "gallery",
        "image",
        "tabs",
        "nav",
        "content",
        "form",
        "overlay",
        "template",
    ],
)
def test_single_block_type_renders(block_type: str) -> None:
    block = _minimal_block(block_type)
    spec = GridViewSpec(
        id=f"page_{block_type}",
        blocks=(block,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(block.id,))),
    )
    host = InMemoryHost()
    html = render_grid_view_spec(spec, (), host=host, backend="html")
    assert isinstance(html, str)
    assert f"cm-block-{block_type}" in html


def test_gallery_lightbox_markup() -> None:
    spec = GridViewSpec(
        id="gallery_page",
        blocks=(
            GridViewGallery(
                id="photos",
                lightbox=True,
                columns=4,
                images=(
                    GridViewImageSource(id="a", url="/a.png", alt="Alpha", thumb="/a-t.png"),
                    GridViewImageSource(id="b", url="/b.png", alt="Beta"),
                ),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("photos",))),
    )
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    assert "data-cm-gallery" in html
    assert 'data-cm-gallery-id="photos"' in html
    assert 'data-cm-gallery-lightbox="true"' in html
    assert 'data-cm-gallery-full="/a.png"' in html
    assert 'src="/a-t.png"' in html
    assert "data-cm-gallery-open" in html


def test_gallery_lazy_datasource_attr() -> None:
    spec = GridViewSpec(
        id="lazy_gallery_page",
        blocks=(
            GridViewGallery(
                id="photos",
                images=(),
                datasource=GridViewDataSource(endpoint="/gallery.json"),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("photos",))),
    )
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    assert 'data-cm-gallery-src="/gallery.json"' in html


def test_nav_tree_presentation_renders_html() -> None:
    from grid_view_spec.types.nav import GridViewNavLevel

    spec = GridViewSpec(
        id="tree_nav_page",
        blocks=(
            GridViewNav(
                id="tree_nav",
                presentation="tree",
                search_placeholder="Search tree...",
                levels=(
                    GridViewNavLevel(level=0, type="category", label="Categories"),
                    GridViewNavLevel(level=1, type="item", label="Items"),
                ),
                items=(
                    GridViewNavItem(
                        id="cat1",
                        label="Category 1",
                        type="category",
                        count=5,
                        children=(
                            GridViewNavItem(
                                id="item1",
                                label="Item 1",
                                type="item",
                                active=True,
                                extra={"hx_get": "/items/1/pane/"},
                            ),
                        ),
                    ),
                ),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("tree_nav",))),
    )
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    assert 'data-cm-nav-tree="tree_nav"' in html
    assert 'data-cm-tree-search="1"' in html
    assert 'placeholder="Search tree..."' in html
    assert 'data-node-id="cat1"' in html
    assert 'data-node-type="category"' in html
    assert "Category 1" in html
    assert "Item 1" in html
    assert 'hx-get="/items/1/pane/"' in html
    assert "is-active" in html
