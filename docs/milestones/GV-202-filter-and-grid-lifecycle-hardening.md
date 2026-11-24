---
id: GV-202
title: In-place facet routing, parallel refresh, and grid lifecycle hardening
doc_type: contract
repository: grid-view-spec
project: gridviewspec
status: completed
owners:
- src/grid_view_spec/types/filters_v2.py
- src/grid_view_spec/wire_decode.py
- schema/grid-view-spec.v2.json
- src/grid_view_spec/schema/grid-view-spec.v2.json
- src/grid_view_spec/templates/grid_view/spec/
- frontend/src/grid-view/
- frontend/src/ag-grid/
- frontend/src/runtime/
- frontend/src/types/generated/grid-view-spec.ts
- tests/
- docs/filtering/facets.md
invariants:
- 'INV-FACET-SCOPE: Only transitions changing declared facet_params trigger HTML facet refresh (when facet_params is omitted on facets=True, all non-settings/all bar transitions refresh per default compatibility); non-facet filters and display-settings controls outside facet_params reload table state without an HTML fetch.'
- 'INV-FACET-ENDPOINT: When facets_endpoint is configured on GridViewFilters, in-place facet reconciliation fetches that lightweight fragment URL instead of re-rendering the full host page.'
- 'INV-FACET-DEDUP: Text and numeric filter inputs ([data-cm-filter-input]) commit at most once per distinct value change; pressing Enter followed by blur with no intermediate edit emits a single filter-change transition.'
- 'INV-FACET-CARDS: In-place reconciliation supports adding and removing optional filter cards in the live workspace without tearing down unchanged cards, scroll offsets, or triggering a full-page reload.'
- 'INV-HISTORY-PRESERVE: History URL updates via replaceState merge onto existing window.history.state so neither spec restoration metadata (cmFilterSpecId) nor host HTMX history entries are discarded.'
- 'INV-GRID-LIFECYCLE: Toolbar Clear-All, agGrid toolbar search, workspace card/global searches, and async AG-Grid boot timers uphold single-owner state synchronization across HTMX swaps and active grid generations.'
depends_on: []
---

# In-place facet routing, parallel refresh, and grid lifecycle hardening

## Outcome and purpose

[GV-201](archive/GV-201-faceted-filter-refresh.md) introduced `facets_refresh_mode="in_place"`, but live integration on complex multi-panel workspaces surfaced eight concrete contract and runtime defects in `grid-view-spec`:

1. **Unconditional facet HTML refreshes (`filter-bar.ts`, `types/filters_v2.py`)**: Every control inside a faceted workspace drawer — including display-settings controls (`panel="settings"`) and pure query filters (price bounds, stock/sale booleans, status) — triggers a full-page HTML `fetch(pageUrl)` and blocks the table reload until SSR finishes.
2. **Double submission on `Enter` + `blur` (`filter-bar.ts`)**: `bindFilterControlListeners` binds both `keydown("Enter")` and `change` on `[data-cm-filter-input]` without tracking committed values, dispatching duplicate filter changes when a user presses `Enter` and blurs the input.
3. **Full-page navigation fallback on dynamic cards (`filter-bar.ts`, `filter-drawer-workspace.ts`)**: `prepareFacetReconciliation` rejects any change in `[data-cm-filter-card]` count or IDs (`"Facet response changes the filter cards"`), forcing a full `window.location.href` page reload; `bindTree` binds `[data-cm-filter-tree-toggle]` only once instead of delegating dynamically on the workspace root.
4. **Destructive `window.history.replaceState` calls (`ag-grid/host.ts`, `filter-bar.ts`, `column-filters.ts`, `actions.ts`, `simple-table.ts`)**: Nine call sites pass `{}` or `null` as the history state object, overwriting `cmFilterSpecId` and breaking `popstate` spec restoration as well as host HTMX history metadata.
5. **Toolbar `Clear all` multi-bar and settings bugs (`actions.ts`)**: `clearAllFilters` resolves only the first matching `[data-cm-filter-bar]`, unchecks `data-cm-filter-display-setting="1"` checkboxes blindly, ignores `data-navigate-on-change="0"`, and skips workspace chrome counter synchronization.
6. **AG-Grid toolbar search bypasses facets (`filter-bar.ts`, `ag-grid/host.ts`)**: Inputs with `data-cm-search-backend="ag_grid"` trigger `onQuickFilterChanged` / `reloadData` directly even on `data-cm-facets="1"` pages, leaving facet counts out of sync with `?q=...`.
7. **Workspace search vs card search `hidden` collisions (`filter-drawer-workspace.ts`)**: `bindWorkspaceSearch` and `bindCardSearch` mutate the same `option.hidden` attribute directly; clearing one search reveals options hidden by the other.
8. **AG-Grid polling timer race (`runtime/table-ag-grid.ts`)**: When `window.agGrid` finishes loading asynchronously, the `setInterval(..., 50)` callback in `bootFromSpecConfig` does not check `isCurrent()`, allowing a superseded HTMX swap generation to initialize a stale grid.

