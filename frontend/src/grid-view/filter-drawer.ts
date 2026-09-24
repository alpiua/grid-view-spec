/** Persistent filter drawer state, tabs, search, and resize behavior. */

import { PageState } from "../page-state/page-state";
import { asHTMLElement, isRecord } from "./dom-guards";
import { byId } from "./registry";

type FilterDrawerPanel = "filters" | "settings";

interface FilterDrawerState {
  collapsed: boolean;
  width: number;
  activePanel: FilterDrawerPanel;
}

function drawerState(value: unknown): FilterDrawerState | null {
  if (!isRecord(value)) return null;
  if (typeof value.collapsed !== "boolean" || typeof value.width !== "number") return null;
  if (!Number.isFinite(value.width)) return null;
  return {
    collapsed: value.collapsed,
    width: value.width,
    activePanel: value.activePanel === "settings" ? "settings" : "filters",
  };
}

function bindLegacyDrawerSearch(drawer: HTMLElement): void {
  const search = drawer.querySelector<HTMLInputElement>("[data-cm-filter-drawer-search]");
  search?.addEventListener("input", () => {
    const query = search.value.trim().toLocaleLowerCase();
    drawer.querySelectorAll<HTMLElement>("[data-cm-filter-search-item]").forEach((item) => {
      const label = (
        item.dataset.placeholder ||
        item.querySelector(".cm-filter-field__label, .cm-filter-grouped-select__label")?.textContent ||
        ""
      ).toLocaleLowerCase();
      const matchesLabel = !query || label.includes(query);
      let hasMatchingOption = false;
      item.querySelectorAll<HTMLElement>(".cm-multiselect-option").forEach((option) => {
        const matchesOption = !query || matchesLabel || option.textContent?.toLocaleLowerCase().includes(query);
        option.hidden = !matchesOption;
        hasMatchingOption ||= !!matchesOption;
      });
      if (!hasMatchingOption) {
        hasMatchingOption = Array.from(item.querySelectorAll("option")).some(
          (option) => !query || matchesLabel || option.textContent?.toLocaleLowerCase().includes(query),
        );
      }
      const visible = matchesLabel || hasMatchingOption;
      item.hidden = !visible;
      item.querySelectorAll<HTMLElement>(".cm-multiselect-panel").forEach((panel) => {
        if (!query) {
          panel.classList.toggle("is-open", panel.dataset.cmDrawerSearchWasOpen === "1");
          delete panel.dataset.cmDrawerSearchWasOpen;
          return;
        }
        if (panel.dataset.cmDrawerSearchWasOpen === undefined) {
          panel.dataset.cmDrawerSearchWasOpen = panel.classList.contains("is-open") ? "1" : "0";
        }
        panel.classList.toggle("is-open", visible);
      });
    });
  });
}

function mountDrawerSettingsForGrid(gridId: string): void {
  const grid = byId.get(gridId);
  if (!grid) return;
  document.querySelectorAll<HTMLElement>("[data-cm-filter-drawer-settings]").forEach((container) => {
    if (container.dataset.cmGridId === gridId) grid.mountColumnSettings?.(container);
  });
}

function gridIdFromReadyEvent(event: Event): string | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail = event.detail;
  if (typeof detail !== "object" || detail === null) return null;
  const gridId = Reflect.get(detail, "gridId");
  return typeof gridId === "string" ? gridId : null;
}

let gridReadyMountBound = false;

function installGridReadySettingsMount(): void {
  if (gridReadyMountBound) return;
  gridReadyMountBound = true;
  document.addEventListener("cm-grid-ready", (event) => {
    const gridId = gridIdFromReadyEvent(event);
    if (gridId) mountDrawerSettingsForGrid(gridId);
  });
}

