import { PageState } from "../page-state/page-state";
import { asHTMLElement } from "./dom-guards";

interface TreePreference {
  version: 1;
  collapsed: string[];
}

interface WorkspacePlugin {
  init: (scope?: Document | Element | null) => void;
}

function isTreePreference(value: unknown): value is TreePreference {
  return (
    value !== null &&
    typeof value === "object" &&
    "version" in value &&
    value.version === 1 &&
    "collapsed" in value &&
    Array.isArray(value.collapsed) &&
    value.collapsed.every((item) => typeof item === "string")
  );
}

function roots(scope: Document | Element | null | undefined): HTMLElement[] {
  const root = scope && "querySelectorAll" in scope ? scope : document;
  const workspaces = Array.from(root.querySelectorAll<HTMLElement>("[data-cm-filter-drawer-workspace]"));
  if (scope instanceof HTMLElement && scope.matches("[data-cm-filter-drawer-workspace]")) {
    workspaces.unshift(scope);
  }
  return workspaces;
}

function isDisplaySetting(control: Element): boolean {
  return control.closest("[data-cm-filter-display-setting='1']") !== null;
}

function activeControls(card: HTMLElement): Element[] {
  const active: Element[] = [];
  card.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach((control) => {
    if (control.disabled || isDisplaySetting(control)) return;
    if (control instanceof HTMLInputElement) {
      if (control.type === "checkbox" ? control.checked : control.value.trim() !== "") active.push(control);
      return;
    }
    if (control.value !== "") active.push(control);
  });
  return active;
}

function updateCardChrome(workspace: HTMLElement): void {
  let activeCount = 0;
  workspace.querySelectorAll<HTMLElement>("[data-cm-filter-card]").forEach((card) => {
    const count = activeControls(card).length;
    activeCount += count;
    const badge = card.querySelector<HTMLElement>("[data-cm-filter-card-count]");
    if (badge) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    }
    const reset = card.querySelector<HTMLButtonElement>("[data-cm-filter-card-reset]");
    if (reset) reset.hidden = count === 0;
  });
  if (workspace.dataset.cmFilterWorkspacePanel === "filters") {
    const drawer = workspace.closest<HTMLElement>("[data-cm-filter-drawer]");
    const badge = drawer?.querySelector<HTMLElement>("[data-cm-filter-drawer-active-count]");
    if (badge) {
      badge.textContent = String(activeCount);
      badge.hidden = activeCount === 0;
    }
  }
  const resetAll = workspace.querySelector<HTMLButtonElement>("[data-cm-filter-drawer-reset-all]");
  if (resetAll) resetAll.hidden = activeCount === 0;
}

function dispatchFilterChange(workspace: HTMLElement): void {
  // Workspace reset controls dispatch from the workspace itself. The filter
  // bar owns navigation/data refresh, so this must traverse that same event
  // boundary as a checklist selection does.
  workspace.dispatchEvent(new CustomEvent("cm-filter-change", { bubbles: true }));
  updateCardChrome(workspace);
}

function resetControls(scope: ParentNode): void {
  scope.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach((control) => {
    if (control.disabled || isDisplaySetting(control)) return;
    if (control instanceof HTMLInputElement) {
      if (control.type === "checkbox") control.checked = false;
      else control.value = "";
      return;
    }
    control.value = "";
  });
}

function treeNodes(scope: ParentNode): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>("[data-cm-filter-tree-node]"));
}

function treePreferenceKey(workspace: HTMLElement): string {
  const drawer = workspace.closest<HTMLElement>("[data-cm-filter-drawer]");
  return `filters.${drawer?.dataset.cmFilterDrawerId || workspace.id}.workspace-tree`;
}

function readCollapsedTreeNodes(workspace: HTMLElement): Set<string> {
  const state = PageState.forRoot(workspace)?.get(treePreferenceKey(workspace));
  if (isTreePreference(state)) return new Set(state.collapsed);

  // A tree is navigation, not a flat checklist: start compact and let search
  // reveal matching branches. The versioned preference preserves deliberate
  // manual expansion on later visits while migrating the previous empty state.
  const collapsed = new Set(
    treeNodes(workspace)
      .filter((node) => node.querySelector("[data-cm-filter-tree-toggle]") !== null)
      .map((node) => node.dataset.cmFilterTreeValue || "")
      .filter(Boolean),
  );
  writeCollapsedTreeNodes(workspace, collapsed);
  return collapsed;
}

function writeCollapsedTreeNodes(workspace: HTMLElement, collapsed: Set<string>): void {
  PageState.forRoot(workspace)?.put(treePreferenceKey(workspace), { version: 1, collapsed: [...collapsed] });
}

