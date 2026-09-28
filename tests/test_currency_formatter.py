"""Comprehensive tests for CurrencyFormatter, wire decoding, rendering, and safety."""

from __future__ import annotations

import dataclasses
import math
from decimal import Decimal

import pytest

from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render import render_grid_view_spec
from grid_view_spec.render.ag_grid import ag_grid_spec_config
from grid_view_spec.render.bind import format_currency
from grid_view_spec.types.formatters import CurrencyFormatter
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.spec import GridViewSpec
from grid_view_spec.types.table_v2 import GridViewColumn, GridViewTable, GridViewTableFooter
from grid_view_spec.validate.validate import validate_spec
from grid_view_spec.validate.wire import spec_to_wire
from grid_view_spec.wire_decode import decode_column, decode_currency_formatter, decode_spec

# --- 1. Contract & Instantiation ----------------------------------------------


def test_default_instantiation() -> None:
    formatter = CurrencyFormatter()
    assert formatter.currency == "UAH"
    assert formatter.locale == "uk-UA"
    assert formatter.precision == 2
    assert formatter.show_symbol is True
    assert formatter.empty_value == "—"
    assert formatter.strict is False


def test_custom_instantiation() -> None:
    formatter = CurrencyFormatter(
        currency="USD",
        locale="en-US",
        precision=0,
        show_symbol=False,
        empty_value="",
        strict=True,
    )
    assert formatter.currency == "USD"
    assert formatter.locale == "en-US"
    assert formatter.precision == 0
    assert formatter.show_symbol is False
    assert formatter.empty_value == ""
    assert formatter.strict is True


def test_frozen_immutability() -> None:
    formatter = CurrencyFormatter()
    with pytest.raises(dataclasses.FrozenInstanceError):
        setattr(formatter, "currency", "EUR")


# --- 2. Safety & Zero-Exception Battery ----------------------------------------


@pytest.mark.parametrize(
    "invalid_input",
    [
        None,
        "",
        "   ",
        "\t\n",
        True,
        False,
        float("nan"),
        math.nan,
        Decimal("NaN"),
        Decimal("-NaN"),
        float("inf"),
        float("-inf"),
        Decimal("Infinity"),
        Decimal("-Infinity"),
        "invalid_text",
        "foo123",
        "NaN",
        "null",
        "undefined",
        object(),
        [],
        [100],
        {"amount": 100},
        (1, 2),
    ],
)
def test_safety_invalid_inputs_return_empty_value(invalid_input: object) -> None:
    formatter = CurrencyFormatter()
    assert formatter.format(invalid_input) == "—"
    assert formatter(invalid_input) == "—"


def test_custom_empty_value_override() -> None:
    formatter = CurrencyFormatter(empty_value="N/A")
    assert formatter.format(None) == "N/A"
    assert formatter.format(None, empty_value="0.00") == "0.00"


# --- 3. Strict Mode & String Normalization ------------------------------------


def test_strict_mode_rejects_strings() -> None:
    strict_formatter = CurrencyFormatter(strict=True)
    lenient_formatter = CurrencyFormatter(strict=False)

    assert strict_formatter.format("1234.50") == "—"
    assert strict_formatter.format(1234.50) == "1 234,50 ₴"

    assert lenient_formatter.format("1234.50") == "1 234,50 ₴"
    assert lenient_formatter.format("1 234,50 ₴") == "1 234,50 ₴"


