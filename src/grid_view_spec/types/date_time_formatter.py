"""Pure date and time value formatting for GridViewSpec columns."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal, DecimalException
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DateTimeFormat = Literal["date", "datetime", "time", "iso"]


@dataclass(frozen=True, slots=True)
class DateTimeFormatter:
    """Settings for formatting date and time values without global locale state."""

    format: DateTimeFormat = "datetime"
    locale: str = "uk-UA"
    timezone: str = "UTC"
    empty_value: str = "—"
    strict: bool = False


_TemporalValue = date | datetime | time


def _parse_epoch(value: int | float | Decimal) -> datetime:
    """Convert seconds or milliseconds since the Unix epoch into a UTC instant."""
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Epoch value must be finite")
    if isinstance(value, Decimal) and not value.is_finite():
        raise ValueError("Epoch value must be finite")

    try:
        if abs(value) >= 100_000_000_000:
            seconds = value / 1000
        else:
            seconds = value
        return datetime.fromtimestamp(float(seconds), tz=UTC)
    except (DecimalException, OverflowError, OSError, ValueError) as exc:
        raise ValueError("Epoch value is outside the supported datetime range") from exc


def _parse_value(value: object) -> _TemporalValue:
    """Parse a supported native temporal, ISO string, or numeric epoch value."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return value
    if isinstance(value, time):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            pass
        try:
            return time.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Value is not a supported ISO date or time") from exc
    if isinstance(value, bool):
        raise ValueError("Boolean values are not epoch numbers")
    if isinstance(value, (int, float, Decimal)):
        return _parse_epoch(value)
    raise ValueError("Value is not a supported date or time")


def _zone(timezone_name: object) -> ZoneInfo:
    """Resolve an IANA timezone name and normalize lookup failures."""
    if not isinstance(timezone_name, str) or not timezone_name:
        raise ValueError("Timezone must be a non-empty IANA name")
    try:
        return ZoneInfo(timezone_name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError(f"Unknown timezone: {timezone_name}") from exc


def _as_local_datetime(value: datetime, zone: ZoneInfo) -> datetime:
    """Interpret naive datetimes as UTC, then project the instant into its zone."""
    aware = value.replace(tzinfo=UTC) if value.utcoffset() is None else value
    try:
        return aware.astimezone(zone)
    except (OverflowError, OSError, ValueError) as exc:
        raise ValueError("Datetime is outside the supported timezone range") from exc


def _format_date(value: date, locale: str) -> str:
    if locale == "en-US":
        return f"{value.month:02d}/{value.day:02d}/{value.year:04d}"
    return f"{value.day:02d}.{value.month:02d}.{value.year:04d}"


def _format_time(value: time) -> str:
    return f"{value.hour:02d}:{value.minute:02d}:{value.second:02d}"


def _format_iso_datetime(value: datetime) -> str:
    timespec = "milliseconds" if value.microsecond else "seconds"
    rendered = value.isoformat(timespec=timespec)
    if value.utcoffset() == timedelta(0):
        rendered = rendered.removesuffix("+00:00").removesuffix("-00:00") + "Z"
    return rendered


def _format_parsed(
    value: _TemporalValue,
    *,
    output_format: object,
    locale: str,
    zone: ZoneInfo,
) -> str:
    if output_format == "date":
        if isinstance(value, time):
            raise ValueError("A time-only value cannot be formatted as a date")
        if isinstance(value, datetime):
            displayed_date = _as_local_datetime(value, zone).date()
        else:
            displayed_date = value
        return _format_date(displayed_date, locale)

    if output_format == "time":
        if isinstance(value, date) and not isinstance(value, datetime):
            raise ValueError("A date-only value cannot be formatted as a time")
        if isinstance(value, datetime):
            displayed_time = _as_local_datetime(value, zone).time()
        else:
            displayed_time = value
        return _format_time(displayed_time)

    if output_format == "datetime":
        if isinstance(value, time):
            raise ValueError("A time-only value cannot be formatted as a datetime")
        if isinstance(value, datetime):
            displayed = _as_local_datetime(value, zone)
            displayed_date = displayed.date()
            displayed_time = displayed.time()
        else:
            displayed_date = value
            displayed_time = time()
        return f"{_format_date(displayed_date, locale)} {_format_time(displayed_time)}"

    if output_format == "iso":
        if isinstance(value, datetime):
            return _format_iso_datetime(_as_local_datetime(value, zone))
        if isinstance(value, date):
            return value.isoformat()
        return _format_time(value)

    raise ValueError(f"Unsupported date and time format: {output_format}")


def format_datetime_value(value: object, formatter: DateTimeFormatter) -> str:
    """Format a supported temporal value, returning or raising according to strict."""
    if value is None or (isinstance(value, str) and value == ""):
        return formatter.empty_value

    try:
        output_format = formatter.format
        if output_format not in {"date", "datetime", "time", "iso"}:
            raise ValueError(f"Unsupported date and time format: {output_format}")
        requested_locale = formatter.locale.strip().replace("_", "-").lower()
        locale = "en-US" if requested_locale == "en-us" else "uk-UA"
        timezone_name = formatter.timezone
        zone = _zone(timezone_name)
        parsed = _parse_value(value)
        return _format_parsed(
            parsed,
            output_format=output_format,
            locale=locale,
            zone=zone,
        )
    except (AttributeError, OverflowError, OSError, TypeError, ValueError) as exc:
        if formatter.strict:
            if isinstance(exc, ValueError):
                raise
            raise ValueError("Unable to format date and time value") from exc
        return formatter.empty_value
