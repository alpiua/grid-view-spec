import { i18n } from "./i18n";
import { byId, invokeGridAction } from "./registry";
import { getGlobal, positionFixedOverlay } from "./dom-utils";
import { parseSmartQuery } from "./search/smart-query";
import { collectColumnFiltersObject, serializeColumnFilters, matchColumnFilter } from "./search/column-filter-state";
import { initColumnFilters, navigateWithTableFilters } from "./column-filters";
import { Charts } from "./charts";
import { Kpi } from "./kpi";
import { applyClientFilterState, initAllSimpleTables, applyFiltersInScope } from "./simple-table";
import { initButtonEllipsisTips } from "./table-cell-ui";
import { asHTMLElement, asHtmlInput, isRecord } from "./dom-guards";
import { resolveToolbarSearchInputForCtx } from "./toolbar-search-input";
import { initFilterDrawers } from "./filter-drawer";

type FilterState = Record<string, string | string[]>;

interface FilterBarOptions {
  navigate?: boolean;
  onChange?: (state: FilterState) => void;
}

interface ToolbarSearchContext {
  root: HTMLElement;
  scopeId: string;
  prefId: string;
  backend: string;
  input: HTMLInputElement | null;
  dropdown: HTMLElement | null;
  container: HTMLElement | null;
}

const MS_VALUE_CHECKBOX =
  'input[type="checkbox"]:checked:not([data-ui-only])';
const MS_COUNTABLE =
  'input[type="checkbox"]:not([data-period-all]):not([data-select-all]):not([data-ui-only]):not([data-exclusive-solo])';
// Leave enough time for a deliberate sequence of checkbox clicks before a
// faceted fragment swap replaces this widget's DOM.
const MULTISELECT_CHANGE_DEBOUNCE_MS = 650;
const multiselectChangeTimers = new WeakMap<HTMLElement, number>();
const filterBarChangeHandlers = new WeakMap<HTMLElement, (event?: Event) => void>();
const boundFilterBars = new WeakSet<HTMLElement>();
const boundFilterSelects = new WeakSet<HTMLSelectElement>();
const boundFilterInputs = new WeakSet<HTMLInputElement>();
const boundFilterInputKeydowns = new WeakSet<HTMLInputElement>();
const boundFilterSearchInputs = new WeakSet<HTMLInputElement>();
const boundPeriodFilterBars = new WeakSet<HTMLElement>();
let multiselectPanelToRestore: { barId: string; filterId: string } | null = null;
let filterHistoryBound = false;
let latestFilterNavigationUrl = "";
let facetRefreshGeneration = 0;
let activeFacetRefreshController: AbortController | null = null;

export function setMultiselectTriggerLabel(root: Element, text: string): void {
  const trigger = root.querySelector(".cm-multiselect-trigger");
  if (!trigger) return;
  const label = trigger.querySelector(".cm-multiselect-trigger__label");
  if (label) label.textContent = text;
  else trigger.textContent = text;
}

export function selectedFilterValues(root: Element): FilterState {
  const state: FilterState = {};
  root.querySelectorAll("[data-cm-multiselect]").forEach((msEl) => {
    const ms = asHTMLElement(msEl);
    if (!ms) return;
    const param = ms.dataset.filterParam || ms.dataset.filterId || "period";
    const vals = Array.from(ms.querySelectorAll<HTMLInputElement>(MS_VALUE_CHECKBOX)).map((cb) => cb.value);
    if (ms.dataset.cmSingleselect === "1") {
      state[param] = vals[0] || "";
    } else {
      state[param] = vals;
    }
  });
  root.querySelectorAll("[data-cm-period-multiselect]").forEach((msEl) => {
    const ms = asHTMLElement(msEl);
    if (!ms) return;
    const param = ms.dataset.filterParam || ms.dataset.filterId || "period";
    const periodFilter = getGlobal().CMPeriodFilter;
    const vals =
      periodFilter && typeof periodFilter.selectedValues === "function"
        ? periodFilter.selectedValues(ms)
        : [];
    if (ms.dataset.cmSingleselect === "1") {
      state[param] = vals[0] || "";
    } else {
      state[param] = vals;
    }
  });
  root.querySelectorAll("select[data-filter-id]").forEach((selEl) => {
    if (!(selEl instanceof HTMLSelectElement)) return;
    const param = selEl.name || selEl.dataset.filterId;
    if (param) state[param] = selEl.value;
  });
  const groupedValues = new Map<string, string[]>();
  root.querySelectorAll<HTMLSelectElement>("select[data-cm-grouped-select]").forEach((select) => {
    const param = select.name || select.closest<HTMLElement>("[data-filter-id]")?.dataset.filterParam;
    if (!param) return;
    const selected = groupedValues.get(param) || [];
    if (select.value) selected.push(select.value);
    groupedValues.set(param, selected);
  });
  groupedValues.forEach((values, param) => {
    // Preserve an explicit empty state so buildFilterUrl removes a prior CSV
    // value rather than leaving it in the browser URL.
    state[param] = values;
  });
  root.querySelectorAll<HTMLInputElement>("[data-cm-filter-input]").forEach((input) => {
    const field = asHTMLElement(input.closest("[data-filter-id]"));
    const param = field?.dataset.filterParam || field?.dataset.filterId || input.name;
    if (!param) return;
    state[param] = input.type === "checkbox" ? (input.checked ? input.value || "1" : "") : input.value;
  });
  const search = asHtmlInput(root.querySelector("[data-cm-search]"));
  if (search && search.name) state[search.name] = search.value;
  return state;
}

export function _updateMultiSelectLabel(ms: HTMLElement): void {
  const placeholder = ms.dataset.placeholder || i18n.t("multiselect.select", "Select");
  const allLabel = ms.dataset.allLabel || placeholder;
  const total = ms.querySelectorAll(MS_COUNTABLE).length;
  const periodAll = ms.querySelector<HTMLInputElement>("[data-period-all]");
  if (periodAll?.checked) {
    setMultiselectTriggerLabel(ms, allLabel);
    return;
  }
  const countableChecked = ms.querySelectorAll(
    'input[type="checkbox"]:checked:not([data-period-all]):not([data-select-all]):not([data-ui-only]):not([data-exclusive-solo])'
  ).length;
  if (!countableChecked) {
    setMultiselectTriggerLabel(ms, allLabel);
    return;
  }
  if (total > 0 && countableChecked === total) {
    setMultiselectTriggerLabel(ms, allLabel);
    return;
  }
  const valueChecked = Array.from(ms.querySelectorAll<HTMLInputElement>(MS_VALUE_CHECKBOX));
  if (valueChecked.length === 1) {
    setMultiselectTriggerLabel(ms, valueChecked[0].dataset.label || valueChecked[0].value);
    return;
  }
  setMultiselectTriggerLabel(
    ms,
    valueChecked.map((cb) => cb.dataset.label || cb.value).join(", ")
  );
}

export function applyFilterValues(root: Element, state: FilterState): void {
  if (!root || !state) return;
  Object.entries(state).forEach(([param, val]) => {
    const values = Array.isArray(val)
      ? val.map(String)
      : String(val).split(",").map((v) => v.trim()).filter(Boolean);
    root.querySelectorAll("[data-cm-multiselect]").forEach((msEl) => {
      const ms = asHTMLElement(msEl);
      if (!ms) return;
      const msParam = ms.dataset.filterParam || ms.dataset.filterId || "period";
      if (msParam !== param) return;
      ms.querySelectorAll('input[type="checkbox"]').forEach((cbEl) => {
        if (!(cbEl instanceof HTMLInputElement)) return;
        if (cbEl.dataset.uiOnly === "1") return;
        cbEl.checked = values.includes(cbEl.value);
      });
      if (typeof ms._cmUpdateLabel === "function") ms._cmUpdateLabel();
      else _updateMultiSelectLabel(ms);
    });
    root.querySelectorAll("[data-cm-period-multiselect]").forEach((msEl) => {
      const ms = asHTMLElement(msEl);
      if (!ms) return;
      const msParam = ms.dataset.filterParam || ms.dataset.filterId || "period";
      if (msParam !== param) return;
      const periodFilter = getGlobal().CMPeriodFilter;
      if (periodFilter && typeof periodFilter.applyValues === "function") {
        periodFilter.applyValues(ms, values);
      }
    });
    root.querySelectorAll("select[data-filter-id]").forEach((selEl) => {
      if (!(selEl instanceof HTMLSelectElement)) return;
      const selParam = selEl.name || selEl.dataset.filterId;
      if (selParam !== param) return;
      selEl.value = Array.isArray(val) ? String(val[0] || "") : String(val);
    });
    root.querySelectorAll<HTMLInputElement>("[data-cm-filter-input]").forEach((input) => {
      const field = asHTMLElement(input.closest("[data-filter-id]"));
      const fieldParam = field?.dataset.filterParam || field?.dataset.filterId || input.name;
      if (fieldParam !== param) return;
      if (input.type === "checkbox") input.checked = values.includes(input.value || "1");
      else input.value = Array.isArray(val) ? String(val[0] || "") : String(val ?? "");
    });
  });
  root.querySelectorAll<HTMLSelectElement>("select[data-cm-grouped-select]").forEach((select) => {
    const param = select.name || select.closest<HTMLElement>("[data-filter-id]")?.dataset.filterParam;
    if (!param) return;
    const rawValue = state[param];
    const values = Array.isArray(rawValue)
      ? rawValue.map(String)
      : String(rawValue || "").split(",").map((value) => value.trim()).filter(Boolean);
    const selected = Array.from(select.options).find(
      (option) => !option.disabled && values.includes(option.value),
    );
    const fallback = Array.from(select.options).find((option) => !option.disabled);
    select.value = selected?.value || fallback?.value || "";
  });
}

export function filterNavigateHref() {
  const url = new URL(window.location.href);
  url.pathname = url.pathname.replace(/\/fragment\/?$/, "/");
  return url.href;
}

