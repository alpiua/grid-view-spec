---
title: "Declarative product editor host contract"
doc_type: plan
status: deferred
area: gridviewspec
---


# Declarative product editor host contract

GridViewSpec supplies the reusable declarative surface required by host-owned
editors without becoming their client runtime. Commerce is the first consumer,
but the package contract remains domain-neutral.

## Decision

GridViewSpec owns spec validation, renderable field and layout declarations,
stable semantic hooks, widget slots and package-owned grid lifecycle. It does
not own application drafts, persistence, external widget instances, HTMX
requests, Alpine components or Commerce operations.

Hosts may map rendered hooks to their own interaction layer. GridViewSpec does
not expose framework-specific concepts such as Alpine expressions or Stimulus
controllers in its wire contract.

## Contract

- Native fields render accessible controls, labels, errors and stable form
  identities from a validated spec.
- Localized fields keep one stable semantic name. Locale codes are explicit
  data in a translation envelope, never suffixes such as `title_<locale>`.
  The host supplies available/default locales and owns the active locale;
  GridViewSpec renders locale-addressable values and errors without introducing
  locale-specific field types or browser state.
- A rich-text declaration renders a host-mountable widget slot plus the
  underlying form identity. The host owns editor loading, value synchronization,
  normalization, failure UI and disposal.
- Layout declarations can render a host-addressable editor surface beside an
  anchor. The package does not open, close, position or persist that host
  application surface through an imperative overlay manager.
- Nested specs retain isolated render context and deterministic identifiers.
- Package cleanup covers only listeners and resources created by the package.
- Unsupported field, layout and validator declarations fail explicitly.
- No Alpine, HTMX, Tiptap or Commerce dependency enters the package.

## Admitted declarative slice

The first producer slice completes the existing form declaration rather than
adding an interaction layer:

```python
GridViewField(
    name="description",
    type="textarea",
    localized=True,
    widget="richtext",
)

GridViewTranslationEnvelope(
    locales=(
        GridViewLocale(code="uk", label="Українська"),
        GridViewLocale(code="en", label="English"),
    ),
    default_locale="uk",
    fallback_locale="en",
    values={
        "uk": {"description": "..."},
        "en": {"description": "..."},
    },
    errors={"uk": {"description": ("Required",)}},
)
```

- `GridViewField.name` is locale-neutral. Locale is a separate value in the
  translation envelope and in rendered `data-locale`/form-name metadata.
- `GridViewForm` optionally carries one translation envelope. A localized
  field requires that envelope; locale/default/fallback references validate
  explicitly.
- The renderer emits accessible native controls, fieldsets, values, help and
  server errors from the existing form contract.
- A widget declaration retains its native control and adds a generic
  `data-cm-widget-slot` mount beside it. The host may enhance that control but
  GridViewSpec never imports or initializes the widget.
- Existing `GridViewFieldset.id` is the semantic section hook and renders as
  `data-cm-fieldset`; no additional section runtime is introduced.

This slice changes the form types, wire/schema/generated types, form template,
form styles and form documentation. It does not change `frontend/src/runtime`,
overlay contracts/templates, or the public `GridView` JavaScript API.

### Public shape and invariants

The added public fields are exactly:

- `GridViewField.localized: bool = False`;
- `GridViewField.widget: str = ""`;
- `GridViewForm.translations: GridViewTranslationEnvelope | None = None`;
- `GridViewLocale(code: str, label: str)` as a frozen slotted dataclass;
- `GridViewTranslationEnvelope` as a frozen slotted keyword-only dataclass with
  `locales: tuple[GridViewLocale, ...]`, `default_locale: str`,
  `fallback_locale: str | None = None`,
  `values: dict[str, JsonObject] = {}` by factory, and
  `errors: dict[str, dict[str, tuple[str, ...]]] = {}` by factory.

Non-localized fields read only from `GridViewForm.values/errors`; localized
fields read only from the translation envelope. A field default applies only
when its value key is absent. Explicit `null`, `false`, zero and an empty string
are supplied values and are never replaced by the default. Unknown locale or
field keys fail validation.

Accepted supplied values are:

| Field type | Value |
| --- | --- |
| `text`, `textarea`, `date` | string or null |
| `number` | integer or number, excluding boolean, or null |
| `select` | declared option string or null |
| `multiselect` | ordered list of distinct declared option strings |
| `boolean` | boolean or null |
| `date_range` | object with `start` and `end`, each string or null |
| `file` | absent or null; a file input is never pre-populated |

Defaults follow the same matrix. Missing and explicit null both render an empty
native control, but remain distinct for default selection. Select values must
match declared options exactly; no string/number coercion is performed.

Default and fallback locales reference declared locales. A localized field
requires an envelope; envelope values/errors reference only declared locales
and localized fields. Configured locale order and error order are preserved.
The renderer emits every locale's native controls in that order; it owns no
active-locale state, hiding or fallback selection.

Form ids, field names, fieldset ids, locale codes and every non-empty widget
token use the shared ASCII grammar `[A-Za-z][A-Za-z0-9_-]{0,127}`. An empty
widget means no slot. Blank, invalid or colliding required identities fail
validation. Because these tokens cannot contain separators,
the deterministic control id
`cm-field-<form-id>-<field-name>[-<locale-code>]` is collision-free within the
globally unique block-id contract.

