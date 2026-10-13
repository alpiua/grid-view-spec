---
title: "Python types — public import map"
doc_type: api
---

# Python types — public import map

Import from **`grid_view_spec`** at host boundaries. Do not copy type trees locally.

## Core spec

```python
from grid_view_spec import CurrencyFormatter, GridViewSpec, validate_spec
from grid_view_spec.types import (
    GridViewActions,
    GridViewArea,
    GridViewCard,
    GridViewCards,
    GridViewChart,
    GridViewCharts,
    GridViewColumn,
    GridViewColumnGroup,
    GridViewConfig,
    GridViewContent,
    GridViewCounter,
    GridViewExportAction,
    GridViewField,
    GridViewFilter,
    GridViewFilters,
    GridViewForm,
    GridViewGallery,
    GridViewHeader,
    GridViewImage,
    GridViewImageSource,
    GridViewKpi,
    GridViewLayout,
    GridViewNav,
    GridViewOverlay,
    GridViewSearch,
    GridViewTable,
    GridViewTabs,
    GridViewToolbar,
    JsonScalar,
    JsonValue,
    RowDict,
)
```

## Export

```python
from grid_view_spec.export.registry import (
    GridViewExportJob,
    register_pdf_export,
    register_xlsx_export,
)
from grid_view_spec.export.xlsx import XlsxReport, XlsxSheet
```

Builders: `(GridViewHost, ExportContextLike) → GridViewExportJob`.

## Django backend

```python
from grid_view_spec.backends.django.host import DjangoGridViewHost
from grid_view_spec.backends.django.export import DjangoExportContext
from grid_view_spec.backends.django.ag_grid import (
    InfiniteGridParams,
    parse_infinite_params,
    apply_grid_filters,
    apply_grid_sort,
    parse_active_col_ids,
)
from grid_view_spec.types.ag_grid import AgGridColumnSpec, AgGridPageSpec
from grid_view_spec.backends.django.hrefs import export_pdf_href, export_xlsx_href
from grid_view_spec.backends.django.models import GridPreference
```

## Search (ORM)

```python
from grid_view_spec.backends.django.search import apply_queryset_search
from grid_view_spec.search.smart import parse_smart_query, apply_smart_queryset_search
from grid_view_spec.search.column import parse_column_filters
```

## Render

```python
from grid_view_spec.render import render_grid_view_spec, build_render_context
```

Strict typing: package ships `py.typed`; run `basedpyright --warnings` on host code that constructs specs.

## Currency formatting

Set a `CurrencyFormatter` on a currency column to share locale, precision, and
symbol rules across the Simple Table and AG Grid renderers:

```python
from grid_view_spec import CurrencyFormatter
from grid_view_spec.types import GridViewColumn

total_column = GridViewColumn(
    id="total",
    label="Total",
    field="amount",
    type="currency",
    currency_formatter=CurrencyFormatter(
        currency="UAH",
        locale="uk-UA",
        precision=2,
        precision_by_currency={"JPY": 0},
        symbol_colors={"USD": "#2563eb"},
    ),
)
```

Rows can provide `<field>_currency` (for example, `amount_currency: "USD"`) to
select a currency per cell. See [Columns and renderers](../tables/columns.md).

## Date and time formatting

Use the pure `format_datetime_value` helper to format native date and time
values, ISO strings, or Unix timestamps with an explicit output format, locale,
and timezone:

```python
from grid_view_spec import DateTimeFormatter, format_datetime_value

label = format_datetime_value(
    "2024-03-05T14:05:06Z",
    DateTimeFormatter(format="datetime", locale="uk-UA", timezone="Europe/Kyiv"),
)
```

Naive datetimes are interpreted as UTC. Date-only and time-only values keep
their components; invalid values return `empty_value` unless `strict=True`, in
which case formatting raises `ValueError`.

## Page-state identity

`GridViewConfig.page_state_scope` is an optional string that separates intentional
same-spec contexts in browser-local persistent page state. `GridViewSpec.id` remains
the primary identity.

```python
spec = GridViewSpec(
    id="orders",
    config=GridViewConfig(page_state_scope="comparison"),
    blocks=(...),
)
```

The field changes only the browser page-state identity. It does not configure
`GridPreference`, a server session, or a storage backend. See
[Page state](../persistence/page-state.md).
