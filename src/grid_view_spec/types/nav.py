from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal
from urllib.parse import urlsplit

from grid_view_spec.types.block_base import GridViewBlockBase
from grid_view_spec.types.json import JsonObject, empty_json_map

GridViewNavPresentation = Literal["breadcrumbs", "tabs", "sidebar", "menu", "back", "tree"]

GRIDVIEW_NAV_PRESENTATIONS: frozenset[GridViewNavPresentation] = frozenset(
    {"breadcrumbs", "tabs", "sidebar", "menu", "back", "tree"}
)


@dataclass(frozen=True, slots=True)
class GridViewNavLevel:
    level: int
    type: str
    label: str = ""
    show_count: bool = False
    count_label: str = ""
    can_have_children: bool = True
    child_type: str | None = None
    selectable: bool = True
    draggable: bool = False
    droppable: bool = False
    accept_drop_types: tuple[str, ...] = ()
    actions: tuple[str, ...] = ()
    extra: JsonObject = field(default_factory=empty_json_map)


@dataclass(frozen=True, slots=True)
class GridViewNavItem:
    id: str
    label: str
    href: str = ""
    icon: str = ""
    active: bool = False
    disabled: bool = False
    count: int | None = None
    type: str = ""
    parent_id: str | None = None
    children: tuple[GridViewNavItem, ...] = ()
    extra: JsonObject = field(default_factory=empty_json_map)

    def __post_init__(self) -> None:
        if (scheme := urlsplit(self.href).scheme) and scheme not in {"http", "https"}:
            raise ValueError("Navigation href scheme must be http or https")


@dataclass(frozen=True, slots=True, kw_only=True)
class GridViewNav(GridViewBlockBase):
    type: Literal["nav"] = "nav"
    presentation: GridViewNavPresentation = "menu"
    items: tuple[GridViewNavItem, ...] = ()
    levels: tuple[GridViewNavLevel, ...] = ()
    search_placeholder: str = ""
    allow_create: bool = False
    saved_searches: bool = False