function resolveToolbarGridId(anchor: Element | null | undefined): string {
  const anchorEl = asHTMLElement(anchor);
  const directGridId = anchorEl?.getAttribute("data-cm-grid-id");
  if (directGridId) return directGridId;
  const drawerTarget = asHTMLElement(anchorEl?.closest(".cm-filters"))?.dataset.target;
  if (drawerTarget) return drawerTarget;
  const root =
    asHTMLElement(anchorEl?.closest("[data-cm-toolbar-search-root]")) ||
    asHTMLElement(anchorEl?.closest(".cm-toolbar-unified")?.querySelector("[data-cm-toolbar-search-root]"));
  return root?.dataset?.cmTableGridId || root?.dataset?.cmPrefGridId || "";
}

function tableFragmentConfig(gridId: string, bar?: Element | null): {
  endpoint: string;
  target: string;
  swap: string;
  gridId: string;
} | null {
  if (!gridId) return null;
  // Filter bar carries fragment config when set via GridViewFilters.fragment_endpoint.
  const barEl = bar instanceof HTMLElement ? bar : (bar as Element | null)?.closest?.("[data-cm-filter-bar]");
  const b = barEl as HTMLElement | null;
  const shell = document.getElementById("cm-table-" + gridId);
  const endpoint = b?.dataset?.cmFragmentEndpoint || shell?.dataset?.cmFragmentEndpoint || "";
  if (!endpoint) return null;
  return {
    endpoint,
    target: b?.dataset?.cmFragmentTarget || shell?.dataset?.cmFragmentTarget || "#block-" + gridId,
    swap: b?.dataset?.cmFragmentSwap || shell?.dataset?.cmFragmentSwap || "outerHTML",
    gridId,
  };
}

function buildFragmentRequestUrl(fragmentEndpoint: string, pagePathAndQuery: string) {
  const page = new URL(pagePathAndQuery, window.location.origin);
  const frag = new URL(fragmentEndpoint, window.location.origin);
  frag.search = page.search;
  return frag.pathname + frag.search;
}

// Faceted filter bars recompute option counts server-side, so filter/search
// changes must refresh the whole spec (bar + table), not just the table.
function specWantsFacets(ref: Element | null | undefined): boolean {
  const el = asHTMLElement(ref);
  if (!el) return false;
  if (el.matches?.("[data-cm-filter-bar][data-cm-facets]")) return true;
  const spec = el.closest("[data-cm-grid-view-spec]");
  if (spec?.querySelector("[data-cm-filter-bar][data-cm-facets]")) return true;
  return !!el.closest("[data-cm-filter-bar][data-cm-facets]");
}

function usesInPlaceFacets(bar: HTMLElement | null | undefined): bar is HTMLElement {
  return bar?.dataset.cmFacets === "1" && bar.dataset.cmFacetsRefreshMode === "in_place";
}

interface FilterScrollPosition {
  element: HTMLElement;
  top: number;
  left: number;
}

interface FilterFocusSnapshot {
  element: HTMLElement;
  filterId: string;
  tagName: string;
  name: string;
  value: string;
  inputType: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}

function filterControlRoots(bar: HTMLElement): Map<string, HTMLElement> {
  const roots = new Map<string, HTMLElement>();
  bar.querySelectorAll<HTMLElement>("[data-filter-id]").forEach((element) => {
    const parent = element.parentElement?.closest<HTMLElement>("[data-filter-id]");
    if (parent && bar.contains(parent)) return;
    const id = element.dataset.filterId || "";
    if (!id || roots.has(id)) throw new Error("Facet response has an ambiguous filter control");
    roots.set(id, element);
  });
  return roots;
}

function syncAttribute(target: Element, source: Element, name: string): void {
  const value = source.getAttribute(name);
  if (value === null) target.removeAttribute(name);
  else target.setAttribute(name, value);
}

function syncMultiselectAttributes(target: HTMLElement, source: HTMLElement): void {
  [
    "data-filter-scope",
    "data-filter-param",
    "data-filter-type",
    "data-placeholder",
    "data-all-label",
    "data-select-all-option",
    "data-select-all-value",
    "data-exclusive-all",
    "data-cm-singleselect",
  ].forEach((name) => syncAttribute(target, source, name));
}

function prepareTreeOptionUpdates(
  currentRoot: HTMLElement,
  nextRoot: HTMLElement,
  operations: Array<() => void>,
): boolean {
  const currentNodes = Array.from(
    currentRoot.querySelectorAll<HTMLElement>("[data-cm-filter-tree-node]"),
  );
  const nextNodes = Array.from(nextRoot.querySelectorAll<HTMLElement>("[data-cm-filter-tree-node]"));
  if (!currentNodes.length && !nextNodes.length) return false;
  if (currentNodes.length !== nextNodes.length) {
    throw new Error("Facet response changes the tree control structure");
  }

  currentNodes.forEach((currentNode, index) => {
    const nextNode = nextNodes[index];
    const currentValue = currentNode.dataset.cmFilterTreeValue || "";
    const nextValue = nextNode.dataset.cmFilterTreeValue || "";
    if (
      currentValue !== nextValue ||
      (currentNode.dataset.cmFilterTreeParent || "") !==
        (nextNode.dataset.cmFilterTreeParent || "")
    ) {
      throw new Error("Facet response changes the tree control structure");
    }
    const currentInput = currentNode.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const nextInput = nextNode.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!currentInput || !nextInput || currentInput.value !== nextInput.value) {
      throw new Error("Facet response has a mismatched tree option");
    }
    const currentLabel = currentNode.querySelector<HTMLElement>(".cm-filter-drawer-option-label");
    const nextLabel = nextNode.querySelector<HTMLElement>(".cm-filter-drawer-option-label");
    const currentCount = currentNode.querySelector<HTMLElement>(".cm-filter-drawer-option-count");
    const nextCount = nextNode.querySelector<HTMLElement>(".cm-filter-drawer-option-count");
    const currentToggle = currentNode.querySelector<HTMLButtonElement>("[data-cm-filter-tree-toggle]");
    const nextToggle = nextNode.querySelector<HTMLButtonElement>("[data-cm-filter-tree-toggle]");
    const labelText = nextLabel?.textContent || "";
    const countText = nextCount?.textContent;
    const checked = nextInput.checked;
    const disabled = nextInput.disabled;
    const facetCount = nextInput.dataset.cmFacetCount;
    const optionLabel = nextInput.dataset.label || "";
    const exclusive = nextInput.dataset.exclusiveSolo;
    const toggleLabel = nextToggle?.getAttribute("aria-label");

    operations.push(() => {
      currentNode.classList.toggle(
        "cm-filter-drawer-option--disabled",
        nextNode.classList.contains("cm-filter-drawer-option--disabled"),
      );
      currentInput.checked = checked;
      currentInput.disabled = disabled;
      currentInput.dataset.label = optionLabel;
      if (facetCount === undefined) delete currentInput.dataset.cmFacetCount;
      else currentInput.dataset.cmFacetCount = facetCount;
      if (exclusive === undefined) delete currentInput.dataset.exclusiveSolo;
      else currentInput.dataset.exclusiveSolo = exclusive;
      if (currentLabel && nextLabel) currentLabel.textContent = labelText;
      if (countText === undefined) {
        currentCount?.remove();
      } else if (currentCount) {
        currentCount.textContent = countText;
      } else {
        const count = document.createElement("span");
        count.className = "cm-filter-drawer-option-count";
        count.textContent = countText;
        currentNode.append(count);
      }
      if (currentToggle && toggleLabel !== null && toggleLabel !== undefined) {
        currentToggle.setAttribute("aria-label", toggleLabel);
      }
    });
  });
  return true;
}

function prepareMultiselectUpdate(
  currentRoot: HTMLElement,
  nextRoot: HTMLElement,
  operations: Array<() => void>,
): void {
  const currentPanel = currentRoot.querySelector<HTMLElement>(".cm-multiselect-panel");
  const nextPanel = nextRoot.querySelector<HTMLElement>(".cm-multiselect-panel");
  if (!!currentPanel !== !!nextPanel) {
    throw new Error("Facet response changes the multiselect control structure");
  }
  const currentOptionsRoot = currentPanel || currentRoot;
  const nextOptionsRoot = nextPanel || nextRoot;
  const hasTree = prepareTreeOptionUpdates(currentOptionsRoot, nextOptionsRoot, operations);
  if (hasTree) {
    operations.push(() => syncMultiselectAttributes(currentRoot, nextRoot));
    return;
  }

  const children = Array.from(nextOptionsRoot.childNodes).map((node) => node.cloneNode(true));
  const emptyPanel = nextPanel?.classList.contains("cm-multiselect-panel--empty") || false;
  operations.push(() => {
    if (currentPanel) {
      const wasOpen = currentPanel.classList.contains("is-open");
      currentPanel.replaceChildren(...children);
      currentPanel.classList.toggle("cm-multiselect-panel--empty", emptyPanel);
      currentPanel.classList.toggle("is-open", wasOpen);
    } else {
      currentRoot.replaceChildren(...children);
    }
    syncMultiselectAttributes(currentRoot, nextRoot);
    const updateLabel = currentRoot._cmUpdateLabel;
    if (typeof updateLabel === "function") updateLabel();
    else _updateMultiSelectLabel(currentRoot);
  });
}

