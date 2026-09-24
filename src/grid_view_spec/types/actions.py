from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from grid_view_spec.types.block_base import GridViewBlockBase
from grid_view_spec.types.json import JsonObject, empty_json_map
from grid_view_spec.types.semantic import GridViewActionVariant, GridViewSemanticTone

GridViewActionsPresentation = Literal["inline", "menu", "split", "compact"]
GridViewExportFormat = Literal["pdf", "xlsx", "csv"]
GridViewHttpMethod = Literal["get", "post"]
GridViewConfirmTone = Literal["default", "primary", "warning", "danger"]

GRIDVIEW_ACTIONS_PRESENTATIONS: frozenset[GridViewActionsPresentation] = frozenset(
    {"inline", "menu", "split", "compact"}
)
GRIDVIEW_EXPORT_FORMATS: frozenset[GridViewExportFormat] = frozenset({"pdf", "xlsx", "csv"})
GRIDVIEW_HTTP_METHODS: frozenset[GridViewHttpMethod] = frozenset({"get", "post"})
GRIDVIEW_CONFIRM_TONES: frozenset[GridViewConfirmTone] = frozenset(
    {"default", "primary", "warning", "danger"}
)


@dataclass(frozen=True, slots=True, kw_only=True)
class GridViewConfirmConfig:
    title: str = "Confirmation"
    message: str = ""
    tone: GridViewConfirmTone = "default"
    confirm_text: str = "Confirm"
    cancel_text: str = "Cancel"
    close_on_backdrop: bool = True


@dataclass(frozen=True, slots=True, kw_only=True)
class GridViewActionBase:
    id: str
    type: str
    label: str = ""
    icon: str = ""
    variant: GridViewActionVariant = "default"
    tone: GridViewSemanticTone = ""
    target: str = ""
    disabled: bool = False
    reason: str = ""
    params: JsonObject = field(default_factory=empty_json_map)
    confirm: GridViewConfirmConfig | str | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class GridViewExportAction(GridViewActionBase):
    type: Literal["export"] = "export"
    format: Literal["pdf", "xlsx", "csv"] = "xlsx"
    endpoint: str = ""
    include_state: bool = True


@dataclass(frozen=True, slots=True, kw_only=True)
class GridViewOverlayAction(GridViewActionBase):
    type: Literal["overlay"] = "overlay"
    overlay: str = ""


@dataclass(frozen=True, slots=True, kw_only=True)
class GridViewLinkAction(GridViewActionBase):
    type: Literal["link"] = "link"
    href: str = ""
    method: Literal["get", "post"] = "get"


@dataclass(frozen=True, slots=True, kw_only=True)
class GridViewButtonAction(GridViewActionBase):
    type: Literal["button"] = "button"
    action: str = ""


@dataclass(frozen=True, slots=True, kw_only=True)
class GridViewSelectOption:
    value: str | int
    label: str


@dataclass(frozen=True, slots=True, kw_only=True)
class GridViewSelectAction(GridViewActionBase):
    type: Literal["select"] = "select"
    action: str = ""
    button_label: str = ""
    options: tuple[GridViewSelectOption, ...] = ()
    default: str | int | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class GridViewMenuAction(GridViewActionBase):
    type: Literal["menu"] = "menu"
    items: tuple[GridViewAction, ...] = ()


GridViewAction = (
    GridViewExportAction
    | GridViewOverlayAction
    | GridViewLinkAction
    | GridViewButtonAction
    | GridViewSelectAction
    | GridViewMenuAction
)


@dataclass(frozen=True, slots=True, kw_only=True)
class GridViewActions(GridViewBlockBase):
    type: Literal["actions"] = "actions"
    presentation: GridViewActionsPresentation = "inline"
    items: tuple[GridViewAction, ...] = ()
