from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import fields, is_dataclass

from grid_view_spec.types.actions import (
    GridViewExportAction,
    GridViewLinkAction,
    GridViewOverlayAction,
)
from grid_view_spec.types.content import GridViewCharts, GridViewTab, GridViewTabs
from grid_view_spec.types.filters_v2 import (
    GridViewFilter,
    GridViewFilters,
    GridViewFilterValue,
    is_set_filter_model,
)
from grid_view_spec.types.form import (
    GRIDVIEW_VALIDATOR_KINDS,
    GridViewField,
    GridViewForm,
    GridViewTranslationEnvelope,
    GridViewValidator,
)
from grid_view_spec.types.header import GridViewHeader
from grid_view_spec.types.json import JsonValue
from grid_view_spec.types.media import GridViewGallery, GridViewImage, GridViewImageSource
from grid_view_spec.types.overlay import GridViewOverlay
from grid_view_spec.types.result import GridViewDiagnostic, GridViewPolicy, GridViewResult
from grid_view_spec.types.spec import GridViewBlock, GridViewSpec
from grid_view_spec.types.table_v2 import GridViewTable, is_valid_gridview_table_settings
from grid_view_spec.types.toolbar import GridViewToolbar
from grid_view_spec.types.wire import is_object_list, is_object_tuple, is_wire_mapping
from grid_view_spec.validate import codes as c
from grid_view_spec.validate.chart_options import KNOWN_CHART_OPTION_KEYS
from grid_view_spec.validate.refs import (
    BLOCK_TYPES,
    block_ref_fields,
    build_block_index,
    collect_action_targets,
    collect_area_ids,
    collect_layout_block_ids,
    is_template_block,
    iter_actions,
    iter_all_blocks,
    iter_nested_specs,
    search_bind_target,
)

BUILTIN_RENDERERS = frozenset(
    {
        "badge",
        "tag",
        "link",
        "money",
        "progress",
        "date",
        "image",
        "thumbnail",
        "button",
        "chip",
        "period_pills",
        "select",
    }
)

# These renderers are emitted by the simple-table templates and carry
# structured values that the AG Grid runtime cannot faithfully represent.
SIMPLE_TABLE_RENDERERS = frozenset({"tag", "progress", "chip", "period_pills", "select"})
AG_GRID_RENDERERS = BUILTIN_RENDERERS - SIMPLE_TABLE_RENDERERS

BlockIndex = dict[str, GridViewBlock]
Diagnostics = list[GridViewDiagnostic]

_FORM_TOKEN = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,127}$")


def error(code: str, message: str, path: str = "") -> GridViewDiagnostic:
    return GridViewDiagnostic(severity="error", code=code, path=path, message=message)


def warning(code: str, message: str, path: str = "") -> GridViewDiagnostic:
    return GridViewDiagnostic(severity="warning", code=code, path=path, message=message)


def _check_duplicate_ids(spec: GridViewSpec) -> list[GridViewDiagnostic]:
    diagnostics: list[GridViewDiagnostic] = []
    seen: set[str] = set()
    for nested in iter_nested_specs(spec):
        for block in nested.blocks:
            if block.id in seen:
                diagnostics.append(
                    error(
                        c.DUPLICATE_BLOCK_ID,
                        f"duplicate block id {block.id!r}",
                        f"blocks.{block.id}",
                    )
                )
            seen.add(block.id)
    return diagnostics


def _check_layout_refs(spec: GridViewSpec, index: BlockIndex) -> Diagnostics:
    diagnostics: list[GridViewDiagnostic] = []
    for block_id in collect_layout_block_ids(spec):
        if block_id not in index:
            diagnostics.append(
                error(
                    c.MISSING_LAYOUT_REF,
                    f"layout references unknown block id {block_id!r}",
                    f"layout.{block_id}",
                )
            )
    return diagnostics


def _check_tab(
    tab: GridViewTab,
    block_id: str,
    index: dict[str, GridViewBlock],
    area_ids: set[str],
) -> list[GridViewDiagnostic]:
    has_area = bool(tab.area)
    has_block = bool(tab.block)
    if has_area == has_block:
        return [
            error(
                c.INVALID_TAB_TARGET,
                "tab must set exactly one of area or block",
                f"blocks.{block_id}.tabs.{tab.id}",
            )
        ]
    if tab.block and tab.block not in index:
        return [
            error(
                c.MISSING_BLOCK_REF,
                f"tab block target {tab.block!r} not found",
                f"blocks.{block_id}.tabs.{tab.id}",
            )
        ]
    if tab.area and tab.area not in area_ids:
        return [
            error(
                c.MISSING_BLOCK_REF,
                f"tab area target {tab.area!r} not found",
                f"blocks.{block_id}.tabs.{tab.id}",
            )
        ]
    return []


