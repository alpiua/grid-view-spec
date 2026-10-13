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
target: |
  Add optional date_time_formatter on GridViewColumn. Encode it as snake_case and decode absent or null as None. Reject a present malformed formatter with INVALID_WIRE. Leave currency formatter decode unchanged. Prove constructor to JSON to decode equality, missing and null compatibility, and rejection of a wrong-typed formatter in tests/test_gridviewspec_roundtrip.py.
proof_policy: seam-test-first
contract_revision: 1
depends_on:
- formatter-value
scope:
- src/grid_view_spec/types/table_v2.py
- src/grid_view_spec/wire_decode.py
- tests/test_gridviewspec_roundtrip.py
status: completed
receipt:
  contract_revision: 1
  passed_at: 2026-10-13T03:16:46.703582215+00:00
  evidence:
    command_proof:
      command: uv run pytest tests/test_gridviewspec_roundtrip.py -q --tb=short
      exit_code: 0
      tests_passed: 24
      tests_failed: 0
  review:
    review_proof:
      decision: pass
      contours:
        paths:
          applicable: true
          evidence: Only the three admitted files are modified; no staged or untracked changes. All three worktree blobs match candidate fa1a97a, and git diff --check is clean.
        claims:
          applicable: true
          evidence: 'GridViewColumn adds an optional formatter at the end with a None default. The decoder accepts absent/null as None, validates mapping fields and format values, and spec_from_wire reports malformed values as INVALID_WIRE. Roundtrip tests verify snake_case JSON equality, absent/null compatibility, and rejection. Existing decode_currency_formatter behavior and its call are unchanged. Focused roundtrip suite: 24 passed.'
        concurrency:
          applicable: false
          evidence: This task changes an immutable data field and pure wire decoding only; it adds no shared state, transactions, locks, receipts, or concurrent operations.
        project_isolation:
          applicable: false
          evidence: No workspace paths, task storage, project resolution, or filesystem operations are changed.
        administration:
          applicable: false
          evidence: No Forge profile, migration, Git hook, delivery, or administrative behavior is changed.
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
    - 'deferred: {"owner_task":"gridviewspec/GV-001:ag-grid-renderer","kind":"deferred-finding","observed_during":"column-wire delivery hook","command":"./scripts/ci-gate.sh","result":{"format_check":"passed (201 files already formatted)","ruff":"passed","basedpyright":"passed (0 errors, 0 warnings, 0 notes)","pytest":"passed (529 passed)","frontend_lint":"passed","frontend_typecheck":"failed"},"finding":"npm run typecheck --prefix frontend exits 2 at src/runtime/table-ag-grid.ts:221:17: Property ''tooltips'' does not exist on type ''AgGridSpecColumn''.","disposition":"Outside column-wire''s three admitted Python paths. No source changes made. Address in ag-grid-renderer and rerun npm run typecheck plus frontend conformance."}'
    review_summary:
      decision: pass
      contours:
        administration: not_applicable
        claims: accepted
        concurrency: not_applicable
        paths: accepted
        project_isolation: not_applicable
```

### task: ssr-cells

```yaml
task_ref: ssr-cells
target: |
  Bind format_datetime from the canonical helper and apply it to configured date and datetime row and footer cells before generic empty handling. Keep autoescaping, unconfigured date cells, currency, and inline editing. Prove an InMemoryHost spec with ISO and epoch row values, a null footer, an escaped configured fallback, and an unchanged unconfigured cell in tests/test_datetime_formatter.py.
proof_policy: seam-test-first
contract_revision: 1
depends_on:
- column-wire
scope:
- src/grid_view_spec/render/bind.py
- src/grid_view_spec/render/spec_renderer.py
- src/grid_view_spec/templates/grid_view/spec/table.html
- tests/test_datetime_formatter.py
status: completed
receipt:
  contract_revision: 1
  passed_at: 2026-10-13T03:35:11.938938990+00:00
  evidence:
    command_proof:
      command: ./scripts/ci-gate.sh
      exit_code: 0
      tests_passed: 554
      tests_failed: 0
  review:
    review_proof:
      decision: pass
      contours:
        paths:
          applicable: true
          evidence: Candidate snapshot 1d9f1bf contains exactly the four admitted paths. Their snapshot blob IDs match the four current worktree file hashes, and git status shows no other modified paths; baseline HEAD is a157b85. No protected profile, repository configuration, generated state, or neighboring project path changed.
        claims:
          applicable: true
          evidence: The renderer binds the canonical format_datetime helper and passes it to the real Jinja spec renderer. In the row template, configured date/datetime formatting runs after the inline-select and currency branches but before generic empty handling, and the result is escaped with |e. The footer uses the same ordering before null/empty fallback. Unconfigured date cells continue through the existing raw escaped branch; currency and inline-edit branches are preserved. The production-seam test renders an InMemoryHost GridViewSpec and asserts ISO date and epoch datetime output, escaped configured empty_value for null row/footer values, and unchanged raw unconfigured date values. Accepted build proof for this same snapshot is ./scripts/ci-gate.sh, exit 0, 554 passed, 0 failed; the repository gate includes ruff format --check, Ruff, basedpyright, pytest, and frontend conformance.
        concurrency:
          applicable: false
          evidence: This change only formats in-memory SSR table values. It introduces no shared mutable state, transaction, task receipt, lock, or concurrent operation.
        project_isolation:
          applicable: false
          evidence: The change is confined to rendering code, one template, and its test inside the owning grid-view-spec worktree. It adds no workspace resolution, task/profile paths, symlink handling, namespace, filesystem access, or Git behavior.
        administration:
          applicable: false
          evidence: No schema migration, profile pin, credential, hook, delivery, deployment, or administrative behavior changed. The accepted full CI gate passed for the candidate snapshot.
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
    architectural_notes: []
    review_summary:
      decision: pass
      contours:
        administration: not_applicable
        claims: accepted
        concurrency: not_applicable
        paths: accepted
        project_isolation: not_applicable
