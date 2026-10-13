---
id: GV-001
title: Date and datetime column formatter
doc_type: contract
repository: grid-view-spec
project: gridviewspec
status: active
owners:
- src/grid_view_spec/types/
- src/grid_view_spec/render/
- frontend/src/runtime/renderers/
invariants:
- 'INV-DT-OWNER: DateTimeFormatter and format_datetime_value live in date_time_formatter.py. formatters.py re-exports them and does not implement a second formatter. date-time.ts owns dateTimeRenderer. builtins.ts only imports and registers it.'
- 'INV-DT-VALUES: The pure helper accepts native date, time, and datetime, valid ISO 8601 strings, and finite Unix epoch numbers. abs(value) >= 1e11 selects milliseconds; smaller magnitudes select seconds. Naive native and ISO datetimes are UTC before ZoneInfo projection. Date-only and time-only values keep their components. Date-only as time and time-only as date are invalid.'
- 'INV-DT-DISPLAY: uk-UA and de-DE dates are DD.MM.YYYY. en-US dates are MM/DD/YYYY. Time is 24-hour HH:mm:ss. Datetime joins date and time with one space. Unsupported locales use uk-UA. Instant-bearing iso is offset ISO 8601 in the target timezone, Z for UTC, with at most three fractional digits. Date-only iso is YYYY-MM-DD. Time-only iso is HH:mm:ss. Date-only datetime appends 00:00:00. Time-only datetime is invalid.'
- 'INV-DT-STRICT: None and an empty string return empty_value in both modes. Python strict=True raises ValueError for an invalid value, timezone, or format. strict=False returns empty_value. AG Grid never throws: strict invalid input, a corrupt config, or an invalid timezone renders escaped emptyValue.'
- 'INV-DT-WIRE: GridViewColumn.date_time_formatter is optional. Wire uses snake_case. Absent or null decodes as None. A present malformed formatter fails spec_from_wire with INVALID_WIRE. Currency formatter decode stays unchanged. JSON rows stay RowDict scalars; native temporal objects are accepted only by the pure helper.'
- 'INV-DT-SSR: A configured date or datetime column formats row and footer cells before generic empty handling, so empty_value survives. Unconfigured date cells stay escaped raw values. Currency and inline-edit paths stay unchanged.'
- 'INV-DT-GRID: A configured date or datetime column emits camelCase dateTimeFormatter and selects dateTimeRenderer. An explicit custom renderer stays selected and still receives the config. The unconfigured date builtin stays. Host columnsVar definitions are not rewritten. A hostile empty_value stays inside one inert application/json script and decodes to the original string.'
depends_on: []
started_at: 2026-10-13T02:01:28+00:00
---

# Date and datetime column formatter

## Outcome and purpose

Admit `datetime-formatter`.
Hosts opt in with `GridViewColumn(type="date" | "datetime", date_time_formatter=...)`.
The pure helper, the column wire field, simple-table SSR, and the AG Grid renderer are one formatter.
JSON schemas stay unconstrained column arrays unless a later verification shows a validation mismatch.
No new dependency, database, or row-type expansion is in scope.

## Tasks in this milestone

### task: formatter-value