def _check_overlay(block: GridViewOverlay, index: BlockIndex) -> Diagnostics:
    diagnostics: list[GridViewDiagnostic] = []
    if block.spec is not None and block.content:
        diagnostics.append(
            error(
                c.INVALID_OVERLAY,
                "overlay must not set both spec and content",
                f"blocks.{block.id}",
            )
        )
    if block.content:
        if block.content not in index:
            diagnostics.append(
                error(
                    c.INVALID_OVERLAY_CONTENT,
                    f"overlay content references unknown block {block.content!r}",
                    f"blocks.{block.id}.content",
                )
            )
        else:
            target = index[block.content]
            if not is_template_block(target):
                diagnostics.append(
                    error(
                        c.INVALID_OVERLAY_CONTENT,
                        "overlay.content must reference a template block",
                        f"blocks.{block.id}.content",
                    )
                )
    return diagnostics


def _check_filters_target_match(
    filters_id: str,
    index: dict[str, GridViewBlock],
    toolbar: GridViewToolbar,
) -> list[GridViewDiagnostic]:
    filters_block = index.get(filters_id)
    if not isinstance(filters_block, GridViewFilters):
        return []
    if filters_block.target != toolbar.target:
        return [
            error(
                c.FILTER_TARGET_MISMATCH,
                "toolbar.filters target must match GridViewFilters.target",
                f"blocks.{toolbar.id}.filters",
            )
        ]
    return []


def _check_filter_state_value(
    filt: GridViewFilter,
    value: GridViewFilterValue,
    path: str,
) -> list[GridViewDiagnostic]:
    if filt.type == "set":
        if not is_set_filter_model(value):
            return [
                error(
                    c.INVALID_SET_FILTER_MODEL,
                    "set filter state must be SetFilterModel",
                    path,
                )
            ]
        return []
    if filt.type == "multiselect" and not isinstance(value, tuple):
        return [error(c.INVALID_FILTER_STATE, "multiselect state must be tuple[str, ...]", path)]
    if filt.type in ("select", "text", "number", "date", "boolean") and isinstance(value, tuple):
        return [error(c.INVALID_FILTER_STATE, f"{filt.type} filter state must be scalar", path)]
    if filt.type in ("number_range", "date_range"):
        if not isinstance(value, tuple) or len(value) != 2:
            return [
                error(
                    c.INVALID_FILTER_STATE,
                    f"{filt.type} state must be tuple of two values",
                    path,
                )
            ]
    return []


def _check_filter_states(spec: GridViewSpec) -> list[GridViewDiagnostic]:
    diagnostics: list[GridViewDiagnostic] = []
    for block in iter_all_blocks(spec):
        if not isinstance(block, GridViewFilters):
            continue
        schema_by_id = {f.id: f for f in block.schema}
        if block.drawer_layout == "workspace":
            if block.presentation != "drawer":
                diagnostics.append(
                    error(
                        c.FILTER_DRAWER_LAYOUT_INVALID,
                        "workspace drawer layout requires drawer presentation",
                        f"blocks.{block.id}.drawer_layout",
                    )
                )
            seen_filter_ids: set[str] = set()
            seen_section_ids: set[str] = set()
            for section in block.drawer_sections:
                section_path = f"blocks.{block.id}.drawer_sections.{section.id}"
                if not section.id or not section.filter_ids or section.id in seen_section_ids:
                    diagnostics.append(
                        error(
                            c.FILTER_DRAWER_SECTION_INVALID,
                            "workspace drawer sections need unique ids and at least one filter",
                            section_path,
                        )
                    )
                seen_section_ids.add(section.id)
                for filter_id in section.filter_ids:
                    if filter_id not in schema_by_id:
                        diagnostics.append(
                            error(
                                c.FILTER_DRAWER_SECTION_UNKNOWN_FILTER,
                                f"workspace section references unknown filter {filter_id!r}",
                                section_path,
                            )
                        )
                    elif filter_id in seen_filter_ids:
                        diagnostics.append(
                            error(
                                c.FILTER_DRAWER_SECTION_DUPLICATE_FILTER,
                                f"workspace filter {filter_id!r} appears in more than one section",
                                section_path,
                            )
                        )
                    else:
                        seen_filter_ids.add(filter_id)
            for filter_id in schema_by_id:
                if filter_id not in seen_filter_ids:
                    diagnostics.append(
                        error(
                            c.FILTER_DRAWER_SECTION_INVALID,
                            f"workspace filter {filter_id!r} is not assigned to a section",
                            f"blocks.{block.id}.drawer_sections",
                        )
                    )
        for filter_id, value in block.state.values.items():
            filt = schema_by_id.get(filter_id)
            if filt is None:
                diagnostics.append(
                    error(
                        c.INVALID_FILTER_STATE,
                        f"state key {filter_id!r} not in schema",
                        f"blocks.{block.id}.state.{filter_id}",
                    )
                )
                continue
            diagnostics.extend(
                _check_filter_state_value(filt, value, f"blocks.{block.id}.state.{filter_id}")
            )
    return diagnostics


