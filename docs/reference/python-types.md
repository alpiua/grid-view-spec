# Python types — public import map

Import from **`grid_view_spec`** at host boundaries. Do not copy type trees locally.

## Core spec

```python
from grid_view_spec import GridViewSpec, validate_spec
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