@pytest.mark.parametrize(
    ("locale", "currency", "raw_string", "expected"),
    [
        # en-US: comma is grouping, dot is decimal
        ("en-US", "USD", "1,234", "$1,234.00"),
        ("en-US", "USD", "1,234.50", "$1,234.50"),
        ("en-US", "USD", "1,234,567.89", "$1,234,567.89"),
        ("en-US", "USD", "1,23", "$1.23"),
        ("en-US", "USD", "9007199254740993", "$9,007,199,254,740,993.00"),
        # de-DE: dot is grouping, comma is decimal
        ("de-DE", "EUR", "1.234", "1.234,00 €"),
        ("de-DE", "EUR", "1.234,50", "1.234,50 €"),
        ("de-DE", "EUR", "1.234.567,89", "1.234.567,89 €"),
        # uk-UA: space is grouping, comma is decimal
        ("uk-UA", "UAH", "  1250.75  ", "1 250,75 ₴"),
        ("uk-UA", "UAH", "1 234", "1 234,00 ₴"),
        ("uk-UA", "UAH", "1 234,50", "1 234,50 ₴"),
        ("uk-UA", "UAH", "1 234 567,89", "1 234 567,89 ₴"),
        ("uk-UA", "UAH", "1 250,75 ₴", "1 250,75 ₴"),
        ("uk-UA", "UAH", "$ 500.00", "500,00 ₴"),
        ("uk-UA", "UAH", "100 USD", "100,00 ₴"),
    ],
)
def test_lenient_string_normalization_valid(
    locale: str,
    currency: str,
    raw_string: str,
    expected: str,
) -> None:
    formatter = CurrencyFormatter(currency=currency, locale=locale)
    assert formatter.format(raw_string) == expected


@pytest.mark.parametrize(
    ("locale", "currency", "malformed_string"),
    [
        # Malformed group widths (en-US comma grouping)
        ("en-US", "USD", "12,34,56"),
        ("en-US", "USD", "1,2,3"),
        # Malformed group widths (de-DE dot grouping)
        ("de-DE", "EUR", "1.2.3"),
        ("de-DE", "EUR", "12.34.56"),
        # Malformed space grouping (uk-UA)
        ("uk-UA", "UAH", "12 34 56"),
        ("uk-UA", "UAH", "1 2 3"),
        ("uk-UA", "UAH", "1 234, 50"),
        ("uk-UA", "UAH", "1 234,5 0"),
        # Multiple leading signs
        ("uk-UA", "UAH", "--12"),
        ("uk-UA", "UAH", "+-12"),
        ("en-US", "USD", "--100"),
    ],
)
def test_lenient_string_normalization_malformed_rejected(
    locale: str,
    currency: str,
    malformed_string: str,
) -> None:
    formatter = CurrencyFormatter(currency=currency, locale=locale, empty_value="—")
    assert formatter.format(malformed_string) == "—"


# --- 4. Locales & Formatting Invariants ---------------------------------------


@pytest.mark.parametrize(
    ("locale", "currency", "amount", "expected"),
    [
        ("uk-UA", "UAH", 1234567.89, "1 234 567,89 ₴"),
        ("uk-UA", "UAH", -50.5, "-50,50 ₴"),
        ("uk-UA", "UAH", 0, "0,00 ₴"),
        ("en-US", "USD", 1234567.89, "$1,234,567.89"),
        ("en-US", "USD", -50.5, "-$50.50"),
        ("de-DE", "EUR", 1234567.89, "1.234.567,89 €"),
        ("de-DE", "EUR", -10, "-10,00 €"),
        ("pl-PL", "PLN", 1234.5, "1 234,50 zł"),
        ("fr-FR", "EUR", 1234.5, "1 234,50 €"),
        ("ja-JP", "JPY", 1234, "¥1,234"),
    ],
)
def test_locale_formatting_rules(
    locale: str,
    currency: str,
    amount: float | int,
    expected: str,
) -> None:
    precision = 0 if currency == "JPY" else 2
    formatter = CurrencyFormatter(currency=currency, locale=locale, precision=precision)
    assert formatter.format(amount) == expected


def test_precision_handling_and_rounding() -> None:
    f_zero = CurrencyFormatter(currency="USD", locale="en-US", precision=0)
    assert f_zero.format(1234.4) == "$1,234"
    assert f_zero.format(1234.5) == "$1,235"  # ROUND_HALF_UP

    f_four = CurrencyFormatter(currency="USD", locale="en-US", precision=4)
    assert f_four.format(12.34567) == "$12.3457"