function prepareFilterControlUpdate(
  currentRoot: HTMLElement,
  nextRoot: HTMLElement,
  operations: Array<() => void>,
): void {
  if (
    currentRoot.dataset.filterId !== nextRoot.dataset.filterId ||
    currentRoot.dataset.filterType !== nextRoot.dataset.filterType ||
    currentRoot.dataset.filterParam !== nextRoot.dataset.filterParam ||
    currentRoot.dataset.filterScope !== nextRoot.dataset.filterScope
  ) {
    throw new Error("Facet response does not match the current filter control");
  }
  const currentMultiselect = currentRoot.hasAttribute("data-cm-multiselect");
  const nextMultiselect = nextRoot.hasAttribute("data-cm-multiselect");
  if (currentMultiselect !== nextMultiselect) {
    throw new Error("Facet response changes the filter control type");
  }
  if (currentMultiselect) {
    prepareMultiselectUpdate(currentRoot, nextRoot, operations);
    return;
  }

  const currentSelects = Array.from(currentRoot.querySelectorAll<HTMLSelectElement>("select"));
  const nextSelects = Array.from(nextRoot.querySelectorAll<HTMLSelectElement>("select"));
  const currentInputs = Array.from(currentRoot.querySelectorAll<HTMLInputElement>("input"));
  const nextInputs = Array.from(nextRoot.querySelectorAll<HTMLInputElement>("input"));
  const currentTextareas = Array.from(currentRoot.querySelectorAll<HTMLTextAreaElement>("textarea"));
  const nextTextareas = Array.from(nextRoot.querySelectorAll<HTMLTextAreaElement>("textarea"));
  if (
    currentSelects.length !== nextSelects.length ||
    currentInputs.length !== nextInputs.length ||
    currentTextareas.length !== nextTextareas.length
  ) {
    throw new Error("Facet response changes the filter control structure");
  }

  currentSelects.forEach((currentSelect, index) => {
    const nextSelect = nextSelects[index];
    if (
      currentSelect.name !== nextSelect.name ||
      currentSelect.multiple !== nextSelect.multiple ||
      currentSelect.hasAttribute("data-cm-grouped-select") !==
        nextSelect.hasAttribute("data-cm-grouped-select")
    ) {
      throw new Error("Facet response changes the select control structure");
    }
    const children = Array.from(nextSelect.childNodes).map((node) => node.cloneNode(true));
    const value = nextSelect.value;
    const disabled = nextSelect.disabled;
    operations.push(() => {
      currentSelect.replaceChildren(...children);
      currentSelect.value = value;
      currentSelect.disabled = disabled;
    });
  });

  currentInputs.forEach((currentInput, index) => {
    const nextInput = nextInputs[index];
    if (
      currentInput.type !== nextInput.type ||
      currentInput.name !== nextInput.name ||
      currentInput.hasAttribute("data-cm-filter-input") !==
        nextInput.hasAttribute("data-cm-filter-input")
    ) {
      throw new Error("Facet response changes the input control structure");
    }
    const value = nextInput.value;
    const checked = nextInput.checked;
    const disabled = nextInput.disabled;
    const placeholder = nextInput.placeholder;
    operations.push(() => {
      currentInput.value = value;
      currentInput.checked = checked;
      currentInput.disabled = disabled;
      currentInput.placeholder = placeholder;
    });
  });

  currentTextareas.forEach((currentTextarea, index) => {
    const nextTextarea = nextTextareas[index];
    if (currentTextarea.name !== nextTextarea.name) {
      throw new Error("Facet response changes the text control structure");
    }
    const value = nextTextarea.value;
    const disabled = nextTextarea.disabled;
    const placeholder = nextTextarea.placeholder;
    operations.push(() => {
      currentTextarea.value = value;
      currentTextarea.disabled = disabled;
      currentTextarea.placeholder = placeholder;
    });
  });
}

function canReuseFilterControlRoot(currentRoot: HTMLElement, nextRoot: HTMLElement): boolean {
  if (
    currentRoot.dataset.filterId !== nextRoot.dataset.filterId ||
    currentRoot.dataset.filterType !== nextRoot.dataset.filterType ||
    currentRoot.dataset.filterParam !== nextRoot.dataset.filterParam ||
    currentRoot.dataset.filterScope !== nextRoot.dataset.filterScope
  ) {
    return false;
  }
  const currentMultiselect = currentRoot.hasAttribute("data-cm-multiselect");
  const nextMultiselect = nextRoot.hasAttribute("data-cm-multiselect");
  if (currentMultiselect !== nextMultiselect) return false;
  if (currentMultiselect) {
    const currentPanel = currentRoot.querySelector(".cm-multiselect-panel");
    const nextPanel = nextRoot.querySelector(".cm-multiselect-panel");
    if (!!currentPanel !== !!nextPanel) return false;
    const currentOptionsRoot = currentPanel || currentRoot;
    const nextOptionsRoot = nextPanel || nextRoot;
    const currentNodes = Array.from(
      currentOptionsRoot.querySelectorAll<HTMLElement>("[data-cm-filter-tree-node]"),
    );
    const nextNodes = Array.from(
      nextOptionsRoot.querySelectorAll<HTMLElement>("[data-cm-filter-tree-node]"),
    );
    if (currentNodes.length !== nextNodes.length) return false;
    return currentNodes.every((currentNode, index) => {
      const nextNode = nextNodes[index];
      const currentInput = currentNode.querySelector<HTMLInputElement>('input[type="checkbox"]');
      const nextInput = nextNode.querySelector<HTMLInputElement>('input[type="checkbox"]');
      return (
        currentNode.dataset.cmFilterTreeValue === nextNode.dataset.cmFilterTreeValue &&
        (currentNode.dataset.cmFilterTreeParent || "") ===
          (nextNode.dataset.cmFilterTreeParent || "") &&
        !!currentInput &&
        !!nextInput &&
        currentInput.value === nextInput.value
      );
    });
  }

  const currentSelects = Array.from(currentRoot.querySelectorAll<HTMLSelectElement>("select"));
  const nextSelects = Array.from(nextRoot.querySelectorAll<HTMLSelectElement>("select"));
  const currentInputs = Array.from(currentRoot.querySelectorAll<HTMLInputElement>("input"));
  const nextInputs = Array.from(nextRoot.querySelectorAll<HTMLInputElement>("input"));
  const currentTextareas = Array.from(currentRoot.querySelectorAll<HTMLTextAreaElement>("textarea"));
  const nextTextareas = Array.from(nextRoot.querySelectorAll<HTMLTextAreaElement>("textarea"));
  if (
    currentSelects.length !== nextSelects.length ||
    currentInputs.length !== nextInputs.length ||
    currentTextareas.length !== nextTextareas.length
  ) {
    return false;
  }
  return (
    currentSelects.every(
      (currentSelect, index) =>
        currentSelect.name === nextSelects[index].name &&
        currentSelect.multiple === nextSelects[index].multiple &&
        currentSelect.hasAttribute("data-cm-grouped-select") ===
          nextSelects[index].hasAttribute("data-cm-grouped-select"),
    ) &&
    currentInputs.every(
      (currentInput, index) =>
        currentInput.type === nextInputs[index].type &&
        currentInput.name === nextInputs[index].name &&
        currentInput.hasAttribute("data-cm-filter-input") ===
          nextInputs[index].hasAttribute("data-cm-filter-input"),
    ) &&
    currentTextareas.every((currentTextarea, index) => currentTextarea.name === nextTextareas[index].name)
  );
}

function filterWorkspaceCards(bar: HTMLElement): Map<string, HTMLElement> {
  const cards = new Map<string, HTMLElement>();
  bar.querySelectorAll<HTMLElement>("[data-cm-filter-card]").forEach((card) => {
    const id = card.dataset.cmFilterCardId || "";
    if (!id || cards.has(id)) throw new Error("Facet response has an ambiguous filter card");
    cards.set(id, card);
  });
  return cards;
}

function matchingFilterControlContainer(
  liveBar: HTMLElement,
  incomingBar: HTMLElement,
  incomingRoot: HTMLElement,
  liveCards: Map<string, HTMLElement>,
): HTMLElement {
  const incomingCard = incomingRoot.closest<HTMLElement>("[data-cm-filter-card]");
  if (incomingCard) {
    const cardId = incomingCard.dataset.cmFilterCardId || "";
    const liveCard = liveCards.get(cardId);
    const liveContainer = liveCard?.querySelector<HTMLElement>(".cm-filter-drawer-card-controls");
    if (!liveContainer || !incomingCard.querySelector(".cm-filter-drawer-card-controls")) {
      throw new Error("Facet response changes a filter card control container");
    }
    return liveContainer;
  }

  let incomingContainer = incomingRoot.parentElement;
  if (!incomingContainer) throw new Error("Facet response has a detached filter control");
  if (incomingContainer === incomingBar) return liveBar;
  while (incomingContainer && incomingContainer !== incomingBar) {
    const { tagName, id, className } = incomingContainer;
    const candidates = [liveBar, ...Array.from(liveBar.querySelectorAll<HTMLElement>("*"))].filter(
      (candidate) =>
        candidate.tagName === tagName &&
        candidate.id === id &&
        candidate.className === className,
    );
    if (candidates.length === 1) return candidates[0];
    incomingContainer = incomingContainer.parentElement;
  }
  if (incomingContainer === incomingBar) return liveBar;
  throw new Error("Facet response changes a filter control container");
}

function hasExternallyBoundFilterBehavior(root: HTMLElement): boolean {
  return (
    root.matches(".cm-period-multiselect, [data-cm-period-multiselect]") ||
    root.querySelector(
      ".cm-period-multiselect, [data-cm-period-multiselect], [data-cm-filter-tree-toggle]",
    ) !== null
  );
}

function captureFilterScroll(bar: HTMLElement): FilterScrollPosition[] {
  const elements = [bar, ...Array.from(bar.querySelectorAll<HTMLElement>("*"))];
  return elements.map((element) => ({ element, top: element.scrollTop, left: element.scrollLeft }));
}

function restoreFilterScroll(positions: FilterScrollPosition[]): void {
  positions.forEach(({ element, top, left }) => {
    if (!element.isConnected) return;
    element.scrollTop = top;
    element.scrollLeft = left;
  });
}

function captureFilterFocus(bar: HTMLElement): FilterFocusSnapshot | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !bar.contains(active)) return null;
  const input = active instanceof HTMLInputElement ? active : null;
  const control = active instanceof HTMLSelectElement ? active : input;
  return {
    element: active,
    filterId: active.closest<HTMLElement>("[data-filter-id]")?.dataset.filterId || "",
    tagName: active.tagName,
    name: control?.name || "",
    value: control?.value || "",
    inputType: input?.type || "",
    selectionStart: input?.selectionStart ?? null,
    selectionEnd: input?.selectionEnd ?? null,
  };
}

