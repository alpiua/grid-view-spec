/**
 * Default AG-Grid cell renderers — wired from column spec `renderer` + `extra`.
 */
import { registerRenderer } from "../../grid-view/registry-api";
import { serializeConfirmAttribute } from "../../grid-view/action-confirmation";

type AgCellParams = Record<string, unknown> & {
  value?: unknown;
  data?: Record<string, unknown>;
  colDef?: { field?: string; cellRendererParams?: Record<string, unknown> };
};

function escHtml(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  const d = document.createElement("div");
  d.textContent = String(value);
  return d.innerHTML;
}

function moneyRenderer(params: AgCellParams): string {
  const value = params.value;
  if (value === undefined || value === null || value === "") return "";
  const field = params.colDef?.field || "";
  const rowCurr = params.data?.[`${field}_currency`];
  const curr = (typeof rowCurr === "string" && rowCurr) || "UAH";
  const symbols: Record<string, string> = { USD: "$", EUR: "€", UAH: "₴", PLN: "zł", GBP: "£" };
  const colors: Record<string, string> = { USD: "#10b981", EUR: "#3b82f6", UAH: "#eab308" };
  const sym = symbols[curr] || curr;
  const color = colors[curr] || "#9ca3af";
  const numValue = Number(value);
  const useDecimals = curr !== "UAH";
  const displayValue = useDecimals
    ? numValue.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(numValue).toLocaleString("uk-UA");
  const cssClass = String(params.colDef?.cellRendererParams?.css_class || "");
  const inner =
    displayValue +
    ` <span style="color:${color};font-size:12px;margin-left:2px">${sym}</span>`;
  return cssClass ? `<span class="${escHtml(cssClass)}">${inner}</span>` : inner;
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
  registerRenderer("button", buttonRenderer);
  registerRenderer("image", imageRenderer);
  registerRenderer("thumbnail", thumbnailRenderer);
}
