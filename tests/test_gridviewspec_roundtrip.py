"""Round-trip tests for wire encode/decode symmetry."""

from __future__ import annotations

import json

import pytest

from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render import render_grid_view_spec
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
from grid_view_spec.types.assets import GridViewTemplateAsset
from grid_view_spec.types.content import GridViewCardGroups
from grid_view_spec.types.formatters import DateTimeFormatter
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.lazy import GridViewLazyDefaults
from grid_view_spec.types.spec import GridViewSpec
from grid_view_spec.types.spec_meta import GridViewConfig
from grid_view_spec.types.table_v2 import GridViewColumn, GridViewTable, GridViewTableSettings
from grid_view_spec.types.wire import is_object_list, is_wire_mapping
from grid_view_spec.validate import spec_from_wire, spec_to_wire
from grid_view_spec.wire_decode import decode_confirm_config, decode_spec
from tests.gridviewspec_fixtures import minimal_valid_spec, rich_spec


def _roundtrip(spec: GridViewSpec) -> GridViewSpec:
    """Encode, JSON-serialize, and decode a spec; return the reconstructed value."""
    wire = spec_to_wire(spec)
    # Force a JSON hop so tuples↔lists and key handling match real transport.
    reparsed: object = json.loads(json.dumps(wire))
    assert is_wire_mapping(reparsed)
    return decode_spec(reparsed)


def test_minimal_spec_roundtrips() -> None:
    """Minimal fixture survives encode → JSON → decode unchanged."""
    spec = minimal_valid_spec()
    assert _roundtrip(spec) == spec


@pytest.mark.parametrize(
    "wire",
    (
        {"id": "bad_blocks", "blocks": [None]},
        {"id": "bad_nav_items", "blocks": [{"id": "nav", "type": "nav", "items": [1]}]},
        {
            "id": "bad_columns",
            "blocks": [{"id": "table", "type": "table", "columns": ["name"]}],
        },
        {"id": "bad_blocks_type", "blocks": "not a list"},
    ),
)
def test_spec_from_wire_rejects_malformed_object_lists(wire: dict[str, object]) -> None:
    result = spec_from_wire(wire)

    assert not result.ok
    assert result.diagnostics[0].code == "INVALID_WIRE"


def test_spec_from_wire_preserves_none_object_lists() -> None:
    result = spec_from_wire({"id": "none_blocks", "blocks": None})

    assert result.ok
    assert result.spec is not None
    assert result.spec.blocks == ()


def test_rich_spec_roundtrips_all_fields() -> None:
    """Rich fixture covering every block type survives round-trip unchanged."""
    spec = rich_spec()
    assert _roundtrip(spec) == spec


def test_page_state_scope_survives_wire_roundtrip() -> None:
    """The browser page-state namespace is preserved across the JSON wire boundary."""
    spec = GridViewSpec(
        id="page_state_scope_wire",
        config=GridViewConfig(page_state_scope="orders:active"),
    )

    assert _roundtrip(spec).config.page_state_scope == "orders:active"


def test_action_confirmation_and_select_none_roundtrip() -> None:
    """Every action variant keeps confirmation, and an absent select default stays absent."""
    confirm = GridViewConfirmConfig(message="Delete this record", tone="danger")
    actions = GridViewActions(
        id="actions",
        items=(
            GridViewExportAction(id="export", confirm=confirm),
            GridViewOverlayAction(id="overlay", overlay="details", confirm=confirm),
            GridViewLinkAction(id="link", href="/records/1/", confirm=confirm),
            GridViewButtonAction(id="button", action="delete", confirm=confirm),
            GridViewSelectAction(
                id="select",
                action="bulk",
                options=(GridViewSelectOption(value="archive", label="Archive"),),
                confirm=confirm,
            ),
            GridViewMenuAction(
                id="menu",
                confirm=confirm,
                items=(GridViewButtonAction(id="nested", action="nested", confirm=confirm),),
            ),
        ),
    )
    spec = GridViewSpec(id="action_wire", blocks=(actions,))

    restored = _roundtrip(spec)
    restored_actions = restored.blocks[0]
    assert isinstance(restored_actions, GridViewActions)
    assert all(action.confirm == confirm for action in restored_actions.items)
    select = next(
        action for action in restored_actions.items if isinstance(action, GridViewSelectAction)
    )
    assert select.default is None