function bindFilterDrawer(drawer: HTMLElement): void {
  if (drawer.dataset.cmFilterDrawerBound) return;
  drawer.dataset.cmFilterDrawerBound = "1";
  const drawerId = drawer.dataset.cmFilterDrawerId || drawer.id;
  if (!drawerId) return;
  const pageState = PageState.forRoot(drawer);
  const namespace = `filters.${drawerId}.drawer`;
  const restored = drawerState(pageState?.get(namespace));
  let state: FilterDrawerState = {
    collapsed: restored?.collapsed ?? false,
    width: Math.max(240, Math.min(520, Math.round(restored?.width ?? 320))),
    activePanel: restored?.activePanel ?? "filters",
  };
  const mountSettings = (): void => {
    drawer.querySelectorAll<HTMLElement>("[data-cm-filter-drawer-settings]").forEach((container) => {
      const grid = byId.get(container.dataset.cmGridId || "");
      if (grid && typeof grid.mountColumnSettings === "function") {
        grid.mountColumnSettings(container);
      }
    });
  };
  const persist = () =>
    pageState?.put(namespace, {
      collapsed: state.collapsed,
      width: state.width,
      activePanel: state.activePanel,
    });
  const apply = () => {
    drawer.classList.toggle("is-collapsed", state.collapsed);
    drawer.style.setProperty("--cm-filter-drawer-width", `${state.width}px`);
    drawer.querySelectorAll<HTMLElement>("[data-cm-filter-drawer-open]").forEach((button) => {
      button.setAttribute("aria-expanded", String(!state.collapsed));
    });
    drawer.querySelector<HTMLElement>("[data-cm-filter-drawer-resize]")?.setAttribute("aria-valuenow", String(state.width));
    drawer.querySelectorAll<HTMLElement>("[data-cm-filter-drawer-tab]").forEach((tab) => {
      const active = tab.dataset.cmFilterDrawerTab === state.activePanel;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    drawer.querySelectorAll<HTMLElement>("[data-cm-filter-drawer-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.cmFilterDrawerPanel !== state.activePanel;
    });
    if (state.activePanel === "settings") mountSettings();
  };
  const setCollapsed = (collapsed: boolean) => {
    state = { ...state, collapsed };
    apply();
    persist();
    drawer.querySelector<HTMLElement>(collapsed ? "[data-cm-filter-drawer-open]" : "[data-cm-filter-drawer-close]")?.focus();
  };
  drawer.querySelectorAll("[data-cm-filter-drawer-open]").forEach((button) => {
    button.addEventListener("click", () => setCollapsed(false));
  });
  drawer.querySelectorAll("[data-cm-filter-drawer-close]").forEach((button) => {
    button.addEventListener("click", () => setCollapsed(true));
  });
  drawer.querySelectorAll<HTMLElement>("[data-cm-filter-drawer-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const activePanel: FilterDrawerPanel = tab.dataset.cmFilterDrawerTab === "settings" ? "settings" : "filters";
      if (!drawer.querySelector(`[data-cm-filter-drawer-panel="${activePanel}"]`)) return;
      state = { ...state, collapsed: false, activePanel };
      apply();
      persist();
    });
  });
  bindLegacyDrawerSearch(drawer);
  const resize = drawer.querySelector<HTMLElement>("[data-cm-filter-drawer-resize]");
  const setWidth = (width: number) => {
    state = { ...state, collapsed: false, width: Math.max(240, Math.min(520, Math.round(width))) };
    apply();
    persist();
  };
  resize?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = state.width;
    const onMove = (move: PointerEvent) => setWidth(startWidth + move.clientX - startX);
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd, { once: true });
    window.addEventListener("pointercancel", onEnd, { once: true });
  });
  resize?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setWidth(state.width - 16);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setWidth(state.width + 16);
    }
  });
  mountSettings();
  apply();
}

export function initFilterDrawers(scope: Document | Element): void {
  installGridReadySettingsMount();
  const drawers = Array.from(scope.querySelectorAll<HTMLElement>("[data-cm-filter-drawer]"));
  if (scope instanceof HTMLElement && scope.matches("[data-cm-filter-drawer]")) drawers.unshift(scope);
  drawers.forEach(bindFilterDrawer);
}