function restoreFilterFocus(bar: HTMLElement, snapshot: FilterFocusSnapshot | null): void {
  if (!snapshot || snapshot.element.isConnected) return;
  const candidates = Array.from(bar.querySelectorAll<HTMLElement>("input, select, button"));
  const filterCandidates = candidates.filter(
    (element) => element.closest<HTMLElement>("[data-filter-id]")?.dataset.filterId === snapshot.filterId,
  );
  const target =
    filterCandidates.find((element) => {
      if (element.tagName !== snapshot.tagName) return false;
      if (element instanceof HTMLInputElement) {
        return element.name === snapshot.name && element.type === snapshot.inputType && element.value === snapshot.value;
      }
      if (element instanceof HTMLSelectElement) return element.name === snapshot.name;
      return true;
    }) || filterCandidates[0];
  if (!target) return;
  target.focus({ preventScroll: true });
  if (
    target instanceof HTMLInputElement &&
    snapshot.selectionStart !== null &&
    snapshot.selectionEnd !== null
  ) {
    try {
      target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    } catch {
      // Inputs without a text selection keep focus without a selection range.
    }
  }
}

function prepareFacetReconciliation(liveBar: HTMLElement, incomingBar: HTMLElement): () => void {
  const currentRoots = filterControlRoots(liveBar);
  const nextRoots = filterControlRoots(incomingBar);
  if (currentRoots.size === 0 || nextRoots.size === 0) {
    throw new Error("Facet response does not contain the matching filter controls");
  }
  const currentCards = filterWorkspaceCards(liveBar);
  const nextCards = filterWorkspaceCards(incomingBar);
  if (currentCards.size !== nextCards.size) {
    throw new Error("Facet response changes the filter cards");
  }
  currentCards.forEach((_card, id) => {
    if (!nextCards.has(id)) throw new Error("Facet response changes the filter cards");
  });

  const operations: Array<() => void> = [];
  const retainedRoots = new Set<HTMLElement>();
  const insertedRoots = new Set<HTMLElement>();
  const plannedRoots = new Map<HTMLElement, HTMLElement[]>();
  nextRoots.forEach((nextRoot, id) => {
    const currentRoot = currentRoots.get(id);
    const container = matchingFilterControlContainer(
      liveBar,
      incomingBar,
      nextRoot,
      currentCards,
    );
    let reconciledRoot: HTMLElement;
    if (currentRoot && canReuseFilterControlRoot(currentRoot, nextRoot)) {
      prepareFilterControlUpdate(currentRoot, nextRoot, operations);
      reconciledRoot = currentRoot;
      retainedRoots.add(currentRoot);
    } else {
      if (hasExternallyBoundFilterBehavior(nextRoot)) {
        throw new Error("Facet response adds a control that requires workspace-specific binding");
      }
      const clone = nextRoot.cloneNode(true);
      if (!(clone instanceof HTMLElement)) {
        throw new Error("Facet response contains a non-element filter control");
      }
      reconciledRoot = clone;
      insertedRoots.add(clone);
    }
    const rootsForContainer = plannedRoots.get(container) || [];
    rootsForContainer.push(reconciledRoot);
    plannedRoots.set(container, rootsForContainer);
  });

  const currentSearch = liveBar.querySelector<HTMLInputElement>("input[data-cm-search]");
  const nextSearch = incomingBar.querySelector<HTMLInputElement>("input[data-cm-search]");
  if (!!currentSearch !== !!nextSearch) {
    throw new Error("Facet response changes the filter search control");
  }
  if (currentSearch && nextSearch) {
    const value = nextSearch.value;
    operations.push(() => {
      currentSearch.value = value;
    });
  }

  if (!filterBarChangeHandlers.has(liveBar)) {
    throw new Error("The live filter workspace has no change handler");
  }
  currentRoots.forEach((currentRoot) => {
    if (!retainedRoots.has(currentRoot)) {
      operations.push(() => currentRoot.remove());
    }
  });
  plannedRoots.forEach((rootsForContainer, container) => {
    operations.push(() => {
      let anchor: ChildNode | null =
        Array.from(container.children).find((child) => child.matches("[data-filter-id]")) || null;
      rootsForContainer.forEach((root) => {
        container.insertBefore(root, anchor);
        anchor = root.nextSibling;
      });
    });
  });
  currentCards.forEach((card, id) => {
    const nextCard = nextCards.get(id);
    if (!nextCard) throw new Error("Facet response changes the filter cards");
    operations.push(() => syncAttribute(card, nextCard, "data-cm-filter-card-filter-ids"));
  });

  const scrollPositions = captureFilterScroll(liveBar);
  const focus = captureFilterFocus(liveBar);
  return () => {
    operations.forEach((operation) => operation());
    insertedRoots.forEach(initMultiSelectWidget);
    bindFilterControlListeners(liveBar);
    liveBar
      .querySelectorAll<HTMLInputElement>("[data-cm-filter-workspace-search], [data-cm-filter-card-search]")
      .forEach((input) => input.dispatchEvent(new Event("input", { bubbles: true })));
    liveBar.dispatchEvent(new Event("change", { bubbles: true }));
    liveBar.querySelectorAll<HTMLElement>("[data-cm-multiselect]").forEach((root) => {
      const updateLabel = root._cmUpdateLabel;
      if (typeof updateLabel === "function") updateLabel();
      else _updateMultiSelectLabel(root);
    });
    restoreFilterScroll(scrollPositions);
    restoreFilterFocus(liveBar, focus);
  };
}

function findIncomingFacetBars(
  responseHtml: string,
  liveBar: HTMLElement,
): Array<[HTMLElement, HTMLElement]> {
  const liveSpec = asHTMLElement(liveBar.closest("[data-cm-grid-view-spec]"));
  if (!liveSpec?.id || !liveBar.id) throw new Error("The current filter workspace has no stable identity");
  const responseDocument = new DOMParser().parseFromString(responseHtml, "text/html");
  const responseSpec = asHTMLElement(responseDocument.getElementById(liveSpec.id));
  if (!responseSpec?.matches("[data-cm-grid-view-spec]")) {
    throw new Error("Facet response does not contain the current GridViewSpec");
  }

  const liveDrawer = asHTMLElement(liveBar.closest("[data-cm-filter-drawer]"));
  if (!liveDrawer) {
    const responseBar = Array.from(
      responseSpec.querySelectorAll<HTMLElement>("[data-cm-filter-bar]"),
    ).find((candidate) => candidate.id === liveBar.id);
    if (!usesInPlaceFacets(responseBar)) {
      throw new Error("Facet response does not contain the matching in-place filter workspace");
    }
    return [[liveBar, responseBar]];
  }

  const drawerId = liveDrawer.dataset.cmFilterDrawerId || "";
  const target = liveDrawer.dataset.target || "";
  if (!drawerId || !target) throw new Error("The current filter drawer has no stable identity");
  const incomingDrawers = Array.from(
    responseSpec.querySelectorAll<HTMLElement>("[data-cm-filter-drawer]"),
  ).filter(
    (candidate) =>
      candidate.dataset.cmFilterDrawerId === drawerId && candidate.dataset.target === target,
  );
  if (incomingDrawers.length !== 1) {
    throw new Error("Facet response does not contain the matching filter drawer");
  }

  const liveBars = Array.from(liveDrawer.querySelectorAll<HTMLElement>("[data-cm-filter-bar]"));
  const incomingBars = Array.from(
    incomingDrawers[0].querySelectorAll<HTMLElement>("[data-cm-filter-bar]"),
  );
  if (liveBars.length === 0 || liveBars.length !== incomingBars.length) {
    throw new Error("Facet response changes the filter drawer workspaces");
  }
  const incomingById = new Map<string, HTMLElement>();
  incomingBars.forEach((candidate) => {
    if (!candidate.id || incomingById.has(candidate.id)) {
      throw new Error("Facet response has ambiguous filter workspaces");
    }
    incomingById.set(candidate.id, candidate);
  });
  const pairs: Array<[HTMLElement, HTMLElement]> = liveBars.map((current) => {
    const incoming = incomingById.get(current.id);
    if (
      !incoming ||
      current.dataset.cmFilterWorkspacePanel !== incoming.dataset.cmFilterWorkspacePanel ||
      !usesInPlaceFacets(incoming)
    ) {
      throw new Error("Facet response does not contain the matching filter workspaces");
    }
    return [current, incoming];
  });
  if (!pairs.some(([current]) => current === liveBar)) {
    throw new Error("The current filter workspace is outside its drawer");
  }
  return pairs;
}

function applyClientFacetFilters(bar: HTMLElement, state: FilterState): void {
  const clientParams = new Set(
    Array.from(bar.querySelectorAll<HTMLElement>('[data-filter-scope="client"]')).map(
      (filter) => filter.dataset.filterParam || filter.dataset.filterId || "",
    ),
  );
  const clientState: FilterState = {};
  Object.entries(state).forEach(([param, value]) => {
    if (clientParams.has(param)) clientState[param] = value;
  });
  const target = asHTMLElement(bar.closest(".cm-filters, .cm-toolbar-unified"))?.dataset.target;
  if (!target || !clientParams.size) return;
  const escaped =
    typeof CSS !== "undefined" && CSS.escape
      ? CSS.escape(target)
      : target.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  applyClientFilterState(document.querySelector("#cm-table-" + escaped), clientState);
}

function dispatchFacetRefreshComplete(bar: HTMLElement, state: FilterState, pageUrl: string): void {
  const nextState: FilterState = { ...state, ...selectedFilterValues(bar) };
  const page = new URL(pageUrl, window.location.origin).searchParams.get("page");
  if (page) nextState.page = page;
  applyClientFacetFilters(bar, nextState);
  bar.dispatchEvent(
    new CustomEvent("cm-filter-change", {
      bubbles: true,
      detail: { state: nextState, bar, facetsRefreshComplete: true },
    }),
  );
}

function cancelFacetRefresh(): void {
  facetRefreshGeneration += 1;
  activeFacetRefreshController?.abort();
  activeFacetRefreshController = null;
}