def _check_search_xor(spec: GridViewSpec, index: BlockIndex) -> Diagnostics:
    diagnostics: list[GridViewDiagnostic] = []
    binds: dict[str, list[str]] = {}
    for block in iter_all_blocks(spec):
        if not isinstance(block, GridViewToolbar):
            continue
        target = search_bind_target(block)
        if target is None:
            continue
        binds.setdefault(target, []).append(block.id)
    for table_id, toolbars in binds.items():
        if len(toolbars) > 1:
            diagnostics.append(
                error(
                    c.DUPLICATE_TABLE_SEARCH,
                    f"multiple toolbar searches bound to table {table_id!r}: {toolbars}",
                    f"blocks.{table_id}",
                )
            )
        if table_id not in index:
            diagnostics.append(
                error(
                    c.MISSING_BLOCK_REF,
                    f"search bind target {table_id!r} not found",
                    f"blocks.{toolbars[0]}.search.bind",
                )
            )
        elif not isinstance(index[table_id], GridViewTable):
            diagnostics.append(
                error(
                    c.INVALID_ACTION_TARGET,
                    f"search bind target {table_id!r} is not a table",
                    f"blocks.{toolbars[0]}.search.bind",
                )
            )
    return diagnostics


VALID_CHART_DATA_SOURCES: frozenset[str] = frozenset({"static", "grid_filtered"})


def _check_chart_options(spec: GridViewSpec, policy: GridViewPolicy) -> list[GridViewDiagnostic]:
    diagnostics: list[GridViewDiagnostic] = []
    for block in iter_all_blocks(spec):
        if not isinstance(block, GridViewCharts):
            continue
        for chart in block.charts:
            # Value validation (always on): data_source must be a known mode.
            data_source = chart.options.get("data_source")
            if (
                isinstance(data_source, str)
                and data_source
                and data_source not in VALID_CHART_DATA_SOURCES
            ):
                allowed = sorted(VALID_CHART_DATA_SOURCES)
                diagnostics.append(
                    error(
                        c.INVALID_CHART_OPTION_VALUE,
                        f"chart data_source {data_source!r} must be one of {allowed}",
                        f"blocks.{block.id}.charts.{chart.id}.options.data_source",
                    )
                )
            # Key gate (strict only): reject undocumented option keys.
            if not policy.strict_unknown_config:
                continue
            for key in chart.options:
                if key not in KNOWN_CHART_OPTION_KEYS:
                    diagnostics.append(
                        error(
                            c.UNKNOWN_CHART_OPTION,
                            f"unknown chart option key {key!r}",
                            f"blocks.{block.id}.charts.{chart.id}.options.{key}",
                        )
                    )
    return diagnostics


def _check_renderers(spec: GridViewSpec, policy: GridViewPolicy) -> list[GridViewDiagnostic]:
    diagnostics: list[GridViewDiagnostic] = []
    for block in iter_all_blocks(spec):
        if not isinstance(block, GridViewTable):
            continue
        allowed = set(policy.registered_renderers) | (
            AG_GRID_RENDERERS if block.backend == "ag_grid" else BUILTIN_RENDERERS
        )
        for col in block.columns:
            if col.renderer and (
                (col.renderer not in allowed and bool(policy.registered_renderers))
                or (
                    block.backend == "ag_grid"
                    and col.renderer in SIMPLE_TABLE_RENDERERS
                    and col.renderer not in policy.registered_renderers
                )
            ):
                diagnostics.append(
                    error(
                        c.UNKNOWN_RENDERER,
                        f"unknown renderer {col.renderer!r}",
                        f"blocks.{block.id}.columns.{col.id}.renderer",
                    )
                )
    return diagnostics


def _check_table_edit(spec: GridViewSpec) -> list[GridViewDiagnostic]:
    """Editable columns require a table edit config; edit commit source is XOR."""
    diagnostics: list[GridViewDiagnostic] = []
    for block in iter_all_blocks(spec):
        if not isinstance(block, GridViewTable):
            continue
        has_edit = block.edit is not None
        for col in block.columns:
            if col.editable and not has_edit:
                diagnostics.append(
                    error(
                        c.EDITABLE_WITHOUT_EDIT,
                        f"column {col.id!r} is editable but table has no edit config",
                        f"blocks.{block.id}.columns.{col.id}.editable",
                    )
                )
        edit = block.edit
        if edit is not None:
            has_endpoint = bool(edit.commit_endpoint)
            has_callback = bool(edit.commit_callback)
            if has_endpoint == has_callback:
                diagnostics.append(
                    error(
                        c.EDIT_COMMIT_XOR,
                        "table edit must set exactly one of commit_endpoint or commit_callback",
                        f"blocks.{block.id}.edit",
                    )
                )
    return diagnostics


