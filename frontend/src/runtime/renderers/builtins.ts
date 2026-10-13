/**
 * Default AG-Grid cell renderers — wired from column spec `renderer` + `extra`.
 */
import { registerRenderer } from "../../grid-view/registry-api";
import { serializeConfirmAttribute } from "../../grid-view/action-confirmation";
import { dateTimeRenderer } from "./date-time";

type AgCellParams = Record<string, unknown> & {
  value?: unknown;
  data?: Record<string, unknown>;
  colDef?: { field?: string; cellRendererParams?: Record<string, unknown> };
};

export type CurrencyFormatterConfig = {
  currency: string;
  locale: string;
  precision: number;
  showSymbol: boolean;
  emptyValue?: string;
  strict?: boolean;
  symbolColors?: Record<string, string>;
  precisionByCurrency?: Record<string, number>;
};

function isCurrencyFormatterConfig(value: unknown): value is CurrencyFormatterConfig {
  if (
    typeof value !== "object" ||
    value === null ||
    !("currency" in value) ||
    !("locale" in value) ||
    !("precision" in value) ||
    !("showSymbol" in value)
  ) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.currency === "string" &&
    typeof c.locale === "string" &&
    typeof c.precision === "number" &&
    typeof c.showSymbol === "boolean" &&
    (!("emptyValue" in c) || typeof c.emptyValue === "string" || c.emptyValue === undefined) &&
    (!("strict" in c) || typeof c.strict === "boolean" || c.strict === undefined)
  );
}

function escHtml(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  const d = document.createElement("div");
  d.textContent = String(value);
  return d.innerHTML;
}

function isValidGrouping(groups: string[]): boolean {
  if (!groups || groups.length < 2) return false;
  const first = groups[0];
  if (first.length < 1 || first.length > 3 || !/^\d+$/.test(first)) return false;
  return groups.slice(1).every((g) => g.length === 3 && /^\d+$/.test(g));
}

function parseFormattedNumber(value: unknown, locale: string): number | string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  let cleaned = value.trim().replace(/\u00a0/g, " ");
  if (!cleaned) return null;
  cleaned = cleaned.replace(/[\$€£₴¥]/g, "").trim();
  cleaned = cleaned.replace(/^[A-Z]{3}\s+/, "").replace(/\s+[A-Z]{3}$/, "").trim();
  if (!cleaned) return null;

  let sign = "";
  let bodyWithSpaces = cleaned;
  if (cleaned.startsWith("-") || cleaned.startsWith("+")) {
    sign = cleaned.startsWith("-") ? "-" : "";
    const rest = cleaned.slice(1).trim();
    if (!rest || rest.startsWith("+") || rest.startsWith("-")) {
      return null;
    }
    bodyWithSpaces = rest;
  }

  // Space grouping validation
  if (bodyWithSpaces.includes(" ")) {
    let intPart = bodyWithSpaces;
    if (bodyWithSpaces.includes(",") && bodyWithSpaces.includes(".")) {
      const lastComma = bodyWithSpaces.lastIndexOf(",");
      const lastDot = bodyWithSpaces.lastIndexOf(".");
      const decPos = Math.max(lastComma, lastDot);
      intPart = bodyWithSpaces.slice(0, decPos);
      if (bodyWithSpaces.slice(decPos).includes(" ")) return null;
    } else if (bodyWithSpaces.includes(",")) {
      const parts = bodyWithSpaces.split(",");
      if (parts.length === 2) {
        intPart = parts[0];
        if (parts[1].includes(" ")) return null;
      }
    } else if (bodyWithSpaces.includes(".")) {
      const parts = bodyWithSpaces.split(".");
      if (parts.length === 2) {
        intPart = parts[0];
        if (parts[1].includes(" ")) return null;
      }
    }

    const spaceGroups = intPart.split(" ");
    if (spaceGroups.length > 1 && !isValidGrouping(spaceGroups)) {
      return null;
    }
  }

  const noSpaces = bodyWithSpaces.replace(/ /g, "");
  const body = noSpaces;
  if (!body) return null;

  const hasComma = body.includes(",");
  const hasDot = body.includes(".");
  const loc = locale.toLowerCase();
  const isDotGroupingLocale = loc.startsWith("de");
  const isCommaGroupingLocale = loc.startsWith("en") || loc.startsWith("ja");

  let normalized: string | null = null;

  if (hasComma && hasDot) {
    const lastComma = body.lastIndexOf(",");
    const lastDot = body.lastIndexOf(".");
    if (lastComma > lastDot) {
      const intPart = body.slice(0, lastComma);
      const decPart = body.slice(lastComma + 1);
      if (!/^\d+$/.test(decPart)) return null;
      if (intPart.includes(".")) {
        const groups = intPart.split(".");
        if (!isValidGrouping(groups)) return null;
        normalized = `${sign}${groups.join("")}.${decPart}`;
      } else {
        if (!/^\d+$/.test(intPart)) return null;
        normalized = `${sign}${intPart}.${decPart}`;
      }
    } else {
      const intPart = body.slice(0, lastDot);
      const decPart = body.slice(lastDot + 1);
      if (!/^\d+$/.test(decPart)) return null;
      if (intPart.includes(",")) {
        const groups = intPart.split(",");
        if (!isValidGrouping(groups)) return null;
        normalized = `${sign}${groups.join("")}.${decPart}`;
      } else {
        if (!/^\d+$/.test(intPart)) return null;
        normalized = `${sign}${intPart}.${decPart}`;
      }
    }
  } else if (hasComma) {
    const groups = body.split(",");
    if (groups.length > 2) {
      if (!isValidGrouping(groups)) return null;
      normalized = `${sign}${groups.join("")}`;
    } else if (isCommaGroupingLocale && isValidGrouping(groups)) {
      normalized = `${sign}${groups.join("")}`;
    } else {
      if (groups.length === 2 && /^\d+$/.test(groups[0]) && /^\d+$/.test(groups[1])) {
        normalized = `${sign}${groups[0]}.${groups[1]}`;
      } else {
        return null;
      }
    }
  } else if (hasDot) {
    const groups = body.split(".");
    if (groups.length > 2) {
      if (!isValidGrouping(groups)) return null;
      normalized = `${sign}${groups.join("")}`;
    } else if (isDotGroupingLocale && isValidGrouping(groups)) {
      normalized = `${sign}${groups.join("")}`;
    } else {
      if (groups.length === 2 && /^\d+$/.test(groups[0]) && /^\d+$/.test(groups[1])) {
        normalized = `${sign}${groups[0]}.${groups[1]}`;
      } else {
        return null;
      }
    }
  } else {
    if (!/^\d+$/.test(body)) return null;
    normalized = `${sign}${body}`;
  }

  if (normalized === null) return null;
  return normalized;
}