async function refreshFacetsInPlace(
  pageUrl: string,
  state: FilterState,
  bar: HTMLElement,
): Promise<void> {
  cancelFacetRefresh();
  const generation = facetRefreshGeneration;
  const controller = new AbortController();
  activeFacetRefreshController = controller;
  try {
    const requestUrl = new URL(pageUrl, window.location.href);
    if (requestUrl.origin !== window.location.origin) {
      throw new Error("Facet refresh requires the current page origin");
    }
    const response = await fetch(requestUrl.href, {
      credentials: "same-origin",
      headers: { Accept: "text/html" },
      signal: controller.signal,
    });
    if (generation !== facetRefreshGeneration) return;
    if (!response.ok) throw new Error("Facet refresh returned an unsuccessful response");
    const responseHtml = await response.text();
    if (generation !== facetRefreshGeneration) return;
    const reconciliations = findIncomingFacetBars(responseHtml, bar).map(
      ([liveBar, incomingBar]) => prepareFacetReconciliation(liveBar, incomingBar),
    );
    if (generation !== facetRefreshGeneration) return;
    reconciliations.forEach((reconcile) => reconcile());
    multiselectPanelToRestore = null;
    dispatchFacetRefreshComplete(bar, state, requestUrl.href);
  } catch {
    if (generation !== facetRefreshGeneration) return;
    window.location.href = pageUrl;
  } finally {
    if (generation === facetRefreshGeneration) activeFacetRefreshController = null;
  }
}

function syncToolbarCounterFromTable(gridId: string): void {
  if (!gridId) return;
  const block = document.getElementById("block-" + gridId);
  const counter = asHTMLElement(document.querySelector('[data-cm-count-for="' + gridId + '"]'));
  if (!block || !counter) return;
  const footer = asHTMLElement(block.querySelector("[data-cm-pagination-total]"));
  const total = footer?.dataset?.cmPaginationTotal || counter.dataset.cmCountTotal || "";
  const shown = block.querySelectorAll("tbody .cm-row:not([hidden])").length;
  if (total) {
    counter.textContent = String(shown) + "/" + total;
    counter.dataset.cmCountTotal = total;
  } else {
    counter.textContent = String(shown);
  }
}

export function navigateFilterState(
  state: FilterState,
  anchorEl: Element | null | undefined,
  bar: Element | null | undefined
): boolean {
  const pageUrl = withActiveTableColumns(
    buildFilterUrl(filterNavigateHref(), state),
    anchorEl || bar
  );
  const gridId = resolveToolbarGridId(anchorEl || bar);
  const frag = tableFragmentConfig(gridId, bar);
  const wantsFacets = specWantsFacets(anchorEl || bar);
  const filterBar =
    bar instanceof HTMLElement
      ? bar
      : asHTMLElement((bar as Element | null | undefined)?.closest?.("[data-cm-filter-bar]"));
  if (usesInPlaceFacets(filterBar)) {
    pushFilterHistory(pageUrl, filterBar);
    void refreshFacetsInPlace(pageUrl, state, filterBar);
    return true;
  }
  cancelFacetRefresh();
  const htmx = getGlobal().htmx;
  if (htmx && typeof htmx.ajax === "function") {
    // Faceted pages refresh the whole spec (bar + table) so option counts
    // recompute; skip the table-only fragment swap in that case.
    // Explicit fragment config (GridViewFilters.fragment_endpoint or GridViewTablePagination).
    if (frag && !wantsFacets) {
      htmx.ajax("GET", buildFragmentRequestUrl(frag.endpoint, pageUrl), {
        target: frag.target,
        swap: frag.swap,
      });
      pushFilterHistory(pageUrl, anchorEl || bar);
      window.setTimeout(() => syncToolbarCounterFromTable(frag.gridId), 0);
      return true;
    }
    // Auto-fragment: swap the spec root using HTMX select to extract only the spec
    // element from the host page's partial response. No application config needed — spec.html gives every spec root a stable id ("cm-spec-{spec.id}").
    const ref = anchorEl || bar;
    const specRoot = ref instanceof Element ? (ref.closest("[data-cm-grid-view-spec]") as HTMLElement | null) : null;
    if (specRoot?.id) {
      const wrapId = "cm-spec-wrap-" + specRoot.dataset.specId;
      htmx.ajax("GET", pageUrl, {
        target: "#" + wrapId,
        swap: "innerHTML",
        select: "#" + specRoot.id,
      });
      pushFilterHistory(pageUrl, ref);
      return true;
    }
  }
  window.location.href = pageUrl;
  return false;
}

function pushFilterHistory(pageUrl: string, anchor: Element | null | undefined): void {
  const specRoot = anchor instanceof Element
    ? asHTMLElement(anchor.closest("[data-cm-grid-view-spec]"))
    : null;
  const state: Record<string, unknown> = isRecord(window.history.state) ? { ...window.history.state } : {};
  const specId = specRoot?.dataset.specId || "";
  if (specId && (typeof state.cmFilterSpecId !== "string" || !state.cmFilterSpecId)) {
    state.cmFilterSpecId = specId;
    window.history.replaceState(state, "", window.location.href);
  }
  if (specId) state.cmFilterSpecId = specId;
  window.history.pushState(state, "", pageUrl);
  latestFilterNavigationUrl = pageUrl;
}

function isSameFilterPage(previousUrl: string, nextUrl: string): boolean {
  const previous = new URL(previousUrl, window.location.origin);
  const next = new URL(nextUrl, window.location.origin);
  return previous.pathname === next.pathname && previous.searchParams.get("tab") === next.searchParams.get("tab");
}

function restoreFilterHistorySpec(): void {
  if (filterHistoryBound) return;
  filterHistoryBound = true;
  window.addEventListener("popstate", () => {
    const nextUrl = filterNavigateHref();
    if (!isSameFilterPage(latestFilterNavigationUrl, nextUrl)) {
      cancelFacetRefresh();
      return;
    }
    latestFilterNavigationUrl = nextUrl;
    // HTMX restores its own cached snapshot during the same popstate dispatch.
    // Queue our canonical server-spec swap after that restore so URL and rows
    // cannot diverge when this filter navigation used pushState directly.
    window.setTimeout(() => {
      const historyState = isRecord(window.history.state) ? window.history.state : {};
      const specId = typeof historyState.cmFilterSpecId === "string" ? historyState.cmFilterSpecId : "";
      const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-cm-grid-view-spec]"));
      const specRoot = specId
        ? asHTMLElement(document.getElementById("cm-spec-" + specId))
        : roots.length === 1 ? roots[0] : null;
      const filterBar = asHTMLElement(specRoot?.querySelector("[data-cm-filter-bar]"));
      if (usesInPlaceFacets(filterBar)) {
        const state = selectedFilterValues(filterBar);
        const page = new URL(nextUrl, window.location.origin).searchParams.get("page");
        if (page) state.page = page;
        void refreshFacetsInPlace(nextUrl, state, filterBar);
        return;
      }
      cancelFacetRefresh();
      const htmx = getGlobal().htmx;
      if (!specRoot?.id || !htmx || typeof htmx.ajax !== "function") return;
      const wrapId = "cm-spec-wrap-" + specRoot.dataset.specId;
      if (!document.getElementById(wrapId)) return;
      htmx.ajax("GET", filterNavigateHref(), {
        target: "#" + wrapId,
        swap: "innerHTML",
        select: "#" + specRoot.id,
      });
    }, 0);
  });
}

function toolbarSearchUsesFragmentNavigation(searchInput: HTMLInputElement): boolean {
  // Faceted pages route search through a server refresh so option counts update.
  if (specWantsFacets(searchInput)) return true;
  return !!tableFragmentConfig(resolveToolbarGridId(searchInput));
}

export function buildFilterUrl(baseUrl: string, state: FilterState): string {
  const url = new URL(baseUrl, window.location.origin);
  Object.entries(state).forEach(([key, val]) => {
    if (val === "" || val == null || (Array.isArray(val) && val.length === 0)) {
      url.searchParams.delete(key);
      return;
    }
    if (Array.isArray(val)) url.searchParams.set(key, val.join(","));
    else url.searchParams.set(key, String(val));
  });
  return url.pathname + url.search;
}

export function activeExportColIds(gridId: string): string {
  if (!gridId) return "";
  const gridView = getGlobal().GridView;
  const handle =
    gridView?.byId && typeof gridView.byId.get === "function" ? gridView.byId.get(gridId) : null;
  if (handle && isRecord(handle) && isRecord(handle.adapter)) {
    const getDisplayed = handle.adapter.getDisplayedColumnIds;
    if (typeof getDisplayed === "function") {
      const ids = getDisplayed.call(handle.adapter);
      if (Array.isArray(ids)) return ids.map(String).join(",");
    }
  }
  return "";
}

export function withActiveTableColumns(urlString: string, scopeEl: Element | null | undefined): string {
  const url = new URL(urlString, window.location.origin);
  const anchor =
    scopeEl && scopeEl.closest
      ? scopeEl.closest("[data-cm-toolbar-search-root], .cm-dashboard-page, .cm-page-table-layout")
      : null;
  const toolbarRoot = asHTMLElement(
    anchor?.querySelector("[data-cm-toolbar-search-root][data-cm-table-grid-id]")
  );
  const tableShell = asHTMLElement(anchor?.querySelector("[data-cm-table-shell][data-grid-id]"));
  const gridId = toolbarRoot?.dataset.cmTableGridId || tableShell?.dataset.gridId || "";
  const cols = activeExportColIds(gridId);
  if (cols) url.searchParams.set("export_cols", cols);
  else url.searchParams.delete("export_cols");
  const colQ = serializeColumnFilters(anchor || document);
  if (colQ) url.searchParams.set("col_q", colQ);
  else url.searchParams.delete("col_q");
  return url.pathname + url.search;
}

function dispatchFilterBarChange(bar: HTMLElement, event?: Event): void {
  filterBarChangeHandlers.get(bar)?.(event);
}