def test_table_settings_surfaces_roundtrip_without_reordering() -> None:
    settings_options: tuple[GridViewTableSettings | None, ...] = (
        None,
        ("drawer",),
        ("modal",),
        ("drawer", "modal"),
        ("modal", "drawer"),
    )
    for settings in settings_options:
        table = GridViewTable(
            id="records",
            columns=(GridViewColumn(id="name", label="Name", field="name"),),
            settings=settings,
        )
        spec = GridViewSpec(
            id="table_settings_wire",
            blocks=(table,),
            layout=GridViewLayout(root=GridViewArea(id="root", blocks=(table.id,))),
        )
        restored = _roundtrip(spec)
        restored_table = restored.blocks[0]
        assert isinstance(restored_table, GridViewTable)
        assert restored_table.settings == settings


@pytest.mark.parametrize(
    "invalid_settings",
    ([], ["drawer", "drawer"], ["unknown"], "drawer", {"drawer": True}),
)
def test_invalid_wire_table_settings_decode_and_do_not_render(
    invalid_settings: object,
) -> None:
    wire: dict[str, object] = {
        "id": "invalid_table_settings",
        "blocks": [
            {
                "id": "records",
                "type": "table",
                "columns": [],
                "settings": invalid_settings,
            }
        ],
        "layout": {"root": {"id": "root", "blocks": ["records"]}},
    }

    decoded = decode_spec(wire)
    table = decoded.blocks[0]
    assert isinstance(table, GridViewTable)
    assert table.settings is None

    html = render_grid_view_spec(decoded, (), host=InMemoryHost(), backend="html")
    assert 'data-cm-column-settings="1"' not in html
    assert "col-selector-panel-records" not in html


def test_confirmation_tone_decode_uses_the_canonical_domain() -> None:
    """Valid tones survive decoding while arbitrary wire tones use default."""
    valid_tones = ("default", "primary", "warning", "danger")
    for tone in valid_tones:
        decoded = decode_confirm_config({"message": "Continue", "tone": tone})
        assert isinstance(decoded, GridViewConfirmConfig)
        assert decoded.tone == tone

    decoded_invalid = decode_confirm_config({"message": "Continue", "tone": "critical"})
    assert isinstance(decoded_invalid, GridViewConfirmConfig)
    assert decoded_invalid.tone == "default"


def test_grid_view_config_legacy_positionals_keep_assets_and_lazy_slots() -> None:
    """Adding page_state_scope does not shift the established positional arguments."""
    assets = (GridViewTemplateAsset(id="theme", kind="style", src="/theme.css"),)
    lazy = GridViewLazyDefaults(enabled=True, timeout_ms=500)

    config = GridViewConfig(True, "", assets, lazy)

    assert config.assets == assets
    assert config.lazy == lazy
    assert config.page_state_scope == ""


def test_card_group_items_decode_from_wire_string_lists() -> None:
    """A wire schema preserves card-group labels supplied as JSON strings."""
    spec = decode_spec(
        {
            "id": "wire_card_groups",
            "blocks": [
                {
                    "id": "signals",
                    "type": "card_groups",
                    "groups": [
                        {"id": "runtime", "title": "Signals", "items": ["Validated", "Interactive"]}
                    ],
                }
            ],
            "layout": {"root": {"id": "root", "blocks": ["signals"]}},
        }
    )
    block = spec.blocks[0]
    assert isinstance(block, GridViewCardGroups)
    assert block.groups[0].items == ("Validated", "Interactive")


def test_datetime_formatter_column_roundtrips_through_json_wire() -> None:
    formatter = DateTimeFormatter(
        format="iso",
        locale="en-US",
        timezone="Europe/Kyiv",
        empty_value="not available",
        strict=True,
    )
    column = GridViewColumn(
        id="created",
        label="Created",
        field="created",
        type="datetime",
        date_time_formatter=formatter,
    )
    table = GridViewTable(id="records", columns=(column,))
    spec = GridViewSpec(
        id="datetime_formatter_wire",
        blocks=(table,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(table.id,))),
    )

    wire = spec_to_wire(spec)
    reparsed: object = json.loads(json.dumps(wire))
    assert is_wire_mapping(reparsed)
    blocks = reparsed.get("blocks")
    assert is_object_list(blocks) and len(blocks) == 1 and is_wire_mapping(blocks[0])
    columns = blocks[0].get("columns")
    assert is_object_list(columns) and len(columns) == 1 and is_wire_mapping(columns[0])
    assert columns[0].get("date_time_formatter") == {
        "format": "iso",
        "locale": "en-US",
        "timezone": "Europe/Kyiv",
        "empty_value": "not available",
        "strict": True,
    }
    assert decode_spec(reparsed) == spec


