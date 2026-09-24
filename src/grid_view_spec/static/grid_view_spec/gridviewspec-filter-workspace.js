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
  function updateTreeVisibility(workspace, collapsed, searchQuery = "", scope = workspace) {
    const nodes = treeNodes(scope);
    const byValue = new Map(nodes.map((node) => [node.dataset.cmFilterTreeValue || "", node]));
    const matching = /* @__PURE__ */ new Set();
    const query = searchQuery.trim().toLocaleLowerCase();
    if (query) {
      nodes.forEach((node) => {
        var _a, _b;
        const value = node.dataset.cmFilterTreeValue || "";
        const label = ((_b = (_a = node.querySelector(".cm-filter-drawer-option-label")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.toLocaleLowerCase()) || "";
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
      var _a, _b;
      const value = node.dataset.cmFilterTreeValue || "";
      let parentValue = node.dataset.cmFilterTreeParent || "";
      let hiddenByAncestor = false;
      while (parentValue) {
        if (collapsed.has(parentValue) && !query) {
          hiddenByAncestor = true;
          break;
        }
        parentValue = ((_a = byValue.get(parentValue)) == null ? void 0 : _a.dataset.cmFilterTreeParent) || "";
      }
      node.hidden = hiddenByAncestor || query !== "" && !matching.has(value);
      node.classList.toggle("is-tree-collapsed", collapsed.has(value));
      (_b = node.querySelector("[data-cm-filter-tree-toggle]")) == null ? void 0 : _b.setAttribute(
        "aria-expanded",
        String(!collapsed.has(value))
      );
    });
  }
  function updateCardOptionVisibility(card, workspace, collapsed, query) {
    var _a;
    const cardMatches = (((_a = card.querySelector("h3")) == null ? void 0 : _a.textContent) || "").toLocaleLowerCase().includes(query);
    const searchable = card.dataset.cmFilterCardSearchable === "1";
    let optionMatches = false;
    card.querySelectorAll("[data-cm-filter-drawer-option]").forEach((option) => {
      if (option.matches("[data-cm-filter-tree-node]")) return;
      const matches = query === "" || cardMatches || searchable && (option.textContent || "").toLocaleLowerCase().includes(query);
      option.hidden = !matches;
      optionMatches || (optionMatches = matches);
    });
    updateTreeVisibility(workspace, collapsed, query, card);
    return cardMatches || optionMatches || !!card.querySelector("[data-cm-filter-tree-node]:not([hidden])");
  }
  function bindWorkspaceSearch(workspace, collapsed) {
    const search = workspace.querySelector("[data-cm-filter-workspace-search]");
    if (!search) return;
    search.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase();
      workspace.querySelectorAll("[data-cm-filter-card], .cm-filter-drawer-card").forEach((card) => {
        card.hidden = query !== "" && !updateCardOptionVisibility(card, workspace, collapsed, query);
      });
    });
  }
  function bindCardSearch(workspace, card, collapsed) {
    const search = card.querySelector("[data-cm-filter-card-search]");
    if (!search) return;
    search.addEventListener("input", () => {
      updateCardOptionVisibility(card, workspace, collapsed, search.value.trim().toLocaleLowerCase());
      card.hidden = false;
    });
  }
  function bindTree(workspace, collapsed) {
    updateTreeVisibility(workspace, collapsed);
    workspace.querySelectorAll("[data-cm-filter-tree-toggle]").forEach((toggle) => {
      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const node = asHTMLElement(toggle.closest("[data-cm-filter-tree-node]"));
        const value = (node == null ? void 0 : node.dataset.cmFilterTreeValue) || "";
        if (!value) return;
        if (collapsed.has(value)) collapsed.delete(value);
        else collapsed.add(value);
        writeCollapsedTreeNodes(workspace, collapsed);
        updateTreeVisibility(workspace, collapsed);
      });
    });
  }
  function bindWorkspace(workspace) {
    var _a;
    if (workspace.dataset.cmFilterWorkspaceBound) return;
    workspace.dataset.cmFilterWorkspaceBound = "1";
    const collapsed = readCollapsedTreeNodes(workspace);
    bindTree(workspace, collapsed);
    bindWorkspaceSearch(workspace, collapsed);
    workspace.querySelectorAll("[data-cm-filter-card]").forEach((card) => {
      var _a2;
      bindCardSearch(workspace, card, collapsed);
      (_a2 = card.querySelector("[data-cm-filter-card-reset]")) == null ? void 0 : _a2.addEventListener("click", () => {
        resetControls(card);
        dispatchFilterChange(workspace);
      });
    });
    (_a = workspace.querySelector("[data-cm-filter-drawer-reset-all]")) == null ? void 0 : _a.addEventListener("click", () => {
      resetControls(workspace);
      dispatchFilterChange(workspace);
    });
    workspace.addEventListener("change", () => updateCardChrome(workspace));
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
