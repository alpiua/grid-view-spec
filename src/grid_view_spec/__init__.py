"""Framework-agnostic GridViewSpec vNext contract (grid-view-spec 2.x)."""

from importlib.metadata import PackageNotFoundError, version

from grid_view_spec.types import (
    CurrencyFormatter,
    DateTimeFormatter,
    GridViewBlock,
    GridViewSpec,
    GridViewTable,
    GridViewToolbar,
    format_datetime_value,
)
from grid_view_spec.validate import normalize_spec, spec_from_wire, spec_to_wire, validate_spec

try:
    __version__ = version("grid-view-spec")
except PackageNotFoundError:
    __version__ = "2.2.0"

__all__ = [
    "CurrencyFormatter",
    "DateTimeFormatter",
    "GridViewBlock",
    "GridViewSpec",
    "GridViewTable",
    "GridViewToolbar",
    "__version__",
    "format_datetime_value",
    "normalize_spec",
    "spec_from_wire",
    "spec_to_wire",
    "validate_spec",
]
