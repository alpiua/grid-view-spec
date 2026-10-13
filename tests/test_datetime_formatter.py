"""Contract tests for the pure date and time formatter seam."""

from __future__ import annotations

import dataclasses
from datetime import UTC, date, datetime, time
from decimal import Decimal

import pytest

from grid_view_spec import (
    DateTimeFormatter as PublicDateTimeFormatter,
)
from grid_view_spec import (
    format_datetime_value as public_format_datetime_value,
)
from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render import render_grid_view_spec
from grid_view_spec.types import (
    DateTimeFormatter as TypesDateTimeFormatter,
)
from grid_view_spec.types import (
    format_datetime_value as types_format_datetime_value,
)
from grid_view_spec.types.formatters import (
    DateTimeFormatter,
    format_datetime_value,
)
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.spec import GridViewSpec
from grid_view_spec.types.table_v2 import (
    GridViewColumn,
    GridViewTable,
    GridViewTableFooter,
)


def test_formatter_is_frozen_and_reexported_from_public_modules() -> None:
    formatter = DateTimeFormatter()

    assert dataclasses.is_dataclass(formatter)
    assert formatter.format == "datetime"
    assert formatter.locale == "uk-UA"
    assert formatter.timezone == "UTC"
    assert formatter.empty_value == "—"
    assert formatter.strict is False
    assert PublicDateTimeFormatter is DateTimeFormatter
    assert TypesDateTimeFormatter is DateTimeFormatter
    assert public_format_datetime_value is format_datetime_value
    assert types_format_datetime_value is format_datetime_value

    with pytest.raises(dataclasses.FrozenInstanceError):
        setattr(formatter, "locale", "en-US")


def test_configured_table_dates_render_with_formatter_before_empty_handling() -> None:
    table = GridViewTable(
        id="dates",
        columns=(
            GridViewColumn(
                id="created",
                label="Created",
                field="created",
                type="date",
                date_time_formatter=DateTimeFormatter(
                    format="date", empty_value="<i>missing date</i>"
                ),
            ),
            GridViewColumn(
                id="updated",
                label="Updated",
                field="updated",
                type="datetime",
                date_time_formatter=DateTimeFormatter(
                    format="datetime", empty_value="<b>missing time</b>"
                ),
            ),
            GridViewColumn(
                id="plain",
                label="Plain",
                field="plain",
                type="date",
            ),
        ),
        rows=(
            {
                "created": "2024-03-05",
                "updated": 1_709_596_800,
                "plain": "2024-03-06",
            },
        ),
        footer=GridViewTableFooter(row=True, label="Total"),
        extra={
            "footer_row": {
                "created": None,
                "updated": None,
                "plain": "2024-03-07",
            }
        },
    )
    spec = GridViewSpec(
        id="date_spec",
        blocks=(table,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(table.id,))),
    )

    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")

    assert "05.03.2024" in html
    assert "05.03.2024 00:00:00" in html
    assert "&lt;i&gt;missing date&lt;/i&gt;" in html
    assert "&lt;b&gt;missing time&lt;/b&gt;" in html
    assert "2024-03-06" in html
    assert "2024-03-07" in html


def test_native_temporal_values_keep_their_components() -> None:
    assert format_datetime_value(date(2024, 3, 5), DateTimeFormatter(format="date")) == "05.03.2024"
    assert format_datetime_value(time(14, 5, 6), DateTimeFormatter(format="time")) == "14:05:06"
    assert (
        format_datetime_value(
            datetime(2024, 3, 5, 14, 5, 6, tzinfo=UTC),
            DateTimeFormatter(format="datetime"),
        )
        == "05.03.2024 14:05:06"
    )


def test_iso_temporal_values_and_epoch_seconds_and_milliseconds() -> None:
    formatter = DateTimeFormatter(format="datetime")
    assert format_datetime_value("2024-03-05", formatter) == "05.03.2024 00:00:00"
    assert format_datetime_value("14:05:06", formatter) == "—"
    assert format_datetime_value("2024-03-05T14:05:06+00:00", formatter) == "05.03.2024 14:05:06"

    assert (
        format_datetime_value(1_704_067_200, DateTimeFormatter(format="datetime"))
        == "01.01.2024 00:00:00"
    )
    assert (
        format_datetime_value(1_704_067_200_000, DateTimeFormatter(format="datetime"))
        == "01.01.2024 00:00:00"
    )