## Tasks in this milestone

### task: facet-routing-and-parallel-refresh

Fixes Defects 1, 2, and 3 cleanly at the package contract and runtime boundary (synchronous ordering before table reload is preserved when `facets_endpoint` updates dependent options so dependent option assertions never race table rows).

```yaml
task_ref: facet-routing-and-parallel-refresh
target: |
  Add optional facet_params: tuple[str, ...] = () and facets_endpoint: str = "" to GridViewFilters, JSON schemas, wire decoder, templates, and generated TypeScript types. Skip in-place HTML facet fetches whenever declared facet_params are unchanged in the URL, routing directly to history state update and table reload. Support lightweight fragment responses from facets_endpoint, deduplicate Enter followed by unchanged blur on [data-cm-filter-input], support dynamic addition/removal of filter cards in prepareFacetReconciliation without full-page fallback, and delegate tree toggles in filter-drawer-workspace.ts.
scope:
- src/grid_view_spec/types/filters_v2.py
- schema/grid-view-spec.v2.json
- src/grid_view_spec/schema/grid-view-spec.v2.json
- src/grid_view_spec/wire_decode.py
- frontend/src/types/generated/grid-view-spec.ts
- src/grid_view_spec/templates/grid_view/spec/_filter_bar.html
- src/grid_view_spec/templates/grid_view/spec/_filter_drawer_workspace.html
- frontend/src/grid-view/filter-bar.ts
- frontend/src/grid-view/filter-drawer-workspace.ts
- tests/test_gridviewspec_roundtrip.py
- tests/test_gridviewspec_render_html.py
- tests/test_gridviewspec_facets_browser.py
- docs/filtering/facets.md
depends_on: []
```

### task: clear-all-and-workspace-search-coordination

Fixes Defects 5, 6, and 7.

```yaml
task_ref: clear-all-and-workspace-search-coordination
target: |
  Update clearAllFilters in actions.ts to reset all bars targeting the grid while preserving [data-cm-filter-display-setting="1"] controls, honoring data-navigate-on-change, and updating workspace chrome counts. Route [data-cm-search-backend="ag_grid"] toolbar search through faceted refresh when specWantsFacets is true. Compose workspace-level and card-level option visibility predicates independently in filter-drawer-workspace.ts so clearing one search preserves constraints from the other.
scope:
- frontend/src/grid-view/actions.ts
- frontend/src/grid-view/filter-bar.ts
- frontend/src/grid-view/filter-drawer-workspace.ts
- tests/test_gridviewspec_facets_browser.py
depends_on:
- facet-routing-and-parallel-refresh
```

### task: history-state-and-grid-generation-safety

Fixes Defects 4 and 8.

```yaml
task_ref: history-state-and-grid-generation-safety
target: |
  Introduce a shared replaceUrlPreservingState helper in dom-utils.ts and replace all direct window.history.replaceState({}, ...) and replaceState(null, ...) calls across host.ts, filter-bar.ts, column-filters.ts, actions.ts, and simple-table.ts so window.history.state (cmFilterSpecId and host state) is never discarded. Cancel pending window.agGrid polling intervals and validate isCurrent() before async grid initialization in table-ag-grid.ts.
scope:
- frontend/src/grid-view/dom-utils.ts
- frontend/src/ag-grid/host.ts
- frontend/src/grid-view/filter-bar.ts
- frontend/src/grid-view/column-filters.ts
- frontend/src/grid-view/actions.ts
- frontend/src/grid-view/simple-table.ts
- frontend/src/runtime/table-ag-grid.ts
- tests/test_gridviewspec_facets_browser.py
depends_on: []
```