function updateTreeVisibility(
  workspace: HTMLElement,
  collapsed: Set<string>,
  searchQuery = "",
  scope: ParentNode = workspace,
): void {
  const nodes = treeNodes(scope);
  const byValue = new Map(nodes.map((node) => [node.dataset.cmFilterTreeValue || "", node]));
  const matching = new Set<string>();
  const query = searchQuery.trim().toLocaleLowerCase();

  if (query) {
    nodes.forEach((node) => {
      const value = node.dataset.cmFilterTreeValue || "";
      const label = node.querySelector(".cm-filter-drawer-option-label")?.textContent?.toLocaleLowerCase() || "";
      if (label.includes(query)) matching.add(value);
    });
    [...matching].forEach((value) => {
      let node = byValue.get(value);
      while (node) {
        const parentValue = node.dataset.cmFilterTreeParent || "";
        if (!parentValue) break;
        matching.add(parentValue);
        node = byValue.get(parentValue);
      }
    });
  }

  nodes.forEach((node) => {
    const value = node.dataset.cmFilterTreeValue || "";
    let parentValue = node.dataset.cmFilterTreeParent || "";
    let hiddenByAncestor = false;
    while (parentValue) {
      if (collapsed.has(parentValue) && !query) {
        hiddenByAncestor = true;
        break;
      }
      parentValue = byValue.get(parentValue)?.dataset.cmFilterTreeParent || "";
    }
    node.hidden = hiddenByAncestor || (query !== "" && !matching.has(value));
    node.classList.toggle("is-tree-collapsed", collapsed.has(value));
    node.querySelector<HTMLButtonElement>("[data-cm-filter-tree-toggle]")?.setAttribute(
      "aria-expanded",
      String(!collapsed.has(value)),
    );
  });
}

function updateCardOptionVisibility(card: HTMLElement, workspace: HTMLElement, collapsed: Set<string>, query: string): boolean {
  const cardMatches = (card.querySelector("h3")?.textContent || "").toLocaleLowerCase().includes(query);
  const searchable = card.dataset.cmFilterCardSearchable === "1";
  let optionMatches = false;
  card.querySelectorAll<HTMLElement>("[data-cm-filter-drawer-option]").forEach((option) => {
    if (option.matches("[data-cm-filter-tree-node]")) return;
    const matches =
      query === "" || cardMatches || (searchable && (option.textContent || "").toLocaleLowerCase().includes(query));
    option.hidden = !matches;
    optionMatches ||= matches;
  });
  updateTreeVisibility(workspace, collapsed, query, card);
  return cardMatches || optionMatches || !!card.querySelector("[data-cm-filter-tree-node]:not([hidden])");
}

function bindWorkspaceSearch(workspace: HTMLElement, collapsed: Set<string>): void {
  const search = workspace.querySelector<HTMLInputElement>("[data-cm-filter-workspace-search]");
  if (!search) return;
  search.addEventListener("input", () => {
    const query = search.value.trim().toLocaleLowerCase();
    workspace.querySelectorAll<HTMLElement>("[data-cm-filter-card], .cm-filter-drawer-card").forEach((card) => {
      card.hidden = query !== "" && !updateCardOptionVisibility(card, workspace, collapsed, query);
    });
  });
}

function bindCardSearch(workspace: HTMLElement, card: HTMLElement, collapsed: Set<string>): void {
  const search = card.querySelector<HTMLInputElement>("[data-cm-filter-card-search]");
  if (!search) return;
  search.addEventListener("input", () => {
    updateCardOptionVisibility(card, workspace, collapsed, search.value.trim().toLocaleLowerCase());
    card.hidden = false;
  });
}

function bindTree(workspace: HTMLElement, collapsed: Set<string>): void {
  updateTreeVisibility(workspace, collapsed);
  workspace.querySelectorAll<HTMLButtonElement>("[data-cm-filter-tree-toggle]").forEach((toggle) => {
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const node = asHTMLElement(toggle.closest("[data-cm-filter-tree-node]"));
      const value = node?.dataset.cmFilterTreeValue || "";
      if (!value) return;
      if (collapsed.has(value)) collapsed.delete(value);
      else collapsed.add(value);
      writeCollapsedTreeNodes(workspace, collapsed);
      updateTreeVisibility(workspace, collapsed);
    });
  });
}

function bindWorkspace(workspace: HTMLElement): void {
  if (workspace.dataset.cmFilterWorkspaceBound) return;
  workspace.dataset.cmFilterWorkspaceBound = "1";
  const collapsed = readCollapsedTreeNodes(workspace);

  bindTree(workspace, collapsed);
  bindWorkspaceSearch(workspace, collapsed);
  workspace.querySelectorAll<HTMLElement>("[data-cm-filter-card]").forEach((card) => {
    bindCardSearch(workspace, card, collapsed);
    card.querySelector<HTMLButtonElement>("[data-cm-filter-card-reset]")?.addEventListener("click", () => {
      resetControls(card);
      dispatchFilterChange(workspace);
    });
  });
  workspace.querySelector<HTMLButtonElement>("[data-cm-filter-drawer-reset-all]")?.addEventListener("click", () => {
    resetControls(workspace);
    dispatchFilterChange(workspace);
  });
  workspace.addEventListener("change", () => updateCardChrome(workspace));
  updateCardChrome(workspace);
}

export function initFilterDrawerWorkspaces(scope?: Document | Element | null): void {
  roots(scope).forEach(bindWorkspace);
}

export function installFilterDrawerWorkspace(): void {
  const global = window as Window & { GridView?: { FilterDrawerWorkspace?: WorkspacePlugin } };
  global.GridView = global.GridView || {};
  global.GridView.FilterDrawerWorkspace = { init: initFilterDrawerWorkspaces };
}