function bindFilterControlListeners(bar: HTMLElement): void {
  if (!boundFilterBars.has(bar)) {
    bar.addEventListener("cm-filter-change", (event) => dispatchFilterBarChange(bar, event));
    boundFilterBars.add(bar);
  }
  bar
    .querySelectorAll<HTMLSelectElement>("select[data-filter-scope='server'], select[data-cm-grouped-select]")
    .forEach((select) => {
      if (boundFilterSelects.has(select)) return;
      select.addEventListener("change", (event) => dispatchFilterBarChange(bar, event));
      boundFilterSelects.add(select);
    });
  bar.querySelectorAll<HTMLInputElement>("[data-cm-filter-input]").forEach((input) => {
    if (!boundFilterInputs.has(input)) {
      input.addEventListener("change", (event) => dispatchFilterBarChange(bar, event));
      boundFilterInputs.add(input);
    }
    if (!boundFilterInputKeydowns.has(input)) {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        dispatchFilterBarChange(bar);
      });
      boundFilterInputKeydowns.add(input);
    }
  });
  const search = asHtmlInput(bar.querySelector("[data-cm-search]"));
  if (search && !boundFilterSearchInputs.has(search)) {
    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && search.dataset.searchScope === "server") {
        dispatchFilterBarChange(bar);
      }
    });
    boundFilterSearchInputs.add(search);
  }
}

export function initMultiSelectWidget(rootEl: Element): void {
  const root = asHTMLElement(rootEl);
  if (!root) return;
  if (root.dataset.cmMsBound) return;
  root.dataset.cmMsBound = "1";
  const panel = root.querySelector(".cm-multiselect-panel");
  const trigger = root.querySelector(".cm-multiselect-trigger");
  const filterBar = asHTMLElement(root.closest("[data-cm-filter-bar]"));
  const restoreKey = {
    barId: filterBar?.id || "",
    filterId: root.dataset.filterId || "",
  };
  const regularCheckboxes = () =>
    Array.from(root.querySelectorAll<HTMLInputElement>(MS_COUNTABLE));
  const selectAllCheckbox = () =>
    root.querySelector<HTMLInputElement>('input[type="checkbox"][data-select-all]');
  const soloCheckboxes = () =>
    Array.from(root.querySelectorAll<HTMLInputElement>('[data-select-all], [data-exclusive-solo]'));
  const syncSelectAllState = () => {
    const allCb = selectAllCheckbox();
    if (!allCb) return;
    const anyRegular = regularCheckboxes().some((box) => box.checked);
    const anySolo = soloCheckboxes().some((box) => box.checked && box !== allCb);
    allCb.checked = !anyRegular && !anySolo;
  };
  const updateLabel = () => {
    _updateMultiSelectLabel(root);
  };
  trigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = panel?.classList.contains("is-open");
    const open = !isOpen;
    document.querySelectorAll(".cm-multiselect-panel.is-open").forEach((p) => p.classList.remove("is-open"));
    if (open) panel?.classList.add("is-open");
  });
  panel?.addEventListener("click", (e) => e.stopPropagation());
  root.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;
    const cb = target;
      if (root.dataset.cmSingleselect === "1" && cb.checked && cb.dataset.selectAll !== "1") {
        root.querySelectorAll('input[type="checkbox"]').forEach((otherEl) => {
          if (otherEl instanceof HTMLInputElement && otherEl !== cb) otherEl.checked = false;
        });
      }
      if (
        (cb.dataset.selectAll === "1" || cb.dataset.exclusiveSolo === "1") &&
        cb.checked
      ) {
        root.querySelectorAll('input[type="checkbox"]').forEach((oEl) => {
          if (oEl instanceof HTMLInputElement && oEl !== cb) oEl.checked = false;
        });
      } else if (root.dataset.exclusiveAll === "1" && cb.dataset.periodAll === "1" && cb.checked) {
        root.querySelectorAll('input[type="checkbox"]:not([data-period-all])').forEach((oEl) => {
          if (oEl instanceof HTMLInputElement) oEl.checked = false;
        });
      } else if (cb.dataset.periodAll !== "1" && cb.checked) {
        const allCb = root.querySelector<HTMLInputElement>("[data-period-all]");
        if (allCb) allCb.checked = false;
      }
      if (
        cb.dataset.selectAll !== "1" &&
        cb.dataset.exclusiveSolo !== "1" &&
        cb.dataset.periodAll !== "1" &&
        cb.checked
      ) {
        soloCheckboxes().forEach((o) => {
          o.checked = false;
        });
      }
      if (cb.dataset.selectAll !== "1") syncSelectAllState();
      updateLabel();
      if (root.dataset.cmSingleselect === "1") {
        root.dispatchEvent(new CustomEvent("cm-filter-change", { bubbles: true }));
        panel?.classList.remove("is-open");
        return;
      }
      const pendingTimer = multiselectChangeTimers.get(root);
      if (pendingTimer) window.clearTimeout(pendingTimer);
      multiselectPanelToRestore = restoreKey;
      const timer = window.setTimeout(() => {
        multiselectChangeTimers.delete(root);
        root.dispatchEvent(new CustomEvent("cm-filter-change", { bubbles: true }));
      }, MULTISELECT_CHANGE_DEBOUNCE_MS);
      multiselectChangeTimers.set(root, timer);
  });
  syncSelectAllState();
  updateLabel();
  root._cmUpdateLabel = updateLabel;
  if (
    multiselectPanelToRestore &&
    multiselectPanelToRestore.barId === restoreKey.barId &&
    multiselectPanelToRestore.filterId === restoreKey.filterId
  ) {
    panel?.classList.add("is-open");
    multiselectPanelToRestore = null;
  }
  if (!window.__cmMultiSelectCloseBound) {
    window.__cmMultiSelectCloseBound = true;
    document.addEventListener("click", () => {
      document.querySelectorAll(".cm-multiselect-panel.is-open").forEach((p) => p.classList.remove("is-open"));
    });
  }
}

