# KPI and charts

Values come from Python `rows` via dynamic aggregation, or from explicit server-side `value` in `KpiSpec`.

## GridViewKpi

### Row Aggregation Mode
Computes metrics dynamically from dataset rows:
```python
GridViewKpi(
    id="summary_kpi",
    items=(
        KpiSpec(label="Total Revenue", column_key="amount", aggregate="sum", format="currency"),
        KpiSpec(label="Order Count", column_key="id", aggregate="count"),
    ),
    presentation="strip",  # strip | cards | compact
)
```

### Explicit Server-Side Value Mode
For paginated or server-side grids (e.g. AG Grid infinite scroll) where stats are precomputed in SQL:
```python
GridViewKpi(
    id="stats_kpi",
    items=(
        KpiSpec(label="Total Products", value=4797, icon="📦", tone="default"),
        KpiSpec(label="Warehouse Stock", value=44412, icon="🏭", tone="default"),
        KpiSpec(label="Pending Matches", value=128, icon="⚡", tone="warning"),
    ),
    presentation="strip",
)
```
When `value` is provided, it is formatted using `format` and rendered directly without iterating over `rows`.

## GridViewCharts

```python
GridViewCharts(
    id="trend_charts",
    charts=(
        GridViewChart(
            id="monthly",
            type="bar",
            title="By month",
            x="month",
            y=("amount",),
            data=(),  # filled by host from rows
        ),
    ),
    presentation="grid",
    filters="page_filters",  # optional — same filter block id as toolbar
)
```

Host base template must load ECharts:

```django
<script src="{{ echarts_cdn_url }}"></script>
```

Optional charts filter reference documents intent; host still supplies filtered `data` in `page_data`.

## AG-Grid KPI strip

Filtered KPI strip can bind to a live grid adapter:

```javascript
GridView.bindGridKpis({ gridAdapter: GridView.createAgGridAdapter(gridApi) });
```