export type CurrencyParts = readonly [prefix: string, symbol: string, suffix: string, color: string];

export function formatCurrencyParts(
  value: unknown, formatter: unknown, currencyOverride: unknown = null,
): CurrencyParts {
  if (!isCurrencyFormatterConfig(formatter)) return ["", "", "", ""];
  const fallback: CurrencyParts = [formatter.emptyValue ?? "", "", "", ""];
  try {
    if (value === undefined || value === null || (typeof value === "string" && !value.trim()) ||
        typeof value === "boolean" || (formatter.strict && typeof value === "string")) return fallback;
    const currency = currencyOverride === null || currencyOverride === undefined || currencyOverride === ""
      ? formatter.currency : currencyOverride;
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency.toUpperCase())) return fallback;
    const code = currency.toUpperCase();
    const precision = formatter.precisionByCurrency?.[code] ?? formatter.precision;
    if (!Number.isInteger(precision) || precision < 0 || precision > 6) return fallback;
    const color = formatter.symbolColors?.[code] ?? "";
    if (typeof color !== "string" || (color && !/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(color))) return fallback;
    const number = parseFormattedNumber(value, formatter.locale);
    if (number === null) return fallback;
    const formatted = new Intl.NumberFormat(
      formatter.locale,
      formatter.showSymbol
        ? { style: "currency", currency: code, minimumFractionDigits: precision, maximumFractionDigits: precision }
        : { minimumFractionDigits: precision, maximumFractionDigits: precision },
    ).formatToParts(number as number);
    const index = formatted.findIndex((part) => part.type === "currency");
    if (index < 0) return [formatted.map((part) => part.value).join(""), "", "", ""];
    return [
      formatted.slice(0, index).map((part) => part.value).join(""),
      formatted[index].value,
      formatted.slice(index + 1).map((part) => part.value).join(""),
      color,
    ];
  } catch {
    return fallback;
  }
}

function moneyRenderer(params: AgCellParams): string {
  try {
    const value = params.value;
    const formatter = params.colDef?.cellRendererParams?.currencyFormatter;
    if (formatter !== undefined && formatter !== null) {
      const field = params.colDef?.field || "";
      const [prefix, symbol, suffix, color] = formatCurrencyParts(
        value, formatter, params.data?.[`${field}_currency`],
      );
      const safeValue = escHtml(prefix) +
        (symbol ? (color ? `<span style="color:${color}">${escHtml(symbol)}</span>` : escHtml(symbol)) : "") +
        escHtml(suffix);
      const cssClass = String(params.colDef?.cellRendererParams?.css_class || "");
      return cssClass ? `<span class="${escHtml(cssClass)}">${safeValue}</span>` : safeValue;
    }

    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      typeof value === "boolean"
    ) return "";

    const field = params.colDef?.field || "";
    const rowCurr = params.data?.[`${field}_currency`];
    const curr = (typeof rowCurr === "string" && rowCurr) || "UAH";
    const symbols: Record<string, string> = { USD: "$", EUR: "€", UAH: "₴", PLN: "zł", GBP: "£" };
    const sym = symbols[curr] || curr;
    const numValue = Number(value);
    const useDecimals = curr !== "UAH";
    const displayValue = useDecimals
      ? numValue.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : Math.round(numValue).toLocaleString("uk-UA");
    const cssClass = String(params.colDef?.cellRendererParams?.css_class || "");
    const inner =
      escHtml(displayValue) + ` ${escHtml(sym)}`;
    return cssClass ? `<span class="${escHtml(cssClass)}">${inner}</span>` : inner;
  } catch {
    return "";
  }
}

