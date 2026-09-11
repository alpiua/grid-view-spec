# Forms

## GridViewForm

Declarative forms with typed native controls, localized values, server errors, and optional host widget
slots — preferred over bespoke templates for standard input flows. The package renders the complete
semantic form; the host owns persistence and any enhancement mounted beside a native control.

```python
GridViewForm(
    id="import_form",
    fields=(
        GridViewField(name="file", label="File", type="file", validators=(GridViewValidator(kind="required"),)),
        GridViewField(name="period", label="Period", type="select", options=(...)),
    ),
    submit=GridViewExportAction(format="xlsx", params={"builder": "import_preview"}),
    endpoint="/api/import/preview/",
)
```

| Concept | Rule |
|---------|------|
| Validators | Declarative metadata mapped to compatible native attributes; `domain` and `custom` remain server-authoritative |
| Bespoke wizards | Use `GridViewTemplate` instead |

Editor types: `text`, `textarea`, `number`, `select`, `multiselect`, `date`, `date_range`, `boolean`, `file`.

### Localized fields

Field names are locale-neutral. Declare localization once on the field and supply the explicit
locale envelope on the form:

```python
GridViewForm(
    id="product_form",
    fields=(GridViewField(name="description", type="textarea", localized=True, widget="richtext"),),
    translations=GridViewTranslationEnvelope(
        locales=(GridViewLocale(code="uk", label="Українська"), GridViewLocale(code="en", label="English")),
        default_locale="uk",
        fallback_locale="en",
        values={"uk": {"description": "..."}, "en": {"description": "..."}},
        errors={"uk": {"description": ("Required",)}},
    ),
)
```

The renderer emits every declared locale in order. Localized controls use
`translations[<locale>][<field>]` names; non-localized controls use the field name directly.
It never selects, hides, or falls back between locales in the browser. `widget` is an opaque safe
capability token: the native control remains operable and the package emits an adjacent
`data-cm-widget-slot` for a host enhancement.

Values are validated without coercion. Select values must be declared options; multiselect values
preserve ordered distinct options; files are never pre-populated; and explicit `null`, `false`, zero,
and empty strings are supplied values rather than defaults. Invalid identities, locales, fieldsets,
values, or validator/field combinations fail spec validation explicitly.
