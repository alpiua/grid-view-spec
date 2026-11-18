---
id: GV-201
title: In-place faceted filter refresh
doc_type: contract
status: completed
closure:
  status: completed
  closed_at: "2026-10-21T20:06:05Z"
  closed_commit: ead24b25d983d5b2bf3c37f9714b25fab3c4a897
owners:
- src/grid_view_spec/types/filters_v2.py
- frontend/src/grid-view/filter-bar.ts
- frontend/src/runtime/table-ag-grid.ts
- src/grid_view_spec/templates/grid_view/spec/
- schema/grid-view-spec.v2.json
- frontend/src/types/generated/grid-view-spec.ts
- tests/
- docs/filtering/facets.md
invariants:
- 'INV-FACET-DEFAULT: GridViewFilters.facets_refresh_mode defaults to spec. Existing callers retain whole-spec facet refresh unless they explicitly opt into in_place.'
- 'INV-FACET-OWNER: GVS transports filter refresh mode and preserves the host-owned filter schema, option computation, counts, row query, and exclude-own facet semantics. GVS adds no domain-specific facet or column meaning.'
- 'INV-FACET-IN-PLACE: An opted-in faceted refresh keeps the live filter drawer, cards, list/search controls, and scroll containers. It reconciles server-returned dependent control options, counts, selected values, and disabled state in place, then refreshes the table data once through the registered AG Grid path.'
- 'INV-FACET-URL: Filter changes and Reset push the resulting URL once. Back and Forward refresh from the current URL without adding a history entry. Dynamic column refresh reads that same current filter state.'
- 'INV-FACET-RACE: Only the latest filter navigation may reconcile controls or trigger the table refresh. An obsolete success or failure has no visible effect.'
- 'INV-FACET-FAILURE: An authoritative refresh request, response, or reconciliation failure falls back to a full navigation at the current URL before partial state is applied. Row-source and column-source failures keep their existing behavior.'
depends_on: []
---

# In-place faceted filter refresh

## Outcome and purpose

Add an explicit `GridViewFilters.facets_refresh_mode` with `spec` and `in_place` values. The default remains `spec`, preserving the current whole-spec fragment replacement for every existing host. Hosts may opt a faceted filter bar into `in_place` when they need table and dependent facet state to refresh without rebuilding the filter drawer.

For an in-place refresh, the current page URL remains authoritative. GVS requests the current full spec from the host, applies the latest response to dependent filter controls without replacing the drawer/list/search containers, and uses the existing AG Grid filter-change path to refresh dynamic columns and rows once. Hosts retain ownership of option and count computation, selected filter normalization, table rows, and column-source results. Exclude-own facet semantics stay unchanged.

Request failures or invalid/mismatched HTML response state use a full-page navigation to the current URL. A stale response is ignored. Back and Forward run the same authoritative refresh from the browser URL without adding history entries. Reset removes active filter parameters and refreshes host defaults.

Commerce adoption is a separate consumer task and is not part of this GVS task. It may opt the stock filter drawer into `in_place` only after this producer contract is available.

## Tasks in this milestone

### task: faceted-filter-in-place-refresh

```yaml
task_ref: faceted-filter-in-place-refresh
target: |
  Add the opt-in facets_refresh_mode: spec|in_place field to GridViewFilters, schema, wire decoding, and generated TypeScript carriers. Preserve spec as the default and reject in_place unless facets is enabled. Render the selected mode on both filter-bar and workspace-drawer roots. For in_place, fetch the host's authoritative current full-spec response, ignore obsolete responses, and reconcile only the matching dependent filter controls/options/counts/selected/disabled state while preserving the live drawer, cards, list/search controls, and scroll containers. After the latest successful reconciliation, dispatch the existing filter-change path once so the current URL state drives dynamic columns and exactly one AG Grid data reload. Apply the same path to Back, Forward, and Reset without duplicate history pushes. On request, response, or reconciliation failure, navigate to the current URL before partially applying state. Keep existing spec-mode behavior and exclude-own facet semantics unchanged. Add a production-browser regression for node identity and scroll preservation, dependent options/counts, one datasource reload with dynamic columns, stale-response ordering, URL/Back/Reset, and full-navigation failure; document the opt-in and failure behavior.
contract_revision: 4
invariants:
- INV-FACET-PROFILE
scope:
- src/grid_view_spec/types/filters_v2.py
- schema/grid-view-spec.v2.json
- src/grid_view_spec/schema/grid-view-spec.v2.json
- src/grid_view_spec/wire_decode.py
- frontend/src/types/generated/grid-view-spec.ts
- src/grid_view_spec/templates/grid_view/spec/_filter_bar.html
- src/grid_view_spec/templates/grid_view/spec/_filter_drawer_workspace.html
- frontend/src/grid-view/filter-bar.ts
- frontend/src/runtime/table-ag-grid.ts
- tests/test_gridviewspec_roundtrip.py
- tests/test_gridviewspec_render_html.py
- tests/test_gridviewspec_facets_browser.py
- src/grid_view_spec/static/grid_view_spec/gridviewspec.js
- src/grid_view_spec/static/grid_view_spec/gridviewspec.min.js
- src/grid_view_spec/static/grid_view_spec/gridviewspec-ag-grid.js
- src/grid_view_spec/static/grid_view_spec/gridviewspec-ag-grid.min.js
- docs/filtering/facets.md
- .acdd/profile.yaml
status: completed
```

> **Historical 0.5 Receipt (`2026-10-21T20:06:05Z`, `contract_revision: 4`):**
> - Command proof: `uv run --all-packages pytest -q` -> exit `0`, `563` passed, `0` failed (archive `b45b3a638f5f000f`; mandatory `ci-gate` archive `515ce625b04428cd`).
> - Review decision: `pass` across `paths` (frozen snapshot `77409e279bd29fb433802fdd1ac7a6ef5a1d2d62`), `claims`, `concurrency`, `project_isolation`, and `administration`.
> - Verified invariants: `INV-FACET-DEFAULT`, `INV-FACET-OWNER`, `INV-FACET-IN-PLACE`, `INV-FACET-URL`, `INV-FACET-RACE`, `INV-FACET-FAILURE`, `INV-FACET-PROFILE`.