def _check_table_settings(spec: GridViewSpec) -> list[GridViewDiagnostic]:
    """Table settings must select each supported surface at most once."""
    diagnostics: list[GridViewDiagnostic] = []
    for block in iter_all_blocks(spec):
        if (
            isinstance(block, GridViewTable)
            and block.settings is not None
            and not is_valid_gridview_table_settings(block.settings)
        ):
            diagnostics.append(
                error(
                    c.INVALID_TABLE_SETTINGS,
                    "table.settings must be a non-empty tuple of unique drawer/modal surfaces",
                    f"blocks.{block.id}.settings",
                )
            )
    return diagnostics


def _has_image_source(src: GridViewImageSource) -> bool:
    return bool(src.url or src.thumb or src.variants)


def _check_media_sources(spec: GridViewSpec) -> list[GridViewDiagnostic]:
    """Galleries must have inline images or a datasource; images must carry a URL."""
    diagnostics: list[GridViewDiagnostic] = []
    for block in iter_all_blocks(spec):
        if isinstance(block, GridViewGallery):
            has_datasource = block.datasource is not None and bool(block.datasource.endpoint)
            # A gallery may also be filled at runtime: by a lazy fragment load, or
            # client-side (e.g. a paired lightbox template). We can't see those
            # sources declaratively, so an empty, source-less gallery is advisory
            # (warning) rather than a hard error — and skipped entirely when lazy.
            if not block.images and not has_datasource and block.lazy is None:
                diagnostics.append(
                    warning(
                        c.GALLERY_NO_SOURCE,
                        "gallery has no inline images, datasource.endpoint, or lazy "
                        "loader; ensure it is populated at runtime",
                        f"blocks.{block.id}",
                    )
                )
            for index, image in enumerate(block.images):
                if not _has_image_source(image):
                    diagnostics.append(
                        error(
                            c.IMAGE_NO_URL,
                            f"gallery image {image.id!r} has no url, thumb, or variants",
                            f"blocks.{block.id}.images[{index}]",
                        )
                    )
        elif isinstance(block, GridViewImage):
            if not _has_image_source(block.image):
                diagnostics.append(
                    error(
                        c.IMAGE_NO_URL,
                        f"image block {block.id!r} source has no url, thumb, or variants",
                        f"blocks.{block.id}.image",
                    )
                )
        elif isinstance(block, GridViewTable):
            for col in block.columns:
                if col.renderer == "image":
                    thumb = col.extra.get("thumb_field")
                    if not thumb and not col.field:
                        diagnostics.append(
                            error(
                                c.IMAGE_NO_URL,
                                f"image column {col.id!r} needs field or extra.thumb_field",
                                f"blocks.{block.id}.columns.{col.id}",
                            )
                        )
    return diagnostics


def _form_token(value: object) -> bool:
    """Return whether a form identity is safe for deterministic HTML hooks."""
    return isinstance(value, str) and bool(_FORM_TOKEN.fullmatch(value))


def _form_value_valid(field: GridViewField, value: JsonValue) -> bool:
    """Validate one supplied/default value against the native form matrix."""
    if value is None:
        return True
    if field.type in ("text", "textarea", "date"):
        return isinstance(value, str)
    if field.type == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if field.type == "select":
        return isinstance(value, str) and value in {option.value for option in field.options}
    if field.type == "multiselect":
        if not isinstance(value, (list, tuple)):
            return False
        if not all(isinstance(item, str) for item in value):
            return False
        items = [item for item in value if isinstance(item, str)]
        return len(items) == len(set(items)) and all(
            item in {option.value for option in field.options} for item in items
        )
    if field.type == "boolean":
        return isinstance(value, bool)
    if field.type == "date_range":
        if not isinstance(value, Mapping):
            return False
        range_value: Mapping[str, JsonValue] = value
        return set(range_value) == {"start", "end"} and all(
            isinstance(range_value[key], str) or range_value[key] is None
            for key in ("start", "end")
        )
    if field.type == "file":
        return False
    return False


def _form_value_diagnostics(
    field: GridViewField,
    value: JsonValue,
    path: str,
    *,
    default: bool = False,
) -> GridViewDiagnostic | None:
    """Build an explicit diagnostic for a value outside the field matrix."""
    if _form_value_valid(field, value):
        return None
    code = c.FORM_DEFAULT_INVALID if default else c.FORM_VALUE_INVALID
    return error(code, f"value for {field.name!r} does not match field type {field.type!r}", path)


