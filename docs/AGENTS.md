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
| `docs/plans/` | Open proposals (`in_place` profile specs). |
| `docs/plans/archive/` | Finished proposals. |
| `docs/milestones/` | Admitted contracts synced by ACDD. |

Give every plan frontmatter with `id` (`PLAN-NNN`), `title`, `doc_type: plan`, `profile: in_place`, and `status` (`planned`, `active`, `completed`, or `cancelled`).
A finished proposal moves to `docs/plans/archive/` with `status: completed`.
There is no `active` directory.

Name a milestone `GV-NNN-slug.md`. Set frontmatter `id` to the same prefix and number, for example `GV-001`.
The number has the form `x0x`. The hundreds digit is the layer. The tens digit stays `0`. The units digit is the next slice: `GV-001`, then `GV-101` for the next layer.

| Band | Layer |
| --- | --- |
| `GV-00x` | Spec types, wire format, and column formatters |
| `GV-10x` | Form declarations and host editor hooks |
| `GV-20x` | Renderers and AG Grid runtime |

Set `status: planned` until the first accepted claim.
Keep one to five tasks. Each task lists real files in `scope`.
Record `depends_on` on the milestone and on each task that cannot start yet.

Run GridViewSpec runs directly inside this repository with `acdd start <spec>`, which writes `<primary_worktree>/.acdd/state.sqlite` (and backs up to `<git_common_dir>/acdd/state.bak.sqlite`).

## Gates

The profile in `.acdd/profile.yaml` (`version: 2`, `inherit: code`, `gates_merge: patch`) binds `test`, `build_check`, `verify_all`, and `pytest` commands alongside reviewer models.
Unspecified gates follow the embedded `code` lifecycle: `blueprint_synthesis` -> `tasks` (`contract`, `build`, `review`, `deliver`) -> `verify` -> `polish` -> `integration_review` -> `handoff`.

| Gate | Role | Proof |
| --- | --- | --- |
| `contract` | `contract_author` | Failing `test` verification (`acdd verify <task>.contract --test <path>`) |
| `build` | `builder` | Passing `build_check` / `test` verification (`acdd verify <task>.build`) |
| `review` | `independent_reviewer` | Review findings/decision across `paths`, `claims`, `concurrency`, `project_isolation`, `administration` |
| `deliver` | `delivery_reviewer` | Scoped delivery receipt (`acdd submit <task>.deliver --action pass`) |

Review and deliver use a `--worker` id distinct from the accepted builder.
Follow the claim's `workflow_guidance`. Commands are in [docs/runbooks/acdd.md](runbooks/acdd.md).
Frontend conformance stays an owner guard beside the registered pytest command: `npm run typecheck` and `npm run test:conformance` in `frontend/`.

## Documentation indexing

ACDD MCP splits Markdown into searchable sections and links those sections to code symbols.

1. Give new Markdown documents YAML frontmatter with `title` and `doc_type` (`architecture`, `adr`, `api`, `guide`, `contract`, or `plan`). Add frontmatter to existing pages when they are deliberately migrated into the ACDD documentation index; routine edits do not require retrofitting legacy pages.
2. Use `##` and `###` headings. Each heading is one search section.
3. Put code symbols in backticks. The identifier matches `[a-zA-Z_][a-zA-Z0-9_.:]*`.
4. Declare an architectural invariant in a `[!IMPORTANT]`, `[!WARNING]`, or `[!NOTE]` callout whose text contains `Invariant:`.
5. Link other documents with repository-relative paths.
6. Check commands, paths, and public claims against live source and tests.

Rebuild the index from this repository with `acdd build .`.
