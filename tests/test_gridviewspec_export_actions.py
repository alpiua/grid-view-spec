"""GridViewExportAction rendering and href builder tests."""

from __future__ import annotations

import pytest

from grid_view_spec.backends.django.host import DjangoGridViewHost
from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render import render_grid_view_spec
from grid_view_spec.render.action_urls import export_action_href
from grid_view_spec.types.actions import (
    GridViewActions,
    GridViewButtonAction,
    GridViewConfirmConfig,
    GridViewExportAction,
    GridViewLinkAction,
    GridViewMenuAction,
    GridViewOverlayAction,
    GridViewSelectAction,
    GridViewSelectOption,
)
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.spec import GridViewSpec
from grid_view_spec.types.table_v2 import GridViewColumn, GridViewTable

pytest.importorskip("jinja2")


def _actions_spec(
    *actions: GridViewExportAction | GridViewLinkAction | GridViewMenuAction,
) -> GridViewSpec:
    return GridViewSpec(
        id="page_export",
        blocks=(
            GridViewActions(id="page_actions", items=actions),
            GridViewTable(
                id="records",
                backend="simple",
                columns=(GridViewColumn(id="name", label="Name", field="name"),),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("page_actions", "records"))),
    )


def _first_export_action(spec: GridViewSpec) -> GridViewExportAction:
    block = spec.blocks[0]
    assert isinstance(block, GridViewActions)
    action = block.items[0]
    assert isinstance(action, GridViewExportAction)
    return action


def test_export_action_href_uses_host_routes_and_filter_state() -> None:
    spec = _actions_spec(
        GridViewExportAction(
            id="pdf",
            label="PDF",
            format="pdf",
            target="records",
            params={"builder": "records"},
        ),
        GridViewExportAction(
            id="xlsx",
            label="XLSX",
            format="xlsx",
            target="records",
            params={"builder": "records"},
        ),
    )
    host = InMemoryHost(filter_state={"q": "Alpha", "period": "2024-01"})
    pdf = _first_export_action(spec)
    block = spec.blocks[0]
    assert isinstance(block, GridViewActions)
    xlsx_action = block.items[1]
    assert isinstance(xlsx_action, GridViewExportAction)

    pdf_href = export_action_href(
        pdf,
        host=host,
        spec=spec,
        filter_state=host.filter_state_from_request(spec),
    )
    xlsx_href = export_action_href(
        xlsx_action,
        host=host,
        spec=spec,
        filter_state=host.filter_state_from_request(spec),
    )

    assert pdf_href.startswith("/export_pdf?")
    assert "builder=records" in pdf_href
    assert "q=Alpha" in pdf_href
    assert "period=2024-01" in pdf_href

    assert xlsx_href.startswith("/export_xlsx?")
    assert "builder=records" in xlsx_href
    assert "q=Alpha" in xlsx_href


def test_export_action_href_respects_endpoint_and_include_state() -> None:
    spec = _actions_spec(
        GridViewExportAction(
            id="csv",
            label="CSV",
            format="csv",
            endpoint="/custom/export",
            include_state=False,
        )
    )
    host = InMemoryHost(filter_state={"q": "hidden"})
    action = _first_export_action(spec)
    href = export_action_href(
        action,
        host=host,
        spec=spec,
        filter_state=host.filter_state_from_request(spec),
    )
    assert href == "/custom/export?builder=page_export"


def test_export_action_href_endpoint_includes_builder_from_params() -> None:
    spec = _actions_spec(
        GridViewExportAction(
            id="pdf",
            label="PDF",
            format="pdf",
            endpoint="/api/export/pdf/",
            include_state=True,
            params={"builder": "alarms", "grid_id": "alarms"},
        )
    )
    host = InMemoryHost(filter_state={"q": "Alpha", "period": "2026-03"})
    action = _first_export_action(spec)
    href = export_action_href(
        action,
        host=host,
        spec=spec,
        filter_state=host.filter_state_from_request(spec),
    )
    assert "builder=alarms" in href
    assert "grid_id=alarms" in href
    assert "q=Alpha" in href
    assert "period=2026-03" in href
    assert href.startswith("/api/export/pdf/")


def test_actions_html_renders_export_links() -> None:
    spec = _actions_spec(
        GridViewExportAction(
            id="pdf",
            label="PDF",
            format="pdf",
            target="records",
            icon="download",
            params={"builder": "records"},
        ),
        GridViewExportAction(
            id="xlsx",
            label="XLSX",
            format="xlsx",
            target="records",
            params={"builder": "records"},
        ),
        GridViewMenuAction(
            id="more",
            label="More",
            items=(
                GridViewExportAction(
                    id="menu_xlsx",
                    label="Menu XLSX",
                    format="xlsx",
                    icon="download",
                ),
            ),
        ),
    )
    host = InMemoryHost(filter_state={"q": "Alpha"})
    html = render_grid_view_spec(spec, (), host=host, backend="html")
    assert isinstance(html, str)
    assert 'class="cm-action cm-action-export cm-action-pdf"' in html
    assert 'aria-label="PDF"' in html
    assert 'title="PDF"' in html
    assert '<svg class="cm-btn-icon cm-export-btn-icon"' in html
    assert 'aria-label="Menu XLSX"' in html
    assert 'title="Menu XLSX"' in html
    assert 'class="cm-action cm-action-export cm-action-xlsx"' in html
    assert 'href="/export_pdf?builder=records&amp;q=Alpha"' in html
    assert 'href="/export_xlsx?builder=records&amp;q=Alpha"' in html