export function bindFilterBar(barEl: Element, opts?: FilterBarOptions) {
  const bar = asHTMLElement(barEl);
  if (!bar) return { getState: () => ({} as FilterState), buildUrl: buildFilterUrl };
  const options = opts || {};
  const navigateOnChange =
    options.navigate !== false && bar.dataset.navigateOnChange !== "0";
  bar.querySelectorAll("[data-cm-multiselect]").forEach(initMultiSelectWidget);
  const periodFilter = getGlobal().CMPeriodFilter;
  if (
    periodFilter &&
    typeof periodFilter.bind === "function" &&
    !boundPeriodFilterBars.has(bar)
  ) {
    periodFilter.bind(bar);
    boundPeriodFilterBars.add(bar);
  }
  const onChange = (event?: Event) => {
    const eventDetail = event instanceof CustomEvent && isRecord(event.detail) ? event.detail : null;
    if (eventDetail?.facetsRefreshComplete === true) return;
    const state = selectedFilterValues(bar);
    state.page = "1";
    const clientParams = new Set(
      Array.from(bar.querySelectorAll<HTMLElement>('[data-filter-scope="client"]')).map(
        (filter) => filter.dataset.filterParam || filter.dataset.filterId || "",
      ),
    );
    const clientState: FilterState = {};
    Object.entries(state).forEach(([param, value]) => {
      if (clientParams.has(param)) clientState[param] = value;
    });
      const target = asHTMLElement(bar.closest(".cm-filters, .cm-toolbar-unified"))?.dataset.target;
    if (!options.onChange && usesInPlaceFacets(bar)) {
      if (event?.type === "cm-filter-change") event.stopPropagation();
      if (navigateOnChange) {
        navigateFilterState(state, bar, bar);
      } else {
        const pageUrl = withActiveTableColumns(buildFilterUrl(filterNavigateHref(), state), bar);
        const historyState = isRecord(window.history.state) ? { ...window.history.state } : {};
        window.history.replaceState(historyState, "", pageUrl);
        latestFilterNavigationUrl = pageUrl;
        void refreshFacetsInPlace(pageUrl, state, bar);
      }
      return;
    }
    if (target && clientParams.size) {
      const escaped =
        typeof CSS !== "undefined" && CSS.escape
          ? CSS.escape(target)
          : target.replace(/\\/g, "\\\\").replace(/\"/g, '\\\"');
      applyClientFilterState(document.querySelector("#cm-table-" + escaped), clientState);
    }
    // When we won't navigate, sync the URL BEFORE notifying listeners: AG-Grid
    // datasources rebuild their query params from window.location (see
    // host.ts::_pageStateFromUrl), so the URL must already reflect the new state
    // when the cm-filter-change listener triggers a datasource reload.
    if (typeof options.onChange !== "function" && !navigateOnChange) {
      const nextUrl = withActiveTableColumns(buildFilterUrl(filterNavigateHref(), state), bar);
      window.history.replaceState({}, "", nextUrl);
    }
    document.dispatchEvent(new CustomEvent("cm-filter-change", { detail: { state, bar } }));
    if (target && !navigateOnChange) invokeGridAction(target, "reloadData");
    if (typeof options.onChange === "function") options.onChange(state);
    else if (navigateOnChange) {
      navigateFilterState(state, bar, bar);
    }
  };
  filterBarChangeHandlers.set(bar, onChange);
  bindFilterControlListeners(bar);
  return { getState: () => selectedFilterValues(bar), buildUrl: buildFilterUrl };
}

export function getCsrfToken() {
  if (!document.cookie) return "";
  const parts = document.cookie.split(";");
  for (let i = 0; i < parts.length; i++) {
    const c = parts[i].trim();
    if (c.indexOf("csrftoken=") === 0) {
      return decodeURIComponent(c.substring("csrftoken=".length));
    }
  }
  return "";
}


export function setSavedSearchPanelOpen(dropdown: HTMLElement | null, open: boolean) {
  if (!dropdown) return;
  var scopeId = dropdown.dataset.cmSavedDropdownFor || "";
  var loadBtn = scopeId
    ? document.getElementById("cm-saved-searches-btn-" + scopeId)
    : null;
  const root = scopeId
    ? document.querySelector<HTMLElement>(
        '[data-cm-toolbar-search-root][data-cm-search-scope-id="' + scopeId + '"]'
      )
    : null;
  if (open && loadBtn instanceof HTMLElement) {
    document.body.appendChild(dropdown);
    dropdown.classList.add("cm-toolbar-search-saved-panel--portal");
    dropdown.classList.remove("is-hidden", "hidden");
    dropdown.classList.add("is-open");
    dropdown.style.right = "auto";
    positionFixedOverlay(dropdown, loadBtn, "end");
    loadBtn.setAttribute("aria-expanded", "true");
    return;
  }
  dropdown.classList.add("is-hidden");
  dropdown.classList.remove("is-open", "cm-toolbar-search-saved-panel--portal");
  dropdown.style.removeProperty("left");
  dropdown.style.removeProperty("top");
  dropdown.style.removeProperty("right");
  if (root) root.appendChild(dropdown);
  if (loadBtn) loadBtn.setAttribute("aria-expanded", "false");
}

/** Saved toolbar searches — one contract: scope_id (DOM), pref_grid_id (GridPreference). */
export const ToolbarSearch = {
  ctx: function (scopeId: string, wrap?: Element | null): ToolbarSearchContext | null {
    let root = asHTMLElement(wrap ?? null);
    if (!root || !root.matches("[data-cm-toolbar-search-root]")) {
      if (!scopeId) return null;
      var esc =
        typeof CSS !== "undefined" && CSS.escape
          ? CSS.escape(scopeId)
          : scopeId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      root = asHTMLElement(
        document.querySelector(
          '[data-cm-toolbar-search-root][data-cm-search-scope-id="' + esc + '"]'
        )
      );
    }
    if (!root) return null;
    var scope = root.dataset.cmSearchScopeId || scopeId || "";
    var prefId = root.dataset.cmTableGridId || root.dataset.cmPrefGridId || scope;
    var backend = root.dataset.cmSearchBackend || "";
    const input = resolveToolbarSearchInputForCtx(root, scope);
    return {
      root,
      scopeId: scope,
      prefId: prefId,
      backend: backend,
      input,
      dropdown: asHTMLElement(document.getElementById("cm-saved-searches-dropdown-" + scope)),
      container: asHTMLElement(document.getElementById("cm-saved-searches-container-" + scope)),
    };
  },
  load: function (ctx: ToolbarSearchContext | null): string[] {
    if (!ctx) return [];
    var raw = ctx.root.dataset.cmSavedSearches;
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          var fromAttr = parsed.filter(function (s) {
            return typeof s === "string" && s;
          });
          if (fromAttr.length) return fromAttr;
        }
      } catch (e) {
        /* ignore broken attribute encoding */
      }
    }
    return [];
  },
  persist: function (ctx: ToolbarSearchContext | null, items: string[]): void {
    if (!ctx) return;
    ctx.root.dataset.cmSavedSearches = JSON.stringify(items);
    var host = byId.get(ctx.scopeId);
    if (host) host.savedQuickSearches = items;
    var url = (getGlobal().GridView && getGlobal().GridView.preferencesUrl) || "";
    if (!url) return;
    fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCsrfToken(),
      },
      body: JSON.stringify({ grid_id: ctx.prefId, searches: items }),
    }).catch(function () {});
  },
  apply: function (ctx: ToolbarSearchContext | null, text: string, onPick?: (text: string) => void): void {
    if (!ctx || !ctx.input) return;
    ctx.input.value = text;
    syncToolbarSearchChrome(ctx.input);
    if (ctx.backend === "ag_grid") {
      // The AG-Grid host is registered under the bound table id (prefId), not the
      // toolbar block id (scopeId) — using scopeId returned no host, so applying a
      // saved search set the input value but never filtered the grid.
      var host = byId.get(ctx.prefId);
      if (host) {
        if (host.gridApi && typeof host.gridApi.setFilterModel === "function") {
          host.gridApi.setFilterModel(null);
        }
        // Call on the host so `this` binds (it reads this.gridApi internally).
        if (typeof host.onQuickFilterChanged === "function") {
          host.onQuickFilterChanged();
        }
      }
    } else if (ctx.backend === "client") {
      ctx.input.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (typeof onPick === "function") {
      onPick(text);
    }
    setSavedSearchPanelOpen(ctx.dropdown, false);
  },
  render: function (
    ctx: ToolbarSearchContext | null,
    items: string[],
    onPick?: ((text: string) => void) | null
  ): void {
    if (!ctx || !ctx.container) return;
    const container = ctx.container;
    container.innerHTML = "";
    const i18n = (getGlobal() as unknown as { GridViewI18n?: Record<string, string> }).GridViewI18n;

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "cm-toolbar-search-saved-empty p-2 text-slate-400 dark:text-gray-500 text-center text-[11px]";
      empty.textContent = i18n?.["search.no_saved_searches"] || "No saved searches";
      container.appendChild(empty);
      if (ctx.input) syncToolbarSearchChrome(ctx.input);
      return;
    }
    items.forEach(function (text) {
      var item = document.createElement("div");
      item.className = "cm-toolbar-search-saved-item";
      var label = document.createElement("span");
      label.textContent = text;
      item.appendChild(label);
      item.addEventListener("mousedown", function (e) {
        e.preventDefault();
        ToolbarSearch.apply(ctx, text, onPick ?? undefined);
      });
      var del = document.createElement("button");
      del.type = "button";
      del.className = "cm-toolbar-search-btn";
      del.innerHTML = "&times;";
      del.addEventListener("mousedown", function (e) {
        e.stopPropagation();
        e.preventDefault();
        var next = items.filter(function (s) {
          return s !== text;
        });
        ToolbarSearch.persist(ctx, next);
        ToolbarSearch.render(ctx, next, onPick);
      });
      item.appendChild(del);
      container.appendChild(item);
    });
    if (ctx.input) syncToolbarSearchChrome(ctx.input);
  },
  save: function (scopeId: string): void {
    var ctx = ToolbarSearch.ctx(scopeId);
    if (!ctx || !ctx.input) return;
    var val = ctx.input.value.trim();
    if (!val) return;
    var items = ToolbarSearch.load(ctx);
    if (items.indexOf(val) >= 0) return;
    items.push(val);
    ToolbarSearch.persist(ctx, items);
    var onPick =
      ctx.backend === "server" && ctx.input
        ? serverToolbarSearchApplyClient(ctx.input)
        : null;
    ToolbarSearch.render(ctx, items, onPick);
  },
  toggle: function (scopeId: string): void {
    var ctx = ToolbarSearch.ctx(scopeId);
    if (!ctx || !ctx.dropdown) return;
    var opening = ctx.dropdown.classList.contains("is-hidden");
    if (opening) {
      var onPick =
        ctx.backend === "server" && ctx.input
          ? serverToolbarSearchApplyClient(ctx.input)
          : null;
      ToolbarSearch.render(ctx, ToolbarSearch.load(ctx), onPick);

    }
    setSavedSearchPanelOpen(ctx.dropdown, opening);
  },
  mount: function (scopeId: string, initialItems?: string[]): void {
    var ctx = ToolbarSearch.ctx(scopeId);
    if (!ctx) return;
    if (initialItems && initialItems.length) {
      ctx.root.dataset.cmSavedSearches = JSON.stringify(initialItems);
    }
    ToolbarSearch.render(ctx, ToolbarSearch.load(ctx), null);
  },
  bindDismiss: function () {
    if (getGlobal()._cmSavedSearchDismissBound) return;
    getGlobal()._cmSavedSearchDismissBound = true;
    document.addEventListener("click", function (e) {
      document
        .querySelectorAll('[id^="cm-saved-searches-dropdown-"]')
        .forEach(function (ddEl) {
          const dd = asHTMLElement(ddEl);
          if (!dd || dd.classList.contains("is-hidden")) return;
          var scopeFor = dd.dataset.cmSavedDropdownFor || "";
          var esc =
            typeof CSS !== "undefined" && CSS.escape
              ? CSS.escape(scopeFor)
              : scopeFor.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          if (!scopeFor) return;
          var root = document.querySelector(
            '[data-cm-toolbar-search-root][data-cm-search-scope-id="' + esc + '"]'
          );
          const target = e.target;
          if (
            root instanceof HTMLElement &&
            target instanceof Node &&
            !root.contains(target) &&
            !dd.contains(target)
          ) {
            setSavedSearchPanelOpen(dd, false);
          }
        });
    });
  },
};
ToolbarSearch.bindDismiss();

export function syncToolbarSearchChrome(input: HTMLInputElement | null | undefined): void {
  const wrap = asHTMLElement(input?.closest("[data-cm-toolbar-search-root]"));
  if (!wrap || !input) return;
  const ctx = ToolbarSearch.ctx(wrap.dataset.cmSearchScopeId || "", wrap);
  const val = (input.value || "").trim();
  const clearBtn = wrap.querySelector(".cm-toolbar-search-clear");
  clearBtn?.classList.toggle("is-visible", val.length > 0);
  const saveBtn = wrap.querySelector(
    '.cm-toolbar-search-action--save, [data-cm-grid-action="saveSearch"]'
  );
  const saved = ctx ? ToolbarSearch.load(ctx) : [];
  saveBtn?.classList.toggle("is-active", !!(val && saved.includes(val)));
}

export function serverToolbarSearchNavigate(searchInput: HTMLInputElement): () => void {
  const scopeId =
    asHTMLElement(searchInput.closest("[data-cm-toolbar-search-root]"))?.dataset.cmSearchScopeId || "";
  const shell =
    searchInput.closest(".cm-dashboard-page, .cm-page-table-layout, .cm-simple-wrapper, .cm-table-shell") ||
    document;
  const filterBar = shell.querySelector("[data-cm-filter-bar]");
  const searchName = searchInput.name || "q";
  const hiddenSearch = filterBar?.querySelector('input[data-cm-search][name="' + searchName + '"]');

  return function navigate() {
    const value = searchInput.value || "";
    if (hiddenSearch instanceof HTMLInputElement) hiddenSearch.value = value;
    if (!filterBar) return;
    const state = selectedFilterValues(filterBar);
    const q = value.trim();
    if (q) state[searchName] = q;
    else state[searchName] = "";
    state.page = "1";
    navigateFilterState(state, searchInput, filterBar);
  };
}

