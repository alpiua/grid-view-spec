/** DOM helpers shared across grid-view modules. */

export function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function getGlobal(): Window {
  return window;
}

/** Update browser URL via ``replaceState`` while preserving existing history state metadata. */
export function replaceUrlPreservingState(url: string | URL): void {
  const currentState = window.history.state;
  const nextState =
    currentState !== null && typeof currentState === "object" && !Array.isArray(currentState)
      ? { ...(currentState as Record<string, unknown>) }
      : {};
  window.history.replaceState(nextState, "", url);
}

export function positionFixedOverlay(
  overlay: HTMLElement,
  trigger: HTMLElement,
  align: "start" | "end",
  shrinkToStartEdge = false
): void {
  const padding = 12;
  const triggerRect = trigger.getBoundingClientRect();
  if (shrinkToStartEdge && align === "start") {
    overlay.style.removeProperty("width");
    const availableWidth = Math.max(0, window.innerWidth - triggerRect.left - padding);
    overlay.style.width = `${Math.min(overlay.getBoundingClientRect().width, availableWidth)}px`;
  }
  const overlayRect = overlay.getBoundingClientRect();
  const preferredLeft = align === "start" ? triggerRect.left : triggerRect.right - overlayRect.width;
  const left = Math.max(
    padding,
    Math.min(preferredLeft, window.innerWidth - overlayRect.width - padding)
  );
  const below = triggerRect.bottom + 6;
  const top =
    below + overlayRect.height <= window.innerHeight - padding
      ? below
      : Math.max(padding, triggerRect.top - overlayRect.height - 6);
  overlay.style.left = `${left}px`;
  overlay.style.top = `${top}px`;
}

/** Resolve ``data-grid-id`` from the table or its shell wrapper. */
export function tableGridId(table: Element | null | undefined): string {
  const shell = table?.closest?.("[data-grid-id]");
  return shell instanceof HTMLElement ? shell.dataset.gridId?.trim() || "" : "";
}

/** Update every linked record counter from the server-reported table total. */
export function updateRecordCounters(gridId: string, count: number): void {
  if (!gridId || !Number.isSafeInteger(count) || count < 0) return;
  const value = String(count);
  const escapedGridId = cssEscape(gridId);
  document
    .querySelectorAll(`[data-cm-count-for="${escapedGridId}"]`)
    .forEach((counter) => {
      counter.textContent = value;
    });
}

/**
 * Record counters for a table: explicit ``[data-cm-count-for=<grid_id>]`` in the
 * page layout, else ``[data-cm-count]`` inside the table wrapper (built-in toolbar).
 */
export function queryRecordCounters(
  table: Element | null | undefined,
  fallbackRoot: Element | null | undefined
): Element[] {
  const gridId = tableGridId(table);
  if (gridId) {
    const esc = cssEscape(gridId);
    const scope =
      table?.closest?.(".cm-page-table-layout, .cm-dashboard-page") ||
      fallbackRoot ||
      document;
    const linked = Array.from(scope.querySelectorAll(`[data-cm-count-for="${esc}"]`));
    if (linked.length) return linked;
  }
  if (!fallbackRoot?.querySelectorAll) return [];
  return Array.from(fallbackRoot.querySelectorAll("[data-cm-count]"));
}
