# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [2.1.3] — 2026-11-24

### Added

- Declared `facet_params` and `facets_endpoint` on `GridViewFilters` (schemas, wire decoder,
  templates, and generated TypeScript types) so hosts can route in-place facet refreshes to a
  lightweight fragment endpoint and skip HTML fetches for non-facet controls.
- Completed [GV-202](docs/milestones/GV-202-filter-and-grid-lifecycle-hardening.md) lifecycle
  hardening, including `replaceUrlPreservingState` across history updates and dynamic filter card
  add/remove reconciliation without losing card scroll or focus.

### Fixed

- Deduplicated `[data-cm-filter-input]` `Enter` followed by unchanged `blur`, cancelled pending
  650ms multiselect debounce timers on reset/clear, and resynchronized toolbar search inputs across
  `popstate`.
- Coordinated `clearAllFilters` across multiple bars while preserving `display-setting` controls and
  `navigate_on_change="0"`; preserved active search predicates when toggling tree branches in
  workspace drawers and composed workspace vs card searches independently.
- Cleared stale `window.agGrid` polling timers across HTMX swaps and guarded async grid init with
  `isCurrent()`.

## [2.1.2] — 2026-10-20

### Fixed

- Filter navigation records the active spec id in browser history so Back and Forward restore the
  correct grid view.
- AG Grid applies saved browser filters and URL filters during grid creation to avoid a duplicate
  datasource refresh; URL state takes precedence when both are present.

## [2.1.1] — 2026-10-13

### Added

- AG Grid date and datetime columns support `DateTimeFormatter` with escaped
  invalid-value fallbacks and locale-aware rendering.

## [2.1.0]

### Added

- `CurrencyFormatter` configures locale-aware currency formatting for both table
  backends. Per-row currency metadata, currency-specific precision, optional
  symbol colors, strict parsing, and empty-value handling are supported.
- Browser-local `GridView.PageState` namespaces persist page layout and table
  state by `GridViewSpec.id`, with optional `GridViewConfig.page_state_scope`.
- `GridViewGallery` adds a package-owned lightbox with thumbnails, overlay,
  keyboard controls, and optional datasource loading.
- Named view presets can store host-owned `pageState` through `PageStateHooks`;
  existing column-only presets remain supported.

### Changed

- Table adapters migrate supported legacy browser grid keys once, clear the old
  keys, and then persist table state through `GridView.PageState`. Existing
  `GridPreference` data and its server API remain unchanged.
- Charts adapt to light and dark themes and use compact layouts on narrow
  screens.

### Fixed

- Column settings use a viewport-limited dialog width, and toolbar stacking
  keeps idle search below filter panels while focused search and menus remain
  accessible above them.
- Chart renderers handle empty, missing, and custom-bound data without replacing
  valid chart state.

## [2.0.4] — 2026-09-03

### Added & Improved

- Column presets show the active selection and an instructional empty state.
- Toolbar mobile behavior uses a unified 640px breakpoint, with responsive
  filter controls and KPI card sizing.
- Backend views handle an optional request in `api_column_filter_dictionary`.

## [2.0.3] — 2026-08-30

### Documentation & Tooling

- Updated agent skills, repository adapter configuration, portfolio routing,
  and planner documentation.

## [2.0.2] — 2026-08-03

### Fixed

- In a multi-table spec, only the primary simple table now refreshes static charts. A later
  summary table can no longer replace a worklist chart with unrelated or zero-valued rows.

## [2.0.1] — 2026-08-03

### Added

- Faceted toolbar filters, HTMX fragment lifecycle support, browser-local column
  settings, and working overlay actions.
- AG Grid set filters, export-column synchronization, and chart titles.

### Fixed

- Kept Simple Table and AG Grid toolbar/filter state synchronized without a full
  page navigation when an HTMX runtime is present.
- Made dashboard KPI/chart binding deterministic for multi-table layouts.
- Aggregate pie/donut slices by the declared `group_by` key in Python and the
  browser runtime.

## [2.0.0] — 2026-06-11

### Changed

- Published the package as `grid-view-spec`.
- Standardized the public Python module as `grid_view_spec`.
- Consolidated pages, rendering, assets, validation, and export around the typed `GridViewSpec` contract.
- Moved Django integration under `grid_view_spec.backends.django`.
- Updated template tags to `{% load grid_view_spec %}`.
- Shipped PDF/XLSX export through package-owned export pipelines.

[2.0.0]: https://github.com/alpiua/grid-view-spec/releases/tag/v2.0.0
[2.0.1]: https://github.com/alpiua/grid-view-spec/releases/tag/v2.0.1
[2.0.2]: https://github.com/alpiua/grid-view-spec/releases/tag/v2.0.2
[2.0.3]: https://github.com/alpiua/grid-view-spec/releases/tag/v2.0.3
[2.0.4]: https://github.com/alpiua/grid-view-spec/releases/tag/v2.0.4
[2.1.0]: https://github.com/alpiua/grid-view-spec/releases/tag/v2.1.0
[2.1.1]: https://github.com/alpiua/grid-view-spec/releases/tag/v2.1.1
[2.1.2]: https://github.com/alpiua/grid-view-spec/releases/tag/v2.1.2
[2.1.3]: https://github.com/alpiua/grid-view-spec/releases/tag/v2.1.3