def _check_validator(
    field: GridViewField,
    validator: GridViewValidator,
    path: str,
    policy: GridViewPolicy,
) -> list[GridViewDiagnostic]:
    """Validate a validator descriptor and its native-attribute compatibility."""
    diagnostics: list[GridViewDiagnostic] = []
    kind = validator.kind
    value = validator.value
    name = validator.name
    if kind not in GRIDVIEW_VALIDATOR_KINDS:
        return [error(c.UNKNOWN_VALIDATOR_KIND, f"unknown validator kind {kind!r}", path)]
    if kind in {"required", "email", "url", "number", "integer"} and value is not None:
        diagnostics.append(
            error(
                c.FORM_VALIDATOR_PARAMETER_INVALID, f"{kind} validator does not accept value", path
            )
        )
    elif kind in {"min", "max"} and (
        not isinstance(value, (int, float)) or isinstance(value, bool)
    ):
        diagnostics.append(
            error(c.FORM_VALIDATOR_PARAMETER_INVALID, f"{kind} validator requires a number", path)
        )
    elif kind in {"min_length", "max_length"} and (
        not isinstance(value, int) or isinstance(value, bool) or value < 0
    ):
        diagnostics.append(
            error(
                c.FORM_VALIDATOR_PARAMETER_INVALID,
                f"{kind} validator requires a non-negative integer",
                path,
            )
        )
    elif kind == "pattern" and (not isinstance(value, str) or not value):
        diagnostics.append(
            error(c.PATTERN_REQUIRES_VALUE, "pattern validator requires a non-empty regex", path)
        )
    elif kind == "domain" and value is not None and (not isinstance(value, str) or not value):
        diagnostics.append(
            error(
                c.FORM_VALIDATOR_PARAMETER_INVALID, "domain value must be a non-empty string", path
            )
        )
    elif kind == "custom" and value is not None:
        diagnostics.append(
            error(
                c.FORM_VALIDATOR_PARAMETER_INVALID, "custom validator does not accept value", path
            )
        )
    if kind == "custom":
        if not name:
            diagnostics.append(
                error(c.CUSTOM_VALIDATOR_MISSING_NAME, "custom validator requires a name", path)
            )
        elif policy.registered_validators and name not in policy.registered_validators:
            diagnostics.append(
                error(
                    c.CUSTOM_VALIDATOR_MISSING_NAME,
                    f"custom validator {name!r} not registered",
                    path,
                )
            )
    compatible: dict[str, frozenset[str]] = {
        "email": frozenset({"text"}),
        "url": frozenset({"text"}),
        "number": frozenset({"number"}),
        "integer": frozenset({"number"}),
        "min": frozenset({"number"}),
        "max": frozenset({"number"}),
        "min_length": frozenset({"text", "textarea"}),
        "max_length": frozenset({"text", "textarea"}),
        "pattern": frozenset({"text"}),
        "domain": frozenset({"text"}),
    }
    if kind in compatible and field.type not in compatible[kind]:
        diagnostics.append(
            error(
                c.FORM_VALIDATOR_INCOMPATIBLE,
                f"{kind} validator is incompatible with field type {field.type!r}",
                path,
            )
        )
    return diagnostics


def _check_translation_envelope(
    block: GridViewForm,
    fields_by_name: Mapping[str, GridViewField],
    envelope: GridViewTranslationEnvelope,
) -> list[GridViewDiagnostic]:
    """Validate locale declarations and locale-keyed values/errors."""
    diagnostics: list[GridViewDiagnostic] = []
    locales = {locale.code for locale in envelope.locales}
    if len(locales) != len(envelope.locales):
        diagnostics.append(
            error(c.FORM_LOCALE_DUPLICATE_CODE, "translation locale codes must be unique")
        )
    for locale in envelope.locales:
        path = f"blocks.{block.id}.translations.locales.{locale.code}"
        if not _form_token(locale.code):
            diagnostics.append(
                error(c.FORM_TOKEN_INVALID, "locale code is not a valid form token", path)
            )
        if not locale.label:
            diagnostics.append(
                error(c.FORM_LOCALE_LABEL_EMPTY, "locale label must not be empty", path)
            )
    if envelope.default_locale not in locales:
        diagnostics.append(
            error(
                c.FORM_TRANSLATION_DEFAULT_LOCALE_UNKNOWN,
                f"default locale {envelope.default_locale!r} is not declared",
                f"blocks.{block.id}.translations.default_locale",
            )
        )
    if envelope.fallback_locale is not None and envelope.fallback_locale not in locales:
        diagnostics.append(
            error(
                c.FORM_TRANSLATION_FALLBACK_LOCALE_UNKNOWN,
                f"fallback locale {envelope.fallback_locale!r} is not declared",
                f"blocks.{block.id}.translations.fallback_locale",
            )
        )
    localized_names = {name for name, field in fields_by_name.items() if field.localized}
    for locale, values in envelope.values.items():
        if locale not in locales:
            diagnostics.append(
                error(
                    c.FORM_TRANSLATION_UNKNOWN_LOCALE,
                    f"unknown locale {locale!r}",
                    f"blocks.{block.id}.translations.values.{locale}",
                )
            )
            continue
        for name, value in values.items():
            field = fields_by_name.get(name)
            if field is None or name not in localized_names:
                diagnostics.append(
                    error(
                        c.FORM_TRANSLATION_UNKNOWN_FIELD,
                        f"unknown or non-localized field {name!r}",
                        f"blocks.{block.id}.translations.values.{locale}.{name}",
                    )
                )
                continue
            diagnostic = _form_value_diagnostics(
                field, value, f"blocks.{block.id}.translations.values.{locale}.{name}"
            )
            if diagnostic:
                diagnostics.append(diagnostic)
    for locale, errors in envelope.errors.items():
        if locale not in locales:
            diagnostics.append(
                error(
                    c.FORM_TRANSLATION_UNKNOWN_LOCALE,
                    f"unknown locale {locale!r}",
                    f"blocks.{block.id}.translations.errors.{locale}",
                )
            )
            continue
        for name in errors:
            if name not in localized_names:
                diagnostics.append(
                    error(
                        c.FORM_TRANSLATION_UNKNOWN_FIELD,
                        f"unknown or non-localized field {name!r}",
                        f"blocks.{block.id}.translations.errors.{locale}.{name}",
                    )
                )
    return diagnostics


