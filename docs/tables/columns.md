# Columns and renderers

```python
GridViewColumn(
    id="status",
    label="Status",
    field="status",
    type="text",
    renderer="badge",
    align="center",
    sortable=True,
    searchable=True,
    filter=GridViewFilter(type="set", options=...),
    hidden=False,
    pinned="",
    extra={"variant_field": "status_variant"},
)
```

## Built-in renderers

| Id | Use |
|----|-----|
| `badge`, `tag` | Status chips |
| `link` | URL column |
| `money` | Currency formatting |
| `progress` | Progress bar |
| `date`, `boolean` | Typed display |
| `image`, `thumbnail` | Resolved URLs in row data |

Register custom renderers in host JS: `GridView.registerRenderer(name, fn)`.

For a currency column, `currency_formatter` defines the locale, fallback currency,
precision, empty value, and strict amount parsing. A row may provide
`<field>_currency` (for example `price_currency: "USD"`) to select that cell's
currency without changing its raw numeric `price`. Missing row metadata uses
the configured currency; invalid explicit metadata renders `empty_value`.
`precision_by_currency` can override precision for named currencies, and
`symbol_colors` can optionally color their symbols using hex colors. GVS has
no default currency colors. AG Grid and Simple Table use the same row convention;
sort and export continue to use the raw amount. Custom AG renderers can call
`GridView.formatCurrencyParts(value, formatterConfig, rowCurrency)` to obtain
plain-text `[prefix, symbol, suffix, color]` parts and must escape them before
placing them in HTML.

```python
from grid_view_spec import CurrencyFormatter
from grid_view_spec.types import GridViewColumn

GridViewColumn(
    id="price",
    label="Price",
    field="price",
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

## Dynamic columns

```python
GridViewTable(
    column_source=GridViewColumnSource(
        endpoint="/api/columns/price-tiers/",
        depends_on=("region",),
        anchor="base_price",
    ),
)
```

The endpoint returns `{"columns": [{"id": "tier_retail", "label": "Retail", "field": "retail"}]}`.
Values in `depends_on` are copied from page state into the request query; `params` adds
constant query values. `anchor` inserts the returned columns after the named base column;
when the anchor is absent, the columns are appended.

Dynamic column ids must be **stable** so presets survive filter changes. On refresh, the
runtime retains live width, visibility, pin, and order state for surviving ids, inserts
new ids in the refreshed definition order, and drops ids no longer returned. The host
owns the endpoint and its data authorization.

## Column groups

```python
GridViewTable(
    header=GridViewTableHeader(
        groups=(GridViewColumnGroup(id="q1", label="Q1", columns=("jan", "feb", "mar")),),
        groups_order=("q1",),
    ),
)
```

Settings modal treats each group as one unit for show/hide and reorder.
