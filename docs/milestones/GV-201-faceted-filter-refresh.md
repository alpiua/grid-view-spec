---
id: GV-201
title: In-place faceted filter refresh
doc_type: contract
repository: grid-view-spec
project: gridviewspec
status: active
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
started_at: 2026-10-20T22:42:39+00:00
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
proof_policy: seam-test-first
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
- .forge/acdd/profile.yaml
status: completed
receipt:
  contract_revision: 4
  passed_at: 2026-10-21T20:06:05.416099240+00:00
  evidence:
    command_proof:
      command: uv run --all-packages pytest -q
      exit_code: 0
      tests_passed: 563
      tests_failed: 0
  review:
    review_proof:
      decision: pass
      contours:
        paths:
          applicable: true
          evidence: All 18 admitted files match frozen snapshot 77409e279bd29fb433802fdd1ac7a6ef5a1d2d62 by git object hash. Current working diff has only four scoped source and test paths plus the Forge generated milestone reopen projection. Schema mirrors are byte identical; no untracked or staged paths.
        claims:
          applicable: true
          evidence: Types, wire decoder, JSON schema, generated TypeScript, both templates and bundled runtime implement default spec and explicit in_place requiring facets. filter-bar.ts fetches authoritative same-origin full page spec, validates matching bars, reconciles changing controls, counts and selected states, and emits one completion event. table-ag-grid.ts resolves dynamic columns then reloads once. Production-bundle Chromium seam covers latest-only requests, both drawer panels, stable search and scroll, dynamic controls, Back, Forward, Reset and navigation fallback. Mandatory ci-gate passed archive 515ce625b04428cd; exact registered pytest 563 passed archive b45b3a638f5f000f.
        concurrency:
          applicable: true
          evidence: filter-bar.ts cancels prior AbortController and fences response and reconcile by facetRefreshGeneration. AG Grid listener fences asynchronous column resolution with filterGeneration before one row reload. Browser seam races d1 and d2 responses, checks latest d2 only, and checks one accepted row refresh per navigation. No task database or receipt mutation in candidate.
        project_isolation:
          applicable: true
          evidence: Refresh checks same-origin URL, finds response spec by live stable spec ID and drawer by drawer ID plus target, and rejects ambiguous or mismatched workspaces before reconciliation. Reviewed only dedicated GV-201 worktree; candidate contains no neighboring project paths or traversal handling changes.
        administration:
          applicable: true
          evidence: Profile file unchanged against task baseline, no migration, credential, or hook edits. Mirrored JSON schemas match. Generated JS and min bundle are in the frozen candidate, and mandatory ci-gate passed formatting, Ruff, BasedPyright, pytest, ESLint, frontend typechecks and generated type checks. Forge delivery receipt and Git commit remain the next stage.
  decision: pass
  rollup:
    verified_invariants:
    - 'INV-FACET-DEFAULT: GridViewFilters.facets_refresh_mode defaults to spec. Existing callers retain whole-spec facet refresh unless they explicitly opt into in_place.'
    - 'INV-FACET-OWNER: GVS transports filter refresh mode and preserves the host-owned filter schema, option computation, counts, row query, and exclude-own facet semantics. GVS adds no domain-specific facet or column meaning.'
    - 'INV-FACET-IN-PLACE: An opted-in faceted refresh keeps the live filter drawer, cards, list/search controls, and scroll containers. It reconciles server-returned dependent control options, counts, selected values, and disabled state in place, then refreshes the table data once through the registered AG Grid path.'
    - 'INV-FACET-URL: Filter changes and Reset push the resulting URL once. Back and Forward refresh from the current URL without adding a history entry. Dynamic column refresh reads that same current filter state.'
    - 'INV-FACET-RACE: Only the latest filter navigation may reconcile controls or trigger the table refresh. An obsolete success or failure has no visible effect.'
    - 'INV-FACET-FAILURE: An authoritative refresh request, response, or reconciliation failure falls back to a full navigation at the current URL before partial state is applied. Row-source and column-source failures keep their existing behavior.'
    - INV-FACET-PROFILE
    architectural_notes: []
    review_summary:
      decision: pass
      contours:
        administration: accepted
        claims: accepted
        concurrency: accepted
        paths: accepted
        project_isolation: accepted
```
