# grid-view-spec — Agent Router

Plan, milestone, and documentation rules are in [docs/AGENTS.md](docs/AGENTS.md).

No `git commit`, `git push`, `git checkout <file>`, or `git restore` without
explicit user approval.

Load `close-review-findings` before fixing a defect or closing a review,
`commit-workflow` only after explicit commit authorization, and
`agent-instructions` before changing agent guidance.
Repository-specific additions belong in `.agents/skills/<skill>/ADDON.md`; they
must extend, not shadow, the global base skill.

Claim and submit commands are in [docs/runbooks/acdd.md](docs/runbooks/acdd.md).
Load `contextunity-forge` before code discovery or task operations, then follow the claim's `workflow_guidance`.

## Routes

- Architecture: [gridviewspec-architecture.md](docs/maintainers/gridviewspec-architecture.md).
- Documentation authoring: [docs/AGENTS.md](docs/AGENTS.md).
- Package use: [.agents/skills/grid-view-spec-docs/SKILL.md](.agents/skills/grid-view-spec-docs/SKILL.md).
- Behavior: global `close-review-findings` and `test-contract-seam`.
- Quality: [code-quality.md](../../contextunity/docs/architecture/code-quality.md).

## Guards

For architecture design, refactors, or component changes, read the
[maintainer architecture reference](docs/maintainers/gridviewspec-architecture.md)
and the relevant [specification](docs/spec/index.md) or
[host contract](docs/integration/host-contract.md) before choosing an approach
or making the first edit. Record their concrete constraints in the task plan,
recheck them when scope or ownership changes, and verify the change against
them during review.

```bash
./scripts/ci-gate.sh
```

- Always ensure `./scripts/ci-gate.sh` passes cleanly (including `ruff format --check`, `ruff check`, and `basedpyright`) on the `build` gate.
- Strict ACDD snapshot immutability: do not edit or reformat files during `deliver` or after `review`. A worktree change relative to the accepted candidate snapshot triggers `TASK_CANDIDATE_MISMATCH`. If delivery fails, preserve local changes and prepare a candidate-matching worktree before retrying; do not overwrite files without explicit user approval.
- Boundaries: no `Any`, `cast`, pyright ignore; use narrowing/`TypeGuard`/
  `Protocol`/`TypedDict`/`JsonValue`.
- Use English-only gettext msgids and JavaScript i18n keys; keep translated text
  exclusively in locale catalogs.
- Tests: observable HTTP/output/wire behavior; no source-text assertions. Bad
  page/block input: explicit rejection.
- Core: no runtime `django.db` import. Export/import seam:
  `tests/test_gridviewspec_export.py::test_pipeline_module_has_no_runtime_django_bindings`.
- No discarded host/protocol parameter, circular-import workaround, generic
  `helpers.py`, or command module over 400 lines.
- For a local UI repair, change the smallest existing path. Do not introduce a
  lifecycle or adapter subsystem, or mix it into a grid dispatcher, unless two
  current consumers require the same owner boundary.
- For non-trivial changes, load global `code-quality` and apply its bug-fix
  admission and delegation gate.

## Skill routing

| Trigger | Route |
|---|---|
| Behavior/regression | `close-review-findings` before repair; `test-contract-seam` after review convergence |
| Typing/payload boundary | ContextUnity contract-boundary guidance → named verification lane |
| Export/render/host | Architecture doc + export/render tests |
| MCP migration | `grid-view-spec-mcp` + [MCP guide](docs/tools/mcp-server.md) |
| Django/HTMX | `tests/test_gridviewspec_django_views.py` |
| Public Python | [python-types.md](docs/reference/python-types.md) |
