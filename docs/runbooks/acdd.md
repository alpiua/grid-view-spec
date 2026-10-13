---
title: "ACDD local execution"
doc_type: guide
---

# ACDD local execution

Gate identifiers are `contract`, `build`, `review`, and `deliver`.
Plan taxonomy and proof rules are in [docs/AGENTS.md](../AGENTS.md).

Synchronize and list GridViewSpec tasks from the ContextUnity checkout that links this repository:

```sh
contextunity-forge-mcp task sync --root <contextunity-checkout>
contextunity-forge-mcp task list --root <contextunity-checkout> \
  --repository gridviewspec \
  --milestone <milestone-id> \
  --milestone-status all \
  --status all
```

That command writes the shared ContextUnity task database.
Run `task sync` in this checkout only when this repository is opened as its own Forge workspace.

## Claim and submit

`<task-id>` has the form `gridviewspec/<milestone-id>:<task-ref>`.
`--worktree` is the absolute grid-view-spec worktree.
`--evidence` is one JSON object. `proof` contains exactly one proof key.

```sh
contextunity-forge-mcp task claim <task-id> \
  --root <contextunity-checkout> \
  --stage contract \
  --worker <worker-id> \
  --worktree <gridviewspec-worktree>
```

```sh
contextunity-forge-mcp task submit <task-id> \
  --root <contextunity-checkout> \
  --stage build \
  --action pass \
  --evidence '{"task_id":"<task-id>","stage":"build","claim_revision":1,"contract_revision":1,"worker_id":"<builder-id>","worktree":"<gridviewspec-worktree>","proof":{"command_proof":{"command":"uv run pytest <path> -q --tb=line","exit_code":0,"tests_passed":1,"tests_failed":0}}}'
```

The `command` string must be `uv run pytest` or that command plus arguments.
`tests_passed` must be greater than zero and `tests_failed` must be zero.

Contract proof uses `proof.contract_proof` with `seam_test_ref` and `red_exit_code`.
Use `red_exit_code` greater than zero for `seam-test-first`.
Review proof uses `proof.review_proof` with `decision` and the five contours `paths`, `claims`, `concurrency`, `project_isolation`, and `administration`. Each contour has `applicable` and `evidence`.
Review and deliver use a different `--worker` from the accepted builder.
Deliver proof is `proof.delivery_proof` set to `{}`.

## Handoff

After every task is completed, run the package verification command, then:

```sh
contextunity-forge-mcp milestone handoff <milestone-id> \
  --root <contextunity-checkout> \
  --verification-command "uv run pytest -q --tb=line" \
  --tests-passed <N> \
  --tests-failed 0
```

Handoff checks commit ancestry, rewrites landed SHAs, and archives the milestone file in this repository.
