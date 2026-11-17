---
title: "ACDD local execution"
doc_type: guide
---

# ACDD local execution

ACDD `0.6.0` executes runs directly inside this repository using flat CLI commands (`acdd start`, `acdd claim`, `acdd verify`, `acdd submit`, `acdd integrate`) or the five MCP state tools (`acdd_state`, `acdd_claim`, `acdd_verify`, `acdd_submit`, `acdd_blackboard`).
Gate identifiers inside a task are `contract`, `build`, `review`, and `deliver`.
Plan taxonomy and gate rules are in [docs/AGENTS.md](../AGENTS.md).

Start and inspect a run from this repository:

```sh
acdd start docs/milestones/<GV-NNN-slug>.md --worktree
acdd status
acdd next
acdd show
```

## Claim, verify, and submit

Task gate cursors have the form `<task-ref>.<gate>` (for example, `faceted-filter-in-place-refresh.contract`).
`--worktree` selects the dedicated Git worktree for that run or task.

```sh
acdd claim <task-ref>.contract \
  --worker <worker-id> \
  --worktree <gridviewspec-worktree>
acdd verify <task-ref>.contract \
  --test <tests/test_module.py::test_fn> \
  --worker <worker-id> \
  --worktree <gridviewspec-worktree>
acdd submit <task-ref>.contract \
  --action pass \
  --worker <worker-id> \
  --worktree <gridviewspec-worktree>
```

For the `build` gate:

```sh
acdd claim <task-ref>.build --worker <builder-id> --worktree <gridviewspec-worktree>
acdd verify <task-ref>.build --worker <builder-id> --worktree <gridviewspec-worktree>
acdd submit <task-ref>.build --action pass --worker <builder-id> --worktree <gridviewspec-worktree>
```

Review (`<task-ref>.review`) and delivery (`<task-ref>.deliver`) must use a `--worker` distinct from the accepted builder.
Pass structured review JSON via `--evidence` across `paths`, `claims`, `concurrency`, `project_isolation`, and `administration`.

## Handoff

After all task gates complete, run `verify`, `polish`, `integration_review`, and `handoff`:

```sh
acdd claim verify && acdd verify verify && acdd submit verify --action pass
acdd claim handoff && acdd submit handoff --action pass
```

Handoff archives the completed specification to `docs/milestones/archive/` (or `docs/plans/archive/`) and records closure metadata.