def test_strict_mode_accepts_valid_iso_datetime() -> None:
    formatter = DateTimeFormatter(format="datetime", strict=True)
    assert format_datetime_value("2024-03-05T14:05:06+00:00", formatter) == ("05.03.2024 14:05:06")


def test_epoch_millisecond_cutoff_applies_to_both_signs() -> None:
    formatter = DateTimeFormatter(format="iso")
    assert format_datetime_value(100_000_000_000, formatter) == "1973-03-03T09:46:40Z"
    assert format_datetime_value(-100_000_000_000, formatter) == "1966-10-31T14:13:20Z"
    assert format_datetime_value(99_999_999_999, formatter) == "5138-11-16T09:46:39Z"

    # Just below the negative cutoff means seconds, which is outside Python's
    # representable datetime range; interpreting it as milliseconds would succeed.
    with pytest.raises(ValueError):
        format_datetime_value(
            -99_999_999_999,
            DateTimeFormatter(format="iso", strict=True),
        )


def test_boolean_is_not_accepted_as_an_epoch_number() -> None:
    assert format_datetime_value(True, DateTimeFormatter(empty_value="N/A")) == "N/A"
    with pytest.raises(ValueError):
        format_datetime_value(True, DateTimeFormatter(strict=True))


def test_naive_native_and_iso_datetimes_are_utc_before_timezone_projection() -> None:
    formatter = DateTimeFormatter(format="datetime", timezone="Europe/Kyiv")
    expected = "15.01.2024 14:00:00"

    assert format_datetime_value(datetime(2024, 1, 15, 12), formatter) == expected
    assert format_datetime_value("2024-01-15T12:00:00", formatter) == expected


def test_supported_locales_and_unknown_locale_fallback() -> None:
    value = date(2024, 3, 5)
    assert (
        format_datetime_value(value, DateTimeFormatter(format="date", locale="uk-UA"))
        == "05.03.2024"
    )
    assert (
        format_datetime_value(value, DateTimeFormatter(format="date", locale="de-DE"))
        == "05.03.2024"
    )
    assert (
        format_datetime_value(value, DateTimeFormatter(format="date", locale="en-US"))
        == "03/05/2024"
    )
    assert (
        format_datetime_value(value, DateTimeFormatter(format="date", locale="fr-FR"))
        == "05.03.2024"
    )


def test_iso_output_uses_target_offset_z_and_at_most_milliseconds() -> None:
    value = datetime(2024, 1, 15, 12, 34, 56, 123_456, tzinfo=UTC)
    assert (
        format_datetime_value(value, DateTimeFormatter(format="iso")) == "2024-01-15T12:34:56.123Z"
    )
    assert (
        format_datetime_value(value, DateTimeFormatter(format="iso", timezone="Europe/Kyiv"))
        == "2024-01-15T14:34:56.123+02:00"
    )


def test_iso_date_and_time_values_keep_component_only_shapes() -> None:
    assert format_datetime_value(date(2024, 3, 5), DateTimeFormatter(format="iso")) == "2024-03-05"
    assert format_datetime_value(time(14, 5, 6), DateTimeFormatter(format="iso")) == "14:05:06"


def test_date_and_time_only_values_ignore_named_timezone_projection() -> None:
    date_value = date(2024, 3, 5)
    time_value = time(14, 5, 6)

    assert (
        format_datetime_value(date_value, DateTimeFormatter(format="date", timezone="Europe/Kyiv"))
        == "05.03.2024"
    )
    assert (
        format_datetime_value(time_value, DateTimeFormatter(format="time", timezone="Europe/Kyiv"))
        == "14:05:06"
    )
    assert (
        format_datetime_value(date_value, DateTimeFormatter(format="iso", timezone="Europe/Kyiv"))
        == "2024-03-05"
    )
    assert (
        format_datetime_value(time_value, DateTimeFormatter(format="iso", timezone="Europe/Kyiv"))
        == "14:05:06"
    )
    assert (
        format_datetime_value(
            "14:05:06+03:00",
            DateTimeFormatter(format="iso", timezone="Europe/Kyiv"),
        )
        == "14:05:06"
    )


