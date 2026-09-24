"""Typed value formatters for GridViewSpec columns and blocks."""

from __future__ import annotations

import dataclasses
import math
import re
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation, localcontext
from typing import NotRequired, TypedDict


class CurrencyFormatterWire(TypedDict):
    """Wire representation of CurrencyFormatter JSON payload."""

    currency: NotRequired[str]
    locale: NotRequired[str]
    precision: NotRequired[int]
    show_symbol: NotRequired[bool]
    empty_value: NotRequired[str]
    strict: NotRequired[bool]


CURRENCY_SYMBOLS: dict[str, str] = {
    "UAH": "₴",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "PLN": "zł",
    "JPY": "¥",
    "CHF": "CHF",
}


@dataclasses.dataclass(frozen=True, slots=True)
class _LocaleRule:
    grouping: str
    decimal: str
    symbol_position: str  # "prefix" or "suffix"
    space_before_suffix: bool
    space_after_prefix: bool


_LOCALE_RULES: dict[str, _LocaleRule] = {
    "uk-ua": _LocaleRule(
        grouping=" ",
        decimal=",",
        symbol_position="suffix",
        space_before_suffix=True,
        space_after_prefix=False,
    ),
    "de-de": _LocaleRule(
        grouping=".",
        decimal=",",
        symbol_position="suffix",
        space_before_suffix=True,
        space_after_prefix=False,
    ),
    "pl-pl": _LocaleRule(
        grouping=" ",
        decimal=",",
        symbol_position="suffix",
        space_before_suffix=True,
        space_after_prefix=False,
    ),
    "fr-fr": _LocaleRule(
        grouping=" ",
        decimal=",",
        symbol_position="suffix",
        space_before_suffix=True,
        space_after_prefix=False,
    ),
    "en-us": _LocaleRule(
        grouping=",",
        decimal=".",
        symbol_position="prefix",
        space_before_suffix=False,
        space_after_prefix=False,
    ),
    "en-gb": _LocaleRule(
        grouping=",",
        decimal=".",
        symbol_position="prefix",
        space_before_suffix=False,
        space_after_prefix=False,
    ),
    "ja-jp": _LocaleRule(
        grouping=",",
        decimal=".",
        symbol_position="prefix",
        space_before_suffix=False,
        space_after_prefix=False,
    ),
}

_LOCALE_ALIASES: dict[str, str] = {
    "uk": "uk-ua",
    "en": "en-us",
    "de": "de-de",
    "pl": "pl-pl",
    "fr": "fr-fr",
    "ja": "ja-jp",
}

_DEFAULT_LOCALE_RULE = _LocaleRule(
    grouping=",",
    decimal=".",
    symbol_position="prefix",
    space_before_suffix=True,
    space_after_prefix=False,
)


def _get_locale_rule(locale: str) -> _LocaleRule:
    """Normalize locale string and resolve matching formatting rule."""
    normalized = locale.strip().replace("_", "-").lower()
    if normalized in _LOCALE_RULES:
        return _LOCALE_RULES[normalized]
    alias = _LOCALE_ALIASES.get(normalized)
    if alias is not None and alias in _LOCALE_RULES:
        return _LOCALE_RULES[alias]
    prefix = normalized.split("-")[0]
    prefix_alias = _LOCALE_ALIASES.get(prefix)
    if prefix_alias is not None and prefix_alias in _LOCALE_RULES:
        return _LOCALE_RULES[prefix_alias]
    return _DEFAULT_LOCALE_RULE


def _is_valid_grouping(groups: list[str]) -> bool:
    """Validate that integer digit grouping conforms to standard 3-digit groups."""
    if not groups or len(groups) < 2:
        return False
    first = groups[0]
    if not (1 <= len(first) <= 3 and first.isdigit()):
        return False
    return all(len(g) == 3 and g.isdigit() for g in groups[1:])