def test_show_symbol_toggle() -> None:
    f_no_sym = CurrencyFormatter(currency="UAH", locale="uk-UA", show_symbol=False)
    assert f_no_sym.format(1234.5) == "1 234,50"
    assert f_no_sym.format(-1234.5) == "-1 234,50"


# --- 5. Wire Decoding & Spec Roundtrip ----------------------------------------


def test_decode_currency_formatter_valid() -> None:
    raw = {
        "currency": "EUR",
        "locale": "de-DE",
        "precision": 3,
        "show_symbol": False,
        "empty_value": "N/A",
        "strict": True,
    }
    decoded = decode_currency_formatter(raw)
    assert decoded is not None
    assert decoded.currency == "EUR"
    assert decoded.locale == "de-DE"
    assert decoded.precision == 3
    assert decoded.show_symbol is False
    assert decoded.empty_value == "N/A"
    assert decoded.strict is True


def test_decode_currency_formatter_bounds_and_fallbacks() -> None:
    assert decode_currency_formatter(None) is None
    assert decode_currency_formatter("not a map") is None

    # precision out of bounds (allowed 0..6)
    out_of_bounds = decode_currency_formatter({"precision": 99})
    assert out_of_bounds is not None
    assert out_of_bounds.precision == 2

    # boolean precision ignored
    bool_prec = decode_currency_formatter({"precision": True})
    assert bool_prec is not None
    assert bool_prec.precision == 2


def test_decode_column_with_currency_formatter() -> None:
    col = decode_column(
        {
            "id": "price",
            "label": "Price",
            "type": "currency",
            "currency_formatter": {
                "currency": "USD",
                "locale": "en-US",
                "precision": 2,
            },
        }
    )
    assert col.currency_formatter is not None
    assert col.currency_formatter.currency == "USD"
    assert col.currency_formatter.locale == "en-US"


@pytest.mark.parametrize("empty_value", ["—", "", "N/A"])
def test_spec_to_wire_and_decode_roundtrip(empty_value: str) -> None:
    formatter = CurrencyFormatter(
        currency="USD",
        locale="en-US",
        precision=2,
        show_symbol=True,
        empty_value=empty_value,
        strict=True,
    )
    table = GridViewTable(
        id="prices_table",
        columns=(
            GridViewColumn(
                id="amount",
                label="Amount",
                type="currency",
                currency_formatter=formatter,
            ),
        ),
    )
    spec = GridViewSpec(id="prices_spec", blocks=(table,))
    wire = spec_to_wire(spec)
    decoded = decode_spec(wire)
    assert decoded == spec
    decoded_table = decoded.blocks[0]
    assert isinstance(decoded_table, GridViewTable)
    assert decoded_table.columns[0].currency_formatter is not None
    assert decoded_table.columns[0].currency_formatter.empty_value == empty_value


# --- 6. Rendering Integration -------------------------------------------------


def test_ag_grid_spec_config_serializes_currency_formatter() -> None:
    table = GridViewTable(
        id="prices_table",
        columns=(
            GridViewColumn(
                id="amount",
                label="Amount",
                type="currency",
                currency_formatter=CurrencyFormatter(
                    currency="USD",
                    locale="en-US",
                    precision=2,
                    show_symbol=False,
                ),
            ),
            GridViewColumn(id="plain", label="Plain", type="text"),
        ),
    )
    config = ag_grid_spec_config(table, "prices_table")
    assert config["columns"] == [
        {
            "id": "amount",
            "field": "amount",
            "label": "Amount",
            "hidden": False,
            "type": "currency",
            "renderer": "",
            "editable": False,
            "width": "",
            "minWidth": "",
            "sortable": True,
            "pinned": "",
            "menuGroup": "",
            "agFilter": "",
            "checkboxSelection": False,
            "extra": {},
            "currencyFormatter": {
                "currency": "USD",
                "locale": "en-US",
                "precision": 2,
                "showSymbol": False,
                "emptyValue": "—",
                "strict": False,
            },
        },
        {
            "id": "plain",
            "field": "plain",
            "label": "Plain",
            "hidden": False,
            "type": "text",
            "renderer": "",
            "editable": False,
            "width": "",
            "minWidth": "",
            "sortable": True,
            "pinned": "",
            "menuGroup": "",
            "agFilter": "",
            "checkboxSelection": False,
            "extra": {},
        },
    ]