def test_time_only_datetime_is_invalid_in_strict_and_lenient_modes() -> None:
    assert (
        format_datetime_value(
            time(14, 5, 6), DateTimeFormatter(format="datetime", empty_value="N/A")
        )
        == "N/A"
    )
    with pytest.raises(ValueError):
        format_datetime_value(
            time(14, 5, 6),
            DateTimeFormatter(format="datetime", strict=True),
        )


def test_date_as_time_is_invalid_in_strict_and_lenient_modes() -> None:
    assert (
        format_datetime_value(date(2024, 3, 5), DateTimeFormatter(format="time", empty_value="N/A"))
        == "N/A"
    )
    with pytest.raises(ValueError):
        format_datetime_value(
            date(2024, 3, 5),
            DateTimeFormatter(format="time", strict=True),
        )


def test_time_as_date_is_invalid_in_strict_and_lenient_modes() -> None:
    assert (
        format_datetime_value(time(14, 5, 6), DateTimeFormatter(format="date", empty_value="N/A"))
        == "N/A"
    )
    with pytest.raises(ValueError):
        format_datetime_value(
            time(14, 5, 6),
            DateTimeFormatter(format="date", strict=True),
        )


@pytest.mark.parametrize("strict", [False, True])
def test_none_and_empty_string_return_empty_value_in_both_modes(strict: bool) -> None:
    formatter = DateTimeFormatter(strict=strict, empty_value="N/A")
    assert format_datetime_value(None, formatter) == "N/A"
    assert format_datetime_value("", formatter) == "N/A"


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_non_finite_epoch_values_obey_strict_mode(value: float) -> None:
    assert format_datetime_value(value, DateTimeFormatter(empty_value="N/A")) == "N/A"
    with pytest.raises(ValueError):
        format_datetime_value(value, DateTimeFormatter(strict=True))


def test_out_of_range_finite_decimal_epoch_obeys_strict_mode() -> None:
    value = Decimal("1e999999999")
    assert format_datetime_value(value, DateTimeFormatter(empty_value="N/A")) == "N/A"
    with pytest.raises(ValueError):
        format_datetime_value(value, DateTimeFormatter(strict=True))


def test_invalid_value_timezone_and_format_obey_strict_mode() -> None:
    assert format_datetime_value("not-a-date", DateTimeFormatter(empty_value="N/A")) == "N/A"
    assert (
        format_datetime_value(
            datetime(2024, 1, 1),
            DateTimeFormatter(timezone="Invalid/Timezone", empty_value="N/A"),
        )
        == "N/A"
    )

    strict_formatter = DateTimeFormatter(strict=True)
    with pytest.raises(ValueError):
        format_datetime_value("not-a-date", strict_formatter)
    with pytest.raises(ValueError):
        format_datetime_value(
            datetime(2024, 1, 1),
            DateTimeFormatter(timezone="Invalid/Timezone", strict=True),
        )

    # Model a corrupt runtime config while retaining the typed public API.
    invalid_format = DateTimeFormatter(strict=True)
    object.__setattr__(invalid_format, "format", "unsupported")
    with pytest.raises(ValueError):
        format_datetime_value(date(2024, 1, 1), invalid_format)

    lenient_invalid_format = DateTimeFormatter(empty_value="N/A")
    object.__setattr__(lenient_invalid_format, "format", "unsupported")
    assert format_datetime_value(date(2024, 1, 1), lenient_invalid_format) == "N/A"


def test_invalid_timezone_and_format_are_checked_for_component_values() -> None:
    date_value = date(2024, 1, 1)
    time_value = time(12, 30)
    with pytest.raises(ValueError):
        format_datetime_value(
            date_value,
            DateTimeFormatter(format="date", timezone="Invalid/Timezone", strict=True),
        )

    invalid_format = DateTimeFormatter(format="date", strict=True)
    object.__setattr__(invalid_format, "format", "unsupported")
    with pytest.raises(ValueError):
        format_datetime_value(time_value, invalid_format)
