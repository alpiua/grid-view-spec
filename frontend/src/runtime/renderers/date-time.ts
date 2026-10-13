type FormatterConfig = {
  format: "date" | "datetime" | "time" | "iso";
  locale: string;
  timezone: string;
  emptyValue?: string;
  strict?: boolean;
};

type ParsedValue =
  | { kind: "date"; year: number; month: number; day: number }
  | { kind: "time"; hour: number; minute: number; second: number }
  | { kind: "instant"; value: Date };

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type CalendarParts = {
  year: number;
  month: number;
  day: number;
};

type ClockParts = {
  hour: number;
  minute: number;
  second: number;
  fraction: string;
  offset: string;
};

const htmlEscapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFormatterConfig(value: unknown): value is FormatterConfig {
  if (!isRecord(value)) return false;
  const format = value.format;
  return (
    (format === "date" || format === "datetime" || format === "time" || format === "iso") &&
    typeof value.locale === "string" &&
    typeof value.timezone === "string" &&
    value.timezone !== "" &&
    (value.emptyValue === undefined || typeof value.emptyValue === "string") &&
    (value.strict === undefined || typeof value.strict === "boolean")
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => htmlEscapes[character] ?? character);
}

function fallback(formatter: unknown): string {
  const emptyValue = isRecord(formatter) && typeof formatter.emptyValue === "string"
    ? formatter.emptyValue
    : "—";
  return escapeHtml(emptyValue);
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1 || month < 1 || month > 12) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysByMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= (daysByMonth[month - 1] ?? 0);
}

function isValidTime(hour: number, minute: number, second: number): boolean {
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 && second >= 0 && second < 60;
}

function parseOffset(offset: string | undefined): string {
  if (!offset || offset.toUpperCase() === "Z") return "Z";
  const digits = offset.slice(1).replace(":", "");
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2, 4));
  if (hours > 23 || minutes > 59) throw new RangeError("Invalid UTC offset");
  return `${offset[0]}${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function parseCalendarDate(value: string): CalendarParts | undefined {
  const dateMatch = /^(?:(\d{4})-(\d{2})-(\d{2})|(\d{4})(\d{2})(\d{2}))$/.exec(value);
  if (!dateMatch) return undefined;
  const year = Number(dateMatch[1] ?? dateMatch[4]);
  const month = Number(dateMatch[2] ?? dateMatch[5]);
  const day = Number(dateMatch[3] ?? dateMatch[6]);
  if (!isValidDate(year, month, day)) throw new RangeError("Invalid calendar date");
  return { year, month, day };
}

function parseClockTime(value: string): ClockParts | undefined {
  const timeMatch = /^(?:(\d{2}):(\d{2})(?::(\d{2}))?|(\d{2})(?:(\d{2})(\d{2})?)?)(?:[.,](\d+))?(Z|[+-]\d{2}:?\d{2})?$/i.exec(value);
  if (!timeMatch) return undefined;
  const fractionDigits = timeMatch[7];
  if (fractionDigits && timeMatch[3] === undefined && timeMatch[6] === undefined) {
    throw new RangeError("Fraction requires clock seconds");
  }
  const hour = Number(timeMatch[1] ?? timeMatch[4]);
  const minute = Number(timeMatch[2] ?? timeMatch[5] ?? "0");
  const second = Number(timeMatch[3] ?? timeMatch[6] ?? "0");
  if (!isValidTime(hour, minute, second)) throw new RangeError("Invalid clock time");
  return {
    hour,
    minute,
    second,
    fraction: fractionDigits ? `.${fractionDigits.slice(0, 3)}` : "",
    offset: parseOffset(timeMatch[8]),
  };
}

function parseValue(value: unknown): ParsedValue {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("Epoch value must be finite");
    const milliseconds = Math.abs(value) >= 100_000_000_000 ? value : value * 1000;
    const instant = new Date(milliseconds);
    if (Number.isNaN(instant.getTime())) throw new RangeError("Epoch value is outside the supported range");
    return { kind: "instant", value: instant };
  }
  if (typeof value !== "string") throw new TypeError("Unsupported date and time value");

  const date = parseCalendarDate(value);
  if (date) return { kind: "date", ...date };

  const dateTimeMatch = /^(\d{4}-\d{2}-\d{2}|\d{8})[Tt ](.+)$/i.exec(value);
  if (dateTimeMatch) {
    const dateParts = parseCalendarDate(dateTimeMatch[1] ?? "");
    const clock = parseClockTime(dateTimeMatch[2] ?? "");
    if (!dateParts || !clock) throw new TypeError("Value is not a supported ISO datetime");
    const canonical = `${pad(dateParts.year, 4)}-${pad(dateParts.month)}-${pad(dateParts.day)}` +
      `T${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}${clock.fraction}${clock.offset}`;
    const instant = new Date(canonical);
    if (Number.isNaN(instant.getTime())) throw new RangeError("Datetime is outside the supported range");
    return { kind: "instant", value: instant };
  }

  const clock = parseClockTime(value);
  if (clock) return { kind: "time", hour: clock.hour, minute: clock.minute, second: clock.second };
  throw new TypeError("Value is not a supported ISO date or time");
}

function normalizedLocale(locale: string): "en-US" | "uk-UA" {
  return locale.trim().replace(/_/g, "-").toLowerCase() === "en-us" ? "en-US" : "uk-UA";
}

function partValue(parts: Intl.DateTimeFormatPart[], type: string): string {
  const part = parts.find((item) => item.type === type);
  if (!part) throw new RangeError(`Missing ${type} date part`);
  return part.value;
}

function zonedParts(value: Date, timezone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const hour = Number(partValue(parts, "hour"));
  return {
    year: Number(partValue(parts, "year")),
    month: Number(partValue(parts, "month")),
    day: Number(partValue(parts, "day")),
    hour: hour === 24 ? 0 : hour,
    minute: Number(partValue(parts, "minute")),
    second: Number(partValue(parts, "second")),
  };
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function dateText(year: number, month: number, day: number, locale: "en-US" | "uk-UA"): string {
  const yyyy = pad(year, 4);
  const mm = pad(month);
  const dd = pad(day);
  return locale === "en-US" ? `${mm}/${dd}/${yyyy}` : `${dd}.${mm}.${yyyy}`;
}

function timeText(hour: number, minute: number, second: number): string {
  return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

function isoOffset(value: Date, parts: ZonedParts): string {
  const localTime = new Date(0);
  localTime.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  localTime.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  const instantSecond = Math.floor(value.getTime() / 1000) * 1000;
  const offsetMinutes = Math.round((localTime.getTime() - instantSecond) / 60_000);
  if (offsetMinutes === 0) return "Z";
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absoluteMinutes = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(absoluteMinutes / 60))}:${pad(absoluteMinutes % 60)}`;
}

