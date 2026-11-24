"""Filter block types, state models, and wire decoders for GridViewSpec v2 filters."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, TypeAlias, TypedDict, TypeGuard

from grid_view_spec.types.block_base import GridViewBlockBase
from grid_view_spec.types.json import JsonObject, empty_json_map
from grid_view_spec.types.wire import is_object_list, is_wire_mapping

FilterMatch = Literal["exact", "any_token"]

FILTER_MATCH_VALUES: frozenset[FilterMatch] = frozenset({"exact", "any_token"})


class SetFilterModelMode(TypedDict):
    mode: Literal["empty", "non_empty"]
    match: FilterMatch


class SetFilterModelWithValues(TypedDict):
    values: list[str]
    match: FilterMatch


SetFilterModel = SetFilterModelMode | SetFilterModelWithValues

GridViewFilterType = Literal[
    "text",
    "number",
    "number_range",
    "select",
    "grouped_select",
    "multiselect",
    "set",
    "date",
    "date_range",
    "boolean",
]

GridViewFilterScope = Literal["server", "client"]
GridViewFiltersPresentation = Literal["toolbar", "inline", "panel", "drawer"]
GridViewFiltersFacetsRefreshMode = Literal["spec", "in_place"]
GridViewFilterDrawerLayout = Literal["compact", "workspace"]
GridViewFilterDrawerControl = Literal["default", "checklist", "tree", "range", "toggle"]
GridViewFilterDrawerListSize = Literal["sm", "md", "lg"]
GridViewFilterDrawerPanel = Literal["filters", "settings"]

GridViewFilterValue: TypeAlias = str | int | float | bool | tuple[str, ...] | SetFilterModel

GRIDVIEW_FILTER_TYPES: frozenset[GridViewFilterType] = frozenset(
    {
        "text",
        "number",
        "number_range",
        "select",
        "grouped_select",
        "multiselect",
        "set",
        "date",
        "date_range",
        "boolean",
    }
)
GRIDVIEW_FILTER_SCOPES: frozenset[GridViewFilterScope] = frozenset({"server", "client"})
GRIDVIEW_FILTERS_PRESENTATIONS: frozenset[GridViewFiltersPresentation] = frozenset(
    {"toolbar", "inline", "panel", "drawer"}
)
GRIDVIEW_FILTERS_FACETS_REFRESH_MODES: frozenset[GridViewFiltersFacetsRefreshMode] = frozenset(
    {"spec", "in_place"}
)
GRIDVIEW_FILTER_DRAWER_LAYOUTS: frozenset[GridViewFilterDrawerLayout] = frozenset(
    {"compact", "workspace"}
)
GRIDVIEW_FILTER_DRAWER_CONTROLS: frozenset[GridViewFilterDrawerControl] = frozenset(
    {"default", "checklist", "tree", "range", "toggle"}
)
GRIDVIEW_FILTER_DRAWER_LIST_SIZES: frozenset[GridViewFilterDrawerListSize] = frozenset(
    {"sm", "md", "lg"}
)
GRIDVIEW_FILTER_DRAWER_PANELS: frozenset[GridViewFilterDrawerPanel] = frozenset(
    {"filters", "settings"}
)


def is_set_filter_model(value: object) -> TypeGuard[SetFilterModel]:
    """Return ``True`` when ``value`` matches the set-filter wire shape."""
    if not is_wire_mapping(value):
        return False
    match = value.get("match")
    if not isinstance(match, str) or match not in FILTER_MATCH_VALUES:
        return False
    mode = value.get("mode")
    if mode in ("empty", "non_empty"):
        return set(value.keys()) == {"mode", "match"}
    values = value.get("values")
    if is_object_list(values) and all(isinstance(item, str) for item in values):
        return set(value.keys()) == {"values", "match"}
    return False


def decode_filter_value(raw: object) -> GridViewFilterValue:
    """Reconstruct a filter-state value from its wire shape.

    Structural and context-free: the encoded JSON shape fully determines the
    variant, so this is the faithful inverse of encoding (round-trip safe).
    """
    if is_set_filter_model(raw):
        return raw
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return raw
    if is_object_list(raw):
        return tuple(item for item in raw if isinstance(item, str))
    if isinstance(raw, str):
        return raw
    return ""


@dataclass(frozen=True, slots=True)
class GridViewFilterOption:
    value: str
    label: str
    children: tuple[GridViewFilterOption, ...] = ()
    exclusive: bool = False
    meta: JsonObject = field(default_factory=empty_json_map)
    # Faceting: number of rows matching this option in the *currently filtered*
    # table (None when faceting is not computed). ``disabled`` dims/locks an
    # option that has no matches in the current slice.
    count: int | None = None
    disabled: bool = False


@dataclass(frozen=True, slots=True)
class GridViewSetPresets:
    select_all: bool = True
    empty: bool = False
    non_empty: bool = False
    auto_empty: bool = True


@dataclass(frozen=True, slots=True)
class GridViewFilter:
    id: str
    label: str
    param: str
    type: GridViewFilterType
    scope: GridViewFilterScope = "server"
    options: tuple[GridViewFilterOption, ...] = ()
    options_endpoint: str = ""
    placeholder: str = ""
    select_all: bool = False
    select_all_label: str = ""
    select_all_value: str = "__all__"
    all_exclusive: bool = False
    presets: GridViewSetPresets = field(default_factory=GridViewSetPresets)
    default: GridViewFilterValue | None = None
    drawer_control: GridViewFilterDrawerControl = "default"


@dataclass(frozen=True, slots=True)
class GridViewFilterDrawerSection:
    """A renderer-neutral card in the workspace drawer presentation.

    A section references existing filter ids; it does not introduce a second
    filter state. This keeps query values canonical while allowing hosts to
    compose related controls such as a price range into one card.
    """

    id: str
    label: str
    filter_ids: tuple[str, ...]
    searchable: bool = False
    list_size: GridViewFilterDrawerListSize = "md"
    # Display-only settings (for example a selected supplier price tier) share
    # the canonical query state but belong beside column preferences, not in
    # the active-filter pane.
    panel: GridViewFilterDrawerPanel = "filters"


@dataclass(frozen=True, slots=True)
class GridViewFilterState:
    values: dict[str, GridViewFilterValue] = field(default_factory=dict)


@dataclass(frozen=True, slots=True, kw_only=True)
class GridViewFilters(GridViewBlockBase):
    type: Literal["filters"] = "filters"
    presentation: GridViewFiltersPresentation = "toolbar"
    schema: tuple[GridViewFilter, ...] = ()
    state: GridViewFilterState = field(default_factory=GridViewFilterState)
    target: str | None = None
    auto_apply: bool = True
    navigate_on_change: bool = True
    fragment_endpoint: str = ""
    fragment_target: str = ""
    fragment_swap: str = "outerHTML"
    # Faceting: when True, the host recomputes each filter's options + counts
    # against the currently filtered table, and filter/search changes refresh the
    # whole spec (bar + table) so counts stay in sync. See search/facets.py.
    facets: bool = False
    facets_refresh_mode: GridViewFiltersFacetsRefreshMode = "spec"
    facet_params: tuple[str, ...] = ()
    facets_endpoint: str = ""
    drawer_layout: GridViewFilterDrawerLayout = "compact"
    drawer_sections: tuple[GridViewFilterDrawerSection, ...] = ()
    drawer_search: bool = True

    def __post_init__(self) -> None:
        """Validate the refresh mode and require facets for in-place refresh."""
        if self.facets_refresh_mode not in GRIDVIEW_FILTERS_FACETS_REFRESH_MODES:
            raise ValueError("facets_refresh_mode must be 'spec' or 'in_place'")
        if self.facets_refresh_mode == "in_place" and not self.facets:
            raise ValueError("facets_refresh_mode='in_place' requires facets=True")
        if any(not param.strip() for param in self.facet_params):
            raise ValueError("facet_params entries must be non-empty strings")
        if self.facet_params and not self.facets:
            raise ValueError("facet_params requires facets=True")
        if self.facets_endpoint.strip() and not self.facets:
            raise ValueError("facets_endpoint requires facets=True")
