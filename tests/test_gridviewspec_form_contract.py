"""Observable contract tests for declarative native forms."""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, replace
from html.parser import HTMLParser
from importlib import resources

import jsonschema
import pytest

from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render import render_grid_view_spec
from grid_view_spec.types.filters_v2 import GridViewFilterOption
from grid_view_spec.types.form import (
    GridViewField,
    GridViewFieldset,
    GridViewForm,
    GridViewLocale,
    GridViewTranslationEnvelope,
    GridViewValidator,
)
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.spec import GridViewSpec
from grid_view_spec.types.wire import is_wire_mapping
from grid_view_spec.validate import spec_to_wire, validate_spec
from grid_view_spec.wire_decode import decode_spec


@dataclass
class _Element:
    tag: str
    attrs: dict[str, str]
    text: str = ""
    locale: str | None = None
    select_id: str | None = None


class _HtmlProbe(HTMLParser):
    """Read rendered controls as a browser-visible HTML contract."""

    _VOID_TAGS = frozenset({"input", "br", "hr", "img", "link", "meta"})

    def __init__(self) -> None:
        super().__init__()
        self.elements: list[_Element] = []
        self._open: list[_Element] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {key: value or "" for key, value in attrs}
        locale = attrs_dict.get("data-cm-locale")
        if locale is None:
            locale = next(
                (
                    ancestor.locale
                    for ancestor in reversed(self._open)
                    if ancestor.locale is not None
                ),
                None,
            )
        select_id = next(
            (
                ancestor.attrs["id"]
                for ancestor in reversed(self._open)
                if ancestor.tag == "select" and "id" in ancestor.attrs
            ),
            None,
        )
        element = _Element(tag, attrs_dict, locale=locale, select_id=select_id)
        self.elements.append(element)
        if tag not in self._VOID_TAGS:
            self._open.append(element)

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self._open) - 1, -1, -1):
            if self._open[index].tag == tag:
                del self._open[index:]
                return

    def handle_data(self, data: str) -> None:
        for element in self._open:
            element.text += data

    def with_id(self, element_id: str) -> _Element:
        return next(element for element in self.elements if element.attrs.get("id") == element_id)

    def options_for(self, control_id: str) -> list[_Element]:
        """Return options in native DOM order for one select control."""
        return [
            element
            for element in self.elements
            if element.tag == "option" and element.select_id == control_id
        ]


def _form_spec(form: GridViewForm) -> GridViewSpec:
    return GridViewSpec(
        id="editor_page",
        blocks=(form,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(form.id,))),
    )


def _contract_form() -> GridViewForm:
    options = (
        GridViewFilterOption(value="draft", label="Draft"),
        GridViewFilterOption(value="published", label="Published"),
    )
    return GridViewForm(
        id="product_form",
        fields=(
            GridViewField(name="title", label="Title", default="Default title"),
            GridViewField(
                name="notes",
                label="Notes",
                type="textarea",
                default="Default notes",
                help="Visible help",
            ),
            GridViewField(name="price", label="Price", type="number", default=99),
            GridViewField(
                name="status",
                label="Status",
                type="select",
                options=options,
                default="published",
            ),
            GridViewField(
                name="tags",
                label="Tags",
                type="multiselect",
                options=tuple(reversed(options)),
                default=("published", "draft"),
            ),
            GridViewField(
                name="published_on",
                label="Published",
                type="date",
                default="2026-09-09",
            ),
            GridViewField(
                name="availability",
                label="Availability",
                type="date_range",
                default={"start": "2026-01-01", "end": "2026-01-02"},
            ),
            GridViewField(name="enabled", label="Enabled", type="boolean", default=True),
            GridViewField(name="attachment", label="Attachment", type="file"),
            GridViewField(name="summary", label="Summary", default="Default summary"),
            GridViewField(
                name="description",
                label="Description",
                type="textarea",
                localized=True,
                widget="richtext",
                help="Localized help",
            ),
        ),
        fieldsets=(GridViewFieldset(id="identity", label="Identity", fields=("title", "price")),),
        values={
            "title": "Supplied title",
            "price": 0,
            "availability": {"start": None, "end": "2026-10-01"},
            "enabled": False,
            "notes": "",
            "published_on": None,
        },
        errors={"availability": ("End must follow start",)},
        translations=GridViewTranslationEnvelope(
            locales=(
                GridViewLocale(code="uk", label="Українська"),
                GridViewLocale(code="en", label="English"),
            ),
            default_locale="uk",
            fallback_locale="en",
            values={"uk": {"description": "Опис"}, "en": {"description": "Description"}},
            errors={"en": {"description": ("Required",)}},
        ),
    )


def _render(form: GridViewForm) -> tuple[str, _HtmlProbe]:
    spec = _form_spec(form)
    assert validate_spec(spec).ok
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    probe = _HtmlProbe()
    probe.feed(html)
    return html, probe


def _unknown_default_locale_form() -> GridViewForm:
    form = _contract_form()
    translations = form.translations
    assert translations is not None
    return replace(form, translations=replace(translations, default_locale="fr"))


