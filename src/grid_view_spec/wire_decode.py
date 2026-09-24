"""Decode wire-format JSON into typed :class:`GridViewSpec` objects.

Inverse of :func:`grid_view_spec.validate.wire.spec_to_wire`. Encoding walks
dataclass fields recursively; decoding is explicit per type so ``basedpyright``
can verify every constructed value against its contract.

Public entry point: :func:`decode_spec`. Completeness (encode ↔ decode symmetry)
is guarded by ``tests/test_gridviewspec_roundtrip.py``.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import TypedDict

from grid_view_spec.types.actions import (
    GRIDVIEW_ACTIONS_PRESENTATIONS,
    GRIDVIEW_CONFIRM_TONES,
    GRIDVIEW_EXPORT_FORMATS,
    GRIDVIEW_HTTP_METHODS,
    GridViewAction,
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
from grid_view_spec.types.assets import GRIDVIEW_TEMPLATE_ASSET_KINDS, GridViewTemplateAsset
from grid_view_spec.types.chart_server import KpiAggregate
from grid_view_spec.types.content import (
    GRIDVIEW_CARD_TONES,
    GRIDVIEW_CARDS_PRESENTATIONS,
    GRIDVIEW_CHART_TYPES,
    GRIDVIEW_CHARTS_PRESENTATIONS,
    GRIDVIEW_COLUMN_FORMATS,
    GRIDVIEW_CONTENT_ROLES,
    GRIDVIEW_KPI_AGGREGATES,
    GRIDVIEW_KPI_PRESENTATIONS,
    GRIDVIEW_KPI_TONES,
    GRIDVIEW_TABS_PRESENTATIONS,
    GRIDVIEW_TEMPLATE_MODES,
    ColumnFormat,
    GridViewCard,
    GridViewCardGroup,
    GridViewCardGroups,
    GridViewCards,
    GridViewChart,
    GridViewCharts,
    GridViewContent,
    GridViewKpi,
    GridViewTab,
    GridViewTabs,
    GridViewTemplate,
    KpiSpec,
)
from grid_view_spec.types.filters_v2 import (
    GRIDVIEW_FILTER_DRAWER_CONTROLS,
    GRIDVIEW_FILTER_DRAWER_LAYOUTS,
    GRIDVIEW_FILTER_DRAWER_LIST_SIZES,
    GRIDVIEW_FILTER_DRAWER_PANELS,
    GRIDVIEW_FILTER_SCOPES,
    GRIDVIEW_FILTER_TYPES,
    GRIDVIEW_FILTERS_PRESENTATIONS,
    GridViewFilter,
    GridViewFilterDrawerSection,
    GridViewFilterOption,
    GridViewFilters,
    GridViewFilterState,
    GridViewFilterValue,
    GridViewSetPresets,
    decode_filter_value,
)
from grid_view_spec.types.form import (
    GRIDVIEW_FIELD_TYPES,
    GRIDVIEW_FORM_METHODS,
    GRIDVIEW_FORM_PRESENTATIONS,
    GRIDVIEW_VALIDATOR_KINDS,
    GridViewField,
    GridViewFieldCondition,
    GridViewFieldset,
    GridViewForm,
    GridViewLocale,
    GridViewTranslationEnvelope,
    GridViewValidator,
)
from grid_view_spec.types.formatters import CurrencyFormatter
from grid_view_spec.types.header import (
    GRIDVIEW_FACT_TONES,
    GRIDVIEW_HEADER_PRESENTATIONS,
    GridViewEntity,
    GridViewFact,
    GridViewHeader,
)
from grid_view_spec.types.json import JsonObject
from grid_view_spec.types.layout import (
    GRIDVIEW_AREA_TYPES,
    GRIDVIEW_STYLE_OVERFLOWS,
    GRIDVIEW_STYLE_SPACINGS,
    GRIDVIEW_STYLE_STICKIES,
    GRIDVIEW_STYLE_SURFACES,
    GRIDVIEW_STYLE_TONES,
    GRIDVIEW_STYLE_WIDTHS,
    GridViewArea,
    GridViewLayout,
    GridViewStyle,
    GridViewTrustedStyle,
)
from grid_view_spec.types.lazy import (
    GRIDVIEW_LAZY_HTTP_METHODS,
    GRIDVIEW_LAZY_MODES,
    GRIDVIEW_LAZY_PLACEHOLDERS,
    GRIDVIEW_LAZY_TRIGGERS,
    GridViewLazyBlock,
    GridViewLazyDefaults,
)
from grid_view_spec.types.media import (
    GRIDVIEW_GALLERY_PRESENTATIONS,
    GRIDVIEW_IMAGE_FITS,
    GridViewGallery,
    GridViewImage,
    GridViewImageSource,
    GridViewImageVariant,
)
from grid_view_spec.types.nav import (
    GRIDVIEW_NAV_PRESENTATIONS,
    GridViewNav,
    GridViewNavItem,
    GridViewNavLevel,
)
from grid_view_spec.types.overlay import (
    GRIDVIEW_OVERLAY_PRESENTATIONS,
    GRIDVIEW_OVERLAY_SIZES,
    GridViewOverlay,
)
from grid_view_spec.types.semantic import (
    GridViewActionVariant,
    GridViewSemanticTone,
    wire_action_variant,
    wire_semantic_tone,
)
from grid_view_spec.types.spec import GridViewBlock, GridViewSpec
from grid_view_spec.types.spec_meta import GridViewConfig, GridViewMeta
from grid_view_spec.types.table_v2 import (
    GRIDVIEW_COLUMN_ALIGNS,
    GRIDVIEW_COLUMN_PINNEDS,
    GRIDVIEW_COLUMN_TYPES,
    GRIDVIEW_DATASOURCE_METHODS,
    GRIDVIEW_SORT_DIRECTIONS,
    GRIDVIEW_TABLE_BACKENDS,
    GRIDVIEW_TABLE_EDIT_MODES,
    GRIDVIEW_TABLE_PAGINATION_MODES,
    GRIDVIEW_TABLE_SEARCH_MODES,
    GridViewColumn,
    GridViewColumnGroup,
    GridViewColumnSource,
    GridViewDataSource,
    GridViewSort,
    GridViewSortState,
    GridViewTable,
    GridViewTableEdit,
    GridViewTableFooter,
    GridViewTableHeader,
    GridViewTablePagination,
    GridViewTableSettings,
    is_valid_gridview_table_settings,
)
from grid_view_spec.types.toolbar import (
    GRIDVIEW_COUNTER_TONES,
    GRIDVIEW_SEARCH_BACKENDS,
    GRIDVIEW_SEARCH_MODES,
    GRIDVIEW_TOOLBAR_PRESENTATIONS,
    GridViewCounter,
    GridViewSearch,
    GridViewToolbar,
)
from grid_view_spec.types.wire import is_object_list, is_object_tuple, is_wire_mapping
from grid_view_spec.validate.wire import (
    wire_bool,
    wire_int,
    wire_json_object,
    wire_json_value,
    wire_literal,
    wire_number,
    wire_object,
    wire_optional_int,
    wire_optional_literal,
    wire_optional_number,
    wire_optional_str,
    wire_str,
    wire_str_tuple,
)


def _objects(value: object) -> list[Mapping[str, object]]:
    """Return wire list items that are string-keyed mappings."""
    if value is None:
        return []
    if not is_object_list(value):
        raise TypeError("Expected a list of objects")
    objects = [item for item in value if is_wire_mapping(item)]
    if len(objects) != len(value):
        raise TypeError("Expected list items to be objects")
    return objects


def wire_str_or_int(value: object) -> str | int:
    """Return a select value accepted by the typed action contract."""
    if isinstance(value, str):
        return value
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    return ""


def wire_optional_str_or_int(value: object) -> str | int | None:
    """Return a select default while preserving an explicit ``None``."""
    if value is None:
        return None
    return wire_str_or_int(value)


# --- shared leaves -----------------------------------------------------------


def decode_style(raw: Mapping[str, object]) -> GridViewStyle:
    """Decode a :class:`GridViewStyle` from wire fields."""
    return GridViewStyle(
        width=wire_literal(raw.get("width"), GRIDVIEW_STYLE_WIDTHS, ""),
        min_width=wire_str(raw.get("min_width")),
        height=wire_str(raw.get("height")),
        min_height=wire_str(raw.get("min_height")),
        overflow=wire_literal(raw.get("overflow"), GRIDVIEW_STYLE_OVERFLOWS, ""),
        padding=wire_literal(raw.get("padding"), GRIDVIEW_STYLE_SPACINGS, ""),
        gap=wire_literal(raw.get("gap"), GRIDVIEW_STYLE_SPACINGS, ""),
        tone=wire_literal(raw.get("tone"), GRIDVIEW_STYLE_TONES, ""),
        surface=wire_literal(raw.get("surface"), GRIDVIEW_STYLE_SURFACES, ""),
        sticky=wire_literal(raw.get("sticky"), GRIDVIEW_STYLE_STICKIES, ""),
    )


def decode_trusted_style(raw: Mapping[str, object]) -> GridViewTrustedStyle:
    """Decode host-controlled CSS variables for a block."""
    css_vars_raw = wire_object(raw.get("css_vars", {}), label="trusted_style.css_vars")
    return GridViewTrustedStyle(css_vars={key: str(item) for key, item in css_vars_raw.items()})


def decode_lazy_block(raw: Mapping[str, object]) -> GridViewLazyBlock:
    """Decode per-block lazy-load configuration."""
    return GridViewLazyBlock(
        endpoint=wire_str(raw.get("endpoint")),
        trigger=wire_literal(raw.get("trigger"), GRIDVIEW_LAZY_TRIGGERS, "visible"),
        params=wire_json_object(raw.get("params", {})),
        method=wire_optional_literal(raw.get("method"), GRIDVIEW_LAZY_HTTP_METHODS),
        placeholder=wire_optional_literal(raw.get("placeholder"), GRIDVIEW_LAZY_PLACEHOLDERS),
        mode=wire_optional_literal(raw.get("mode"), GRIDVIEW_LAZY_MODES),
        timeout_ms=wire_optional_int(raw.get("timeout_ms")),
    )


def decode_lazy_defaults(raw: Mapping[str, object]) -> GridViewLazyDefaults:
    """Decode page-level lazy-load defaults from ``config.lazy``."""
    return GridViewLazyDefaults(
        enabled=wire_bool(raw.get("enabled")),
        method=wire_literal(raw.get("method"), GRIDVIEW_LAZY_HTTP_METHODS, "get"),
        placeholder=wire_literal(raw.get("placeholder"), GRIDVIEW_LAZY_PLACEHOLDERS, "skeleton"),
        mode=wire_literal(raw.get("mode"), GRIDVIEW_LAZY_MODES, "replace"),
        timeout_ms=wire_int(raw.get("timeout_ms"), 30000),
    )


def decode_template_asset(raw: Mapping[str, object]) -> GridViewTemplateAsset:
    """Decode a script/style asset reference."""
    return GridViewTemplateAsset(
        id=wire_str(raw.get("id")),
        kind=wire_literal(raw.get("kind"), GRIDVIEW_TEMPLATE_ASSET_KINDS, "script"),
        src=wire_str(raw.get("src")),
        defer=wire_bool(raw.get("defer")),
        module=wire_bool(raw.get("module")),
    )


def _template_assets(value: object) -> tuple[GridViewTemplateAsset, ...]:
    """Decode a wire list of template assets."""
    return tuple(decode_template_asset(item) for item in _objects(value))


# --- actions -----------------------------------------------------------------


def _decode_action_semantic(
    raw: Mapping[str, object],
) -> tuple[str, GridViewActionVariant, GridViewSemanticTone]:
    """Return ``(icon, variant, tone)`` for any action wire object."""
    icon = wire_str(raw.get("icon"))
    variant = wire_action_variant(raw.get("variant"))
    tone = wire_semantic_tone(raw.get("tone"))
    return icon, variant, tone


def decode_confirm_config(value: object) -> GridViewConfirmConfig | str | None:
    """Decode a confirmation configuration or string."""
    if isinstance(value, str):
        return value.strip() or None
    if is_wire_mapping(value):
        return GridViewConfirmConfig(
            title=wire_str(value.get("title", "Confirmation")),
            message=wire_str(value.get("message", "")),
            tone=wire_literal(value.get("tone", "default"), GRIDVIEW_CONFIRM_TONES, "default"),
            confirm_text=wire_str(value.get("confirm_text", "Confirm")),
            cancel_text=wire_str(value.get("cancel_text", "Cancel")),
            close_on_backdrop=wire_bool(value.get("close_on_backdrop", True)),
        )
    return None


def decode_link_action(raw: Mapping[str, object]) -> GridViewLinkAction:
    """Decode a link action (also used inside entity headers and menus)."""
    icon, variant, tone = _decode_action_semantic(raw)
    return GridViewLinkAction(
        id=wire_str(raw.get("id")),
        label=wire_str(raw.get("label")),
        icon=icon,
        variant=variant,
        tone=tone,
        target=wire_str(raw.get("target")),
        disabled=wire_bool(raw.get("disabled")),
        reason=wire_str(raw.get("reason")),
        params=wire_json_object(raw.get("params", {})),
        href=wire_str(raw.get("href")),
        method=wire_literal(raw.get("method"), GRIDVIEW_HTTP_METHODS, "get"),
        confirm=decode_confirm_config(raw.get("confirm")),
    )


def decode_action(raw: Mapping[str, object]) -> GridViewAction:
    """Decode any action variant, dispatching on the ``type`` field."""
    action_type = wire_str(raw.get("type"))
    action_id = wire_str(raw.get("id"))
    label = wire_str(raw.get("label"))
    icon, variant, tone = _decode_action_semantic(raw)
    target = wire_str(raw.get("target"))
    disabled = wire_bool(raw.get("disabled"))
    reason = wire_str(raw.get("reason"))
    params = wire_json_object(raw.get("params", {}))
    confirm = decode_confirm_config(raw.get("confirm"))
    if action_type == "export":
        return GridViewExportAction(
            id=action_id,
            label=label,
            icon=icon,
            variant=variant,
            tone=tone,
            target=target,
            disabled=disabled,
            reason=reason,
            params=params,
            confirm=confirm,
            format=wire_literal(raw.get("format"), GRIDVIEW_EXPORT_FORMATS, "xlsx"),
            endpoint=wire_str(raw.get("endpoint")),
            include_state=wire_bool(raw.get("include_state", True)),
        )
    if action_type == "overlay":
        return GridViewOverlayAction(
            id=action_id,
            label=label,
            icon=icon,
            variant=variant,
            tone=tone,
            target=target,
            disabled=disabled,
            reason=reason,
            params=params,
            confirm=confirm,
            overlay=wire_str(raw.get("overlay")),
        )
    if action_type == "link":
        return decode_link_action(raw)
    if action_type == "button":
        return GridViewButtonAction(
            id=action_id,
            label=label,
            icon=icon,
            variant=variant,
            tone=tone,
            target=target,
            disabled=disabled,
            reason=reason,
            params=params,
            action=wire_str(raw.get("action")),
            confirm=confirm,
        )
    if action_type == "select":
        raw_opts = _objects(raw.get("options"))
        select_options = tuple(
            GridViewSelectOption(
                value=wire_str_or_int(opt.get("value")),
                label=wire_str(opt.get("label")),
            )
            for opt in raw_opts
        )
        return GridViewSelectAction(
            id=action_id,
            label=label,
            icon=icon,
            variant=variant,
            tone=tone,
            target=target,
            disabled=disabled,
            reason=reason,
            params=params,
            action=wire_str(raw.get("action")),
            button_label=wire_str(raw.get("button_label")),
            options=select_options,
            default=wire_optional_str_or_int(raw.get("default")),
            confirm=confirm,
        )
    if action_type == "menu":
        return GridViewMenuAction(
            id=action_id,
            label=label,
            icon=icon,
            variant=variant,
            tone=tone,
            target=target,
            disabled=disabled,
            reason=reason,
            params=params,
            confirm=confirm,
            items=tuple(decode_action(item) for item in _objects(raw.get("items"))),
        )
    raise ValueError(f"unknown action type {action_type!r}")


def _opt_action(value: object, key: str) -> GridViewAction | None:
    """Decode an optional nested action from ``value[key]``."""
    item = value.get(key) if is_wire_mapping(value) else None
    return decode_action(item) if is_wire_mapping(item) else None


# --- filters -----------------------------------------------------------------


def decode_filter_option(raw: Mapping[str, object]) -> GridViewFilterOption:
    """Decode a selectable filter option (supports nested children)."""
    return GridViewFilterOption(
        value=wire_str(raw.get("value")),
        label=wire_str(raw.get("label")),
        children=tuple(decode_filter_option(item) for item in _objects(raw.get("children"))),
        exclusive=wire_bool(raw.get("exclusive")),
        meta=wire_json_object(raw.get("meta", {})),
        count=wire_optional_int(raw.get("count")),
        disabled=wire_bool(raw.get("disabled")),
    )


def decode_set_presets(raw: Mapping[str, object]) -> GridViewSetPresets:
    """Decode preset toggles for set-type filters."""
    return GridViewSetPresets(
        select_all=wire_bool(raw.get("select_all", True)),
        empty=wire_bool(raw.get("empty")),
        non_empty=wire_bool(raw.get("non_empty")),
        auto_empty=wire_bool(raw.get("auto_empty", True)),
    )


def decode_filter(raw: Mapping[str, object]) -> GridViewFilter:
    """Decode a single filter schema entry."""
    default_raw = raw.get("default")
    presets_raw = raw.get("presets")
    return GridViewFilter(
        id=wire_str(raw.get("id")),
        label=wire_str(raw.get("label")),
        param=wire_str(raw.get("param")),
        type=wire_literal(raw.get("type"), GRIDVIEW_FILTER_TYPES, "text"),
        scope=wire_literal(raw.get("scope"), GRIDVIEW_FILTER_SCOPES, "server"),
        options=tuple(decode_filter_option(item) for item in _objects(raw.get("options"))),
        options_endpoint=wire_str(raw.get("options_endpoint")),
        placeholder=wire_str(raw.get("placeholder")),
        select_all=wire_bool(raw.get("select_all")),
        select_all_label=wire_str(raw.get("select_all_label")),
        select_all_value=wire_str(raw.get("select_all_value", "__all__")),
        all_exclusive=wire_bool(raw.get("all_exclusive")),
        presets=decode_set_presets(presets_raw)
        if is_wire_mapping(presets_raw)
        else GridViewSetPresets(),
        default=None if default_raw is None else decode_filter_value(default_raw),
        drawer_control=wire_literal(
            raw.get("drawer_control"), GRIDVIEW_FILTER_DRAWER_CONTROLS, "default"
        ),
    )


def decode_filter_drawer_section(raw: Mapping[str, object]) -> GridViewFilterDrawerSection:
    """Decode a workspace drawer section without accepting untyped filter ids."""
    raw_filter_ids = raw.get("filter_ids")
    filter_ids = (
        tuple(item for item in raw_filter_ids if isinstance(item, str))
        if is_object_list(raw_filter_ids)
        else ()
    )
    return GridViewFilterDrawerSection(
        id=wire_str(raw.get("id")),
        label=wire_str(raw.get("label")),
        filter_ids=filter_ids,
        searchable=wire_bool(raw.get("searchable")),
        list_size=wire_literal(raw.get("list_size"), GRIDVIEW_FILTER_DRAWER_LIST_SIZES, "md"),
        panel=wire_literal(raw.get("panel"), GRIDVIEW_FILTER_DRAWER_PANELS, "filters"),
    )


def decode_filter_state(raw: Mapping[str, object]) -> GridViewFilterState:
    """Decode active filter values keyed by param name."""
    values_raw = wire_object(raw.get("values", {}), label="filter state values")
    values: dict[str, GridViewFilterValue] = {
        key: decode_filter_value(item) for key, item in values_raw.items()
    }
    return GridViewFilterState(values=values)


# --- header ------------------------------------------------------------------


def decode_fact(raw: Mapping[str, object]) -> GridViewFact:
    """Decode one entity fact row in a header block."""
    return GridViewFact(
        label=wire_str(raw.get("label")),
        value=wire_str(raw.get("value")),
        icon=wire_str(raw.get("icon")),
        tone=wire_literal(raw.get("tone"), GRIDVIEW_FACT_TONES, ""),
    )


def decode_entity(raw: Mapping[str, object]) -> GridViewEntity:
    """Decode the entity panel attached to a header block."""
    return GridViewEntity(
        type=wire_str(raw.get("type")),
        id=wire_str(raw.get("id")),
        title=wire_str(raw.get("title")),
        subtitle=wire_str(raw.get("subtitle")),
        facts=tuple(decode_fact(item) for item in _objects(raw.get("facts"))),
        links=tuple(decode_link_action(item) for item in _objects(raw.get("links"))),
    )


# --- toolbar -----------------------------------------------------------------


def decode_search(raw: Mapping[str, object]) -> GridViewSearch:
    """Decode toolbar search configuration."""
    return GridViewSearch(
        param=wire_str(raw.get("param", "q")),
        value=wire_str(raw.get("value")),
        placeholder=wire_str(raw.get("placeholder")),
        backend=wire_literal(raw.get("backend"), GRIDVIEW_SEARCH_BACKENDS, "server"),
        mode=wire_literal(raw.get("mode"), GRIDVIEW_SEARCH_MODES, "smart"),
        bind=wire_optional_str(raw.get("bind")),
        saved=wire_bool(raw.get("saved", True)),
        compact=wire_bool(raw.get("compact", True)),
    )


def decode_counter(raw: Mapping[str, object]) -> GridViewCounter:
    """Decode a toolbar counter badge."""
    field_raw = raw.get("field")
    field = wire_str(field_raw) if field_raw not in (None, "") else None
    total_raw = raw.get("total")
    total = max(0, wire_int(total_raw)) if total_raw not in (None, "") else None
    return GridViewCounter(
        id=wire_str(raw.get("id")),
        label=wire_str(raw.get("label")),
        value=wire_number(raw.get("value")),
        tone=wire_literal(raw.get("tone"), GRIDVIEW_COUNTER_TONES, ""),
        field=field,
        total=total,
    )


# --- table -------------------------------------------------------------------


def decode_column_source(raw: Mapping[str, object]) -> GridViewColumnSource:
    """Decode dynamic column metadata fetched from an endpoint."""
    return GridViewColumnSource(
        endpoint=wire_str(raw.get("endpoint")),
        method=wire_literal(raw.get("method"), GRIDVIEW_DATASOURCE_METHODS, "get"),
        depends_on=wire_str_tuple(raw.get("depends_on")),
        params=wire_json_object(raw.get("params", {})),
        anchor=wire_str(raw.get("anchor")),
    )


def _positive_int_tuple(value: object) -> tuple[int, ...]:
    if is_object_list(value):
        values: list[object] | tuple[object, ...] = value
    elif is_object_tuple(value):
        values = value
    else:
        return ()
    return tuple(number for item in values if (number := wire_int(item)) > 0)


def decode_datasource(raw: Mapping[str, object]) -> GridViewDataSource:
    """Decode a table or gallery row datasource."""
    return GridViewDataSource(
        endpoint=wire_str(raw.get("endpoint")),
        method=wire_literal(raw.get("method"), GRIDVIEW_DATASOURCE_METHODS, "get"),
        params=wire_json_object(raw.get("params", {})),
        row_id=wire_str(raw.get("row_id", "id")),
    )


def decode_sort_state(raw: Mapping[str, object]) -> GridViewSortState:
    """Decode table sort order."""
    return GridViewSortState(
        by=tuple(
            GridViewSort(
                column=wire_str(item.get("column")),
                direction=wire_literal(item.get("direction"), GRIDVIEW_SORT_DIRECTIONS, "asc"),
            )
            for item in _objects(raw.get("by"))
        )
    )


def decode_table_settings(raw: object) -> GridViewTableSettings | None:
    """Decode the selected column-settings surfaces."""
    if not is_object_list(raw):
        return None
    raw_surfaces = wire_str_tuple(raw)
    if len(raw_surfaces) != len(raw):
        return None
    surfaces = tuple(raw_surfaces)
    return surfaces if is_valid_gridview_table_settings(surfaces) else None


def decode_table_edit(raw: Mapping[str, object]) -> GridViewTableEdit:
    """Decode inline edit configuration for a table."""
    return GridViewTableEdit(
        mode=wire_literal(raw.get("mode"), GRIDVIEW_TABLE_EDIT_MODES, "cell"),
        commit_endpoint=wire_str(raw.get("commit_endpoint")),
        commit_callback=wire_str(raw.get("commit_callback")),
        confirm=wire_bool(raw.get("confirm")),
    )


def decode_table_header(raw: Mapping[str, object]) -> GridViewTableHeader:
    """Decode grouped column header metadata."""
    return GridViewTableHeader(
        groups=tuple(
            GridViewColumnGroup(
                id=wire_str(item.get("id")),
                label=wire_str(item.get("label")),
                columns=wire_str_tuple(item.get("columns")),
            )
            for item in _objects(raw.get("groups"))
        ),
        groups_order=wire_str_tuple(raw.get("groups_order")),
    )


def decode_table_footer(raw: Mapping[str, object]) -> GridViewTableFooter:
    """Decode optional aggregate footer row settings."""
    return GridViewTableFooter(
        row=wire_bool(raw.get("row")),
        label=wire_str(raw.get("label")),
        label_span=wire_int(raw.get("label_span")),
    )


def decode_table_pagination(raw: Mapping[str, object]) -> GridViewTablePagination:
    """Decode server/client/fragment paging for a simple table."""
    return GridViewTablePagination(
        page=max(1, wire_int(raw.get("page"), default=1)),
        page_size=wire_int(raw.get("page_size"), default=25),
        total=max(0, wire_int(raw.get("total"), default=0)),
        mode=wire_literal(raw.get("mode"), GRIDVIEW_TABLE_PAGINATION_MODES, "server"),
        page_param=wire_str(raw.get("page_param")) or "page",
        page_size_param=wire_str(raw.get("page_size_param")) or "page_size",
        fragment_endpoint=wire_str(raw.get("fragment_endpoint")),
        fragment_target=wire_str(raw.get("fragment_target")),
        fragment_swap=wire_str(raw.get("fragment_swap")) or "outerHTML",
        page_endpoint=wire_str(raw.get("page_endpoint")),
        page_size_options=_positive_int_tuple(raw.get("page_size_options")),
    )


def decode_currency_formatter(raw: object) -> CurrencyFormatter | None:
    """Decode a currency formatter configuration from untrusted wire input."""
    if not is_wire_mapping(raw):
        return None
    precision = raw.get("precision", 2)
    return CurrencyFormatter(
        currency=wire_str(raw.get("currency"), default="UAH") or "UAH",
        locale=wire_str(raw.get("locale"), default="uk-UA") or "uk-UA",
        precision=(
            precision
            if isinstance(precision, int)
            and not isinstance(precision, bool)
            and 0 <= precision <= 6
            else 2
        ),
        show_symbol=wire_bool(raw.get("show_symbol"), default=True),
        empty_value=wire_str(raw.get("empty_value"), default="—"),
        strict=wire_bool(raw.get("strict"), default=False),
    )


def decode_column(raw: Mapping[str, object]) -> GridViewColumn:
    """Decode one table column definition."""
    filter_raw = raw.get("filter")
    formatter_raw = raw.get("currency_formatter")
    if formatter_raw is None:
        formatter_raw = raw.get("formatter")
    return GridViewColumn(
        id=wire_str(raw.get("id")),
        label=wire_str(raw.get("label")),
        field=wire_str(raw.get("field")),
        type=wire_literal(raw.get("type"), GRIDVIEW_COLUMN_TYPES, "text"),
        renderer=wire_str(raw.get("renderer")),
        width=wire_str(raw.get("width")),
        min_width=wire_str(raw.get("min_width")),
        align=wire_literal(raw.get("align"), GRIDVIEW_COLUMN_ALIGNS, ""),
        sortable=wire_bool(raw.get("sortable", True)),
        searchable=wire_bool(raw.get("searchable", True)),
        exportable=wire_bool(raw.get("exportable", True)),
        wrap=wire_bool(raw.get("wrap")),
        menu_group=wire_str(raw.get("menu_group")),
        editable=wire_bool(raw.get("editable")),
        filter=decode_filter(filter_raw) if is_wire_mapping(filter_raw) else None,
        hidden=wire_bool(raw.get("hidden")),
        pinned=wire_literal(raw.get("pinned"), GRIDVIEW_COLUMN_PINNEDS, ""),
        extra=wire_json_object(raw.get("extra", {})),
        currency_formatter=decode_currency_formatter(formatter_raw),
    )


# --- form --------------------------------------------------------------------


def decode_validator(raw: Mapping[str, object]) -> GridViewValidator:
    """Decode a single form field validator rule."""
    return GridViewValidator(
        kind=wire_literal(raw.get("kind"), GRIDVIEW_VALIDATOR_KINDS, "required"),
        value=wire_optional_number(raw.get("value")),
        message=wire_str(raw.get("message")),
        name=wire_str(raw.get("name")),
    )


def decode_field(raw: Mapping[str, object]) -> GridViewField:
    """Decode one form field definition."""
    condition_raw = raw.get("visible_when")
    return GridViewField(
        name=wire_str(raw.get("name")),
        label=wire_str(raw.get("label")),
        type=wire_literal(raw.get("type"), GRIDVIEW_FIELD_TYPES, "text"),
        localized=wire_bool(raw.get("localized")),
        widget=wire_str(raw.get("widget")),
        options=tuple(decode_filter_option(item) for item in _objects(raw.get("options"))),
        required=wire_bool(raw.get("required")),
        default=wire_json_value(raw.get("default")),
        placeholder=wire_str(raw.get("placeholder")),
        help=wire_str(raw.get("help")),
        validators=tuple(decode_validator(item) for item in _objects(raw.get("validators"))),
        visible_when=(
            GridViewFieldCondition(
                field=wire_str(condition_raw.get("field")),
                equals=wire_json_value(condition_raw.get("equals")),
            )
            if is_wire_mapping(condition_raw)
            else None
        ),
        extra=wire_json_object(raw.get("extra", {})),
    )


def decode_fieldset(raw: Mapping[str, object]) -> GridViewFieldset:
    """Decode a grouped set of form fields."""
    return GridViewFieldset(
        id=wire_str(raw.get("id")),
        label=wire_str(raw.get("label")),
        fields=wire_str_tuple(raw.get("fields")),
        columns=wire_int(raw.get("columns"), 1),
    )


def _form_errors(value: object) -> dict[str, tuple[str, ...]]:
    """Decode server-side validation errors keyed by field name."""
    if not is_wire_mapping(value):
        return {}
    return {key: wire_str_tuple(item) for key, item in value.items()}


def _translation_errors(value: object) -> dict[str, dict[str, tuple[str, ...]]]:
    """Decode locale-keyed server-side validation errors."""
    if not is_wire_mapping(value):
        return {}
    errors: dict[str, dict[str, tuple[str, ...]]] = {}
    for locale, raw_errors in value.items():
        if is_wire_mapping(raw_errors):
            errors[locale] = {key: wire_str_tuple(item) for key, item in raw_errors.items()}
    return errors


def decode_locale(raw: Mapping[str, object]) -> GridViewLocale:
    """Decode one declared form locale."""
    return GridViewLocale(code=wire_str(raw.get("code")), label=wire_str(raw.get("label")))


def decode_translation_envelope(raw: Mapping[str, object]) -> GridViewTranslationEnvelope:
    """Decode localized form values and host-authoritative errors."""
    values_raw = raw.get("values", {})
    return GridViewTranslationEnvelope(
        locales=tuple(decode_locale(item) for item in _objects(raw.get("locales"))),
        default_locale=wire_str(raw.get("default_locale")),
        fallback_locale=wire_optional_str(raw.get("fallback_locale")),
        values={key: wire_json_object(item) for key, item in values_raw.items()}
        if is_wire_mapping(values_raw)
        else {},
        errors=_translation_errors(raw.get("errors", {})),
    )


# --- media -------------------------------------------------------------------


def decode_image_source(raw: Mapping[str, object]) -> GridViewImageSource:
    """Decode an image or gallery item source."""
    return GridViewImageSource(
        id=wire_str(raw.get("id")),
        url=wire_str(raw.get("url")),
        alt=wire_str(raw.get("alt")),
        thumb=wire_str(raw.get("thumb")),
        variants=tuple(
            GridViewImageVariant(
                url=wire_str(item.get("url")),
                width=wire_int(item.get("width")),
                height=wire_int(item.get("height")),
                media=wire_str(item.get("media")),
            )
            for item in _objects(raw.get("variants"))
        ),
        width=wire_int(raw.get("width")),
        height=wire_int(raw.get("height")),
        href=wire_str(raw.get("href")),
        meta=wire_json_object(raw.get("meta", {})),
    )


def decode_nav_level(raw: Mapping[str, object]) -> GridViewNavLevel:
    child_type_raw = raw.get("child_type")
    return GridViewNavLevel(
        level=wire_int(raw.get("level")),
        type=wire_str(raw.get("type")),
        label=wire_str(raw.get("label")),
        show_count=wire_bool(raw.get("show_count")),
        count_label=wire_str(raw.get("count_label")),
        can_have_children=wire_bool(raw.get("can_have_children", True)),
        child_type=wire_str(child_type_raw) if isinstance(child_type_raw, str) else None,
        selectable=wire_bool(raw.get("selectable", True)),
        draggable=wire_bool(raw.get("draggable")),
        droppable=wire_bool(raw.get("droppable")),
        accept_drop_types=wire_str_tuple(raw.get("accept_drop_types")),
        actions=wire_str_tuple(raw.get("actions")),
        extra=wire_json_object(raw.get("extra", {})),
    )


def decode_nav_item(raw: Mapping[str, object]) -> GridViewNavItem:
    count_raw = raw.get("count")
    parent_id_raw = raw.get("parent_id")
    return GridViewNavItem(
        id=wire_str(raw.get("id")),
        label=wire_str(raw.get("label")),
        href=wire_str(raw.get("href")),
        icon=wire_str(raw.get("icon")),
        active=wire_bool(raw.get("active")),
        disabled=wire_bool(raw.get("disabled")),
        count=(
            wire_int(count_raw)
            if count_raw is not None and not isinstance(count_raw, bool)
            else None
        ),
        type=wire_str(raw.get("type")),
        parent_id=wire_str(parent_id_raw) if isinstance(parent_id_raw, str) else None,
        children=tuple(decode_nav_item(item) for item in _objects(raw.get("children"))),
        extra=wire_json_object(raw.get("extra", {})),
    )


# --- blocks ------------------------------------------------------------------


def _card_group_count(value: object) -> str | int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        return value
    return 0


class _CommonBlockKwargs(TypedDict):
    """Keyword arguments shared by every :class:`GridViewBlock` variant."""

    id: str
    title: str
    extra: JsonObject
    style: GridViewStyle
    trusted_style: GridViewTrustedStyle | None
    lazy: GridViewLazyBlock | None


def _common_block_kwargs(raw: Mapping[str, object]) -> _CommonBlockKwargs:
    """Decode the fields :class:`GridViewBlockBase` defines for all block types."""
    trusted_style_raw = raw.get("trusted_style")
    lazy_raw = raw.get("lazy")
    return _CommonBlockKwargs(
        id=wire_str(raw.get("id")),
        title=wire_str(raw.get("title")),
        extra=wire_json_object(raw.get("extra", {})),
        style=decode_style(wire_object(raw.get("style", {}), label="style")),
        trusted_style=(
            decode_trusted_style(trusted_style_raw) if is_wire_mapping(trusted_style_raw) else None
        ),
        lazy=decode_lazy_block(lazy_raw) if is_wire_mapping(lazy_raw) else None,
    )


def decode_block(raw: Mapping[str, object]) -> GridViewBlock:
    """Decode any block variant, dispatching on the ``type`` field."""
    common = _common_block_kwargs(raw)
    block_type = wire_str(raw.get("type"))

    if block_type == "header":
        entity_raw = raw.get("entity")
        return GridViewHeader(
            **common,
            presentation=wire_literal(
                raw.get("presentation"), GRIDVIEW_HEADER_PRESENTATIONS, "plain"
            ),
            nav=wire_optional_str(raw.get("nav")),
            entity=decode_entity(entity_raw) if is_wire_mapping(entity_raw) else None,
            content=wire_optional_str(raw.get("content")),
            subtitle=wire_str(raw.get("subtitle")),
            icon=wire_str(raw.get("icon")),
            actions=wire_optional_str(raw.get("actions")),
        )
    if block_type == "toolbar":
        search_raw = raw.get("search")
        return GridViewToolbar(
            **common,
            presentation=wire_literal(
                raw.get("presentation"), GRIDVIEW_TOOLBAR_PRESENTATIONS, "default"
            ),
            search=decode_search(search_raw) if is_wire_mapping(search_raw) else None,
            filters=wire_optional_str(raw.get("filters")),
            counters=tuple(decode_counter(item) for item in _objects(raw.get("counters"))),
            actions=wire_optional_str(raw.get("actions")),
            target=wire_optional_str(raw.get("target")),
        )
    if block_type == "filters":
        return GridViewFilters(
            **common,
            presentation=wire_literal(
                raw.get("presentation"), GRIDVIEW_FILTERS_PRESENTATIONS, "toolbar"
            ),
            schema=tuple(decode_filter(item) for item in _objects(raw.get("schema"))),
            state=decode_filter_state(wire_object(raw.get("state", {}), label="filter state")),
            target=wire_optional_str(raw.get("target")),
            auto_apply=wire_bool(raw.get("auto_apply", True)),
            navigate_on_change=wire_bool(raw.get("navigate_on_change", True)),
            fragment_endpoint=wire_str(raw.get("fragment_endpoint")),
            fragment_target=wire_str(raw.get("fragment_target")),
            fragment_swap=wire_str(raw.get("fragment_swap")) or "outerHTML",
            facets=wire_bool(raw.get("facets")),
            drawer_layout=wire_literal(
                raw.get("drawer_layout"), GRIDVIEW_FILTER_DRAWER_LAYOUTS, "compact"
            ),
            drawer_sections=tuple(
                decode_filter_drawer_section(item) for item in _objects(raw.get("drawer_sections"))
            ),
        )
    if block_type == "actions":
        return GridViewActions(
            **common,
            presentation=wire_literal(
                raw.get("presentation"), GRIDVIEW_ACTIONS_PRESENTATIONS, "inline"
            ),
            items=tuple(decode_action(item) for item in _objects(raw.get("items"))),
        )
    if block_type == "table":
        return GridViewTable(
            **common,
            backend=wire_literal(raw.get("backend"), GRIDVIEW_TABLE_BACKENDS, "simple"),
            columns=tuple(decode_column(item) for item in _objects(raw.get("columns"))),
            column_source=(
                decode_column_source(wire_object(raw["column_source"], label="column_source"))
                if is_wire_mapping(raw.get("column_source"))
                else None
            ),
            rows=tuple(wire_json_object(item) for item in _objects(raw.get("rows"))),
            datasource=(
                decode_datasource(wire_object(raw["datasource"], label="datasource"))
                if is_wire_mapping(raw.get("datasource"))
                else None
            ),
            header=decode_table_header(wire_object(raw.get("header", {}), label="table header")),
            search_mode=wire_literal(raw.get("search_mode"), GRIDVIEW_TABLE_SEARCH_MODES, "global"),
            sort=decode_sort_state(wire_object(raw.get("sort", {}), label="sort")),
            settings=decode_table_settings(raw.get("settings")),
            edit=(
                decode_table_edit(wire_object(raw["edit"], label="edit"))
                if is_wire_mapping(raw.get("edit"))
                else None
            ),
            assets=_template_assets(raw.get("assets")),
            row_action=_opt_action(raw, "row_action"),
            footer=(
                decode_table_footer(wire_object(raw["footer"], label="footer"))
                if is_wire_mapping(raw.get("footer"))
                else None
            ),
            empty_message=wire_str(raw.get("empty_message")),
            per_page=wire_int(raw.get("per_page")),
            pagination=(
                decode_table_pagination(wire_object(raw["pagination"], label="pagination"))
                if is_wire_mapping(raw.get("pagination"))
                else None
            ),
            striped=wire_bool(raw.get("striped")),
        )
    if block_type == "charts":
        return GridViewCharts(
            **common,
            charts=tuple(
                GridViewChart(
                    id=wire_str(item.get("id")),
                    type=wire_literal(item.get("type"), GRIDVIEW_CHART_TYPES, "bar"),
                    title=wire_str(item.get("title")),
                    x=wire_str(item.get("x")),
                    y=wire_str_tuple(item.get("y")),
                    data=tuple(wire_json_object(row) for row in _objects(item.get("data"))),
                    options=wire_json_object(item.get("options", {})),
                )
                for item in _objects(raw.get("charts"))
            ),
            presentation=wire_literal(
                raw.get("presentation"), GRIDVIEW_CHARTS_PRESENTATIONS, "grid"
            ),
            filters=wire_optional_str(raw.get("filters")),
        )
    if block_type == "kpi":
        return GridViewKpi(
            **common,
            items=tuple(
                KpiSpec(
                    label=wire_str(item.get("label")),
                    format=wire_literal(
                        item.get("format"), GRIDVIEW_COLUMN_FORMATS, ColumnFormat.NUMBER
                    ),
                    aggregate=wire_literal(
                        item.get("aggregate"), GRIDVIEW_KPI_AGGREGATES, KpiAggregate.COUNT
                    ),
                    column_key=wire_optional_str(item.get("column_key")),
                    tone=wire_literal(item.get("tone"), GRIDVIEW_KPI_TONES, "default"),
                    icon=wire_optional_str(item.get("icon")),
                    value=wire_optional_number(item.get("value")),
                )
                for item in _objects(raw.get("items"))
            ),
            presentation=wire_literal(raw.get("presentation"), GRIDVIEW_KPI_PRESENTATIONS, "strip"),
        )
    if block_type == "cards":
        return GridViewCards(
            **common,
            cards=tuple(
                GridViewCard(
                    id=wire_str(item.get("id")),
                    title=wire_str(item.get("title")),
                    subtitle=wire_str(item.get("subtitle")),
                    value=wire_str(item.get("value")),
                    href=wire_str(item.get("href")),
                    icon=wire_str(item.get("icon")),
                    tone=wire_literal(item.get("tone"), GRIDVIEW_CARD_TONES, ""),
                    meta=wire_json_object(item.get("meta", {})),
                )
                for item in _objects(raw.get("cards"))
            ),
            presentation=wire_literal(
                raw.get("presentation"), GRIDVIEW_CARDS_PRESENTATIONS, "grid"
            ),
        )
    if block_type == "card_groups":
        return GridViewCardGroups(
            **common,
            groups=tuple(
                GridViewCardGroup(
                    id=wire_str(item.get("id")),
                    title=wire_str(item.get("title")),
                    tone=wire_literal(item.get("tone"), GRIDVIEW_KPI_TONES, "default"),
                    items=wire_str_tuple(item.get("items")),
                    count=_card_group_count(item.get("count", 0)),
                    empty_message=wire_str(item.get("empty_message", "—")),
                )
                for item in _objects(raw.get("groups"))
            ),
        )
    if block_type == "tabs":
        return GridViewTabs(
            **common,
            tabs=tuple(
                GridViewTab(
                    id=wire_str(item.get("id")),
                    label=wire_str(item.get("label")),
                    area=wire_str(item.get("area")),
                    block=wire_str(item.get("block")),
                    active=wire_bool(item.get("active")),
                    disabled=wire_bool(item.get("disabled")),
                    badge=wire_str(item.get("badge")),
                    badge_tone=wire_semantic_tone(item.get("badge_tone")),
                )
                for item in _objects(raw.get("tabs"))
            ),
            presentation=wire_literal(raw.get("presentation"), GRIDVIEW_TABS_PRESENTATIONS, "tabs"),
        )
    if block_type == "nav":
        return GridViewNav(
            **common,
            presentation=wire_literal(raw.get("presentation"), GRIDVIEW_NAV_PRESENTATIONS, "menu"),
            items=tuple(decode_nav_item(item) for item in _objects(raw.get("items"))),
            levels=tuple(decode_nav_level(lvl) for lvl in _objects(raw.get("levels"))),
            search_placeholder=wire_str(raw.get("search_placeholder")),
            allow_create=wire_bool(raw.get("allow_create")),
            saved_searches=wire_bool(raw.get("saved_searches")),
        )
    if block_type == "content":
        return GridViewContent(
            **common,
            role=wire_literal(raw.get("role"), GRIDVIEW_CONTENT_ROLES, "text"),
            body=wire_str(raw.get("body")),
            tone=wire_semantic_tone(raw.get("tone")),
            dismissible=wire_bool(raw.get("dismissible")),
        )
    if block_type == "form":
        translations_raw = raw.get("translations")
        return GridViewForm(
            **common,
            presentation=wire_literal(
                raw.get("presentation"), GRIDVIEW_FORM_PRESENTATIONS, "stack"
            ),
            fields=tuple(decode_field(item) for item in _objects(raw.get("fields"))),
            fieldsets=tuple(decode_fieldset(item) for item in _objects(raw.get("fieldsets"))),
            values=wire_json_object(raw.get("values", {})),
            errors=_form_errors(raw.get("errors")),
            translations=(
                decode_translation_envelope(translations_raw)
                if is_wire_mapping(translations_raw)
                else None
            ),
            submit=_opt_action(raw, "submit"),
            method=wire_literal(raw.get("method"), GRIDVIEW_FORM_METHODS, "post"),
            endpoint=wire_str(raw.get("endpoint")),
        )
    if block_type == "overlay":
        nested = raw.get("spec")
        return GridViewOverlay(
            **common,
            presentation=wire_literal(
                raw.get("presentation"), GRIDVIEW_OVERLAY_PRESENTATIONS, "modal"
            ),
            spec=decode_spec(wire_object(nested, label="overlay spec"))
            if is_wire_mapping(nested)
            else None,
            content=wire_optional_str(raw.get("content")),
            size=wire_literal(raw.get("size"), GRIDVIEW_OVERLAY_SIZES, "lg"),
            close_on_backdrop=wire_bool(raw.get("close_on_backdrop", True)),
            close_on_escape=wire_bool(raw.get("close_on_escape", True)),
        )
    if block_type == "template":
        return GridViewTemplate(
            **common,
            mode=wire_literal(raw.get("mode"), GRIDVIEW_TEMPLATE_MODES, "file"),
            template=wire_str(raw.get("template")),
            context=wire_json_object(raw.get("context", {})),
            html=wire_str(raw.get("html")),
            assets=_template_assets(raw.get("assets")),
        )
    if block_type == "gallery":
        return GridViewGallery(
            **common,
            images=tuple(decode_image_source(item) for item in _objects(raw.get("images"))),
            datasource=(
                decode_datasource(wire_object(raw["datasource"], label="gallery datasource"))
                if is_wire_mapping(raw.get("datasource"))
                else None
            ),
            presentation=wire_literal(
                raw.get("presentation"), GRIDVIEW_GALLERY_PRESENTATIONS, "grid"
            ),
            columns=wire_int(raw.get("columns")),
            aspect=wire_str(raw.get("aspect")),
            lightbox=wire_bool(raw.get("lightbox", True)),
        )
    if block_type == "image":
        image_default: dict[str, object] = {"id": common["id"]}
        return GridViewImage(
            **common,
            image=decode_image_source(wire_object(raw.get("image", image_default), label="image")),
            fit=wire_literal(raw.get("fit"), GRIDVIEW_IMAGE_FITS, "cover"),
            aspect=wire_str(raw.get("aspect")),
        )
    raise ValueError(f"unknown block type {block_type!r}")


# --- spec --------------------------------------------------------------------


def decode_area(raw: Mapping[str, object]) -> GridViewArea:
    """Decode one layout area node (recursive)."""
    return GridViewArea(
        id=wire_str(raw.get("id", "root")),
        type=wire_literal(raw.get("type"), GRIDVIEW_AREA_TYPES, "stack"),
        blocks=wire_str_tuple(raw.get("blocks")),
        areas=tuple(decode_area(item) for item in _objects(raw.get("areas"))),
        style=decode_style(wire_object(raw.get("style", {}), label="area style")),
        extra=wire_json_object(raw.get("extra", {})),
    )


def decode_config(raw: Mapping[str, object]) -> GridViewConfig:
    """Decode page-level host configuration."""
    return GridViewConfig(
        htmx=wire_bool(raw.get("htmx", True)),
        template=wire_str(raw.get("template")),
        page_state_scope=wire_str(raw.get("page_state_scope")),
        assets=_template_assets(raw.get("assets")),
        lazy=decode_lazy_defaults(wire_object(raw.get("lazy", {}), label="config.lazy")),
    )


def decode_spec(raw: Mapping[str, object]) -> GridViewSpec:
    """Decode a full GridViewSpec wire object (public entry point)."""
    meta_raw = wire_object(raw.get("meta", {}), label="meta")
    layout_raw = wire_object(raw.get("layout", {}), label="layout")
    root_default: dict[str, object] = {"id": "root"}
    root_raw = wire_object(layout_raw.get("root", root_default), label="layout.root")
    return GridViewSpec(
        id=wire_str(raw.get("id")),
        meta=GridViewMeta(
            title=wire_str(meta_raw.get("title")),
            subtitle=wire_str(meta_raw.get("subtitle")),
            icon=wire_str(meta_raw.get("icon")),
            description=wire_str(meta_raw.get("description")),
        ),
        config=decode_config(wire_object(raw.get("config", {}), label="config")),
        blocks=tuple(decode_block(item) for item in _objects(raw.get("blocks"))),
        layout=GridViewLayout(root=decode_area(root_raw)),
    )
