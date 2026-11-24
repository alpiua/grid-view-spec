"use strict";
(() => {
  // src/page-state/page-state.ts
  var ROOT_SELECTOR = "[data-cm-grid-view-spec]";
  var STORAGE_PREFIX = "cmGridViewPageState:v1:";
  var VERSION = 1;
  var FORBIDDEN_OBJECT_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  var INVALID_JSON_VALUE = Symbol("invalid-json-value");
  function isSafeKey(key) {
    return !FORBIDDEN_OBJECT_KEYS.has(key);
  }
  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function isNamespace(value) {
    return value.length > 0 && isSafeKey(value);
  }
  function isIdentityPart(value, required) {
    return !required || value.length > 0;
  }
  function cloneJsonValue(value, seen = /* @__PURE__ */ new WeakSet()) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : INVALID_JSON_VALUE;
    if (typeof value !== "object") return INVALID_JSON_VALUE;
    if (seen.has(value)) return INVALID_JSON_VALUE;
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        const result2 = [];
        for (const item of value) {
          const validated = cloneJsonValue(item, seen);
          if (validated === INVALID_JSON_VALUE) return INVALID_JSON_VALUE;
          result2.push(validated);
        }
        return result2;
      }
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) return INVALID_JSON_VALUE;
      const result = /* @__PURE__ */ Object.create(null);
      for (const [key, item] of Object.entries(value)) {
        if (!isSafeKey(key)) return INVALID_JSON_VALUE;
        const validated = cloneJsonValue(item, seen);
        if (validated === INVALID_JSON_VALUE) return INVALID_JSON_VALUE;
        result[key] = validated;
      }
      return result;
    } catch (e) {
      return INVALID_JSON_VALUE;
    } finally {
      seen.delete(value);
    }
  }
  function emptyState() {
    return { version: VERSION, namespaces: /* @__PURE__ */ Object.create(null) };
  }
  function parseStoredState(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!isRecord(parsed)) return null;
      const envelope = parsed;
      if (envelope.version !== VERSION) return null;
      const namespaces = envelope.namespaces;
      if (!isRecord(namespaces)) return null;
      const validState = emptyState();
      for (const [namespace, value] of Object.entries(namespaces)) {
        if (!isNamespace(namespace)) return null;
        const validated = cloneJsonValue(value);
        if (validated === INVALID_JSON_VALUE) return null;
        validState.namespaces[namespace] = validated;
      }
      return validState;
    } catch (e) {
      return null;
    }
  }
  function browserStorage() {
    try {
      return typeof window === "undefined" ? null : window.localStorage;
    } catch (e) {
      return null;
    }
  }
  function readState(storage, key) {
    try {
      return parseStoredState(storage.getItem(key));
    } catch (e) {
      return null;
    }
  }
  function writeState(storage, key, state) {
    try {
      storage.setItem(key, JSON.stringify(state));
    } catch (e) {
    }
  }
  function removeState(storage, key) {
    try {
      storage.removeItem(key);
    } catch (e) {
    }
  }
  function resolveSpecRoot(root) {
    if (!root.isConnected) return null;
    const specRoot = root.matches(ROOT_SELECTOR) ? root : root.closest(ROOT_SELECTOR);
    return specRoot instanceof HTMLElement ? specRoot : null;
  }
  function pageStateIdentity(root) {
    var _a, _b;
    const specId = (_a = root.getAttribute("data-spec-id")) != null ? _a : "";
    const scope = (_b = root.getAttribute("data-cm-page-state-scope")) != null ? _b : "";
    if (!isIdentityPart(specId, true) || !isIdentityPart(scope, false)) return null;
    try {
      return {
        storageKey: `${STORAGE_PREFIX}${encodeURIComponent(specId)}:${encodeURIComponent(scope)}`
      };
    } catch (e) {
      return null;
    }
  }
  var LocalPageStateHandle = class {
    constructor(root, storageKey) {
      this.root = root;
      this.storageKey = storageKey;
    }
    get(namespace) {
      if (!this.isLive() || !isNamespace(namespace)) return void 0;
      const storage = browserStorage();
      const stored = storage ? readState(storage, this.storageKey) : null;
      const value = stored == null ? void 0 : stored.namespaces[namespace];
      if (value === void 0) return void 0;
      const cloned = cloneJsonValue(value);
      return cloned === INVALID_JSON_VALUE ? void 0 : cloned;
    }
    put(namespace, value) {
      var _a;
      if (!this.isLive() || !isNamespace(namespace)) return;
      const validated = cloneJsonValue(value);
      if (validated === INVALID_JSON_VALUE) return;
      const storage = browserStorage();
      if (!storage) return;
      const state = (_a = readState(storage, this.storageKey)) != null ? _a : emptyState();
      state.namespaces[namespace] = validated;
      writeState(storage, this.storageKey, state);
    }
    remove(namespace) {
      if (!this.isLive() || !isNamespace(namespace)) return;
      const storage = browserStorage();
      if (!storage) return;
      const state = readState(storage, this.storageKey);
      if (!state) {
        removeState(storage, this.storageKey);
        return;
      }
      if (!(namespace in state.namespaces)) return;
      delete state.namespaces[namespace];
      if (Object.keys(state.namespaces).length === 0) {
        removeState(storage, this.storageKey);
        return;
      }
      writeState(storage, this.storageKey, state);
    }
    isLive() {
      return this.root.isConnected;
    }
  };
  var PageState = {
    forRoot(root) {
      if (typeof Element === "undefined" || !(root instanceof Element)) return null;
      const specRoot = resolveSpecRoot(root);
      if (!specRoot) return null;
      const identity = pageStateIdentity(specRoot);
      return identity ? new LocalPageStateHandle(specRoot, identity.storageKey) : null;
    }
  };

  // src/grid-view/dom-guards.ts
  function asHTMLElement(el) {
    return el instanceof HTMLElement ? el : null;
  }

  // src/grid-view/filter-drawer-workspace.ts
  function isTreePreference(value) {
    return value !== null && typeof value === "object" && "version" in value && value.version === 1 && "collapsed" in value && Array.isArray(value.collapsed) && value.collapsed.every((item) => typeof item === "string");
  }
  function roots(scope) {
    const root = scope && "querySelectorAll" in scope ? scope : document;
    const workspaces = Array.from(root.querySelectorAll("[data-cm-filter-drawer-workspace]"));
    if (scope instanceof HTMLElement && scope.matches("[data-cm-filter-drawer-workspace]")) {
      workspaces.unshift(scope);
    }
    return workspaces;
  }
  function isDisplaySetting(control) {
    return control.closest("[data-cm-filter-display-setting='1']") !== null;
  }
  function activeControls(card) {
    const active = [];
    card.querySelectorAll("input, select").forEach((control) => {
      if (control.disabled || isDisplaySetting(control)) return;
      if (control instanceof HTMLInputElement) {
        if (control.type === "checkbox" ? control.checked : control.value.trim() !== "") active.push(control);
        return;
      }
      if (control.value !== "") active.push(control);
    });
    return active;
  }
  function updateCardChrome(workspace) {
    let activeCount = 0;
    workspace.querySelectorAll("[data-cm-filter-card]").forEach((card) => {
      const count = activeControls(card).length;
      activeCount += count;
      const badge = card.querySelector("[data-cm-filter-card-count]");
      if (badge) {
        badge.textContent = String(count);
        badge.hidden = count === 0;
      }
      const reset = card.querySelector("[data-cm-filter-card-reset]");
      if (reset) reset.hidden = count === 0;
    });
    if (workspace.dataset.cmFilterWorkspacePanel === "filters") {
      const drawer = workspace.closest("[data-cm-filter-drawer]");
      const badge = drawer == null ? void 0 : drawer.querySelector("[data-cm-filter-drawer-active-count]");
      if (badge) {
        badge.textContent = String(activeCount);
        badge.hidden = activeCount === 0;
      }
    }
    const resetAll = workspace.querySelector("[data-cm-filter-drawer-reset-all]");
    if (resetAll) resetAll.hidden = activeCount === 0;
  }
  function dispatchFilterChange(workspace) {
    workspace.dispatchEvent(new CustomEvent("cm-filter-change", { bubbles: true }));
    updateCardChrome(workspace);
  }
  function resetControls(scope) {
    scope.querySelectorAll("input, select").forEach((control) => {
      if (control.disabled || isDisplaySetting(control)) return;
      if (control instanceof HTMLInputElement) {
        if (control.type === "checkbox") control.checked = false;
        else control.value = "";
        return;
      }
      control.value = "";
    });
    scope.querySelectorAll("[data-cm-multiselect]").forEach((root) => {
      var _a;
      return (_a = root._cmUpdateLabel) == null ? void 0 : _a.call(root);
    });
  }
  function treeNodes(scope) {
    return Array.from(scope.querySelectorAll("[data-cm-filter-tree-node]"));
  }
  function treePreferenceKey(workspace) {
    const drawer = workspace.closest("[data-cm-filter-drawer]");
    return `filters.${(drawer == null ? void 0 : drawer.dataset.cmFilterDrawerId) || workspace.id}.workspace-tree`;
  }
  function readCollapsedTreeNodes(workspace) {
    var _a;
    const state = (_a = PageState.forRoot(workspace)) == null ? void 0 : _a.get(treePreferenceKey(workspace));
    if (isTreePreference(state)) return new Set(state.collapsed);
    const collapsed = new Set(
      treeNodes(workspace).filter((node) => node.querySelector("[data-cm-filter-tree-toggle]") !== null).map((node) => node.dataset.cmFilterTreeValue || "").filter(Boolean)
    );
    writeCollapsedTreeNodes(workspace, collapsed);
    return collapsed;
  }
  function writeCollapsedTreeNodes(workspace, collapsed) {
    var _a;
    (_a = PageState.forRoot(workspace)) == null ? void 0 : _a.put(treePreferenceKey(workspace), { version: 1, collapsed: [...collapsed] });
  }
  var workspaceQueries = /* @__PURE__ */ new WeakMap();
  var cardQueries = /* @__PURE__ */ new WeakMap();
  function updateTreeVisibility(workspace, collapsed, requiredQueries = [], scope = workspace) {
    const nodes = treeNodes(scope);
    const byValue = new Map(nodes.map((node) => [node.dataset.cmFilterTreeValue || "", node]));
    const matching = /* @__PURE__ */ new Set();
    const terms = requiredQueries.map((term) => term.trim().toLocaleLowerCase()).filter(Boolean);
    const hasSearch = terms.length > 0;
    if (hasSearch) {
      nodes.forEach((node) => {
        var _a, _b;
        const value = node.dataset.cmFilterTreeValue || "";
        const label = ((_b = (_a = node.querySelector(".cm-filter-drawer-option-label")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.toLocaleLowerCase()) || "";
        if (terms.every((term) => label.includes(term))) matching.add(value);
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
      var _a, _b;
      const value = node.dataset.cmFilterTreeValue || "";
      let parentValue = node.dataset.cmFilterTreeParent || "";
      let hiddenByAncestor = false;
      while (parentValue) {
        if (collapsed.has(parentValue) && !hasSearch) {
          hiddenByAncestor = true;
          break;
        }
        parentValue = ((_a = byValue.get(parentValue)) == null ? void 0 : _a.dataset.cmFilterTreeParent) || "";
      }
      node.hidden = hiddenByAncestor || hasSearch && !matching.has(value);
      node.classList.toggle("is-tree-collapsed", collapsed.has(value));
      (_b = node.querySelector("[data-cm-filter-tree-toggle]")) == null ? void 0 : _b.setAttribute(
        "aria-expanded",
        String(!collapsed.has(value))
      );
    });
  }
  function updateCardOptionVisibility(card, workspace, collapsed) {
    var _a;
    const workspaceQuery = workspaceQueries.get(workspace) || "";
    const cardQuery = cardQueries.get(card) || "";
    const cardMatchesWorkspace = workspaceQuery !== "" && (((_a = card.querySelector("h3")) == null ? void 0 : _a.textContent) || "").toLocaleLowerCase().includes(workspaceQuery);
    const searchable = card.dataset.cmFilterCardSearchable === "1";
    const applyWorkspaceFilterToOptions = workspaceQuery !== "" && !cardMatchesWorkspace;
    let workspaceOptionMatches = false;
    card.querySelectorAll("[data-cm-filter-option]").forEach((option) => {
      if (option.matches("[data-cm-filter-tree-node]")) return;
      const label = (option.textContent || "").toLocaleLowerCase();
      const matchesWorkspace = !applyWorkspaceFilterToOptions || searchable && label.includes(workspaceQuery);
      const matchesCard = cardQuery === "" || label.includes(cardQuery);
      option.hidden = !(matchesWorkspace && matchesCard);
      if (matchesWorkspace) workspaceOptionMatches = true;
    });
    const requiredTreeQueries = [];
    if (applyWorkspaceFilterToOptions && searchable) requiredTreeQueries.push(workspaceQuery);
    else if (applyWorkspaceFilterToOptions) requiredTreeQueries.push("\0__no_tree_match__");
    if (cardQuery) requiredTreeQueries.push(cardQuery);
    updateTreeVisibility(workspace, collapsed, requiredTreeQueries, card);
    const workspaceTreeMatches = !applyWorkspaceFilterToOptions || !!Array.from(card.querySelectorAll("[data-cm-filter-tree-node]")).some((node) => {
      var _a2, _b;
      if (!searchable) return false;
      const label = ((_b = (_a2 = node.querySelector(".cm-filter-drawer-option-label")) == null ? void 0 : _a2.textContent) == null ? void 0 : _b.toLocaleLowerCase()) || "";
      return label.includes(workspaceQuery);
    });
    return workspaceQuery === "" || cardMatchesWorkspace || workspaceOptionMatches || workspaceTreeMatches;
  }
  function bindWorkspaceSearch(workspace, collapsed) {
    const search = workspace.querySelector("[data-cm-filter-workspace-search]");
    if (!search) return;
    search.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase();
      workspaceQueries.set(workspace, query);
      workspace.querySelectorAll("[data-cm-filter-card], .cm-filter-drawer-card").forEach((card) => {
        card.hidden = query !== "" && !updateCardOptionVisibility(card, workspace, collapsed);
      });
    });
  }
  function bindCardSearch(workspace, card, collapsed) {
    const search = card.querySelector("[data-cm-filter-card-search]");
    if (!search) return;
    search.addEventListener("input", () => {
      cardQueries.set(card, search.value.trim().toLocaleLowerCase());
      const matchesWorkspace = updateCardOptionVisibility(card, workspace, collapsed);
      card.hidden = (workspaceQueries.get(workspace) || "") !== "" && !matchesWorkspace;
    });
  }
  var collapsedByWorkspace = /* @__PURE__ */ new WeakMap();
  function bindWorkspaceCards(workspace, collapsed) {
    workspace.querySelectorAll("[data-cm-filter-card]").forEach((card) => {
      if (card.dataset.cmFilterCardBound) return;
      card.dataset.cmFilterCardBound = "1";
      bindCardSearch(workspace, card, collapsed);
    });
  }
  function bindWorkspace(workspace) {
    var _a;
    let collapsed = collapsedByWorkspace.get(workspace);
    if (!workspace.dataset.cmFilterWorkspaceBound || !collapsed) {
      workspace.dataset.cmFilterWorkspaceBound = "1";
      collapsed = readCollapsedTreeNodes(workspace);
      collapsedByWorkspace.set(workspace, collapsed);
      workspace.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const toggle = target.closest("[data-cm-filter-tree-toggle]");
        if (toggle && workspace.contains(toggle)) {
          event.preventDefault();
          event.stopPropagation();
          const node = asHTMLElement(toggle.closest("[data-cm-filter-tree-node]"));
          const value = (node == null ? void 0 : node.dataset.cmFilterTreeValue) || "";
          if (!value || !collapsed) return;
          if (collapsed.has(value)) collapsed.delete(value);
          else collapsed.add(value);
          writeCollapsedTreeNodes(workspace, collapsed);
          const card = asHTMLElement(toggle.closest("[data-cm-filter-card], .cm-filter-drawer-card"));
          if (card) {
            const matchesWorkspace = updateCardOptionVisibility(card, workspace, collapsed);
            card.hidden = (workspaceQueries.get(workspace) || "") !== "" && !matchesWorkspace;
          } else {
            updateTreeVisibility(workspace, collapsed);
          }
          return;
        }
        const cardReset = target.closest("[data-cm-filter-card-reset]");
        if (cardReset && workspace.contains(cardReset)) {
          const card = asHTMLElement(cardReset.closest("[data-cm-filter-card]"));
          if (!card) return;
          resetControls(card);
          dispatchFilterChange(workspace);
        }
      });
      bindWorkspaceSearch(workspace, collapsed);
      (_a = workspace.querySelector("[data-cm-filter-drawer-reset-all]")) == null ? void 0 : _a.addEventListener("click", () => {
        resetControls(workspace);
        dispatchFilterChange(workspace);
      });
      workspace.addEventListener("change", () => updateCardChrome(workspace));
      workspace.addEventListener("cm-filter-change", () => updateCardChrome(workspace));
    }
    bindWorkspaceCards(workspace, collapsed);
    updateTreeVisibility(workspace, collapsed);
    updateCardChrome(workspace);
  }
  function initFilterDrawerWorkspaces(scope) {
    roots(scope).forEach(bindWorkspace);
  }
  function installFilterDrawerWorkspace() {
    const global = window;
    global.GridView = global.GridView || {};
    global.GridView.FilterDrawerWorkspace = { init: initFilterDrawerWorkspaces };
  }

  // src/filter-drawer-workspace-boot.ts
  installFilterDrawerWorkspace();
})();