```yaml
task_ref: formatter-value
target: |
  Add frozen DateTimeFormatter and format_datetime_value in date_time_formatter.py, with format date|datetime|time|iso, locale uk-UA, timezone UTC, empty_value em dash, and strict false. Re-export the type and function from formatters.py and the public package modules. Prove native, ISO, and epoch inputs, the 1e11 cutoff on both signs, UTC-first naive values, the three locale layouts plus uk-UA fallback, component-only datetime and iso rules, and strict ValueError versus non-strict empty_value in tests/test_datetime_formatter.py.
proof_policy: seam-test-first
contract_revision: 1
scope:
- src/grid_view_spec/types/date_time_formatter.py
- src/grid_view_spec/types/formatters.py
- src/grid_view_spec/types/__init__.py
- src/grid_view_spec/__init__.py
- tests/test_datetime_formatter.py
- docs/reference/python-types.md
status: completed
receipt:
  contract_revision: 1
  passed_at: 2026-10-13T02:58:26.552000699+00:00
  evidence:
    command_proof:
      command: uv run pytest
      exit_code: 0
      tests_passed: 535
      tests_failed: 0
  review:
    review_proof:
      decision: pass
      contours:
        paths:
          applicable: true
          evidence: Snapshot c78234f contains exactly six files, all in the task initial scope. The six worktree blobs match c78234f; no out-of-scope tracked files remain modified. The untracked docs/milestones input is separate and is not part of the candidate.
        claims:
          applicable: true
          evidence: 'The unchanged candidate implements the admitted pure formatter contract: native and ISO temporal values, epoch seconds/milliseconds with signed 1e11 cutoff, UTC-first naive datetime handling, requested locale/display and component-only rules, and strict ValueError versus lenient empty_value including invalid timezone/format and Decimal overflow. Tests call the real helper and verify re-exports. The final build gate reports uv run pytest: 535 passed, 14 skipped, 0 failed.'
        concurrency:
          applicable: false
          evidence: This is a pure stateless formatter with no shared mutable state, transactions, receipts, or concurrent operations.
        project_isolation:
          applicable: false
          evidence: The formatter handles in-memory values and explicit options; it performs no filesystem, workspace, project namespace, profile, or Git operations.
        administration:
          applicable: false
          evidence: No profile, migration, credential, hook, delivery, deployment, or administrative code changed.
  decision: pass
  rollup:
    verified_invariants:
    - 'INV-DT-OWNER: DateTimeFormatter and format_datetime_value live in date_time_formatter.py. formatters.py re-exports them and does not implement a second formatter. date-time.ts owns dateTimeRenderer. builtins.ts only imports and registers it.'
    - 'INV-DT-VALUES: The pure helper accepts native date, time, and datetime, valid ISO 8601 strings, and finite Unix epoch numbers. abs(value) >= 1e11 selects milliseconds; smaller magnitudes select seconds. Naive native and ISO datetimes are UTC before ZoneInfo projection. Date-only and time-only values keep their components. Date-only as time and time-only as date are invalid.'
    - 'INV-DT-DISPLAY: uk-UA and de-DE dates are DD.MM.YYYY. en-US dates are MM/DD/YYYY. Time is 24-hour HH:mm:ss. Datetime joins date and time with one space. Unsupported locales use uk-UA. Instant-bearing iso is offset ISO 8601 in the target timezone, Z for UTC, with at most three fractional digits. Date-only iso is YYYY-MM-DD. Time-only iso is HH:mm:ss. Date-only datetime appends 00:00:00. Time-only datetime is invalid.'
    - 'INV-DT-STRICT: None and an empty string return empty_value in both modes. Python strict=True raises ValueError for an invalid value, timezone, or format. strict=False returns empty_value. AG Grid never throws: strict invalid input, a corrupt config, or an invalid timezone renders escaped emptyValue.'
    - 'INV-DT-WIRE: GridViewColumn.date_time_formatter is optional. Wire uses snake_case. Absent or null decodes as None. A present malformed formatter fails spec_from_wire with INVALID_WIRE. Currency formatter decode stays unchanged. JSON rows stay RowDict scalars; native temporal objects are accepted only by the pure helper.'
    - 'INV-DT-SSR: A configured date or datetime column formats row and footer cells before generic empty handling, so empty_value survives. Unconfigured date cells stay escaped raw values. Currency and inline-edit paths stay unchanged.'
    - 'INV-DT-GRID: A configured date or datetime column emits camelCase dateTimeFormatter and selects dateTimeRenderer. An explicit custom renderer stays selected and still receives the config. The unconfigured date builtin stays. Host columnsVar definitions are not rewritten. A hostile empty_value stays inside one inert application/json script and decodes to the original string.'
    architectural_notes:
    - 'deferred: DOCS-BUNDLE-001 deferred: the full pytest suite runs tests/test_llm_context_build.py, which regenerates docs/llm/grid-view-spec-llm-context.md from docs/reference/python-types.md. This 24-line generated update is outside this task''s six admitted paths. task extend-scope rejected it as outside admitted scope roots, and changing milestone authority was not available at this gate. Keep this delivery scoped to the six admitted formatter files; route the generated bundle refresh through a task whose contract admits docs/llm.'
    review_summary:
      decision: pass
      contours:
        administration: not_applicable
        claims: accepted
        concurrency: not_applicable
        paths: accepted
        project_isolation: not_applicable
```

### task: column-wire

```yaml
task_ref: column-wire
target: >
  Add optional date_time_formatter on GridViewColumn. Encode it as snake_case
  and decode absent or null as None. Reject a present malformed formatter with
  INVALID_WIRE. Leave currency formatter decode unchanged. Prove constructor
  to JSON to decode equality, missing and null compatibility, and rejection of
  a wrong-typed formatter in tests/test_gridviewspec_roundtrip.py.
proof_policy: seam-test-first
contract_revision: 1
depends_on:
  - formatter-value
scope:
  - src/grid_view_spec/types/table_v2.py
  - src/grid_view_spec/wire_decode.py
  - tests/test_gridviewspec_roundtrip.py
```

### task: ssr-cells

```yaml
task_ref: ssr-cells
target: >
  Bind format_datetime from the canonical helper and apply it to configured
  date and datetime row and footer cells before generic empty handling.
  Keep autoescaping, unconfigured date cells, currency, and inline editing.
  Prove an InMemoryHost spec with ISO and epoch row values, a null footer,
  an escaped configured fallback, and an unchanged unconfigured cell in
  tests/test_datetime_formatter.py.
proof_policy: seam-test-first
contract_revision: 1
depends_on:
  - column-wire
scope:
  - src/grid_view_spec/render/bind.py
  - src/grid_view_spec/render/spec_renderer.py
  - src/grid_view_spec/templates/grid_view/spec/table.html
  - tests/test_datetime_formatter.py
```

### task: ag-grid-renderer

```yaml
task_ref: ag-grid-renderer
target: >
  Emit camelCase dateTimeFormatter only for configured date and datetime
  columns, forward it through static and columnSource column defs, and
  register one dateTimeRenderer. Match the Python layouts with
  Intl.DateTimeFormat. On the client, invalid input renders escaped
  emptyValue and does not throw. Keep a hostile empty_value inside one inert
  JSON script. Preserve an explicit custom renderer, the unconfigured date
  builtin, and host columnsVar definitions. Prove the boot JSON in
  tests/test_ag_grid_spec_config.py and the booted column-def plus cell
  output in frontend/scripts/conformance-entry.ts. Refresh the checked-in
  package bundle only when the owner build procedure requires it.
proof_policy: seam-test-first
contract_revision: 1
depends_on:
  - column-wire
  - ssr-cells
scope:
  - src/grid_view_spec/render/ag_grid.py
  - src/grid_view_spec/templates/grid_view/spec/table.html
  - frontend/src/runtime/table-ag-grid.ts
  - frontend/src/runtime/renderers/date-time.ts
  - frontend/src/runtime/renderers/builtins.ts
  - frontend/scripts/conformance-entry.ts
  - tests/test_ag_grid_spec_config.py
  - CHANGELOG.md
```