```

### task: ag-grid-renderer

```yaml
task_ref: ag-grid-renderer
target: |
  Emit camelCase dateTimeFormatter only for configured date and datetime columns, forward it through static and columnSource column defs, and register one dateTimeRenderer. Match the Python layouts with Intl.DateTimeFormat. On the client, invalid input renders escaped emptyValue and does not throw. Keep a hostile empty_value inside one inert JSON script. Preserve an explicit custom renderer, the unconfigured date builtin, and host columnsVar definitions. Prove the boot JSON in tests/test_ag_grid_spec_config.py and the booted column-def plus cell output in frontend/scripts/conformance-entry.ts. Refresh the checked-in package bundle only when the owner build procedure requires it.
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
status: completed
receipt:
  contract_revision: 1
  passed_at: 2026-10-13T10:16:52.964498421+00:00
  evidence:
    command_proof:
      command: ./scripts/ci-gate.sh
      exit_code: 0
      tests_passed: 555
      tests_failed: 0
      log: Full gate passed after the renderer fix. 203 files already formatted; Ruff clean; basedpyright 0 errors, 0 warnings, 0 notes; pytest 555 passed. Frontend ESLint, standard and strict typechecks passed; generated types are up to date; booted JS conformance passed, including 20240305, 20240305T040506, 040506 and equivalent reduced-precision/fraction/offset basic forms; all 9 chart fixtures passed. Pre-fix seam run against the unchanged 4dbdcb2 parser failed at the new 20240305 assertion. Gate-generated LLM bundle delta was removed; candidate status remains within the admitted scope.
  review:
    review_proof:
      decision: pass
      contours:
        paths:
          applicable: true
          evidence: Snapshot 8151691 contains the nine admitted task paths, including the conformance extension. Every scoped snapshot blob matches the current worktree file hash. Compared with prior snapshot 4dbdcb2, only frontend/src/runtime/renderers/date-time.ts and frontend/scripts/ag-grid-date-time-conformance.ts changed, both admitted. git diff --check against baseline 74d030a4bcd0cde4c9cf403e154d069aeb96ab68 is clean. git status has only the task-scope files; no protected profile, .gitignore, generated docs, or neighboring project paths changed. No source files changed during review.
        claims:
          applicable: true
          evidence: 'The introduced parsing defect is closed through the production boot/cell-renderer path. Blackboard note 4''s three exact cases are asserted: `render(created, "20240305")` -> `05.03.2024`; `render(dynamic, "20240305T040506")` -> `05.03.2024 04:05:06`; `render(clock, "040506")` -> `04:05:06`. The matrix also covers reduced precision (`20240305T0405`, `20240305T04`, `0405`), fractional/offset basic forms, and invalid residuals: `20240230`, `246060`, and `20240305T246060` render escaped configured emptyValue; existing invalid text, corrupt config, and invalid timezone fallback checks remain. Each result calls a renderer from columnDefs produced by `bootAgGridSpecFromDocument` and the shared static/columnSource builder. The accepted full build proof for this same snapshot is `./scripts/ci-gate.sh`, exit 0: 203 files formatted, Ruff clean, basedpyright 0 errors/warnings/notes, pytest 555 passed, frontend ESLint and standard/strict typechecks passed, generated types current, booted JS conformance passed, and all 9 chart fixtures passed. The build record also reports the pre-fix seam run failed at the 20240305 assertion. INV-DT-VALUES and INV-DT-DISPLAY are covered by the basic-form and output-layout assertions; invalid values still use escaped fallback.'
        concurrency:
          applicable: false
          evidence: The fix adds pure parsing of basic ISO components and conformance cases; it introduces no shared persistence, task receipts, locks, transactions, or concurrent workflow operations.
        project_isolation:
          applicable: false
          evidence: The fix introduces no workspace resolution, profile/task paths, symlink traversal, filesystem access, namespaces, or Git behavior. The snapshot is tied to the grid-view-spec worktree and confined to its admitted paths.
        administration:
          applicable: false
          evidence: No schema migration, profile pin, credentials, hook, delivery, deployment, or administrative behavior changed. The full CI gate proof is recorded against snapshot 8151691.
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
    architectural_notes: []
    review_summary:
      decision: pass
      contours:
        administration: not_applicable
        claims: accepted
        concurrency: not_applicable
        paths: accepted
        project_isolation: not_applicable
```