function formatParsed(
  value: ParsedValue,
  formatter: FormatterConfig,
  locale: "en-US" | "uk-UA",
): string {
  if (value.kind === "date") {
    if (formatter.format === "time") throw new RangeError("A date cannot be formatted as a time");
    if (formatter.format === "iso") return `${pad(value.year, 4)}-${pad(value.month)}-${pad(value.day)}`;
    const date = dateText(value.year, value.month, value.day, locale);
    return formatter.format === "datetime" ? `${date} 00:00:00` : date;
  }
  if (value.kind === "time") {
    if (formatter.format === "date" || formatter.format === "datetime") {
      throw new RangeError("A time-only value cannot be formatted as a date");
    }
    return timeText(value.hour, value.minute, value.second);
  }

  const parts = zonedParts(value.value, formatter.timezone);
  const date = dateText(parts.year, parts.month, parts.day, locale);
  const time = timeText(parts.hour, parts.minute, parts.second);
  if (formatter.format === "date") return date;
  if (formatter.format === "time") return time;
  if (formatter.format === "datetime") return `${date} ${time}`;
  const milliseconds = value.value.getUTCMilliseconds();
  const fraction = milliseconds === 0 ? "" : `.${pad(milliseconds, 3)}`;
  const isoDate = `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
  return `${isoDate}T${time}${fraction}${isoOffset(value.value, parts)}`;
}

export function dateTimeRenderer(params: unknown): string {
  const colDef = isRecord(params) && isRecord(params.colDef) ? params.colDef : undefined;
  const rendererParams = colDef && isRecord(colDef.cellRendererParams)
    ? colDef.cellRendererParams
    : undefined;
  const formatter = rendererParams?.dateTimeFormatter;
  const emptyHtml = (): string => fallback(formatter);
  const input = isRecord(params) ? params.value : undefined;
  if (input === null || input === undefined || input === "") return emptyHtml();
  if (!isFormatterConfig(formatter)) return emptyHtml();

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: formatter.timezone });
    const parsed = parseValue(input);
    return escapeHtml(formatParsed(parsed, formatter, normalizedLocale(formatter.locale)));
  } catch {
    return emptyHtml();
  }
}
