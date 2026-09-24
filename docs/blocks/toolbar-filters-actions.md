# Toolbar, filters, and actions

## GridViewToolbar

Always a **layout block** — never embedded inside the table template.

```python
GridViewToolbar(
    id="records_toolbar",
    target="records_table",  # None = page-wide
    search=GridViewSearch(param="q", placeholder="Search…"),
    filters="page_filters",
    counters=(GridViewCounter(id="row_count", label="rows", value=0),),
)
```

```python
from grid_view_spec.types.toolbar import GridViewSearch, GridViewCounter
```

| Field | Role |
|-------|------|
| `target` | Table block id for bound search/export, or `None` for page chrome |
| `search` | Single `GridViewSearch` (XOR per table) |
| `filters` | `GridViewFilters` block id |
| `clear_all` | Show the built-in “clear all filters and search” toolbar action for the target table |

## GridViewFilters

Filter bar schema and state. Scope via `target`:

- `None` — page-wide filters
- block id — filters scoped to one table/chart block

Charts may reference the same filters block id for documentation/validation; the host still supplies filtered `data` in `page_data`.

| Field | Role |
|------|------|
| `presentation` | `toolbar` \| `inline` \| `panel` \| `drawer` |
| `schema` | Tuple of `GridViewFilter` (id, label, param, type, scope, options, …) |
| `state` | `GridViewFilterState` — current selection (`{param: value}`) |
| `target` | `None` (page-wide) or a block id (scoped) |
| `auto_apply` | Submit on change (default `True`) |
| `navigate_on_change` | Navigate the URL on change instead of an in-place fragment (default `True`) |
| `facets` | Recompute each filter's options + counts on the currently filtered table (exclude-own). See [Faceted filtering](../filtering/facets.md) |
| `fragment_endpoint` | HTMX URL that re-renders the spec (bar + table) with counted options when `facets=True` |
| `fragment_target` | CSS selector for the fragment swap target |
| `fragment_swap` | HTMX swap strategy (default `outerHTML`) |
| `drawer_layout` | `compact` (default) or `workspace` |
| `drawer_sections` | Ordered visual groups for a `workspace` drawer |

`presentation="drawer"` renders the filter block as a persistent, resizable
sidebar with a bounded scroll area and in-drawer filter search. The drawer's
collapsed state, width, and active `Filters`/`Column settings` tab are stored
through the owning spec's `GridView.PageState` namespace; filter values remain
URL state. When the filter has a table `target`, the `Column settings` tab
mounts that table's shared settings controls in the drawer. The package owns
presentation and browser preferences, while the host owns the filter schema and
query semantics.

`drawer_layout="workspace"` groups the same canonical schema into persistent
cards. Each `GridViewFilterDrawerSection` names its `filter_ids`, `panel`
(`"filters"` by default or `"settings"`), optional search support, and bounded
list size. A workspace must assign every schema filter exactly once across both
panels; it does not introduce a second filter state or a host-side JavaScript
adapter. `panel="settings"` is for display choices that still use the same URL
state. Its tree state, drawer size, active tab, column order, visibility, pins,
and named column presets use the normal `GridView.PageState` namespace; values
continue to use the URL.

The workspace runtime and stylesheet are optional assets. Django marks them from
the rendered Spec before the document head is emitted; pages without a workspace
drawer receive neither bundle. Asset URLs carry the installed bundle-set version,
so a rebuilt package cannot reuse a stale browser script or stylesheet. If a
workspace arrives later in an HTMX fragment, the core runtime loads the same
bundle on demand.

Use `type="grouped_select"` when one query parameter represents one selected
option in each named group — for example, a price tier per supplier. Each
top-level `GridViewFilterOption` is the group label and its `children` are the
selectable options. The browser serializes those child values as CSV under the
single `param`; groups with no children are not rendered. It is a server-side
query control, not a table-column preference: table visibility remains owned by
the target table's existing settings.

`GridViewFilterOption` carries `count` (`int | None`) and `disabled` (`bool`) for facet
counts — set by the host facet computation, not by authors. See
[Faceted filtering](../filtering/facets.md).

## GridViewActions

Export buttons, links, and commands:

```python
GridViewActions(
    id="page_actions",
    items=(
        GridViewExportAction(format="xlsx", params={"builder": "orders"}),
        GridViewButtonAction(label="Refresh", action="reload_table", target="orders_table"),
    ),
)
```

Export actions use `GridViewExportAction` with `params.builder` or default to `spec.id`.

`GridViewSelectAction` presents a native option selector and its submit button. Its inherited
`disabled` flag disables both controls, so the host can keep a batch action unavailable until
the current selection or permission state allows it:

```python
from grid_view_spec.types.actions import GridViewSelectAction, GridViewSelectOption
```

```python
GridViewSelectAction(
    id="bulk_status",
    label="Bulk status",
    action="set_status",
    button_label="Apply",
    disabled=True,
    options=(
        GridViewSelectOption(value="active", label="Active"),
        GridViewSelectOption(value="paused", label="Paused"),
    ),
)
```

See [Export](../export/page-pattern.md).