@pytest.mark.parametrize(
    "formatter_fields",
    (
        pytest.param({}, id="absent"),
        pytest.param({"date_time_formatter": None}, id="null"),
    ),
)
def test_datetime_formatter_column_missing_or_null_decodes_as_none(
    formatter_fields: dict[str, object],
) -> None:
    wire: dict[str, object] = {
        "id": "datetime_formatter_compatibility",
        "blocks": [
            {
                "id": "records",
                "type": "table",
                "columns": [
                    {
                        "id": "created",
                        "label": "Created",
                        "field": "created",
                        **formatter_fields,
                    }
                ],
            }
        ],
        "layout": {"root": {"id": "root", "blocks": ["records"]}},
    }

    result = spec_from_wire(wire)

    assert result.ok
    assert result.spec is not None
    table = result.spec.blocks[0]
    assert isinstance(table, GridViewTable)
    assert table.columns[0].date_time_formatter is None


def test_datetime_formatter_column_rejects_wrong_typed_wire_value() -> None:
    result = spec_from_wire(
        {
            "id": "datetime_formatter_invalid",
            "blocks": [
                {
                    "id": "records",
                    "type": "table",
                    "columns": [
                        {
                            "id": "created",
                            "label": "Created",
                            "field": "created",
                            "date_time_formatter": "iso",
                        }
                    ],
                }
            ],
            "layout": {"root": {"id": "root", "blocks": ["records"]}},
        }
    )

    assert not result.ok
    assert result.diagnostics[0].code == "INVALID_WIRE"


def test_set_filter_model_match_contract_aligns_with_typescript() -> None:
    """SetFilterModel.match must use the same values Python and TS share.

    The TS mirror (``frontend/src/grid-view/search/filter-engine.ts``) declares
    ``FilterMatch = "exact" | "any_token"``. Python ``types/filters_v2`` and
    ``schema/grid-view-spec.v2.json`` must accept exactly the same set so a
    set-filter model produced by the browser round-trips through the Python
    wire decoder without being silently dropped to ``""``.
    """
    from typing import get_args

    from grid_view_spec.types.filters_v2 import (
        FILTER_MATCH_VALUES,
        FilterMatch,
        decode_filter_value,
        is_set_filter_model,
    )

    # The shared cross-language contract.
    assert FILTER_MATCH_VALUES == frozenset({"exact", "any_token"})
    assert get_args(FilterMatch) == ("exact", "any_token")
    assert is_set_filter_model({"mode": "empty", "match": "any_token"})
    assert is_set_filter_model({"mode": "non_empty", "match": "exact"})
    assert is_set_filter_model({"values": ["a", "b"], "match": "any_token"})

    # Legacy values from the old Python-only FilterMatch are rejected so the
    # wire contract cannot drift back to a Python-exclusive vocabulary.
    assert not is_set_filter_model({"mode": "empty", "match": "contains"})
    assert not is_set_filter_model({"values": ["a"], "match": "starts_with"})
    assert not is_set_filter_model({"values": ["a"], "match": "ends_with"})

    # decode_filter_value preserves a valid TS-shaped model unchanged.
    model: dict[str, object] = {"mode": "empty", "match": "any_token"}
    assert decode_filter_value(model) == model
    # An invalid match value falls through to the scalar branch and never
    # silently produces a half-decoded model.
    assert decode_filter_value({"mode": "empty", "match": "contains"}) == ""


def test_tree_nav_roundtrips() -> None:
    from grid_view_spec.types.nav import GridViewNav, GridViewNavItem, GridViewNavLevel

    spec = GridViewSpec(
        id="tree_nav_spec",
        blocks=(
            GridViewNav(
                id="n1",
                presentation="tree",
                search_placeholder="Search...",
                allow_create=True,
                levels=(
                    GridViewNavLevel(
                        level=0,
                        type="category",
                        label="Category",
                        show_count=True,
                        count_label="items",
                        can_have_children=True,
                        child_type="item",
                        selectable=True,
                        draggable=False,
                        droppable=True,
                        accept_drop_types=("item",),
                        actions=("create",),
                    ),
                ),
                items=(
                    GridViewNavItem(
                        id="c1",
                        label="Cat 1",
                        count=10,
                        type="category",
                        children=(
                            GridViewNavItem(
                                id="i1",
                                label="Item 1",
                                type="item",
                                parent_id="c1",
                                active=True,
                                href="/items/1/",
                            ),
                        ),
                    ),
                ),
            ),
        ),
    )
    assert _roundtrip(spec) == spec