def _check_form_rules(spec: GridViewSpec, policy: GridViewPolicy) -> list[GridViewDiagnostic]:
    """Validate declarative form identities, values, locales, fieldsets, and validators."""
    diagnostics: list[GridViewDiagnostic] = []
    for block in iter_all_blocks(spec):
        if not isinstance(block, GridViewForm):
            continue
        if not _form_token(block.id):
            diagnostics.append(
                error(
                    c.FORM_TOKEN_INVALID,
                    "form id is not a valid form token",
                    f"blocks.{block.id}.id",
                )
            )
        field_names: set[str] = set()
        fields_by_name: dict[str, GridViewField] = {}
        for field in block.fields:
            field_path = f"blocks.{block.id}.fields.{field.name}"
            if not _form_token(field.name):
                diagnostics.append(
                    error(c.FORM_TOKEN_INVALID, "field name is not a valid form token", field_path)
                )
            if field.name in field_names:
                diagnostics.append(
                    error(
                        c.FORM_FIELD_DUPLICATE_NAME,
                        f"duplicate field name {field.name!r}",
                        f"blocks.{block.id}.fields.{field.name}",
                    )
                )
            field_names.add(field.name)
            fields_by_name.setdefault(field.name, field)
            if field.widget and not _form_token(field.widget):
                diagnostics.append(
                    error(
                        c.FORM_WIDGET_INVALID,
                        "widget is not a valid capability token",
                        f"{field_path}.widget",
                    )
                )
            if field.options and field.type not in {"select", "multiselect"}:
                diagnostics.append(
                    error(
                        c.FORM_OPTION_INVALID,
                        "options are only valid for select fields",
                        f"{field_path}.options",
                    )
                )
            option_values = [option.value for option in field.options]
            if len(option_values) != len(set(option_values)):
                diagnostics.append(
                    error(
                        c.FORM_OPTION_INVALID,
                        "option values must be unique",
                        f"{field_path}.options",
                    )
                )
            diagnostic = _form_value_diagnostics(
                field, field.default, f"{field_path}.default", default=True
            )
            if diagnostic:
                diagnostics.append(diagnostic)
            for validator_index, validator in enumerate(field.validators):
                vpath = f"{field_path}.validators[{validator_index}]"
                diagnostics.extend(_check_validator(field, validator, vpath, policy))

        for field in block.fields:
            if field.visible_when and field.visible_when.field not in field_names:
                diagnostics.append(
                    error(
                        c.FORM_FIELD_CONDITION_UNKNOWN,
                        f"unknown condition field {field.visible_when.field!r}",
                        f"blocks.{block.id}.fields.{field.name}.visible_when.field",
                    )
                )
        for name, value in block.values.items():
            field = fields_by_name.get(name)
            if field is None:
                diagnostics.append(
                    error(
                        c.FORM_VALUE_INVALID,
                        f"unknown form value field {name!r}",
                        f"blocks.{block.id}.values.{name}",
                    )
                )
            elif field.localized:
                diagnostics.append(
                    error(
                        c.FORM_TRANSLATION_NONLOCALIZED_FIELD,
                        "localized field values belong in translations",
                        f"blocks.{block.id}.values.{name}",
                    )
                )
            else:
                diagnostic = _form_value_diagnostics(
                    field, value, f"blocks.{block.id}.values.{name}"
                )
                if diagnostic:
                    diagnostics.append(diagnostic)
        for name in block.errors:
            if name not in fields_by_name:
                diagnostics.append(
                    error(
                        c.FORM_VALUE_INVALID,
                        f"unknown form error field {name!r}",
                        f"blocks.{block.id}.errors.{name}",
                    )
                )
            elif fields_by_name[name].localized:
                diagnostics.append(
                    error(
                        c.FORM_TRANSLATION_NONLOCALIZED_FIELD,
                        "localized field errors belong in translations",
                        f"blocks.{block.id}.errors.{name}",
                    )
                )
        localized_fields = [field for field in block.fields if field.localized]
        if localized_fields and block.translations is None:
            diagnostics.append(
                error(
                    c.FORM_TRANSLATIONS_REQUIRED,
                    "localized fields require a translation envelope",
                    f"blocks.{block.id}.translations",
                )
            )
        if block.translations is not None:
            diagnostics.extend(
                _check_translation_envelope(block, fields_by_name, block.translations)
            )
        defined = {field.name for field in block.fields}
        fieldset_ids: set[str] = set()
        grouped_fields: set[str] = set()
        for fieldset in block.fieldsets:
            if not _form_token(fieldset.id):
                diagnostics.append(
                    error(
                        c.FORM_TOKEN_INVALID,
                        "fieldset id is not a valid form token",
                        f"blocks.{block.id}.fieldsets.{fieldset.id}",
                    )
                )
            if fieldset.id in fieldset_ids:
                diagnostics.append(
                    error(
                        c.FORM_FIELDSET_DUPLICATE_ID,
                        f"duplicate fieldset id {fieldset.id!r}",
                        f"blocks.{block.id}.fieldsets.{fieldset.id}",
                    )
                )
            fieldset_ids.add(fieldset.id)
            if fieldset.columns < 1:
                diagnostics.append(
                    error(
                        c.FORM_FIELDSET_COLUMNS_INVALID,
                        "fieldset columns must be positive",
                        f"blocks.{block.id}.fieldsets.{fieldset.id}.columns",
                    )
                )
            for ref in fieldset.fields:
                if ref not in defined:
                    diagnostics.append(
                        error(
                            c.FIELDSET_UNKNOWN_FIELD,
                            f"fieldset {fieldset.id!r} references unknown field {ref!r}",
                            f"blocks.{block.id}.fieldsets.{fieldset.id}",
                        )
                    )
                elif ref in grouped_fields:
                    diagnostics.append(
                        error(
                            c.FORM_FIELDSET_DUPLICATE_FIELD,
                            f"field {ref!r} is referenced by more than one fieldset",
                            f"blocks.{block.id}.fieldsets.{fieldset.id}.fields",
                        )
                    )
                grouped_fields.add(ref)
    return diagnostics