def test_actions_html_renders_typed_targets_for_top_level_and_menu_items() -> None:
    spec = _actions_spec(
        GridViewLinkAction(id="blank", label="Blank", href="/blank", target="_blank"),
        GridViewLinkAction(id="named", label="Named", href="/named", target="report_window"),
        GridViewExportAction(
            id="export_blank",
            label="Export",
            format="csv",
            target="_blank",
            endpoint="/export.csv",
            include_state=False,
        ),
    )
    menu_spec = GridViewSpec(
        id="menu_actions",
        blocks=(
            GridViewActions(
                id="menu",
                items=(
                    GridViewMenuAction(
                        id="menu_items",
                        label="More",
                        items=(
                            GridViewLinkAction(
                                id="menu_blank",
                                label="Menu blank",
                                href="/menu-blank",
                                target="_blank",
                            ),
                            GridViewExportAction(
                                id="menu_export",
                                label="Menu export",
                                format="csv",
                                target="_self",
                            ),
                        ),
                    ),
                ),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("menu",))),
    )

    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    menu_html = render_grid_view_spec(menu_spec, (), host=InMemoryHost(), backend="html")

    assert 'href="/blank"' in html
    assert 'target="_blank" rel="noopener noreferrer"' in html
    assert 'href="/named"' in html
    assert 'target="report_window"' in html
    assert 'href="/export.csv?builder=page_export"' in html
    assert 'target="_blank" rel="noopener noreferrer"' in html
    assert 'href="/menu-blank"' in menu_html
    assert 'target="_blank" rel="noopener noreferrer"' in menu_html
    assert 'target="_self"' in menu_html


def test_actions_html_renders_select_action_contract() -> None:
    """Actions blocks preserve select options and the value-aware dispatch seam."""
    spec = GridViewSpec(
        id="page_select",
        blocks=(
            GridViewActions(
                id="page_actions",
                items=(
                    GridViewSelectAction(
                        id="status",
                        label="Status",
                        action="apply_status",
                        target="records",
                        button_label="Apply",
                        options=(
                            GridViewSelectOption(value="active", label="Active"),
                            GridViewSelectOption(value="archived", label="Archived"),
                        ),
                        default="archived",
                        confirm=GridViewConfirmConfig(message="Apply status?"),
                    ),
                    GridViewSelectAction(
                        id="empty_default",
                        label="No default",
                        action="apply_empty",
                        options=(GridViewSelectOption(value="one", label="One"),),
                    ),
                ),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("page_actions",))),
    )

    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")

    assert 'class="cm-action-select-group" data-cm-action-group="status"' in html
    assert '<option value="active">Active</option>' in html
    assert '<option value="archived" selected>Archived</option>' in html
    assert 'data-cm-action="apply_status"' in html
    assert 'data-cm-action-target="records"' in html
    assert 'data-cm-action-select-ref="status"' in html
    assert (
        'data-cm-confirm="{&#34;title&#34;:&#34;Confirmation&#34;,'
        "&#34;message&#34;:&#34;Apply status?&#34;" in html
    )
    assert '<option value="one">One</option>' in html
    assert 'data-cm-action-select-ref="empty_default"' in html
    empty_default_select = html.split('data-cm-action-group="empty_default"', 1)[1].split(
        "</select>", 1
    )[0]
    assert " selected" not in empty_default_select


def test_actions_html_renders_button_action_metadata_for_direct_and_menu_items() -> None:
    spec = GridViewSpec(
        id="button_actions",
        blocks=(
            GridViewActions(
                id="actions",
                items=(
                    GridViewButtonAction(
                        id="direct",
                        label="Direct",
                        action="direct_action",
                        target="records",
                    ),
                    GridViewMenuAction(
                        id="menu",
                        label="More",
                        items=(
                            GridViewButtonAction(
                                id="menu_button",
                                label="Menu button",
                                action="menu_action",
                                target="records",
                                disabled=True,
                            ),
                            GridViewOverlayAction(
                                id="menu_overlay",
                                label="Menu overlay",
                                overlay="details",
                            ),
                        ),
                    ),
                ),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("actions",))),
    )

    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")

    assert 'data-action-id="direct"' in html
    assert 'data-cm-action="direct_action"' in html
    assert 'data-cm-action-target="records"' in html
    assert 'data-action-id="menu_button"' in html
    assert 'data-cm-action="menu_action"' in html
    assert 'data-overlay-id="details"' in html
    menu_button = html.split('data-action-id="menu_button"', 1)[1].split(">", 1)[0]
    assert " disabled" in menu_button


def test_django_host_export_action_resolves_default_urlconf() -> None:
    pytest.importorskip("django")
    from django.test import RequestFactory

    spec = _actions_spec(
        GridViewExportAction(
            id="pdf",
            label="PDF",
            format="pdf",
            target="records",
            params={"builder": "records"},
        )
    )
    request = RequestFactory().get("/page/?q=Alpha")
    host = DjangoGridViewHost(request)
    action = _first_export_action(spec)
    href = export_action_href(
        action,
        host=host,
        spec=spec,
        filter_state=host.filter_state_from_request(spec),
    )
    assert href.startswith("/grid/export/pdf/?")
    assert "builder=records" in href
    assert "q=Alpha" in href


def test_export_action_href_unknown_format_returns_empty() -> None:
    spec = _actions_spec(
        GridViewExportAction(id="csv", label="CSV", format="csv"),
    )
    host = InMemoryHost()
    action = _first_export_action(spec)
    href = export_action_href(
        action,
        host=host,
        spec=spec,
        filter_state={},
    )
    assert href == ""


def test_memory_host_url_for_encodes_query_values() -> None:
    host = InMemoryHost()
    href = host.url_for("export_pdf", builder="a&b", q="hello world")
    assert href.startswith("/export_pdf?")
    assert "builder=a%26b" in href
    assert "q=hello+world" in href