def _parse_number_to_decimal(
    value: object,
    *,
    locale: str = "uk-UA",
    strict: bool = False,
) -> Decimal | None:
    """Parse raw value to Decimal; returns None for non-numeric, NaN, and Inf."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return Decimal(str(value))
    if isinstance(value, Decimal):
        if value.is_nan() or value.is_infinite():
            return None
        return value
    if strict or not isinstance(value, str):
        return None

    cleaned = value.strip().replace("\u00a0", " ")
    if not cleaned:
        return None
    # Remove known currency symbols
    for sym in CURRENCY_SYMBOLS.values():
        cleaned = cleaned.replace(sym, "")
    cleaned = cleaned.strip()
    # Clean currency codes if at start or end with space
    cleaned = re.sub(r"^[A-Z]{3}\s+", "", cleaned)
    cleaned = re.sub(r"\s+[A-Z]{3}$", "", cleaned)
    cleaned = cleaned.strip()
    if not cleaned:
        return None

    # Check for multiple signs e.g. "--12"
    if cleaned.startswith(("-", "+")):
        sign = "-" if cleaned.startswith("-") else ""
        rest = cleaned[1:].strip()
        if not rest or rest.startswith(("-", "+")):
            return None
        body_with_spaces = rest
    else:
        sign = ""
        body_with_spaces = cleaned

    # Space grouping validation
    if " " in body_with_spaces:
        int_part = body_with_spaces
        if "," in body_with_spaces and "." in body_with_spaces:
            last_comma = body_with_spaces.rfind(",")
            last_dot = body_with_spaces.rfind(".")
            dec_pos = max(last_comma, last_dot)
            int_part = body_with_spaces[:dec_pos]
            if " " in body_with_spaces[dec_pos:]:
                return None
        elif "," in body_with_spaces:
            parts = body_with_spaces.split(",")
            if len(parts) == 2:
                int_part = parts[0]
                if " " in parts[1]:
                    return None
        elif "." in body_with_spaces:
            parts = body_with_spaces.split(".")
            if len(parts) == 2:
                int_part = parts[0]
                if " " in parts[1]:
                    return None

        space_groups = int_part.split(" ")
        if len(space_groups) > 1 and not _is_valid_grouping(space_groups):
            return None

    # Remove spaces used as grouping
    cleaned_no_spaces = body_with_spaces.replace(" ", "")
    body = cleaned_no_spaces
    if not body:
        return None

    rule = _get_locale_rule(locale)
    has_comma = "," in body
    has_dot = "." in body

    if has_comma and has_dot:
        last_comma = body.rfind(",")
        last_dot = body.rfind(".")
        if last_comma > last_dot:
            # 1.234,56 format: dots are thousands, comma is decimal
            int_part, dec_part = body.rsplit(",", 1)
            if not dec_part.isdigit():
                return None
            if "." in int_part:
                groups = int_part.split(".")
                if not _is_valid_grouping(groups):
                    return None
                int_clean = "".join(groups)
            else:
                if not int_part.isdigit():
                    return None
                int_clean = int_part
            normalized = f"{sign}{int_clean}.{dec_part}"
        else:
            # 1,234.56 format: commas are thousands, dot is decimal
            int_part, dec_part = body.rsplit(".", 1)
            if not dec_part.isdigit():
                return None
            if "," in int_part:
                groups = int_part.split(",")
                if not _is_valid_grouping(groups):
                    return None
                int_clean = "".join(groups)
            else:
                if not int_part.isdigit():
                    return None
                int_clean = int_part
            normalized = f"{sign}{int_clean}.{dec_part}"
    elif has_comma:
        groups = body.split(",")
        if len(groups) > 2:
            if not _is_valid_grouping(groups):
                return None
            normalized = f"{sign}{''.join(groups)}"
        elif rule.grouping == "," and _is_valid_grouping(groups):
            normalized = f"{sign}{''.join(groups)}"
        else:
            if len(groups) == 2 and groups[0].isdigit() and groups[1].isdigit():
                normalized = f"{sign}{groups[0]}.{groups[1]}"
            else:
                return None
    elif has_dot:
        groups = body.split(".")
        if len(groups) > 2:
            if not _is_valid_grouping(groups):
                return None
            normalized = f"{sign}{''.join(groups)}"
        elif rule.grouping == "." and _is_valid_grouping(groups):
            normalized = f"{sign}{''.join(groups)}"
        else:
            if len(groups) == 2 and groups[0].isdigit() and groups[1].isdigit():
                normalized = f"{sign}{groups[0]}.{groups[1]}"
            else:
                return None
    else:
        if not body.isdigit():
            return None
        normalized = f"{sign}{body}"

    try:
        parsed = Decimal(normalized)
        if parsed.is_nan() or parsed.is_infinite():
            return None
        return parsed
    except (InvalidOperation, ValueError):
        return None


def _format_currency(
    value: Decimal,
    *,
    currency: str,
    locale: str,
    precision: int,
    show_symbol: bool,
) -> str:
    """Format Decimal into locale-aware currency representation."""
    rule = _get_locale_rule(locale)
    prec = max(0, min(precision, 6))
    digits_count = len(value.as_tuple().digits) + prec + 4
    with localcontext() as ctx:
        ctx.prec = max(28, digits_count)
        if prec == 0:
            quant = Decimal("1")
        else:
            quant = Decimal(f"1e-{prec}")
        try:
            rounded = value.quantize(quant, rounding=ROUND_HALF_UP)
        except (InvalidOperation, OverflowError):
            return ""

        is_negative = rounded < Decimal(0)
        abs_d = abs(rounded)
        d_str = f"{abs_d:f}"
        parts = d_str.split(".")
        int_str = parts[0]
        frac_part = parts[1] if len(parts) > 1 else ("0" * prec if prec > 0 else "")

    # Format integer part with thousands grouping
    groups: list[str] = []
    while int_str:
        groups.append(int_str[-3:])
        int_str = int_str[:-3]
    groups.reverse()
    formatted_int = rule.grouping.join(groups) if groups else "0"

    # Format fractional part
    if prec > 0:
        number_str = f"{formatted_int}{rule.decimal}{frac_part}"
    else:
        number_str = formatted_int

    if not show_symbol:
        return f"-{number_str}" if is_negative else number_str

    curr_upper = currency.upper()
    symbol = CURRENCY_SYMBOLS.get(curr_upper, currency)
    is_multi_letter = len(symbol) > 1

    if rule.symbol_position == "suffix":
        symbol_spaced = f" {symbol}" if rule.space_before_suffix or is_multi_letter else symbol
        res = f"{number_str}{symbol_spaced}"
        return f"-{res}" if is_negative else res

    # prefix
    symbol_spaced = f"{symbol} " if is_multi_letter else symbol
    res = f"{symbol_spaced}{number_str}"
    return f"-{res}" if is_negative else res


@dataclasses.dataclass(frozen=True, slots=True)
class CurrencyFormatter:
    """Format numeric values as localized currency strings.

    Total function: never raises exceptions on invalid or empty inputs.
    """

    currency: str = "UAH"
    locale: str = "uk-UA"
    precision: int = 2
    show_symbol: bool = True
    empty_value: str = "—"
    strict: bool = False

    def format(self, value: object, *, empty_value: str | None = None) -> str:
        """Format ``value`` to a currency string; returns ``empty_value`` on failure."""
        fallback = self.empty_value if empty_value is None else empty_value
        try:
            num = _parse_number_to_decimal(value, locale=self.locale, strict=self.strict)
            if num is None:
                return fallback

            res = _format_currency(
                num,
                currency=self.currency,
                locale=self.locale,
                precision=self.precision,
                show_symbol=self.show_symbol,
            )
            return res if res else fallback
        except Exception:
            return fallback

    def __call__(self, value: object) -> str:
        """Callable interface delegating to :meth:`format`."""
        return self.format(value)