def test_native_controls_keep_values_and_accessible_date_range_identity() -> None:
    """Every declared native type renders its public control and supplied state."""
    html, probe = _render(_contract_form())

    assert probe.with_id("cm-field-product_form-title").attrs["value"] == "Supplied title"
    notes = probe.with_id("cm-field-product_form-notes")
    assert notes.tag == "textarea"
    assert notes.text == ""
    assert notes.attrs["aria-describedby"] == "cm-field-product_form-notes-help"
    assert probe.with_id("cm-field-product_form-summary").attrs["value"] == "Default summary"
    assert probe.with_id("cm-field-product_form-price").attrs == {
        "id": "cm-field-product_form-price",
        "type": "number",
        "name": "price",
        "value": "0",
    }
    assert probe.with_id("cm-field-product_form-status").tag == "select"
    assert probe.with_id("cm-field-product_form-tags").attrs["multiple"] == ""
    published_on = probe.with_id("cm-field-product_form-published_on")
    assert published_on.attrs["type"] == "date"
    assert published_on.attrs["value"] == ""
    assert probe.with_id("cm-field-product_form-availability-start").attrs["value"] == ""
    assert probe.with_id("cm-field-product_form-availability-end").attrs["value"] == "2026-10-01"
    assert '<label for="cm-field-product_form-availability-start">Availability</label>' in html
    enabled_controls = [
        element
        for element in probe.elements
        if element.tag == "input" and element.attrs.get("name") == "enabled"
    ]
    assert [(element.attrs["type"], element.attrs["value"]) for element in enabled_controls] == [
        ("hidden", "false"),
        ("checkbox", "true"),
    ]
    assert "checked" not in enabled_controls[1].attrs
    assert probe.with_id("cm-field-product_form-attachment").attrs["type"] == "file"
    status_options = probe.options_for("cm-field-product_form-status")
    assert [option.attrs["value"] for option in status_options if option.attrs["value"]] == [
        "draft",
        "published",
    ]
    assert [option.attrs["value"] for option in status_options if "selected" in option.attrs] == [
        "published"
    ]
    tag_options = probe.options_for("cm-field-product_form-tags")
    assert [option.attrs["value"] for option in tag_options] == ["published", "draft"]
    assert [option.attrs["value"] for option in tag_options if "selected" in option.attrs] == [
        "published",
        "draft",
    ]


def test_fieldsets_locales_and_widget_slots_are_observable_and_ordered() -> None:
    """Grouping, locale envelopes, and host slots retain native fallbacks."""
    html, probe = _render(_contract_form())

    assert 'data-cm-fieldset="identity"' in html
    assert html.index('data-cm-fieldset="identity"') < html.index(
        'id="cm-field-product_form-status"'
    )
    assert html.index('data-cm-locale="uk"') < html.index('data-cm-locale="en"')
    uk_control = probe.with_id("cm-field-product_form-description-uk")
    en_control = probe.with_id("cm-field-product_form-description-en")
    assert uk_control.tag == en_control.tag == "textarea"
    assert uk_control.attrs["name"] == "translations[uk][description]"
    assert en_control.attrs["name"] == "translations[en][description]"
    assert uk_control.text == "Опис"
    assert en_control.text == "Description"
    assert 'name="description_uk"' not in html
    assert en_control.attrs["aria-invalid"] == "true"
    assert en_control.attrs["aria-describedby"] == (
        "cm-field-product_form-description-en-help cm-field-product_form-description-en-errors"
    )
    assert [
        element.text.strip()
        for element in probe.elements
        if element.tag == "legend" and element.locale == "uk"
    ] == ["Українська"]
    assert [
        element.text.strip()
        for element in probe.elements
        if element.tag == "legend" and element.locale == "en"
    ] == ["English"]
    uk_slot = probe.with_id("cm-field-product_form-description-uk-widget")
    assert uk_slot.attrs == {
        "class": "cm-field-widget-slot",
        "id": "cm-field-product_form-description-uk-widget",
        "data-cm-widget-slot": "richtext",
        "data-control-id": "cm-field-product_form-description-uk",
        "data-field-name": "description",
        "data-locale": "uk",
    }
    assert html.count('data-cm-widget-slot="richtext"') == 2
    assert "disabled" not in uk_control.attrs


@pytest.mark.parametrize(
    ("make_form", "code"),
    (
        (lambda: replace(_contract_form(), id="bad form"), "FORM_TOKEN_INVALID"),
        (
            _unknown_default_locale_form,
            "FORM_TRANSLATION_DEFAULT_LOCALE_UNKNOWN",
        ),
        (
            lambda: replace(_contract_form(), values={"description": "wrong owner"}),
            "FORM_TRANSLATION_NONLOCALIZED_FIELD",
        ),
        (
            lambda: replace(
                _contract_form(), fields=(GridViewField(name="price", type="number", default=True),)
            ),
            "FORM_DEFAULT_INVALID",
        ),
        (
            lambda: replace(
                _contract_form(),
                fieldsets=(
                    GridViewFieldset(id="first", fields=("title",)),
                    GridViewFieldset(id="second", fields=("title",)),
                ),
            ),
            "FORM_FIELDSET_DUPLICATE_FIELD",
        ),
        (
            lambda: replace(
                _contract_form(),
                fields=(
                    GridViewField(
                        name="title",
                        validators=(GridViewValidator(kind="min", value=1),),
                    ),
                ),
            ),
            "FORM_VALIDATOR_INCOMPATIBLE",
        ),
    ),
)
def test_invalid_form_declarations_fail_at_the_public_validation_boundary(
    make_form: Callable[[], GridViewForm], code: str
) -> None:
    """Malformed identities, ownership, values, and declarations are rejected."""
    result = validate_spec(_form_spec(make_form()))
    assert not result.ok
    assert code in {diagnostic.code for diagnostic in result.diagnostics}


def test_localized_form_roundtrips_through_wire_and_schema() -> None:
    """The public wire preserves locale metadata, values, errors, and widget fields."""
    spec = _form_spec(_contract_form())
    wire = spec_to_wire(spec)
    schema = json.loads(
        resources.files("grid_view_spec").joinpath("schema/grid-view-spec.v2.json").read_text()
    )
    jsonschema.validate(wire, schema)

    reparsed: object = json.loads(json.dumps(wire))
    assert is_wire_mapping(reparsed)
    assert decode_spec(reparsed) == spec