def _check_trusted_css_vars(spec: GridViewSpec, policy: GridViewPolicy) -> list[GridViewDiagnostic]:
    """Reject host-only css_vars when the policy forbids trusted style overrides."""
    if policy.allow_trusted_css_vars:
        return []
    diagnostics: list[GridViewDiagnostic] = []
    for block in iter_all_blocks(spec):
        if block.trusted_style and block.trusted_style.css_vars:
            diagnostics.append(
                error(
                    c.TRUSTED_CSS_VARS_DENIED,
                    "trusted_style.css_vars require policy.allow_trusted_css_vars=True",
                    f"blocks.{block.id}.trusted_style",
                )
            )
    return diagnostics


def _serializable_leaves(value: object, path: str) -> list[GridViewDiagnostic]:
    """Recurse into a spec value and flag any non-JsonValue leaf (callable/ORM/object)."""
    diagnostics: list[GridViewDiagnostic] = []
    if value is None or isinstance(value, bool | int | float | str):
        return diagnostics
    if callable(value):
        diagnostics.append(
            error(
                c.NON_SERIALIZABLE_VALUE,
                f"callable value at {path} is not JSON-serializable",
                path,
            )
        )
        return diagnostics
    if is_dataclass(value):
        for field in fields(value):
            diagnostics.extend(
                _serializable_leaves(getattr(value, field.name), f"{path}.{field.name}")
            )
        return diagnostics
    if is_wire_mapping(value):
        for key, item in value.items():
            diagnostics.extend(_serializable_leaves(item, f"{path}.{key}"))
        return diagnostics
    if is_object_list(value):
        for index, item in enumerate(value):
            diagnostics.extend(_serializable_leaves(item, f"{path}[{index}]"))
        return diagnostics
    if is_object_tuple(value):
        for index, item in enumerate(value):
            diagnostics.extend(_serializable_leaves(item, f"{path}[{index}]"))
        return diagnostics
    # Any other object (ORM instance, non-str-keyed dict, arbitrary class) is rejected.
    diagnostics.append(
        error(
            c.NON_SERIALIZABLE_VALUE,
            f"non-serializable {type(value).__name__} value at {path}",
            path,
        )
    )
    return diagnostics


def _check_serializable(spec: GridViewSpec) -> list[GridViewDiagnostic]:
    """Reject callables, ORM objects, or other non-JsonValue leaves anywhere in the spec."""
    return _serializable_leaves(spec, "spec")


