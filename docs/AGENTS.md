---
title: "Documentation and planning governance"
doc_type: guide
---

# Documentation and planning governance

Read `AGENTS.md` at the repository root.
Verify runtime claims against live source, configuration, and tests.
Write documentation in English.
Describe inputs, effects, results, and failure conditions in present tense.

## Plans and milestones

GridViewSpec owns its proposals and admitted work in this repository.

| Path | Holds |
| --- | --- |
| `docs/plans/` | Open proposals. Not executable. |
| `docs/plans/archived/` | Finished proposals. |
| `docs/milestones/` | Admitted contracts synced by Forge. |

Give every plan frontmatter with `title`, `doc_type: plan`, `status`, and `area: gridviewspec`.
Use `status: queued` when the design is ready to admit, `deferred` when it waits on a host, `idea` for an early note, and `planned` after the proposal is admitted as a milestone.
A finished proposal moves to `docs/plans/archived/` with `status: done`.
There is no `active` directory.

Name a milestone `GV-NNN-slug.md`. Set frontmatter `id` to the same prefix and number, for example `GV-001`.
Task ids then read `gridviewspec/GV-001:<task-ref>`.
The number has the form `x0x`. The hundreds digit is the layer. The tens digit stays `0`. The units digit is the next slice: `GV-001`, then `GV-101` for the next layer.

| Band | Layer |
| --- | --- |
| `GV-00x` | Spec types, wire format, and column formatters |
| `GV-10x` | Form declarations and host editor hooks |
| `GV-20x` | Renderers and AG Grid runtime |

Set `project: gridviewspec`.
Set `status: planned` until the first accepted claim.
Keep one to five tasks. Each task lists real files in `scope`.
Record `depends_on` on the milestone and on each task that cannot start yet.

Synchronize GridViewSpec milestones from the ContextUnity checkout that links this repository.
That server writes the shared ContextUnity `.forge/tasks.sqlite`.
A `task sync` started in this checkout writes this repository's `.forge/tasks.sqlite` and is not the shared queue.

## Gates

The profile in `.forge/acdd/profile.yaml` registers this repository's pytest command and reviewer models.
Unspecified gates stay the compiled Forge order: `contract`, `build`, `review`, `deliver`.

| Gate | Role | Proof |
| --- | --- | --- |
| `contract` | `contract_author` | `contract_proof` with `seam_test_ref` and `red_exit_code` |
| `build` | `builder` | `command_proof` whose command is `uv run pytest` or a longer invocation of that command |
| `review` | `independent_reviewer` | `review_proof` over `paths`, `claims`, `concurrency`, `project_isolation`, `administration` |
| `deliver` | `delivery_reviewer` | `delivery_proof` |

`seam-test-first` requires `red_exit_code` greater than zero.
Review and deliver use a worker id distinct from the accepted builder.
Follow the claim's `workflow_guidance`. Commands are in [docs/runbooks/acdd.md](runbooks/acdd.md).
Frontend conformance stays an owner guard beside the registered pytest command: `npm run typecheck` and `npm run test:conformance` in `frontend/`.

## Documentation indexing

Forge MCP splits Markdown into searchable sections and links those sections to code symbols.

1. Give new Markdown documents YAML frontmatter with `title` and `doc_type` (`architecture`, `adr`, `api`, `guide`, `contract`, or `plan`). Add frontmatter to existing pages when they are deliberately migrated into the Forge documentation index; routine edits do not require retrofitting legacy pages.
2. Use `##` and `###` headings. Each heading is one search section.
3. Put code symbols in backticks. The identifier matches `[a-zA-Z_][a-zA-Z0-9_.:]*`.
4. Declare an architectural invariant in a `[!IMPORTANT]`, `[!WARNING]`, or `[!NOTE]` callout whose text contains `Invariant:`.
5. Link other documents with repository-relative paths.
6. Check commands, paths, and public claims against live source and tests.

Rebuild the index from this repository with `contextunity-forge-mcp build .`.