function linkRenderer(params: AgCellParams): string {
  const field = params.colDef?.field || "";
  const extra = params.colDef?.cellRendererParams || {};
  const url = params.data?.[`${field}__url`];
  const text = params.value ?? "";
  const action = extra.action ? String(extra.action) : "";
  const recordKey = String(extra.record_key || "id");
  const rowId = params.data?.[recordKey];
  const rowAttr = rowId != null ? ` data-cm-row-id="${escHtml(rowId)}"` : "";
  const confirm = serializeConfirmAttribute(extra.confirm);
  const confirmAttr = confirm ? ` data-cm-confirm="${escHtml(confirm)}"` : "";
  if (typeof url === "string" && url) {
    const actionAttr = action ? ` data-cm-cell-action="${escHtml(action)}"` : "";
    return (
      `<a href="${escHtml(url)}" class="cm-grid-link cm-link"${actionAttr}${rowAttr}${confirmAttr}` +
      ` style="font-weight:500;color:#818cf8">${escHtml(text)}</a>`
    );
  }
  if (action) {
    return (
      `<span class="cm-grid-link cm-link" role="button" tabindex="0"` +
      ` data-cm-cell-action="${escHtml(action)}"${rowAttr}${confirmAttr}` +
      ` style="font-weight:500;cursor:pointer;color:#818cf8">${escHtml(text)}</span>`
    );
  }
  return escHtml(text);
}

function badgeRenderer(params: AgCellParams): string {
  const value = params.value;
  if (value === undefined || value === null || value === "") return "";
  const extra = params.colDef?.cellRendererParams || {};
  const badges = (extra.badges as Record<string, string>) || {};
  const labels = (extra.badge_labels as Record<string, string>) || {};
  const labelField = extra.label_field ? String(extra.label_field) : "";
  const key = String(value);
  const cls = badges[key] || "badge-slate";
  let label = labels[key] || key;
  if (labelField && params.data?.[labelField] != null) {
    label = String(params.data[labelField]);
  }
  return `<span class="badge ${escHtml(cls)}">${escHtml(label)}</span>`;
}

function dateRenderer(params: AgCellParams): string {
  const value = params.value;
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return escHtml(value);
  return escHtml(date.toLocaleDateString("uk-UA"));
}

function buttonRenderer(params: AgCellParams): string {
  const extra = params.colDef?.cellRendererParams || {};
  const action = String(extra.action || "");
  if (!action) return escHtml(params.value ?? "");
  const label =
    String(extra.label || "") ||
    (extra.label_from_field && params.data
      ? String(params.data[String(extra.label_from_field)] || "")
      : "") ||
    String(params.value ?? "");
  const btnClass = String(extra.button_class || "cm-record-detail-btn");
  const recordKey = String(extra.record_key || "id");
  const rowId = params.data?.[recordKey];
  const confirm = serializeConfirmAttribute(extra.confirm);
  const confirmAttr = confirm ? ` data-cm-confirm="${escHtml(confirm)}"` : "";
  return (
    `<button type="button" class="${escHtml(btnClass)}"` +
    ` data-cm-cell-action="${escHtml(action)}"` +
    ` data-cm-row-id="${escHtml(rowId ?? "")}"${confirmAttr}>${escHtml(label)}</button>`
  );
}
function imageRenderer(params: AgCellParams): string {
  const value = params.value;
  if (!value || typeof value !== "string") {
    return '<div class="cm-grid-img-cell flex items-center justify-center text-slate-400 text-xs">📦</div>';
  }
  return (
    `<div class="cm-grid-img-cell flex items-center justify-center" style="width:36px;height:36px;margin:auto">` +
    `<img src="${escHtml(value)}" alt="" style="width:36px;height:36px;object-fit:contain;border-radius:4px" loading="lazy"` +
    ` onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='inline')" />` +
    `<span class="text-xs text-slate-400" style="display:none">📦</span>` +
    `</div>`
  );
}

function thumbnailRenderer(params: AgCellParams): string {
  return imageRenderer(params);
}


let _registered = false;

export function initBuiltinRenderers(): void {
  if (_registered) return;
  _registered = true;
  registerRenderer("money", moneyRenderer);
  registerRenderer("link", linkRenderer);
  registerRenderer("badge", badgeRenderer);
  registerRenderer("date", dateRenderer);
  registerRenderer("dateTimeRenderer", dateTimeRenderer);
  registerRenderer("button", buttonRenderer);
  registerRenderer("image", imageRenderer);
  registerRenderer("thumbnail", thumbnailRenderer);
}