def _check_block_refs(
    spec: GridViewSpec,
    index: dict[str, GridViewBlock],
    area_ids: set[str],
) -> list[GridViewDiagnostic]:
    diagnostics: list[GridViewDiagnostic] = []
    for block in iter_all_blocks(spec):
        if block.type not in BLOCK_TYPES:
            diagnostics.append(
                error(
                    c.INVALID_BLOCK_TYPE,
                    f"unknown block type {block.type!r}",
                    f"blocks.{block.id}.type",
                )
            )
        for field_name, ref_id in block_ref_fields(block):
            if ref_id not in index:
                diagnostics.append(
                    error(
                        c.MISSING_BLOCK_REF,
                        f"{field_name} references unknown block id {ref_id!r}",
                        f"blocks.{block.id}.{field_name}",
                    )
                )
        if isinstance(block, GridViewHeader) and block.content:
            target = index.get(block.content)
            if target is not None and not is_template_block(target):
                diagnostics.append(
                    error(
                        c.INVALID_HEADER_CONTENT,
                        "header.content must reference a template block",
                        f"blocks.{block.id}.content",
                    )
                )
        if isinstance(block, GridViewTabs):
            for tab in block.tabs:
                diagnostics.extend(_check_tab(tab, block.id, index, area_ids))
        if isinstance(block, GridViewOverlay):
            diagnostics.extend(_check_overlay(block, index))
        if isinstance(block, GridViewToolbar) and block.filters:
            diagnostics.extend(_check_filters_target_match(block.filters, index, block))
        if isinstance(block, GridViewToolbar) and block.target:
            target_block = index.get(block.target)
            if target_block is None:
                diagnostics.append(
                    error(
                        c.INVALID_BLOCK_TARGET,
                        f"toolbar.target {block.target!r} not found",
                        f"blocks.{block.id}.target",
                    )
                )
            elif not isinstance(target_block, GridViewTable):
                diagnostics.append(
                    error(
                        c.INVALID_BLOCK_TARGET,
                        f"toolbar.target {block.target!r} is not a table",
                        f"blocks.{block.id}.target",
                    )
                )
        if isinstance(block, GridViewFilters) and block.target:
            target_block = index.get(block.target)
            if target_block is None:
                diagnostics.append(
                    error(
                        c.INVALID_BLOCK_TARGET,
                        f"filters.target {block.target!r} not found",
                        f"blocks.{block.id}.target",
                    )
                )
            elif not isinstance(target_block, (GridViewTable, GridViewCharts)):
                diagnostics.append(
                    error(
                        c.INVALID_BLOCK_TARGET,
                        f"filters.target {block.target!r} is not a table or chart",
                        f"blocks.{block.id}.target",
                    )
                )
        for action in iter_actions(block):
            if isinstance(action, GridViewOverlayAction) and action.overlay not in index:
                diagnostics.append(
                    error(
                        c.INVALID_ACTION_TARGET,
                        f"overlay action references unknown overlay {action.overlay!r}",
                        f"blocks.{block.id}.actions.{action.id}.overlay",
                    )
                )
            if (
                isinstance(action, GridViewExportAction)
                and action.target
                and action.target not in index
            ):
                diagnostics.append(
                    error(
                        c.INVALID_ACTION_TARGET,
                        f"export action target {action.target!r} not found",
                        f"blocks.{block.id}.actions.{action.id}.target",
                    )
                )
            if (
                isinstance(action, GridViewLinkAction)
                and action.target
                and action.target not in index
            ):
                diagnostics.append(
                    error(
                        c.INVALID_ACTION_TARGET,
                        f"link action target {action.target!r} not found",
                        f"blocks.{block.id}.actions.{action.id}.target",
                    )
                )
            for field_name, ref_id in collect_action_targets(action):
                if field_name == "overlay" and ref_id not in index:
                    continue
                if field_name == "target" and ref_id and ref_id not in index:
                    diagnostics.append(
                        error(
                            c.INVALID_ACTION_TARGET,
                            f"action target {ref_id!r} not found",
                            f"blocks.{block.id}.actions.{action.id}.target",
                        )
                    )
    return diagnostics


def validate_spec(spec: GridViewSpec, *, policy: GridViewPolicy | None = None) -> GridViewResult:
    active_policy = policy or GridViewPolicy()
    index = build_block_index(spec)
    area_ids = collect_area_ids(spec.layout.root)
    diagnostics: list[GridViewDiagnostic] = []
    diagnostics.extend(_check_duplicate_ids(spec))
    diagnostics.extend(_check_layout_refs(spec, index))
    diagnostics.extend(_check_block_refs(spec, index, area_ids))
    diagnostics.extend(_check_search_xor(spec, index))
    diagnostics.extend(_check_filter_states(spec))
    diagnostics.extend(_check_chart_options(spec, active_policy))
    diagnostics.extend(_check_renderers(spec, active_policy))
    diagnostics.extend(_check_table_edit(spec))
    diagnostics.extend(_check_table_settings(spec))
    diagnostics.extend(_check_media_sources(spec))
    diagnostics.extend(_check_form_rules(spec, active_policy))
    diagnostics.extend(_check_trusted_css_vars(spec, active_policy))
    diagnostics.extend(_check_serializable(spec))
    ok = not any(d.severity == "error" for d in diagnostics)
    return GridViewResult(ok=ok, spec=spec, diagnostics=tuple(diagnostics))