/** Live SimpleTable filter for server-toolbar pages (Enter still navigates via serverToolbarSearchNavigate). */
export function serverToolbarSearchApplyClient(searchInput: HTMLInputElement): () => void {
  const scopeId =
    asHTMLElement(searchInput.closest("[data-cm-toolbar-search-root]"))?.dataset.cmSearchScopeId || "";
  const shell =
    searchInput.closest(".cm-dashboard-page, .cm-page-table-layout, .cm-simple-wrapper, .cm-table-shell") ||
    document;
  const filterBar = shell.querySelector("[data-cm-filter-bar]");
  const searchName = searchInput.name || "q";
  const hiddenSearch = filterBar?.querySelector('input[data-cm-search][name="' + searchName + '"]');

  return function applyClient() {
    syncToolbarSearchChrome(searchInput);
    if (hiddenSearch instanceof HTMLInputElement) {
      hiddenSearch.value = searchInput.value || "";
    }
    const layout =
      searchInput.closest(".cm-page-table-layout, .cm-dashboard-page, .cm-simple-wrapper, .cm-table-shell") ||
      searchInput.closest(".cm-dashboard-page");
    applyFiltersInScope(layout || document);
  };
}

let _fragmentCounterBound = false;

function bindFragmentCounterSync() {
  if (_fragmentCounterBound || typeof document === "undefined") return;
  _fragmentCounterBound = true;
  document.addEventListener("htmx:afterSwap", (event) => {
    const target = (event as CustomEvent<{ target?: Element }>).detail?.target;
    const id = target?.id || "";
    if (!id.startsWith("block-")) return;
    syncToolbarCounterFromTable(id.slice("block-".length));
  });
}

export function initToolbarSearch(scope: Document | Element | null | undefined): void {
  bindFragmentCounterSync();
  const root = scope && "querySelectorAll" in scope ? scope : document;
  root.querySelectorAll('[data-cm-search-backend="server"][data-cm-toolbar-search]').forEach((searchEl) => {
    const searchInput = asHtmlInput(searchEl);
    if (!searchInput) return;
    if (searchInput.dataset.cmToolbarSearchBound) return;
    searchInput.dataset.cmToolbarSearchBound = "1";
    const input = searchInput;
    const wrap = asHTMLElement(input.closest("[data-cm-toolbar-search-root]"));
    const scopeId = wrap?.dataset.cmSearchScopeId || "";
    const clearBtn = wrap?.querySelector(".cm-toolbar-search-clear");

    function syncStateUi() {
      const value = input.value || "";
      if (clearBtn) clearBtn.classList.toggle("is-visible", value.trim().length > 0);
    }

    const navigate = serverToolbarSearchNavigate(input);
    const applyClient = serverToolbarSearchApplyClient(input);
    const fragmentSearch = toolbarSearchUsesFragmentNavigation(input);
    const ctx = ToolbarSearch.ctx(scopeId, wrap);
    if (ctx) ToolbarSearch.render(ctx, ToolbarSearch.load(ctx), fragmentSearch ? navigate : applyClient);

    let searchNavigateTimer = 0;
    input.addEventListener("input", () => {
      syncStateUi();
      if (fragmentSearch) {
        window.clearTimeout(searchNavigateTimer);
        searchNavigateTimer = window.setTimeout(navigate, 400);
        return;
      }
      applyClient();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      navigate();
    });
    clearBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      input.value = "";
      syncStateUi();
      // Mirror the typing handler: fragment pages navigate via HTMX, client-live
      // pages just re-filter in place. Unconditionally navigating here caused a
      // full window.location reload on non-fragment pages (e.g. departments).
      if (fragmentSearch) {
        navigate();
      } else {
        applyClient();
      }
    });
    syncStateUi();
    syncToolbarSearchChrome(input);
  });

  root.querySelectorAll('[data-cm-search-backend="ag_grid"][data-cm-toolbar-search]').forEach((searchEl) => {
    const searchInput = asHtmlInput(searchEl);
    if (!searchInput) return;
    if (searchInput.dataset.cmToolbarSearchBound) return;
    searchInput.dataset.cmToolbarSearchBound = "1";
    const input = searchInput;
    const wrap = asHTMLElement(input.closest("[data-cm-toolbar-search-root]"));
    const tableGridId = wrap?.dataset.cmTableGridId || wrap?.dataset.cmSearchScopeId || "";
    const clearBtn = wrap?.querySelector(".cm-toolbar-search-clear");
    let searchReloadTimer = 0;

    function reloadGridSearch() {
      if (!tableGridId) return;
      invokeGridAction(tableGridId, "onQuickFilterChanged");
    }

    input.addEventListener("input", () => {
      syncToolbarSearchChrome(input);
      window.clearTimeout(searchReloadTimer);
      searchReloadTimer = window.setTimeout(reloadGridSearch, 300);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      window.clearTimeout(searchReloadTimer);
      invokeGridAction(tableGridId, "reloadData");
    });
    clearBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      input.value = "";
      syncToolbarSearchChrome(input);
      invokeGridAction(tableGridId, "clearSearch");
    });
    syncToolbarSearchChrome(input);
  });
}

export function initFilterBars(scope: Document | Element | null | undefined): void {
  const root = scope && "querySelectorAll" in scope ? scope : document;
  latestFilterNavigationUrl = filterNavigateHref();
  root.querySelectorAll("[data-cm-filter-bar]").forEach((barEl) => {
    const bar = asHTMLElement(barEl);
    if (!bar) return;
    if (!bar.dataset.cmFbBound) {
      bar.dataset.cmFbBound = "1";
      bindFilterBar(bar, { navigate: bar.dataset.navigateOnChange !== "0" });
    }
    const clientParams = Array.from(
      bar.querySelectorAll<HTMLElement>('[data-filter-scope="client"]'),
    ).map((filter) => filter.dataset.filterParam || filter.dataset.filterId || "");
    const target = asHTMLElement(bar.closest(".cm-filters, .cm-toolbar-unified"))?.dataset.target;
    if (target && clientParams.length) {
      const selected = selectedFilterValues(bar);
      const clientState: FilterState = {};
      clientParams.forEach((param) => {
        if (param in selected) clientState[param] = selected[param];
      });
      applyClientFilterState(document.getElementById("cm-table-" + target), clientState);
    }
  });
  initFilterDrawers(root);
  const workspaceRoot = root.querySelector("[data-cm-filter-drawer-workspace]");
  if (workspaceRoot) {
    const workspace = getGlobal().GridView?.FilterDrawerWorkspace;
    if (workspace) {
      workspace.init(root);
    } else {
      const ensureWorkspace = getGlobal().GridView?.assets?.ensureFilterDrawerWorkspace;
      if (ensureWorkspace) {
        void ensureWorkspace()
          .then(() => getGlobal().GridView?.FilterDrawerWorkspace?.init(root))
          .catch(() => undefined);
      }
    }
  }
  restoreFilterHistorySpec();
  initToolbarSearch(root);
}

/** Re-bind grid-view widgets after HTMX swaps (Phase 7: unified runtime boot). */
export function initTabGroups(scope: Document | Element | null | undefined): void {
  const root = scope && "querySelectorAll" in scope ? scope : document;
  root.querySelectorAll("[data-cm-tab-group]").forEach((groupEl) => {
    const group = asHTMLElement(groupEl);
    if (!group) return;
    if (group.dataset.cmTabBound) return;
    group.dataset.cmTabBound = "1";
    group.addEventListener("click", (e) => {
      const btn = (e.target as Element | null)?.closest("[data-cm-tab-target]");
      if (!btn || !group.contains(btn)) return;
      const targetId = btn.getAttribute("data-cm-tab-target");
      if (!targetId) return;
      group.querySelectorAll("[data-cm-tab-target]").forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
        b.setAttribute("tabindex", "-1");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      btn.removeAttribute("tabindex");
      const specRoot =
        group.closest("[data-cm-grid-view-spec]") ||
        group.closest(".cm-dashboard-page") ||
        group.parentElement;
      if (!specRoot) return;
      const isPageTabs = group.hasAttribute("data-cm-tabs-block");
      const paneHost = isPageTabs
        ? group.closest(".cm-area")
        : group.closest(".cm-area[data-cm-tab-pane]") || group.closest(".cm-area");
      if (!paneHost) return;
      const panes = paneHost.querySelectorAll(
        ":scope > .cm-area[data-cm-tab-pane], :scope > .cm-block[data-cm-tab-pane]"
      );
      let shownPane: Element | null = null;
      panes.forEach((pane) => {
        const paneId =
          pane.getAttribute("data-cm-tab-pane") ||
          pane.id.replace(/^tab-pane-/, "") ||
          pane.id.replace(/^tab-/, "");
        const visible = paneId === targetId;
        pane.classList.toggle("hidden", !visible);
        if (visible) shownPane = pane;
      });
      const urlParam = group.getAttribute("data-cm-tab-url-param");
      const tabSlug = btn.getAttribute("data-cm-tab-id");
      if (urlParam && tabSlug) {
        const url = new URL(window.location.href);
        url.searchParams.set(urlParam, tabSlug);
        window.history.replaceState({}, "", url.toString());
      }
      const gv = (window as Window & { GridView?: { bootScope?: (el: Element) => void } }).GridView;
      if (shownPane && gv?.bootScope) {
        gv.bootScope(shownPane);
      }
    });
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".cm-multiselect-panel.is-open").forEach((p) => p.classList.remove("is-open"));
});

export const FilterBar = {
  bindFilterBar,
  initFilterBars,
  initToolbarSearch,
  initColumnFilters,
  navigateWithTableFilters,
  parseSmartQuery,
  buildFilterUrl,
  withActiveTableColumns,
  selectedFilterValues,
  applyFilterValues,
  syncToolbarSearchChrome,
  collectColumnFilters: collectColumnFiltersObject,
  serializeColumnFilters,
  matchColumnFilter
};