def test_format_currency_helper_in_bind() -> None:
    formatter = CurrencyFormatter()
    assert format_currency(1234.5, formatter) == "1 234,50 ₴"
    assert format_currency(None, formatter) == "—"


def test_simple_table_renders_currency_formatter() -> None:
    table = GridViewTable(
        id="prices",
        columns=(
            GridViewColumn(
                id="price",
                label="Price",
                field="price",
                type="currency",
                currency_formatter=CurrencyFormatter(
                    currency="USD", locale="en-US", precision=2, empty_value="N/A"
                ),
            ),
        ),
        rows=({"price": 1234.5}, {"price": None}),
        footer=GridViewTableFooter(
            row=True,
            label="Total",
        ),
        extra={"footer_row": {"price": None}},
    )
    spec = GridViewSpec(
        id="currency_spec",
        blocks=(table,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(table.id,))),
    )

    html = render_grid_view_spec(
        spec,
        (),
        host=InMemoryHost(),
        backend="html",
    )
    assert "$1,234.50" in html
    assert "N/A" in html


def test_row_currency_uses_column_locale_and_optional_symbol_color() -> None:
    formatter = CurrencyFormatter(
        currency="UAH",
        locale="uk-UA",
        precision=2,
        precision_by_currency={"UAH": 0},
        symbol_colors={"USD": "#22c55e"},
        empty_value="INVALID",
        strict=True,
    )
    assert formatter.format(1234.5) == "1 235 ₴"
    assert formatter.format(1234.5, currency="USD") == "1 234,50 $"
    assert formatter.format_parts(1234.5, currency="USD") == ("1 234,50 ", "$", "", "#22c55e")
    assert formatter.format_parts(1234.5) == ("1 235 ", "₴", "", "")
    assert formatter.format("1234.5", currency="USD") == "INVALID"
    assert formatter.format(1234.5, currency="<img>") == "INVALID"
    assert formatter.format(1234.5, currency=24) == "INVALID"
    assert (
        CurrencyFormatter(symbol_colors={"USD": "red;injection"}).format(3, currency="USD") == "—"
    )


def test_mixed_currency_simple_table_preserves_numeric_sort_and_wire() -> None:
    formatter = CurrencyFormatter(
        locale="en-US",
        currency="UAH",
        precision=2,
        precision_by_currency={"UAH": 0},
        symbol_colors={"USD": "#22c55e"},
        empty_value="<missing>",
    )
    table = GridViewTable(
        id="prices",
        columns=(
            GridViewColumn(
                id="price", label="Price", type="currency", currency_formatter=formatter
            ),
        ),
        rows=(
            {"price": 1234.5, "price_currency": "USD"},
            {"price": 45.5, "price_currency": "UAH"},
            {"price": 1, "price_currency": "<script>"},
        ),
    )
    spec = GridViewSpec(
        id="prices",
        blocks=(table,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("prices",))),
    )
    assert decode_spec(spec_to_wire(spec)) == spec
    assert validate_spec(spec).ok
    config = ag_grid_spec_config(table, "prices")["columns"]
    assert isinstance(config, list)
    assert config[0]["currencyFormatter"]["symbolColors"] == {"USD": "#22c55e"}
    assert config[0]["currencyFormatter"]["precisionByCurrency"] == {"UAH": 0}
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    assert 'data-cm-sort-val="1234.5"' in html
    assert 'data-cm-export-raw="45.5"' in html
    assert '<span style="color:#22c55e">$</span>' in html
    assert "₴46" in html or "46₴" in html
    assert "&lt;missing&gt;" in html
    assert "<script>" not in html