Native names encode the same translation envelope explicitly. A non-localized
control uses `<field-name>`. A localized control uses
`translations[<locale-code>][<field-name>]`; date-range endpoints append
`[start]` or `[end]`. Repeated multiselect controls keep the same encoded name
and preserve option order. The host parses those bracketed keys into the wire
translation envelope. Locale suffixes such as `title_uk`, dotted aliases such
as `title.uk`, and duplicate bare `name="title"` controls are not emitted.
An unchecked boolean serializes explicitly: the renderer emits a preceding
hidden control with value `false` and a checkbox with value `true`; form
decoding uses the last submitted value for that declared boolean field.
Date-range control IDs append `-start` and `-end` to the base control id.

Control IDs include the nested spec/form identity, semantic field name and,
when localized, locale code. Labels use `for`; fieldsets use real
`fieldset`/`legend` and `data-cm-fieldset`; fields expose `data-field-name` and
localized controls expose `data-locale`. Help and error IDs feed
`aria-describedby`, and server errors set `aria-invalid="true"`. Ungrouped
fields render once after declared fieldsets. Duplicate fieldset IDs, unknown
field references and a field referenced by more than one fieldset fail
validation.

Each localized control is enclosed by a locale field group with
`data-cm-locale="<code>"` and an accessible legend from
`GridViewLocale.label`; an empty locale label fails validation. The grouping is
present before any host enhancement.

`widget` is an opaque, nonblank safe capability token, not a GridViewSpec
allowlist or a rich-text field type. The renderer always keeps an operable
native control and emits exactly one adjacent slot per rendered control with
`id="<control-id>-widget"`, `data-cm-widget-slot="<token>"`,
`data-control-id="<control-id>"`, `data-field-name="<semantic-name>"` and, for
localized controls, `data-locale="<code>"`. GridViewSpec never hides or disables the
fallback. A host may do so only after a successful mount and owns value sync,
failure UI and disposal.

Declaration validation maps compatible validators to native attributes:
`required`; `email`/`url` input types on text fields; `number`/`integer` and
`min`/`max` on number fields; `min_length`/`max_length` on text and textarea;
and `pattern` on text. `domain` and named `custom` validators remain
server-authoritative metadata and are not executed by package JavaScript.
Missing validator parameters and incompatible field/validator combinations fail
validation instead of being ignored.

This slice adds no layout/anchor contract, cleanup API, listener, draft API,
validator registry, overlay change or file under `frontend/src/runtime`.

## Existing tab-layout reuse

The Commerce editor reuses the existing domain-neutral `GridViewTabs`,
`GridViewTab` and `GridViewArea` contracts. A tab references exactly one block
or area; existing validation rejects invalid targets, and the renderer provides
the tab list, tab panels and semantic host hooks. The existing
`initTabGroups` behavior owns local tab activation.

No additional GridViewSpec tab type, editor layout type or active-tab runtime is
introduced for Commerce. The host composes eight consumer tabs (General,
Stocks, Images, Description, Characteristics, Technologies, Merchandising and
SEO) from ordinary areas and template/form blocks. Commerce owns local field
drafts and external widget lifecycle. Its Alpine island may react to the active
panel to mount Tiptap or a media
adapter, but it does not implement another tab system.

Any missing lazy-mount notification is first treated as a bounded host adapter
seam. A package contract change is admitted only when a consumer proof shows
that the existing semantic hooks cannot support cleanup safely.

## Producer and consumer boundary

```text
GridViewSpec declaration
        -> server-rendered semantic markup
        -> host adapter / island mounts behavior
        -> host persistence returns saved state or validation errors
```

The host proves draft preservation, focus, Escape behavior, adjacent drawer
interaction, responsive sizing, external-widget cleanup and failed persistence.
Those are host interaction guarantees, not GridViewSpec runtime APIs.

## Delivery

- [x] Preserve candidate `5c491bc` as historical evidence on
  `archive/product-editor-interaction-runtime`; it is not a delivery dependency
  and never targets `main`.
- [x] Add only declarations, semantic hooks and widget slots proved by the
  Commerce consumer; do not restore the archived package-owned application
  runtime.
- [x] Publish the resulting schema, generated types and assets.
- [x] Add package tests for render output, stable identities, invalid specs and
  host widget slots without importing a client framework. Cover localized
  values, per-locale errors, fallback metadata and locale-neutral field names.
- [x] Run the frontend build, generated-type check, Ruff, BasedPyright and the
  full 380-test package suite. Run `./scripts/ci-gate.sh` again at final handoff.
- [x] Complete independent implementation and test-diff review.
- [ ] Record the accepted package commit only after package and Commerce
  consumer proofs pass.

The Commerce consumer plan is maintained in the ContextUnity checkout at
`extensions/commerce/docs/commerce-gridview-migration-plan.md`. Package acceptance
remains deferred until the package commit and Commerce consumer proofs are recorded.

No package completion is claimed while required gates remain open.
