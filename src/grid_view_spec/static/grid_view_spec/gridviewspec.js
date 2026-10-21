/** grid-view-spec — built from frontend/src/spec-boot.ts */

"use strict";
(() => {
  // src/grid-view/dom-utils.ts
  function cssEscape(value) {
    if (typeof CSS !== "undefined" && CSS.escape) {
      return CSS.escape(value);
    }
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  function getGlobal() {
    return window;
  }
  function positionFixedOverlay(overlay2, trigger, align, shrinkToStartEdge = false) {
    const padding = 12;
    const triggerRect = trigger.getBoundingClientRect();
    if (shrinkToStartEdge && align === "start") {
      overlay2.style.removeProperty("width");
      const availableWidth = Math.max(0, window.innerWidth - triggerRect.left - padding);
      overlay2.style.width = `${Math.min(overlay2.getBoundingClientRect().width, availableWidth)}px`;
    }
    const overlayRect = overlay2.getBoundingClientRect();
    const preferredLeft = align === "start" ? triggerRect.left : triggerRect.right - overlayRect.width;
    const left = Math.max(
      padding,
      Math.min(preferredLeft, window.innerWidth - overlayRect.width - padding)
    );
    const below = triggerRect.bottom + 6;
    const top = below + overlayRect.height <= window.innerHeight - padding ? below : Math.max(padding, triggerRect.top - overlayRect.height - 6);
    overlay2.style.left = `${left}px`;
    overlay2.style.top = `${top}px`;
  }
  function tableGridId(table) {
    var _a, _b;
    const shell = (_a = table == null ? void 0 : table.closest) == null ? void 0 : _a.call(table, "[data-grid-id]");
    return shell instanceof HTMLElement ? ((_b = shell.dataset.gridId) == null ? void 0 : _b.trim()) || "" : "";
  }
  function updateRecordCounters(gridId, count) {
    if (!gridId || !Number.isSafeInteger(count) || count < 0) return;
    const value = String(count);
    const escapedGridId = cssEscape(gridId);
    document.querySelectorAll(`[data-cm-count-for="${escapedGridId}"]`).forEach((counter) => {
      counter.textContent = value;
    });
  }
  function queryRecordCounters(table, fallbackRoot) {
    var _a;
    const gridId = tableGridId(table);
    if (gridId) {
      const esc = cssEscape(gridId);
      const scope = ((_a = table == null ? void 0 : table.closest) == null ? void 0 : _a.call(table, ".cm-page-table-layout, .cm-dashboard-page")) || fallbackRoot || document;
      const linked = Array.from(scope.querySelectorAll(`[data-cm-count-for="${esc}"]`));
      if (linked.length) return linked;
    }
    if (!(fallbackRoot == null ? void 0 : fallbackRoot.querySelectorAll)) return [];
    return Array.from(fallbackRoot.querySelectorAll("[data-cm-count]"));
  }

  // src/grid-view/registry.ts
  var _byGridId = /* @__PURE__ */ new Map();
  var _bootByGridId = /* @__PURE__ */ new Map();
  var byId = {
    register(gridId, handle) {
      if (gridId != null && gridId !== "") {
        _byGridId.set(String(gridId), handle);
      }
      return handle;
    },
    get(gridId) {
      var _a;
      if (gridId == null || gridId === "") return null;
      const id = String(gridId);
      if (_byGridId.has(id)) return (_a = _byGridId.get(id)) != null ? _a : null;
      const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const shell = document.querySelector(`[data-grid-id="${esc}"]`);
      if (shell == null ? void 0 : shell._colSettings) return shell._colSettings;
      return null;
    },
    registerBoot(gridId, fn) {
      if (gridId != null && gridId !== "" && typeof fn === "function") {
        _bootByGridId.set(String(gridId), fn);
      }
    },
    boot(gridId) {
      const fn = _bootByGridId.get(String(gridId));
      if (typeof fn === "function") fn();
    }
  };
  function invokeGridAction(gridId, method, options) {
    const handle = byId.get(gridId != null ? gridId : "");
    if (!handle || typeof handle !== "object") return;
    const fn = Reflect.get(handle, method);
    if (typeof fn === "function") {
      fn.call(handle, options);
    }
  }

  // src/grid-view/registry-api.ts
  var _renderers = /* @__PURE__ */ new Map();
  var _commits = /* @__PURE__ */ new Map();
  var _actions = /* @__PURE__ */ new Map();
  var _drops = /* @__PURE__ */ new Map();
  function registerRenderer(name, fn) {
    if (!name || typeof fn !== "function") return;
    _renderers.set(name, fn);
  }
  function registerCommit(name, fn) {
    if (!name || typeof fn !== "function") return;
    _commits.set(name, fn);
  }
  function registerAction(name, fn) {
    if (!name || typeof fn !== "function") return;
    _actions.set(name, fn);
  }
  function registerDrop(name, fn) {
    if (!name || typeof fn !== "function") return;
    _drops.set(name, fn);
  }
  async function invokeDrop(name, ctx) {
    const fn = _drops.get(name);
    if (typeof fn !== "function") return false;
    try {
      return await fn(ctx) === true;
    } catch (e) {
      return false;
    }
  }
  function invokeAction(name, ctx) {
    const fn = _actions.get(name);
    if (typeof fn === "function") fn(ctx);
  }
  async function invokeCommit(name, ctx) {
    const fn = _commits.get(name);
    if (typeof fn !== "function") return false;
    const result = await fn(ctx);
    return result !== false;
  }
  function getRegisteredRenderer(name) {
    return _renderers.get(name);
  }

  // src/grid-view/dom-guards.ts
  function asHTMLElement(el) {
    return el instanceof HTMLElement ? el : null;
  }
  function asHtmlInput(el) {
    return el instanceof HTMLInputElement ? el : null;
  }
  function eventTargetElement(target) {
    if (target instanceof HTMLElement) return target;
    let el = target instanceof Element ? target : null;
    while (el && !(el instanceof HTMLElement)) {
      el = el.parentElement;
    }
    return el instanceof HTMLElement ? el : null;
  }
  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  // src/grid-view/i18n.ts
  var catalog = {};
  function initI18n(next) {
    catalog = next || {};
  }
  function t(key, fallback2) {
    if (catalog[key] && catalog[key] !== key) return catalog[key];
    if (fallback2 !== void 0) return fallback2;
    return key;
  }
  var i18n = { initI18n, t };

  // src/grid-view/search/smart-query.ts
  var EXCLUDE_PREFIXES = ["-", "\u2212", "\u2013", "\u2014"];
  function isExcludePrefix(ch) {
    return EXCLUDE_PREFIXES.includes(ch);
  }
  function splitOrGroups(raw) {
    const groups = [];
    let buf = "";
    let inQuote = false;
    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (ch === '"') {
        inQuote = !inQuote;
        buf += ch;
      } else if (!inQuote && (ch === "/" || ch === "\\" || ch === ",")) {
        const chunk2 = buf.trim();
        if (chunk2) groups.push(chunk2);
        buf = "";
      } else {
        buf += ch;
      }
    }
    const chunk = buf.trim();
    if (chunk) groups.push(chunk);
    return groups;
  }
  function parseGroupAndTerms(group) {
    const terms = [];
    let i = 0;
    const n = group.length;
    while (i < n) {
      while (i < n && group[i] === " ") i += 1;
      if (i >= n) break;
      if (group[i] === "+") {
        i += 1;
        continue;
      }
      let exclude = false;
      if (isExcludePrefix(group[i])) {
        exclude = true;
        i += 1;
      }
      while (i < n && group[i] === " ") i += 1;
      if (i >= n) break;
      if (group[i] === '"') {
        i += 1;
        const start2 = i;
        while (i < n && group[i] !== '"') i += 1;
        const term = group.slice(start2, i);
        if (i < n) i += 1;
        if (term || exclude) terms.push({ term, exclude, quoted: true });
        continue;
      }
      const start = i;
      while (i < n) {
        if (group[i] === '"') break;
        if (group[i] === "+") {
          if (i > start) break;
          i += 1;
          continue;
        }
        if (group[i] === " ") {
          let j = i;
          while (j < n && group[j] === " ") j += 1;
          if (j < n && isExcludePrefix(group[j]) && i > start) break;
          i = j;
          continue;
        }
        i += 1;
      }
      const text = group.slice(start, i).trim();
      if (text) terms.push({ term: text, exclude, quoted: false });
    }
    return terms;
  }
  function tokenizeSmartQuery(text) {
    const raw = String(text != null ? text : "").trim();
    if (!raw) return [];
    return splitOrGroups(raw).map((g) => parseGroupAndTerms(g));
  }
  function parseSmartQuery(text) {
    const raw = String(text != null ? text : "").trim();
    if (!raw) return { terms: [], excludes: [], orGroups: [] };
    const groups = tokenizeSmartQuery(raw);
    const terms = [];
    const excludes = [];
    const orGroups = groups.map(
      (andTerms) => andTerms.map((item) => item.exclude ? `-${item.term}` : item.term).join("+")
    );
    groups.forEach((andTerms, gi) => {
      andTerms.forEach((item) => {
        if (!item.term) return;
        if (item.exclude) excludes.push({ term: item.term, group: gi });
        else terms.push({ term: item.term, group: gi });
      });
    });
    return { terms, excludes, orGroups };
  }

  // src/grid-view/search/column-scope.ts
  function normalizeColumnLabel(text) {
    return String(text != null ? text : "").toLowerCase().replace(/\s+/g, "");
  }
  function columnKeysForHint(hint, columns) {
    const needle = normalizeColumnLabel(hint);
    if (!needle) return [];
    const keys = [];
    for (const col of columns) {
      const label = normalizeColumnLabel(col.label);
      if (label.includes(needle) || label.startsWith(needle)) {
        keys.push(col.key);
      }
    }
    return keys;
  }
  function parseScopedTerm(term, columns) {
    const raw = String(term != null ? term : "").trim();
    if (!raw || raw.indexOf(":") < 0) return { scope: null, inner: raw };
    const idx = raw.indexOf(":");
    const hint = raw.slice(0, idx).trim();
    const inner = raw.slice(idx + 1).trim();
    if (!hint || !inner) return { scope: null, inner: raw };
    if (columnKeysForHint(hint, columns).length) return { scope: hint, inner };
    return { scope: null, inner: raw };
  }
  function cellsForScope(hint, cellsByKey, columns, allCells) {
    if (!hint) return [...allCells];
    const keys = columnKeysForHint(hint, columns);
    if (!keys.length) return [...allCells];
    const scoped = [];
    for (const key of keys) {
      const val = cellsByKey[key];
      if (val) scoped.push(val);
    }
    return scoped;
  }

  // src/grid-view/search/term-match.ts
  var NUMERIC_OPS = [">=", "<=", ">", "<", "="];
  var RANGE_SPLIT = "..";
  function parseNumberForColumnFilter(text) {
    const cleaned = String(text != null ? text : "").replace(/\u00a0/g, " ").replace(/[^\d.,-]/g, "").replace(",", ".");
    if (!cleaned || cleaned === "-" || cleaned === ".") return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  function extractNumericValues(text) {
    const hay = String(text != null ? text : "").replace(/\u00a0/g, " ");
    const values = [];
    const pattern = /[\d]+(?:[ \u00a0.,][\d]{3})*(?:[.,][\d]+)?|[\d]+(?:[.,][\d]+)?/g;
    let match;
    while ((match = pattern.exec(hay)) !== null) {
      const chunk = match[0].replace(/[ \u00a0]/g, "");
      const parsed = parseNumberForColumnFilter(chunk);
      if (parsed !== null) values.push(parsed);
    }
    if (!values.length) {
      const parsed = parseNumberForColumnFilter(hay);
      if (parsed !== null) values.push(parsed);
    }
    return values;
  }
  function numericExprMatchesValue(value, query) {
    const q = String(query != null ? query : "").trim();
    const bounds = parseRangeBounds(q);
    if (bounds !== null) return value >= bounds[0] && value <= bounds[1];
    for (const op of NUMERIC_OPS) {
      if (!q.startsWith(op)) continue;
      const right = parseNumberForColumnFilter(q.slice(op.length).trim());
      if (right === null) return false;
      if (op === ">") return value > right;
      if (op === ">=") return value >= right;
      if (op === "<") return value < right;
      if (op === "<=") return value <= right;
      return value === right;
    }
    return false;
  }
  function parseRangeBounds(term) {
    const t3 = String(term != null ? term : "").trim();
    if (t3.indexOf(RANGE_SPLIT) < 0) return null;
    const parts = t3.split(RANGE_SPLIT);
    if (parts.length !== 2) return null;
    const lo = parseNumberForColumnFilter(parts[0]);
    const hi = parseNumberForColumnFilter(parts[1]);
    if (lo === null || hi === null) return null;
    return [Math.min(lo, hi), Math.max(lo, hi)];
  }
  function termIsExpression(term) {
    const t3 = String(term != null ? term : "").trim();
    if (!t3) return false;
    if (parseRangeBounds(t3) !== null) return true;
    for (const op of NUMERIC_OPS) {
      if (t3.startsWith(op)) return t3.slice(op.length).trim().length > 0;
    }
    if (t3.length > 1 && t3.charAt(0) === "^") return true;
    if (t3.length > 1 && t3.charAt(t3.length - 1) === "$") return true;
    return t3.indexOf("%") >= 0;
  }
  function hasSmartSyntax(raw) {
    const text = String(raw != null ? raw : "");
    if (text.indexOf('"') >= 0) return true;
    let inQuote = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (!inQuote) {
        if (ch === "/" || ch === "\\" || ch === "," || ch === "+") return true;
        if ((ch === "-" || ch === "\u2212" || ch === "\u2013" || ch === "\u2014") && (i === 0 || text[i - 1] === " " || text[i - 1] === "+")) {
          return true;
        }
      }
    }
    return false;
  }
  function matchColumnExpression(cellText, query) {
    const q = String(query != null ? query : "").trim();
    if (!q) return true;
    const hay = String(cellText != null ? cellText : "").trim();
    const hayFold = hay.toLowerCase();
    if (q.length > 1 && q.charAt(0) === "^") {
      const prefix = q.slice(1).trim().toLowerCase();
      return !!prefix && hayFold.startsWith(prefix);
    }
    if (q.length > 1 && q.charAt(q.length - 1) === "$") {
      const suffix = q.slice(0, -1).trim().toLowerCase();
      return !!suffix && hayFold.endsWith(suffix);
    }
    const bounds = parseRangeBounds(q);
    if (bounds !== null) {
      const numbers = extractNumericValues(hay);
      if (!numbers.length) return false;
      return numbers.some((val) => val >= bounds[0] && val <= bounds[1]);
    }
    for (const op of NUMERIC_OPS) {
      if (q.startsWith(op)) {
        if (parseNumberForColumnFilter(q.slice(op.length).trim()) === null) return false;
        const numbers = extractNumericValues(hay);
        if (!numbers.length) return false;
        return numbers.some((val) => numericExprMatchesValue(val, q));
      }
    }
    if (q.indexOf("%") >= 0) {
      const pattern = q.toLowerCase();
      if (pattern.charAt(0) === "%" && pattern.charAt(pattern.length - 1) === "%" && pattern.length >= 2) {
        const mid = pattern.slice(1, -1);
        return !!mid && hayFold.indexOf(mid) >= 0;
      }
      if (pattern.charAt(0) === "%") {
        const suffix = pattern.slice(1);
        return !!suffix && hayFold.endsWith(suffix);
      }
      if (pattern.charAt(pattern.length - 1) === "%") {
        const prefix = pattern.slice(0, -1);
        return !!prefix && hayFold.startsWith(prefix);
      }
    }
    return false;
  }
  function literalContains(haystack, term) {
    return haystack.toLowerCase().indexOf(term.toLowerCase()) >= 0;
  }
  function spaceInsensitiveContains(haystack, term) {
    const hayNs = haystack.toLowerCase().replace(/ /g, "");
    const termNs = term.toLowerCase().replace(/ /g, "");
    return !!termNs && hayNs.indexOf(termNs) >= 0;
  }
  function matchQueryTerm(haystack, term, options) {
    const t3 = String(term != null ? term : "").trim();
    if (!t3) return true;
    const hay = String(haystack != null ? haystack : "");
    const quoted = (options == null ? void 0 : options.quoted) === true;
    if (!quoted && t3.length > 1 && t3.charAt(0) === "!") {
      return !matchQueryTerm(hay, t3.slice(1).trim(), options);
    }
    if (termIsExpression(t3)) return matchColumnExpression(hay, t3);
    if (quoted || t3.indexOf(" ") >= 0) return literalContains(hay, t3);
    return spaceInsensitiveContains(hay, t3);
  }

  // src/grid-view/search/contract.ts
  var ALL_EXPR = /* @__PURE__ */ new Set([
    "or_sep" /* OrSep */,
    "and" /* And */,
    "exclude" /* Exclude */,
    "quoted" /* Quoted */,
    "plain_text" /* PlainText */,
    "phrase_text" /* PhraseText */,
    "numeric_cmp" /* NumericCmp */,
    "numeric_range" /* NumericRange */,
    "wildcard" /* Wildcard */
  ]);
  var TEXT_TOKENS = /* @__PURE__ */ new Set([
    "or_sep" /* OrSep */,
    "and" /* And */,
    "exclude" /* Exclude */,
    "quoted" /* Quoted */,
    "plain_text" /* PlainText */,
    "phrase_text" /* PhraseText */,
    "wildcard" /* Wildcard */
  ]);
  var NUMERIC_TOKENS = /* @__PURE__ */ new Set([
    "or_sep" /* OrSep */,
    "and" /* And */,
    "exclude" /* Exclude */,
    "numeric_cmp" /* NumericCmp */,
    "numeric_range" /* NumericRange */,
    "wildcard" /* Wildcard */
  ]);
  var TOOLBAR_TOKENS = /* @__PURE__ */ new Set([...ALL_EXPR, "column_scope" /* ColumnScope */]);
  var COLUMN_FILTER_ALIASES = {
    auto: "default",
    standard: "default",
    column_default: "default",
    column_expr: "default",
    column_text: "text",
    column_numeric: "numeric",
    column_nosearch: "nosearch",
    set: "list",
    expr: "default",
    search: "default",
    none: "nosearch"
  };
  var PROFILE_ENABLED = {
    ["toolbar" /* Toolbar */]: TOOLBAR_TOKENS,
    ["default" /* Default */]: ALL_EXPR,
    ["text" /* Text */]: TEXT_TOKENS,
    ["numeric" /* Numeric */]: NUMERIC_TOKENS,
    ["nosearch" /* Nosearch */]: /* @__PURE__ */ new Set()
  };
  var EXPR_OPS = [">=", "<=", ">", "<", "="];
  var TRAILING_MOD = /(?:[+,\/\\]|[\u2212\u2013\u2014-])$/;
  function isHTMLElement(value) {
    return value instanceof HTMLElement;
  }
  function defaultSearchProfile() {
    return "default" /* Default */;
  }
  function resolveColumnFilter(value) {
    const text = String(value != null ? value : "").trim().toLowerCase();
    if (!text) return "default";
    const mapped = COLUMN_FILTER_ALIASES[text];
    if (mapped) return mapped;
    if (text === "default" || text === "text" || text === "numeric" || text === "nosearch" || text === "list") {
      return text;
    }
    return "default";
  }
  function resolveSearchProfile(value) {
    const cf = resolveColumnFilter(value);
    if (cf === "list") return "default" /* Default */;
    if (cf === "nosearch") return "nosearch" /* Nosearch */;
    if (cf === "text") return "text" /* Text */;
    if (cf === "numeric") return "numeric" /* Numeric */;
    if (String(value != null ? value : "").trim().toLowerCase() === "toolbar") return "toolbar" /* Toolbar */;
    return "default" /* Default */;
  }
  function bindSearchProfileForToolbar() {
    return "toolbar" /* Toolbar */;
  }
  function tokenProfileForHeader(th) {
    if (!isHTMLElement(th)) return defaultSearchProfile();
    return resolveSearchProfile(th.dataset.cmColumnFilter || "default");
  }
  function bindSearchProfileForHeader(th) {
    return tokenProfileForHeader(th);
  }
  function classifyTermTokens(term, quoted = false) {
    const tokens = /* @__PURE__ */ new Set();
    if (quoted) {
      tokens.add("quoted" /* Quoted */);
      return tokens;
    }
    const t3 = String(term != null ? term : "").trim();
    if (!t3) return tokens;
    if (t3.indexOf(" ") >= 0) tokens.add("phrase_text" /* PhraseText */);
    if (parseRangeBounds(t3) !== null) tokens.add("numeric_range" /* NumericRange */);
    for (const op of EXPR_OPS) {
      if (t3.startsWith(op) && t3.slice(op.length).trim()) {
        tokens.add("numeric_cmp" /* NumericCmp */);
        break;
      }
    }
    if (t3.indexOf("%") >= 0) tokens.add("wildcard" /* Wildcard */);
    if (t3.length > 1 && t3.charAt(0) === "^" || t3.length > 1 && t3.charAt(t3.length - 1) === "$" || t3.length > 1 && t3.charAt(0) === "!") {
      tokens.add("wildcard" /* Wildcard */);
    }
    if (!tokens.size) tokens.add("plain_text" /* PlainText */);
    return tokens;
  }
  function classifyQueryTokens(query, options) {
    const raw = String(query != null ? query : "").trim();
    const tokens = /* @__PURE__ */ new Set();
    if (!raw) return tokens;
    if (hasSmartSyntax(raw)) {
      if (/[,/\\]/.test(raw)) tokens.add("or_sep" /* OrSep */);
      if (raw.indexOf("+") >= 0) tokens.add("and" /* And */);
    }
    const columns = options == null ? void 0 : options.columns;
    for (const andTerms of tokenizeSmartQuery(raw)) {
      for (const item of andTerms) {
        if (item.exclude) tokens.add("exclude" /* Exclude */);
        let term = item.term;
        if (columns == null ? void 0 : columns.length) {
          const scoped = parseScopedTerm(term, columns);
          if (scoped.scope) tokens.add("column_scope" /* ColumnScope */);
          term = scoped.inner;
        }
        for (const token of classifyTermTokens(term, item.quoted)) tokens.add(token);
      }
    }
    if (!tokens.size && raw) {
      for (const token of classifyTermTokens(raw)) tokens.add(token);
    }
    return tokens;
  }
  function guardQueryForProfile(query, profile, options) {
    if (profile === "nosearch" /* Nosearch */) {
      return !String(query != null ? query : "").trim();
    }
    const used = classifyQueryTokens(query, options);
    if (!used.size) return true;
    const allowed = PROFILE_ENABLED[profile];
    for (const token of used) {
      if (!allowed.has(token)) return false;
    }
    return true;
  }
  function termIsComplete(term) {
    const t3 = term.trim();
    if (!t3) return false;
    if (t3.includes("..")) return parseRangeBounds(t3) !== null;
    for (const op of EXPR_OPS) {
      if (t3.startsWith(op) && !t3.slice(op.length).trim()) return false;
    }
    return true;
  }
  function syntaxCommitReady(query) {
    const q = String(query != null ? query : "").trim();
    if (!q) return true;
    if (TRAILING_MOD.test(q)) return false;
    if (/^(>=|<=|>|<|=)\s*$/.test(q)) return false;
    if (/\.\.\s*$/.test(q) || /\.\.$/.test(q)) return false;
    if (/^[\d.,]+\.\.\s*$/.test(q)) return false;
    if (hasSmartSyntax(q)) {
      const groups = tokenizeSmartQuery(q);
      if (!groups.length) return false;
      for (const andTerms of groups) {
        if (!andTerms.length) return false;
        for (const item of andTerms) {
          if (!termIsComplete(item.term)) return false;
        }
      }
      return true;
    }
    if (termIsExpression(q)) {
      if (parseRangeBounds(q) !== null) return true;
      for (const op of EXPR_OPS) {
        if (q.startsWith(op)) return q.slice(op.length).trim().length > 0;
      }
    }
    return true;
  }
  function isCommitReadyForProfile(query, profile, options) {
    if (profile === "nosearch" /* Nosearch */) {
      return !String(query != null ? query : "").trim();
    }
    if (!syntaxCommitReady(query)) return false;
    return guardQueryForProfile(query, profile, options);
  }
  function columnFilterPlaceholderKey(profile) {
    if (profile === "numeric" /* Numeric */) return "column_filter.placeholder_numeric";
    if (profile === "text" /* Text */) return "column_filter.placeholder_text";
    return "column_filter.placeholder";
  }

  // src/grid-view/search/match.ts
  function termIsCellScoped(term) {
    const t3 = String(term != null ? term : "").trim();
    return termIsExpression(t3) || t3.indexOf("%") >= 0;
  }
  function numericExprMatchesValue2(value, query) {
    return matchColumnExpression(String(value), query);
  }
  function matchExprTermsOnSameCell(cell, terms) {
    if (!terms.length) return true;
    const numericTerms = terms.filter((t3) => termIsExpression(t3) && t3.indexOf("%") < 0);
    const otherTerms = terms.filter((t3) => numericTerms.indexOf(t3) < 0);
    for (const term of otherTerms) {
      if (!matchColumnExpression(cell, term)) return false;
    }
    if (!numericTerms.length) return true;
    const numbers = extractNumericValues(cell);
    if (!numbers.length) return false;
    return numbers.some(
      (value) => numericTerms.every((term) => numericExprMatchesValue2(value, term))
    );
  }
  function scopedCellsForTerm(term, haystack, cells, cellsByKey, columns, activeScope) {
    var _a, _b;
    if (!cellsByKey || !(columns == null ? void 0 : columns.length)) {
      return { inner: term, scopedCells: cells, activeScope: activeScope != null ? activeScope : null };
    }
    const { scope: hint, inner } = parseScopedTerm(term, columns);
    const scope = (_a = hint != null ? hint : activeScope) != null ? _a : null;
    const nextScope = (_b = hint != null ? hint : activeScope) != null ? _b : null;
    if (!scope) return { inner: term, scopedCells: cells, activeScope: nextScope };
    return {
      inner,
      scopedCells: cellsForScope(scope, cellsByKey, columns, cells),
      activeScope: nextScope
    };
  }
  function innerTermForMatch(term, columns) {
    if (!(columns == null ? void 0 : columns.length)) return term;
    return parseScopedTerm(term, columns).inner;
  }
  function matchSmartGroup(andTerms, haystack, cells, cellsByKey, columns) {
    const positives = andTerms.filter((item) => !item.exclude);
    const excludes = andTerms.filter((item) => item.exclude);
    let activeScope = null;
    for (const item of andTerms) {
      if (item.exclude) continue;
      const { scope } = parseScopedTerm(item.term, columns != null ? columns : []);
      if (scope) activeScope = scope;
    }
    for (const item of excludes) {
      const { inner, scopedCells } = scopedCellsForTerm(
        item.term,
        haystack,
        cells,
        cellsByKey,
        columns,
        activeScope
      );
      if (matchQueryTerm(scopedCells.join(" "), inner, { quoted: item.quoted })) return false;
    }
    if (!positives.length) return true;
    const textTerms = positives.filter(
      (item) => !termIsCellScoped(innerTermForMatch(item.term, columns))
    );
    const exprTerms = positives.filter(
      (item) => termIsCellScoped(innerTermForMatch(item.term, columns))
    );
    for (const item of textTerms) {
      const resolved = scopedCellsForTerm(
        item.term,
        haystack,
        cells,
        cellsByKey,
        columns,
        activeScope
      );
      activeScope = resolved.activeScope;
      if (!matchQueryTerm(resolved.scopedCells.join(" "), resolved.inner, { quoted: item.quoted })) {
        return false;
      }
    }
    if (!exprTerms.length) return true;
    const innerExprs = exprTerms.map((item) => innerTermForMatch(item.term, columns));
    const hasTermScope = exprTerms.some(
      (item) => !!parseScopedTerm(item.term, columns != null ? columns : []).scope
    );
    if (!hasTermScope && !activeScope && exprTerms.length > 1 && innerExprs.every((term) => termIsExpression(term) && term.indexOf("%") < 0)) {
      return cells.some((cell) => matchExprTermsOnSameCell(cell, innerExprs));
    }
    for (const item of exprTerms) {
      const resolved = scopedCellsForTerm(
        item.term,
        haystack,
        cells,
        cellsByKey,
        columns,
        activeScope
      );
      activeScope = resolved.activeScope;
      const matched = resolved.scopedCells.some(
        (cell) => matchQueryTerm(cell, resolved.inner, { quoted: item.quoted })
      );
      if (!matched) return false;
    }
    return true;
  }
  function matchSmartHaystackClient(haystack, query, options) {
    const raw = String(query != null ? query : "").trim();
    if (!raw) return true;
    const hay = String(haystack != null ? haystack : "");
    const cells = (options == null ? void 0 : options.cells) ? [...options.cells] : [hay];
    const groups = tokenizeSmartQuery(raw);
    if (!groups.length) return matchQueryTerm(hay, raw);
    for (const andTerms of groups) {
      if (!andTerms.length) continue;
      if (matchSmartGroup(andTerms, hay, cells, options == null ? void 0 : options.cellsByKey, options == null ? void 0 : options.columns)) {
        return true;
      }
    }
    return false;
  }
  function matchColumnFilter(cellText, query, options) {
    var _a;
    const q = String(query != null ? query : "").trim();
    if (!q) return true;
    const profile = (_a = options == null ? void 0 : options.profile) != null ? _a : defaultSearchProfile();
    if (!guardQueryForProfile(q, profile, {
      columns: options == null ? void 0 : options.columns
    })) {
      return false;
    }
    const hay = String(cellText != null ? cellText : "").trim();
    const cells = (options == null ? void 0 : options.cells) ? [...options.cells] : [hay];
    if (!hasSmartSyntax(q) && termIsExpression(q)) {
      return cells.some((cell) => matchColumnExpression(cell, q));
    }
    return matchSmartHaystackClient(hay, q, options);
  }

  // src/grid-view/search/query-commit.ts
  function isToolbarQueryCommitReady(query, options) {
    return isCommitReadyForProfile(query, bindSearchProfileForToolbar(), options);
  }

  // src/grid-view/search/filter-engine.ts
  function isRecord2(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  function isSetFilterModel(value) {
    if (!isRecord2(value)) return false;
    if (value.mode === "empty" || value.mode === "non_empty") return true;
    return Array.isArray(value.values);
  }
  function isEmptyCellValue(val) {
    const tv = String(val === null || val === void 0 ? "" : val).trim();
    return tv === "" || tv === "-" || tv === "\u2014" || tv === "\u2013" || tv === "[]";
  }
  function isNumericZeroCell(val) {
    return parseNumberForColumnFilter(val) === 0;
  }
  function normalizeFilterMatch(match) {
    return match === "any_token" ? "any_token" : "exact";
  }
  function cellTokensFromText(cellText, match) {
    const trimmed = String(cellText === null || cellText === void 0 ? "" : cellText).trim();
    if (isEmptyCellValue(trimmed)) return [];
    if (match === "any_token") {
      return trimmed.split(/\s+/).map((t3) => t3.trim()).filter((t3) => !isEmptyCellValue(t3));
    }
    return [trimmed];
  }
  function parseCellFilterTokens(td, match) {
    if (!td) return [];
    if (td.dataset.cmFilterEmpty === "1") return [];
    if (match === "any_token") {
      const raw = td.dataset.cmFilterTokens;
      if (raw !== void 0) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.map((t3) => String(t3 != null ? t3 : "").trim()).filter((t3) => !isEmptyCellValue(t3));
          }
        } catch (e) {
        }
      }
    }
    const text = (td.dataset.cmSortVal || td.dataset.cmExportRaw || td.textContent || "").trim();
    return cellTokensFromText(text, match);
  }
  function resolveSetFilterTokens(cellText, match, options) {
    if ((options == null ? void 0 : options.tokens) !== void 0) {
      return options.tokens.map((t3) => String(t3).trim()).filter((t3) => !isEmptyCellValue(t3));
    }
    return cellTokensFromText(cellText, match);
  }
  function matchSetFilter(cellText, model, options) {
    var _a;
    if (!model) return true;
    const match = normalizeFilterMatch((_a = options == null ? void 0 : options.match) != null ? _a : "match" in model ? model.match : void 0);
    const tokens = resolveSetFilterTokens(cellText, match, options);
    if ("mode" in model) {
      const isEmpty = tokens.length === 0 || (options == null ? void 0 : options.numeric) === true && isNumericZeroCell(cellText);
      if (model.mode === "empty") return isEmpty;
      if (model.mode === "non_empty") return !isEmpty;
    }
    const values = "values" in model ? model.values : void 0;
    if (Array.isArray(values)) {
      if (!values.length) return false;
      if (!tokens.length) return false;
      const selected = values.map((v) => String(v).trim()).filter((v) => !isEmptyCellValue(v));
      if (match === "any_token") {
        return selected.some((v) => tokens.includes(v));
      }
      return tokens.length === 1 && selected.includes(tokens[0]);
    }
    return true;
  }
  function parseColumnFilterEntry(raw) {
    if (raw === null || raw === void 0) return null;
    if (typeof raw === "string") {
      const text = raw.trim();
      if (!text) return null;
      if (text.startsWith("{")) {
        try {
          const parsed = JSON.parse(text);
          return parseColumnFilterEntry(parsed);
        } catch (e) {
        }
      }
      return text;
    }
    if (!isRecord2(raw)) return null;
    const match = normalizeFilterMatch(raw.match);
    if (raw.mode === "empty" || raw.mode === "non_empty") {
      return { mode: raw.mode, match };
    }
    if (Array.isArray(raw.values)) {
      if (raw.values.length === 0) {
        return { values: [], match };
      }
      const values = raw.values.map((v) => String(v != null ? v : "").trim()).filter((v) => !isEmptyCellValue(v));
      if (!values.length) return null;
      return { values, match };
    }
    return null;
  }
  function serializeColumnFilterEntry(entry) {
    if (entry === null || entry === void 0) return "";
    if (typeof entry === "string") return entry.trim();
    return JSON.stringify(entry);
  }
  function matchColumnFilterEntry(cellText, entry, options) {
    if (typeof entry === "string") {
      return matchColumnFilter(cellText, entry, { profile: options == null ? void 0 : options.profile });
    }
    return matchSetFilter(cellText, entry, {
      tokens: options == null ? void 0 : options.tokens,
      match: options == null ? void 0 : options.match,
      numeric: (options == null ? void 0 : options.profile) === "numeric" /* Numeric */
    });
  }
  function isExprFilterCommitReady(query, th) {
    return isCommitReadyForProfile(query, bindSearchProfileForHeader(th));
  }
  function matchToolbarQuery(haystack, query, options) {
    return matchColumnFilter(haystack, query, {
      ...options,
      profile: bindSearchProfileForToolbar()
    });
  }
  function matchAgGridQuickFilter(haystack, query) {
    if (matchToolbarQuery(haystack, query)) return true;
    const raw = String(query != null ? query : "").trim().toLowerCase();
    if (!raw.includes("-")) return false;
    const hay = String(haystack != null ? haystack : "").toLowerCase();
    return hay.replace(/ /g, "").includes(raw.replace(/-/g, ""));
  }

  // src/grid-view/search/column-filter-state.ts
  function asRoot(scope) {
    return scope && "querySelector" in scope ? scope : document;
  }
  function isHTMLElement2(value) {
    return value instanceof HTMLElement;
  }
  function isStringRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  function collectColumnFiltersFromTable(table) {
    const filters = {};
    if (!table) return filters;
    table.querySelectorAll("th[data-cm-col-key]").forEach((el) => {
      const key = el.dataset.cmColKey;
      const val = (el.dataset.cmColFilterValue || "").trim();
      if (key && val) filters[key] = val;
    });
    return filters;
  }
  function collectColumnFiltersObject(scope, tableHint) {
    const root = asRoot(scope);
    const table = (tableHint instanceof HTMLElement && tableHint.matches("[data-cm-table][data-cm-col-filters]") ? tableHint : null) || root.querySelector("[data-cm-table][data-cm-col-filters]");
    return collectColumnFiltersFromTable(table);
  }
  function serializeColumnFilters(scope) {
    const filters = collectColumnFiltersObject(scope);
    const keys = Object.keys(filters);
    if (!keys.length) return "";
    const out = {};
    keys.forEach((key) => {
      const entry = parseColumnFilterEntry(filters[key]);
      if (entry) out[key] = entry;
    });
    return JSON.stringify(out);
  }
  function parseColumnFiltersFromUrl() {
    const raw = new URLSearchParams(window.location.search).get("col_q");
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (!isStringRecord(parsed)) return {};
      const out = {};
      Object.entries(parsed).forEach(([key, val]) => {
        const entry = parseColumnFilterEntry(val);
        if (entry) out[key] = serializeColumnFilterEntry(entry);
      });
      return out;
    } catch (e) {
      return {};
    }
  }
  function tableFilterShell(el) {
    var _a;
    if (!(el == null ? void 0 : el.closest)) return void 0;
    return el.closest(".cm-simple-wrapper, .cm-table-shell, .cm-page-table-layout, .cm-dashboard-page") || ((_a = el.closest("[data-cm-table]")) == null ? void 0 : _a.closest(".cm-page-table-layout")) || void 0;
  }
  function syncColumnFilterChrome(table) {
    if (!table) return;
    table.querySelectorAll("th[data-cm-col-key]").forEach((el) => {
      const key = el.dataset.cmColKey;
      const active = !!(key && (el.dataset.cmColFilterValue || "").trim());
      const btn = el.querySelector("[data-cm-col-filter-trigger]");
      btn == null ? void 0 : btn.classList.toggle("is-active", active);
      const clearBtn = el.querySelector("[data-cm-col-filter-clear]");
      clearBtn == null ? void 0 : clearBtn.classList.toggle("is-visible", active);
    });
  }
  function headerFilterUi(th) {
    const cf = resolveColumnFilter(isHTMLElement2(th) ? th.dataset.cmColumnFilter : void 0);
    if (cf === "list") return "list";
    if (cf === "nosearch") return "none";
    return "search";
  }
  function headerFilterKind(th) {
    const ui = headerFilterUi(th);
    if (ui === "list") return "set";
    if (ui === "none") return "none";
    return "expr";
  }
  function headerFilterMatch(th) {
    return isHTMLElement2(th) && th.dataset.cmFilterMatch === "any_token" ? "any_token" : "exact";
  }

  // src/grid-view/search/row-haystack.ts
  function cellTextFromTd(td) {
    var _a, _b, _c;
    const raw = (_c = (_b = (_a = td.dataset.cmExportRaw) != null ? _a : td.dataset.cmSortVal) != null ? _b : td.textContent) != null ? _c : "";
    return String(raw).trim();
  }
  function collectRowCellsByKeyFromDom(row) {
    const cells = {};
    row.querySelectorAll("td[data-cm-col-key]").forEach((el) => {
      const key = el.dataset.cmColKey;
      if (!key || el.classList.contains("cm-col-hidden")) return;
      const text = cellTextFromTd(el);
      if (text) cells[key] = text;
    });
    return cells;
  }
  function collectRowCellValuesFromDom(row) {
    const byKey = collectRowCellsByKeyFromDom(row);
    const parts = Object.values(byKey);
    if (!parts.length) {
      row.querySelectorAll("td").forEach((td) => {
        var _a;
        const text = ((_a = td.textContent) != null ? _a : "").trim();
        if (text) parts.push(text);
      });
    }
    return parts;
  }
  function collectSearchColumnsFromTable(table) {
    const cols = [];
    const seen = /* @__PURE__ */ new Set();
    table.querySelectorAll("thead th[data-cm-col-key]").forEach((el) => {
      var _a, _b;
      const key = el.dataset.cmColKey;
      if (!key || el.classList.contains("cm-col-hidden") || seen.has(key)) return;
      seen.add(key);
      const labelEl = el.querySelector(".cm-th-label");
      const label = ((_b = (_a = labelEl == null ? void 0 : labelEl.textContent) != null ? _a : el.textContent) != null ? _b : "").trim();
      cols.push({ key, label });
    });
    return cols;
  }
  function buildRowHaystackFromDom(row) {
    return collectRowCellValuesFromDom(row).join(" ");
  }

  // src/grid-view/search/syntax-tips.ts
  var SEARCH_TIP_ROWS = {
    word: {
      modifierKey: "search.tip_mod_word",
      exampleKey: "search.tip_ex_word",
      meaningKey: "search.tip_mean_word"
    },
    and: { modifierKey: "+", exampleKey: "search.tip_ex_and", meaningKey: "search.tip_mean_and" },
    exclude: {
      modifierKey: "-",
      exampleKey: "search.tip_ex_exclude",
      meaningKey: "search.tip_mean_exclude"
    },
    or: { modifierKey: ",", exampleKey: "search.tip_ex_or", meaningKey: "search.tip_mean_or" },
    column_scope: {
      modifierKey: ":",
      exampleKey: "search.tip_ex_column_scope",
      meaningKey: "search.tip_mean_column_scope"
    },
    compare: {
      modifierKey: "> <",
      exampleKey: "search.tip_ex_compare",
      meaningKey: "search.tip_mean_compare"
    },
    range: { modifierKey: "..", exampleKey: "search.tip_ex_range", meaningKey: "search.tip_mean_range" },
    quote: {
      modifierKey: '"\u2026"',
      exampleKey: "search.tip_ex_quote",
      meaningKey: "search.tip_mean_quote"
    },
    phrase: {
      modifierKey: "search.tip_mod_phrase",
      exampleKey: "search.tip_ex_phrase",
      meaningKey: "search.tip_mean_phrase"
    },
    wildcard: {
      modifierKey: "%",
      exampleKey: "search.tip_ex_wildcard",
      meaningKey: "search.tip_mean_wildcard"
    }
  };
  var PROFILE_TIP_ROW_IDS = {
    ["toolbar" /* Toolbar */]: [
      "word",
      "and",
      "exclude",
      "or",
      "column_scope",
      "compare",
      "range",
      "quote",
      "phrase"
    ],
    ["default" /* Default */]: [
      "word",
      "and",
      "exclude",
      "or",
      "compare",
      "range",
      "quote",
      "phrase",
      "wildcard"
    ],
    ["text" /* Text */]: ["word", "and", "exclude", "or", "quote", "phrase", "wildcard"],
    ["numeric" /* Numeric */]: ["compare", "range", "and", "or", "wildcard"],
    ["nosearch" /* Nosearch */]: []
  };
  function tipRowIdsForProfile(profile) {
    var _a;
    return (_a = PROFILE_TIP_ROW_IDS[profile]) != null ? _a : PROFILE_TIP_ROW_IDS["default" /* Default */];
  }

  // src/grid-view/search-syntax-tip-html.ts
  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function tipCellText(keyOrLiteral) {
    if (keyOrLiteral.startsWith("search.")) {
      return escapeHtml(i18n.t(keyOrLiteral, keyOrLiteral));
    }
    return escapeHtml(keyOrLiteral);
  }
  function buildSearchSyntaxTipHtml(profile) {
    const rowIds = tipRowIdsForProfile(profile);
    const headMod = escapeHtml(i18n.t("search.tip_col_modifier", "Modifier"));
    const headEx = escapeHtml(i18n.t("search.tip_col_example", "Example"));
    const headMean = escapeHtml(i18n.t("search.tip_col_meaning", "Meaning"));
    const body = rowIds.map((id) => {
      const row = SEARCH_TIP_ROWS[id];
      if (!row) return "";
      const mod = tipCellText(row.modifierKey);
      const ex = tipCellText(row.exampleKey);
      const mean = escapeHtml(i18n.t(row.meaningKey, row.meaningKey));
      return `<tr><td><code>${mod}</code></td><td><code>${ex}</code></td><td>${mean}</td></tr>`;
    }).join("");
    const footnote = escapeHtml(
      i18n.t("search.tip_quote_hint", "Wrap the expression in double quotes to disable modifiers")
    );
    const example = escapeHtml(
      i18n.t("search.tip_quote_example", '"search -1 +2", word2')
    );
    return `<div class="cm-search-syntax-tip"><table class="cm-search-syntax-table"><colgroup><col class="cm-search-syntax-col--mod"><col class="cm-search-syntax-col--ex"><col class="cm-search-syntax-col--mean"></colgroup><thead><tr><th scope="col">${headMod}</th><th scope="col">${headEx}</th><th scope="col">${headMean}</th></tr></thead><tbody>${body}</tbody></table><p class="cm-search-syntax-footnote">${footnote}</p><p class="cm-search-syntax-example"><code>${example}</code></p></div>`;
  }

  // src/grid-view/search-help-ui.ts
  var INFO_ICON = '<svg class="cm-search-help-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="8" r="1.35" fill="currentColor" stroke="none"/><path d="M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var searchHelpSequence = 0;
  function searchHelpTipFor(btn) {
    var _a;
    const tipId = btn.dataset.cmSearchHelpTipId;
    if (tipId) {
      const ownedTip = document.getElementById(tipId);
      if (ownedTip instanceof HTMLElement) return ownedTip;
    }
    return ((_a = btn.closest(".cm-toolbar-search")) == null ? void 0 : _a.querySelector(
      ":scope > .cm-ellipsis-tip--search-help"
    )) || btn.querySelector(":scope > .cm-ellipsis-tip--search-help") || null;
  }
  function showSearchHelpTip(btn) {
    const tip = searchHelpTipFor(btn);
    if (!tip) return;
    document.body.appendChild(tip);
    tip.classList.add("cm-ellipsis-tip--search-help-portal");
    tip.style.visibility = "hidden";
    positionFixedOverlay(tip, btn, "start", true);
    tip.style.removeProperty("visibility");
  }
  function hideSearchHelpTip(btn) {
    const tip = searchHelpTipFor(btn);
    const host = btn.closest(".cm-toolbar-search");
    if (!tip || !host) return;
    tip.classList.remove("cm-ellipsis-tip--search-help-portal");
    tip.style.removeProperty("left");
    tip.style.removeProperty("top");
    tip.style.removeProperty("width");
    host.appendChild(tip);
  }
  function bindSearchSyntaxHelp(btn) {
    if (btn.dataset.cmSearchHelpBound === "1") return;
    btn.dataset.cmSearchHelpBound = "1";
    btn.classList.add("cm-tip-host");
    btn.removeAttribute("title");
    btn.addEventListener("mouseenter", () => showSearchHelpTip(btn));
    btn.addEventListener("mouseleave", () => hideSearchHelpTip(btn));
    btn.addEventListener("focusin", () => showSearchHelpTip(btn));
    btn.addEventListener("focusout", () => hideSearchHelpTip(btn));
    window.addEventListener("resize", () => {
      const tip = searchHelpTipFor(btn);
      if (tip == null ? void 0 : tip.classList.contains("cm-ellipsis-tip--search-help-portal")) {
        positionFixedOverlay(tip, btn, "start", true);
      }
    });
  }
  function refreshSearchSyntaxHelp(btn, profile) {
    const host = btn.closest(".cm-toolbar-search") || btn;
    let tip = searchHelpTipFor(btn);
    if (!tip) {
      tip = document.createElement("span");
      tip.className = "cm-ellipsis-tip cm-ellipsis-tip--search-help";
      tip.setAttribute("role", "tooltip");
    }
    if (!btn.id) {
      searchHelpSequence += 1;
      btn.id = `cm-search-help-${searchHelpSequence}`;
    }
    tip.id = `cm-search-help-tip-${btn.id}`;
    btn.dataset.cmSearchHelpTipId = tip.id;
    if (tip.parentElement !== host) host.appendChild(tip);
    tip.innerHTML = buildSearchSyntaxTipHtml(profile);
    bindSearchSyntaxHelp(btn);
  }
  function appendSearchSyntaxHelp(container, profile = "default" /* Default */) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cm-search-help-btn cm-tip-host";
    btn.dataset.cmTipProfile = profile;
    btn.setAttribute(
      "aria-label",
      i18n.t("search.syntax_help", "Search syntax help")
    );
    btn.innerHTML = INFO_ICON;
    container.appendChild(btn);
    refreshSearchSyntaxHelp(btn, profile);
    return btn;
  }
  function initSearchSyntaxHelp(scope) {
    const root = scope && "querySelectorAll" in scope ? scope : document;
    root.querySelectorAll(".cm-search-help-btn").forEach((node) => {
      var _a, _b;
      if (!(node instanceof HTMLElement)) return;
      const closestHost = node.closest("[data-cm-tip-profile]");
      const host = closestHost instanceof HTMLElement ? closestHost : null;
      const profile = resolveSearchProfile(
        (_b = (_a = host == null ? void 0 : host.dataset.cmTipProfile) != null ? _a : node.dataset.cmTipProfile) != null ? _b : "toolbar" /* Toolbar */
      );
      refreshSearchSyntaxHelp(node, profile);
    });
  }

  // src/grid-view/table-cell-ui.ts
  var BTN_TIP_SCOPE = ".cm-table, .cm-toolbar, .cm-toolbar-unified, .cm-toolbar-search, .cm-toolbar-search-actions, .cm-toolbar-search-saved-actions, [data-cm-toolbar-search-root], .cm-export-group, [data-cm-column-settings]";
  function normalizeText(text) {
    return text.replace(/\s+/g, " ").trim();
  }
  function isElementTruncated(el) {
    return el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1;
  }
  function measureTextWidth(el, text) {
    const style = getComputedStyle(el);
    const span = document.createElement("span");
    span.style.cssText = [
      "position:fixed",
      "visibility:hidden",
      "white-space:nowrap",
      "top:0",
      "left:0",
      `font:${style.font}`,
      `font-size:${style.fontSize}`,
      `font-weight:${style.fontWeight}`,
      `letter-spacing:${style.letterSpacing}`,
      `text-transform:${style.textTransform}`
    ].join(";");
    span.textContent = text;
    document.body.appendChild(span);
    const width = span.offsetWidth;
    span.remove();
    return width;
  }
  function isHeaderLabelTruncated(label, text) {
    if (isElementTruncated(label)) return true;
    if (label.clientWidth <= 0) return false;
    return measureTextWidth(label, text) > label.clientWidth + 1;
  }
  function headerInnerScrollWidth(th) {
    const inner = th.querySelector(".cm-th-inner");
    if (inner instanceof HTMLElement) return inner.scrollWidth;
    return th.scrollWidth;
  }
  function bindHeaderHoverExpand(table) {
    if (table.dataset.cmHeaderExpandBound) return;
    table.dataset.cmHeaderExpandBound = "1";
    table.querySelectorAll("thead th.cm-th-filterable[data-cm-col-key]").forEach(function(th) {
      if (!(th instanceof HTMLElement)) return;
      const label = th.querySelector(".cm-th-label");
      if (!(label instanceof HTMLElement)) return;
      if (!th.dataset.cmColKey) return;
      let restoreMinWidth = "";
      const expand = function() {
        if (table.classList.contains("cm-table--resizing")) return;
        window.requestAnimationFrame(function() {
          const need = headerInnerScrollWidth(th) + 4;
          const current = th.getBoundingClientRect().width;
          if (need <= current + 1) return;
          if (!restoreMinWidth) {
            restoreMinWidth = th.style.minWidth;
          }
          th.style.minWidth = `${Math.max(need, current)}px`;
          refreshHeaderLabels(table);
        });
      };
      const collapse = function(e) {
        if (!restoreMinWidth && !th.style.minWidth) return;
        const next = e.relatedTarget;
        if (next instanceof Node && th.contains(next)) return;
        th.style.minWidth = restoreMinWidth;
        restoreMinWidth = "";
        refreshHeaderLabels(table);
      };
      label.addEventListener("mouseenter", expand);
      label.addEventListener("mouseleave", collapse);
      th.addEventListener("mouseenter", expand);
      th.addEventListener("mouseleave", collapse);
    });
  }
  function cellFullText(td) {
    const raw = (td.dataset.cmExportRaw || "").trim();
    if (raw) return raw;
    const valueEl = td.querySelector("[data-cm-cell-value], .cm-cell");
    if (valueEl) return normalizeText(valueEl.textContent || "");
    const link = td.querySelector("a.cm-link");
    if (link) return normalizeText(link.textContent || "");
    return normalizeText(td.textContent || "");
  }
  function cellVisibleText(td) {
    const valueEl = td.querySelector("[data-cm-cell-value], .cm-cell");
    if (valueEl) return normalizeText(valueEl.textContent || "");
    const link = td.querySelector("a.cm-link");
    if (link) return normalizeText(link.textContent || "");
    return normalizeText(td.textContent || "");
  }
  function overflowTarget(td) {
    const inner = td.querySelector("[data-cm-cell-value], .cm-cell");
    if (inner instanceof HTMLElement) return inner;
    return td;
  }
  function isWrapColumn(td) {
    return td.hasAttribute("data-cm-wrap");
  }
  function isTruncatedCell(td) {
    if (isWrapColumn(td)) return false;
    const full = cellFullText(td);
    if (!full) return false;
    const visible = cellVisibleText(td);
    if (visible && full !== visible && full.length > visible.length) return true;
    if (visible.endsWith("\u2026") || visible.endsWith("...")) return true;
    const target = overflowTarget(td);
    if (target instanceof HTMLElement && isElementTruncated(target)) return true;
    return isElementTruncated(td);
  }
  function isInteractiveValueCell(td) {
    if (td.querySelector("a.cm-link[href]")) return true;
    if (td.querySelector("button:not([disabled])")) return true;
    if (td.querySelector("textarea")) return true;
    const select = td.querySelector("select");
    if (select instanceof HTMLSelectElement) {
      if (select.hasAttribute("data-cm-inline-edit")) {
        return td.closest("[data-cm-inline-edit-active]") !== null;
      }
      return true;
    }
    return false;
  }
  function copyText(text) {
    var _a;
    if (!text) return;
    if ((_a = navigator.clipboard) == null ? void 0 : _a.writeText) {
      void navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "true");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(ta);
    }
  }
  var COPY_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  function ensureValueWrap(td) {
    var _a;
    const existing = td.querySelector(":scope > .cm-cell-value-wrap");
    if (existing instanceof HTMLElement) return existing;
    const valueHost = td.querySelector(":scope > [data-cm-cell-value], :scope > .cm-cell");
    if (valueHost instanceof HTMLElement) {
      const wrap = document.createElement("span");
      wrap.className = "cm-cell-value-wrap";
      (_a = valueHost.parentNode) == null ? void 0 : _a.insertBefore(wrap, valueHost);
      wrap.appendChild(valueHost);
      return wrap;
    }
    if (td.querySelector("button, select, a.cm-link")) return null;
    return null;
  }
  function syncValueCellChrome(td, wrap) {
    const truncated = isTruncatedCell(td);
    wrap.classList.toggle("cm-cell-is-truncated", truncated);
    let tip = wrap.querySelector(".cm-ellipsis-tip");
    if (!truncated) {
      tip == null ? void 0 : tip.remove();
      return;
    }
    const full = cellFullText(td);
    if (!(tip instanceof HTMLElement)) {
      tip = document.createElement("span");
      tip.className = "cm-ellipsis-tip cm-ellipsis-tip--start";
      tip.setAttribute("role", "tooltip");
      wrap.appendChild(tip);
    }
    tip.textContent = full;
  }
  function enhanceValueCell(td) {
    if (isWrapColumn(td)) return;
    if (isInteractiveValueCell(td)) return;
    if (!td.querySelector(":scope > .cm-cell") && !td.querySelector(":scope > [data-cm-cell-value]")) return;
    const full = cellFullText(td);
    if (!full) return;
    const wrap = ensureValueWrap(td);
    if (!wrap) return;
    if (!td.dataset.cmValueHoverBound) {
      td.dataset.cmValueHoverBound = "1";
      td.classList.add("cm-cell-has-value-hover");
      const copyLabel = i18n.t("cell_link.copy", "Copy value");
      const actions = document.createElement("span");
      actions.className = "cm-cell-value-actions";
      actions.dataset.cmCellValueActions = "1";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "cm-cell-link-action";
      copyBtn.title = copyLabel;
      copyBtn.setAttribute("aria-label", copyLabel);
      copyBtn.innerHTML = COPY_ICON;
      copyBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        copyText(cellFullText(td));
      });
      actions.appendChild(copyBtn);
      wrap.appendChild(actions);
    }
    syncValueCellChrome(td, wrap);
  }
  function enhanceLinkCell(td, link) {
    var _a;
    if (td.dataset.cmLinkActionsBound) return;
    const href = (link.getAttribute("href") || "").trim();
    if (!href || href === "#") return;
    td.dataset.cmLinkActionsBound = "1";
    td.classList.add("cm-cell-has-link");
    let wrap = link.parentElement;
    if (!(wrap instanceof HTMLElement) || !wrap.classList.contains("cm-cell-link-wrap")) {
      wrap = document.createElement("span");
      wrap.className = "cm-cell-link-wrap";
      (_a = link.parentNode) == null ? void 0 : _a.insertBefore(wrap, link);
      wrap.appendChild(link);
    }
    if (wrap.querySelector("[data-cm-cell-link-actions]")) return;
    const actions = document.createElement("span");
    actions.className = "cm-cell-link-actions";
    actions.dataset.cmCellLinkActions = "1";
    const copyLabel = i18n.t("cell_link.copy", "Copy value");
    const openLabel = i18n.t("cell_link.open", "Open in new window");
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "cm-cell-link-action";
    copyBtn.dataset.cmCopyValue = "1";
    copyBtn.title = copyLabel;
    copyBtn.setAttribute("aria-label", copyLabel);
    copyBtn.innerHTML = COPY_ICON;
    const openBtn = document.createElement("a");
    openBtn.className = "cm-cell-link-action";
    openBtn.href = href;
    openBtn.target = "_blank";
    openBtn.rel = "noopener noreferrer";
    openBtn.title = openLabel;
    openBtn.setAttribute("aria-label", openLabel);
    openBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
    copyBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      const val = (td.dataset.cmExportRaw || link.textContent || "").trim() || (link.getAttribute("href") || "").trim();
      copyText(val);
    });
    openBtn.addEventListener("click", function(e) {
      e.stopPropagation();
    });
    actions.appendChild(copyBtn);
    actions.appendChild(openBtn);
    wrap.appendChild(actions);
  }
  function headerLabelText(label) {
    const stored = label.dataset.cmLabelText;
    if (stored) return normalizeText(stored);
    const text = normalizeText(label.textContent || "");
    if (text) label.dataset.cmLabelText = text;
    return text;
  }
  function refreshHeaderLabels(table) {
    table.querySelectorAll(".cm-th-label").forEach(function(label) {
      var _a, _b;
      if (!(label instanceof HTMLElement)) return;
      const text = headerLabelText(label);
      label.removeAttribute("title");
      if (!text) {
        label.classList.remove("cm-th-label--truncated");
        label.classList.remove("cm-tip-host");
        (_a = label.querySelector(".cm-ellipsis-tip")) == null ? void 0 : _a.remove();
        return;
      }
      if (isHeaderLabelTruncated(label, text)) {
        label.classList.add("cm-th-label--truncated");
        label.classList.add("cm-tip-host");
        let tip = label.querySelector(".cm-ellipsis-tip");
        if (!(tip instanceof HTMLElement)) {
          tip = document.createElement("span");
          tip.className = "cm-ellipsis-tip cm-ellipsis-tip--center";
          tip.setAttribute("role", "tooltip");
          label.appendChild(tip);
        }
        tip.textContent = text;
      } else {
        label.classList.remove("cm-th-label--truncated", "cm-tip-host");
        (_b = label.querySelector(".cm-ellipsis-tip")) == null ? void 0 : _b.remove();
      }
    });
  }
  function refreshTableCells(table) {
    table.querySelectorAll("tbody td[data-cm-col-key]").forEach(function(td) {
      if (!(td instanceof HTMLTableCellElement)) return;
      if (td.classList.contains("cm-col-hidden")) return;
      const link = td.querySelector("a.cm-link[href]");
      if (link instanceof HTMLAnchorElement) {
        enhanceLinkCell(td, link);
        return;
      }
      enhanceValueCell(td);
    });
  }
  function refreshTableCellOverflowActions(table) {
    if (table instanceof HTMLTableElement) {
      refreshTableCells(table);
      refreshHeaderLabels(table);
    }
  }
  function refreshTableCellTooltips(table) {
    refreshTableCellOverflowActions(table);
  }
  function refreshTableHeaderTooltips(table) {
    if (table instanceof HTMLTableElement) refreshHeaderLabels(table);
  }
  var LARGE_TABLE_ROW_THRESHOLD = 120;
  function refreshLinkCells(table) {
    table.querySelectorAll("tbody td[data-cm-col-key]").forEach(function(td) {
      if (!(td instanceof HTMLTableCellElement)) return;
      if (td.classList.contains("cm-col-hidden")) return;
      const link = td.querySelector("a.cm-link[href]");
      if (link instanceof HTMLAnchorElement) enhanceLinkCell(td, link);
    });
  }
  function observeTableCellUi(table) {
    if (table.dataset.cmCellUiObserved) return;
    table.dataset.cmCellUiObserved = "1";
    const rowCount = table.querySelectorAll("tbody tr.cm-row").length;
    const isLarge = rowCount > LARGE_TABLE_ROW_THRESHOLD;
    bindHeaderHoverExpand(table);
    const runInit = function() {
      if (isLarge) {
        refreshHeaderLabels(table);
        refreshLinkCells(table);
        return;
      }
      refreshTableCells(table);
      refreshHeaderLabels(table);
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(runInit, { timeout: 800 });
    } else {
      window.setTimeout(runInit, 0);
    }
    if (isLarge) return;
    let resizeTimer = 0;
    const onResize = function() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function() {
        refreshHeaderLabels(table);
        table.querySelectorAll("tbody td[data-cm-col-key]").forEach(function(td) {
          if (!(td instanceof HTMLTableCellElement)) return;
          const wrap = td.querySelector(":scope > .cm-cell-value-wrap");
          if (wrap instanceof HTMLElement && td.dataset.cmValueHoverBound) {
            syncValueCellChrome(td, wrap);
          }
        });
      }, 150);
    };
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(onResize);
      ro.observe(table);
    }
  }
  function initTableHeaderTooltips(scope) {
    var _a;
    const root = scope && "querySelectorAll" in scope ? scope : document;
    root.querySelectorAll("[data-cm-table]").forEach(function(table) {
      if (table instanceof HTMLTableElement) observeTableCellUi(table);
    });
    (_a = document.getElementById("cm-cell-overflow-popover")) == null ? void 0 : _a.remove();
  }
  function tipSourceText(el) {
    const title = (el.getAttribute("title") || "").trim();
    if (title) return title;
    return (el.getAttribute("aria-label") || "").trim();
  }
  function tipPositionClass(el) {
    if (el.classList.contains("cm-search-help-btn")) {
      return "cm-ellipsis-tip cm-ellipsis-tip--start";
    }
    return "cm-ellipsis-tip cm-ellipsis-tip--center";
  }
  function bindButtonEllipsisTip(el) {
    if (el.dataset.cmBtnTipBound === "1") return;
    let tip = el.querySelector(":scope > .cm-ellipsis-tip");
    const preset = tip instanceof HTMLElement ? (tip.textContent || "").trim() : "";
    const text = preset || tipSourceText(el);
    if (!text) return;
    el.dataset.cmBtnTipBound = "1";
    if (!preset) el.dataset.cmBtnTipText = text;
    el.removeAttribute("title");
    el.classList.add("cm-tip-host");
    if (!(tip instanceof HTMLElement)) {
      tip = document.createElement("span");
      tip.className = tipPositionClass(el);
      tip.setAttribute("role", "tooltip");
      el.appendChild(tip);
      tip.textContent = text;
    }
  }
  function initButtonEllipsisTips(scope) {
    const root = scope && "querySelectorAll" in scope ? scope : document;
    const selectors = [];
    BTN_TIP_SCOPE.split(",").forEach((container) => {
      const prefix = container.trim();
      selectors.push(
        `${prefix} button[title]`,
        `${prefix} a[title]`,
        `${prefix} button[aria-label]`,
        `${prefix} a[aria-label]`
      );
    });
    const selector = selectors.join(", ");
    root.querySelectorAll(selector).forEach(function(node) {
      if (!(node instanceof HTMLElement)) return;
      if (node.closest(".cm-col-resize-handle")) return;
      if (node.classList.contains("cm-search-help-btn")) return;
      bindButtonEllipsisTip(node);
    });
  }
  function initTableCellUi(scope) {
    initTableHeaderTooltips(scope);
    initButtonEllipsisTips(scope);
    initSearchSyntaxHelp(scope);
  }

  // src/grid-view/simple-table-column-resize.ts
  var MIN_COL_WIDTH = 28;
  function leafHeaderCells(table) {
    const rows = table.querySelectorAll("thead tr");
    const row = rows.length ? rows[rows.length - 1] : null;
    if (!row) return [];
    return Array.from(row.querySelectorAll("th[data-cm-col-key]")).filter(
      (th) => th instanceof HTMLElement
    );
  }
  function ensureColgroup(table) {
    if (table.querySelector("colgroup[data-cm-colgroup]")) return;
    const headers = leafHeaderCells(table);
    if (!headers.length) return;
    const cg = document.createElement("colgroup");
    cg.dataset.cmColgroup = "1";
    headers.forEach(function(th) {
      var _a, _b;
      const key = th.dataset.cmColKey;
      if (!key) return;
      const col = document.createElement("col");
      col.dataset.cmColKey = key;
      const width = th.style.width || ((_b = (_a = th.getAttribute("style")) == null ? void 0 : _a.match(/width:\s*([^;]+)/)) == null ? void 0 : _b[1]);
      if (width) col.style.width = width.trim();
      cg.appendChild(col);
    });
    table.insertBefore(cg, table.firstChild);
  }
  function colElementForKey(table, colKey) {
    const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(colKey) : colKey.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const col = table.querySelector('colgroup col[data-cm-col-key="' + esc + '"]');
    return col instanceof HTMLTableColElement ? col : null;
  }
  function visibleLeafHeaderCells(table) {
    return leafHeaderCells(table).filter(function(th) {
      return !th.classList.contains("cm-col-hidden");
    });
  }
  function leafHeaderCell(table, colKey) {
    const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(colKey) : colKey.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const rows = table.querySelectorAll("thead tr");
    const leaf = rows.length ? rows[rows.length - 1] : null;
    if (!leaf) return null;
    const th = leaf.querySelector('th[data-cm-col-key="' + esc + '"]');
    return th instanceof HTMLElement ? th : null;
  }
  function isColumnHidden(table, colKey) {
    var _a;
    const th = leafHeaderCell(table, colKey);
    return (_a = th == null ? void 0 : th.classList.contains("cm-col-hidden")) != null ? _a : false;
  }
  function applyHiddenColumnWidth(table, colKey) {
    const col = colElementForKey(table, colKey);
    if (col) {
      col.style.display = "none";
    }
  }
  function applyColumnWidth(table, colKey, widthPx) {
    if (isColumnHidden(table, colKey)) {
      applyHiddenColumnWidth(table, colKey);
      return 0;
    }
    const w = Math.max(MIN_COL_WIDTH, Math.round(widthPx));
    const px = w + "px";
    const col = colElementForKey(table, colKey);
    if (col) {
      col.style.width = px;
      col.style.minWidth = "";
      delete col.dataset.cmColZero;
    }
    const th = leafHeaderCell(table, colKey);
    if (th) {
      th.style.width = px;
      th.style.minWidth = "";
      th.dataset.cmColWidth = String(w);
    }
    return w;
  }
  function syncHiddenColumnWidths(table) {
    leafHeaderCells(table).forEach(function(th) {
      const key = th.dataset.cmColKey;
      if (!key) return;
      if (th.classList.contains("cm-col-hidden")) {
        applyHiddenColumnWidth(table, key);
      } else {
        const col = colElementForKey(table, key);
        if (col) col.style.display = "";
      }
    });
  }
  function sumVisibleColumnWidths(table) {
    let sum = 0;
    visibleLeafHeaderCells(table).forEach(function(th) {
      const key = th.dataset.cmColKey;
      if (!key) return;
      const w = readColumnWidthPx(table, key);
      if (w !== null) sum += w;
    });
    return sum;
  }
  function syncTableWidthFromColumns(table) {
    if (!table.classList.contains("cm-table--has-col-widths")) {
      table.style.width = "";
      return;
    }
    const sum = sumVisibleColumnWidths(table);
    if (sum > 0) {
      table.style.width = sum + "px";
    }
  }
  function rebalanceTableColumnLayout(table) {
    if (!table.classList.contains("cm-table--has-col-widths")) return;
    syncHiddenColumnWidths(table);
    syncTableWidthFromColumns(table);
  }
  function neighborHeaderIndex(headers, index) {
    for (let i = index + 1; i < headers.length; i++) {
      if (!headers[i].classList.contains("cm-col-hidden")) return i;
    }
    for (let i = index - 1; i >= 0; i--) {
      if (!headers[i].classList.contains("cm-col-hidden")) return i;
    }
    return -1;
  }
  function seedFixedColumnWidths(table) {
    if (table.classList.contains("cm-table--has-col-widths")) return;
    ensureColgroup(table);
    const measured = [];
    visibleLeafHeaderCells(table).forEach(function(th) {
      const key = th.dataset.cmColKey;
      if (!key) return;
      measured.push({
        key,
        w: Math.max(MIN_COL_WIDTH, Math.round(th.getBoundingClientRect().width))
      });
    });
    syncHiddenColumnWidths(table);
    measured.forEach(function(item) {
      applyColumnWidth(table, item.key, item.w);
    });
    table.classList.add("cm-table--has-col-widths");
    syncHiddenColumnWidths(table);
    syncTableWidthFromColumns(table);
  }
  function resizeColumnWithNeighbor(table, colKey, widthPx) {
    seedFixedColumnWidths(table);
    const headers = visibleLeafHeaderCells(table);
    const index = headers.findIndex(function(th) {
      return th.dataset.cmColKey === colKey;
    });
    if (index < 0) return;
    const prevW = readColumnWidthPx(table, colKey);
    if (prevW === null) return;
    const nextW = Math.max(MIN_COL_WIDTH, Math.round(widthPx));
    const delta = nextW - prevW;
    if (delta === 0) return;
    applyColumnWidth(table, colKey, nextW);
    const neighborIndex = neighborHeaderIndex(headers, index);
    if (neighborIndex < 0) return;
    const neighborKey = headers[neighborIndex].dataset.cmColKey;
    if (!neighborKey) return;
    const neighborW = readColumnWidthPx(table, neighborKey);
    if (neighborW === null) return;
    applyColumnWidth(table, neighborKey, neighborW - delta);
    syncHiddenColumnWidths(table);
    syncTableWidthFromColumns(table);
  }
  function readColumnWidthPx(table, colKey) {
    if (isColumnHidden(table, colKey)) return 0;
    const col = colElementForKey(table, colKey);
    const raw = (col == null ? void 0 : col.style.width) || "";
    const m = raw.match(/^(\d+(?:\.\d+)?)px$/);
    if (m) return parseFloat(m[1]);
    const th = leafHeaderCell(table, colKey);
    if (th instanceof HTMLElement && th.dataset.cmColWidth) {
      const n = parseFloat(th.dataset.cmColWidth);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  function persistColumnWidths(table) {
    const shell = table.closest('[data-cm-column-settings="1"]');
    const host = shell == null ? void 0 : shell._colSettings;
    if (host && typeof host.saveState === "function") {
      host.saveState();
    }
  }
  function bindResizeHandle(table, handle, colKey) {
    if (handle.dataset.cmColResizeBound) return;
    handle.dataset.cmColResizeBound = "1";
    handle.addEventListener("mousedown", function(e) {
      var _a;
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const headerTh = leafHeaderCell(table, colKey);
      if (!headerTh || headerTh.classList.contains("cm-col-hidden")) return;
      const activeHeaderTh = headerTh;
      seedFixedColumnWidths(table);
      const startX = e.clientX;
      const startW = (_a = readColumnWidthPx(table, colKey)) != null ? _a : activeHeaderTh.getBoundingClientRect().width;
      document.body.classList.add("cm-col-resize-active");
      table.classList.add("cm-table--resizing");
      activeHeaderTh.classList.add("cm-col-resize-active");
      let moveRefreshTimer = 0;
      function onMove(ev) {
        resizeColumnWithNeighbor(table, colKey, startW + (ev.clientX - startX));
        window.clearTimeout(moveRefreshTimer);
        moveRefreshTimer = window.setTimeout(function() {
          refreshTableHeaderTooltips(table);
          refreshTableCellTooltips(table);
        }, 50);
      }
      function onUp() {
        document.body.classList.remove("cm-col-resize-active");
        table.classList.remove("cm-table--resizing");
        activeHeaderTh.classList.remove("cm-col-resize-active");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        rebalanceTableColumnLayout(table);
        persistColumnWidths(table);
        refreshTableHeaderTooltips(table);
        refreshTableCellTooltips(table);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }
  function bindTableColumnResize(table) {
    if (table.dataset.cmColResizeBound) return;
    table.dataset.cmColResizeBound = "1";
    ensureColgroup(table);
    syncHiddenColumnWidths(table);
    leafHeaderCells(table).forEach(function(th) {
      const key = th.dataset.cmColKey;
      if (!key || th.classList.contains("cm-col-hidden")) return;
      if (!th.querySelector("[data-cm-col-resize]")) {
        const handle2 = document.createElement("span");
        handle2.className = "cm-col-resize-handle";
        handle2.dataset.cmColResize = "1";
        handle2.setAttribute("role", "separator");
        handle2.setAttribute("aria-orientation", "vertical");
        handle2.title = "";
        th.appendChild(handle2);
      }
      const handle = th.querySelector("[data-cm-col-resize]");
      if (handle instanceof HTMLElement) bindResizeHandle(table, handle, key);
    });
  }
  function initSimpleTableColumnResize(scope) {
    if (typeof window !== "undefined") {
      window.GridViewColumnLayout = {
        rebalance: rebalanceTableColumnLayout
      };
    }
    const root = scope && "querySelectorAll" in scope ? scope : document;
    root.querySelectorAll('[data-cm-column-settings="1"] [data-cm-table]').forEach(function(table) {
      if (!(table instanceof HTMLTableElement)) return;
      bindTableColumnResize(table);
      maybeSeedColumnWidths(table);
    });
  }
  function maybeSeedColumnWidths(table) {
    if (table.classList.contains("cm-table--has-col-widths")) return;
    if (!table.offsetWidth) return;
    if (!table.querySelector("tbody tr")) return;
    seedFixedColumnWidths(table);
  }

  // src/grid-view/charts-bridge.ts
  var chartsApi = null;
  function resolveApi() {
    var _a;
    if (chartsApi) return chartsApi;
    const registered = (_a = window.GridView) == null ? void 0 : _a.Charts;
    return registered && registered !== ChartsBridge ? registered : null;
  }
  var ChartsBridge = {
    initChart(root, config, rows) {
      var _a, _b;
      return (_b = (_a = resolveApi()) == null ? void 0 : _a.initChart(root, config, rows)) != null ? _b : null;
    },
    refreshChartWrap(wrap, config, rows) {
      var _a;
      (_a = resolveApi()) == null ? void 0 : _a.refreshChartWrap(wrap, config, rows);
    },
    initAllCharts(scope) {
      var _a;
      (_a = resolveApi()) == null ? void 0 : _a.initAllCharts(scope);
    },
    buildEchartsOption(config, rows) {
      const api = resolveApi();
      return api ? api.buildEchartsOption(config, rows) : null;
    }
  };

  // src/runtime/dialog.ts
  var activeDialog = null;
  var currentResolver = null;
  function ensureDialogElement() {
    if (activeDialog && document.body.contains(activeDialog)) {
      return activeDialog;
    }
    const dialog = document.createElement("dialog");
    dialog.className = "cm-dialog-root";
    dialog.setAttribute("aria-modal", "true");
    dialog.innerHTML = `
    <div class="cm-dialog-panel" data-cm-dialog-panel>
      <div class="cm-dialog-header">
        <h3 class="cm-dialog-title" data-cm-dialog-title></h3>
        <button type="button" class="cm-dialog-close-btn" data-cm-dialog-cancel>&times;</button>
      </div>
      <div class="cm-dialog-body" data-cm-dialog-body></div>
      <div class="cm-dialog-footer">
        <button type="button" class="cm-btn cm-dialog-btn-cancel" data-cm-dialog-cancel></button>
        <button type="button" class="cm-btn cm-dialog-btn-confirm" data-cm-dialog-confirm></button>
      </div>
    </div>
  `;
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        const closeOnBackdrop = dialog.dataset.cmCloseOnBackdrop !== "0";
        if (closeOnBackdrop) {
          closeWithResult(false);
        }
      }
    });
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeWithResult(false);
    });
    const cancelButtons = dialog.querySelectorAll("[data-cm-dialog-cancel]");
    cancelButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeWithResult(false);
      });
    });
    const confirmBtn = dialog.querySelector("[data-cm-dialog-confirm]");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeWithResult(true);
      });
    }
    document.body.appendChild(dialog);
    activeDialog = dialog;
    return dialog;
  }
  function closeWithResult(result) {
    if (!activeDialog) return;
    if (activeDialog.open) {
      activeDialog.close();
    }
    if (currentResolver) {
      const resolve = currentResolver;
      currentResolver = null;
      resolve(result);
    }
  }
  function confirmDialog(options) {
    var _a, _b, _c, _d, _e, _f;
    const opts = typeof options === "string" ? { message: options } : { ...options };
    const title = (_a = opts.title) != null ? _a : t("dialog.title", "Confirmation");
    const message = (_b = opts.message) != null ? _b : "";
    const tone = (_c = opts.tone) != null ? _c : "default";
    const confirmText = (_d = opts.confirmText) != null ? _d : t("dialog.confirm", "Confirm");
    const cancelText = (_e = opts.cancelText) != null ? _e : t("dialog.cancel", "Cancel");
    const closeText = t("common.close", "Close");
    const closeOnBackdrop = (_f = opts.closeOnBackdrop) != null ? _f : true;
    if (currentResolver) {
      closeWithResult(false);
    }
    const dialog = ensureDialogElement();
    dialog.dataset.cmCloseOnBackdrop = closeOnBackdrop ? "1" : "0";
    dialog.dataset.cmTone = tone;
    const titleEl = dialog.querySelector("[data-cm-dialog-title]");
    if (titleEl) titleEl.textContent = title;
    const closeBtn = dialog.querySelector(".cm-dialog-close-btn");
    if (closeBtn) closeBtn.setAttribute("aria-label", closeText);
    const bodyEl = dialog.querySelector("[data-cm-dialog-body]");
    if (bodyEl) bodyEl.textContent = message;
    const cancelBtn = dialog.querySelector(".cm-dialog-btn-cancel");
    if (cancelBtn) cancelBtn.textContent = cancelText;
    const confirmBtn = dialog.querySelector(".cm-dialog-btn-confirm");
    if (confirmBtn) {
      confirmBtn.textContent = confirmText;
      confirmBtn.className = "cm-btn cm-dialog-btn-confirm";
      if (tone === "danger") {
        confirmBtn.classList.add("cm-btn-danger");
      } else if (tone === "primary") {
        confirmBtn.classList.add("cm-btn-primary");
      } else if (tone === "warning") {
        confirmBtn.classList.add("cm-btn-warning");
      } else {
        confirmBtn.classList.add("cm-btn-default");
      }
    }
    return new Promise((resolve) => {
      currentResolver = resolve;
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
      if (tone === "danger") {
        cancelBtn == null ? void 0 : cancelBtn.focus();
      } else {
        confirmBtn == null ? void 0 : confirmBtn.focus();
      }
    });
  }

  // src/grid-view/action-confirmation.ts
  var pendingConfirmations = /* @__PURE__ */ new WeakSet();
  function isDisabledElement(element) {
    return element.matches(":disabled") || element.getAttribute("aria-disabled") === "true";
  }
  function stringValue(record, ...keys) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string") return value;
    }
    return void 0;
  }
  function toneValue(value) {
    return value === "default" || value === "primary" || value === "warning" || value === "danger" ? value : void 0;
  }
  function booleanValue(value) {
    return typeof value === "boolean" ? value : void 0;
  }
  function decodeConfirmValue(value) {
    var _a;
    if (typeof value === "string") return value;
    if (!isRecord(value)) return null;
    const options = {};
    const title = stringValue(value, "title");
    const message = stringValue(value, "message");
    const tone = toneValue(value.tone);
    const confirmText = stringValue(value, "confirmText", "confirm_text");
    const cancelText = stringValue(value, "cancelText", "cancel_text");
    const closeOnBackdrop = booleanValue((_a = value.closeOnBackdrop) != null ? _a : value.close_on_backdrop);
    if (title !== void 0) options.title = title;
    if (message !== void 0) options.message = message;
    if (tone !== void 0) options.tone = tone;
    if (confirmText !== void 0) options.confirmText = confirmText;
    if (cancelText !== void 0) options.cancelText = cancelText;
    if (closeOnBackdrop !== void 0) options.closeOnBackdrop = closeOnBackdrop;
    return options;
  }
  function serializeConfirmAttribute(value) {
    var _a, _b, _c, _d, _e, _f;
    const decoded = decodeConfirmValue(value);
    if (decoded === null) return "";
    if (typeof decoded === "string") return JSON.stringify(decoded);
    return JSON.stringify({
      title: (_a = decoded.title) != null ? _a : "Confirmation",
      message: (_b = decoded.message) != null ? _b : "",
      tone: (_c = decoded.tone) != null ? _c : "default",
      confirm_text: (_d = decoded.confirmText) != null ? _d : "Confirm",
      cancel_text: (_e = decoded.cancelText) != null ? _e : "Cancel",
      close_on_backdrop: (_f = decoded.closeOnBackdrop) != null ? _f : true
    });
  }
  function parseConfirmAttribute(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return decodeConfirmValue(parsed);
    } catch (e) {
      return null;
    }
  }
  function confirmAndInvokeFromElement(element, invoke, preferredElement = null) {
    var _a;
    if (pendingConfirmations.has(element)) return;
    const preferredRaw = (_a = preferredElement == null ? void 0 : preferredElement.getAttribute("data-cm-confirm")) != null ? _a : null;
    const preferredConfirm = parseConfirmAttribute(preferredRaw);
    if (preferredRaw !== null && preferredConfirm === null) return;
    const raw = element.getAttribute("data-cm-confirm");
    const confirm = preferredConfirm != null ? preferredConfirm : parseConfirmAttribute(raw);
    if (raw !== null && confirm === null) return;
    if (confirm === null) {
      invoke();
      return;
    }
    pendingConfirmations.add(element);
    void confirmDialog(confirm).then(
      (confirmed) => {
        try {
          if (confirmed) invoke();
        } finally {
          pendingConfirmations.delete(element);
        }
      },
      () => {
        pendingConfirmations.delete(element);
      }
    );
  }

  // src/grid-view/simple-table.ts
  function isClientFilterState(value) {
    return isRecord(value) && Object.values(value).every(
      (item) => typeof item === "string" || Array.isArray(item) && item.every((entry) => typeof entry === "string")
    );
  }
  function isRowDict(value) {
    if (!isRecord(value)) return false;
    return Object.values(value).every(
      (v) => v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean"
    );
  }
  function isChartRuntimeDict(value) {
    return isRecord(value);
  }
  function asHtmlTable(el) {
    return el instanceof HTMLTableElement ? el : null;
  }
  function simpleTableWrapper(table) {
    const wrapper = table.closest(
      ".cm-simple-wrapper, .cm-table-shell, .cm-page-table-layout, .cm-dashboard-page"
    ) || table.parentElement;
    return asHTMLElement(wrapper);
  }
  function ensureSimpleTableForTable(tableEl) {
    if (!tableEl) return null;
    const table = tableEl.matches("[data-cm-table]") ? asHtmlTable(tableEl) : asHtmlTable(tableEl.querySelector("[data-cm-table]"));
    if (!table) return null;
    if (table._cmSimpleTable instanceof SimpleTable) return table._cmSimpleTable;
    const wrapper = simpleTableWrapper(table);
    if (!wrapper) return null;
    const instance = new SimpleTable(wrapper, table);
    table._cmSimpleTable = instance;
    return instance;
  }
  function resolveDataTable(el) {
    if (!el) return null;
    if (el.matches("[data-cm-table][data-cm-col-filters]"))
      return asHtmlTable(el);
    return asHtmlTable(el.querySelector("[data-cm-table][data-cm-col-filters]"));
  }
  function clearSimpleTableFiltersForGrid(gridId) {
    if (!gridId) return false;
    const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(gridId) : gridId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const shell = document.getElementById("cm-table-" + gridId);
    let table = resolveDataTable(shell);
    if (!table)
      table = resolveDataTable(
        document.querySelector('[data-grid-id="' + esc + '"]')
      );
    if (!table) return false;
    const simple = ensureSimpleTableForTable(table);
    if (!simple) return false;
    simple.clearAllFilters();
    return true;
  }
  function applyTableFilters(tableEl) {
    const table = resolveDataTable(tableEl);
    if (!table) return;
    const simple = ensureSimpleTableForTable(table);
    if (simple) {
      simple.applyAllFilters();
      return;
    }
    const wrapper = simpleTableWrapper(table);
    if (!wrapper) return;
    new SimpleTable(wrapper, table).applyAllFilters();
  }
  function applyClientFilterState(tableEl, state) {
    var _a;
    const table = resolveDataTable(tableEl);
    if (!table) return;
    table.dataset.cmClientFilters = JSON.stringify(state);
    (_a = ensureSimpleTableForTable(table)) == null ? void 0 : _a.applyAllFilters();
  }
  function applyFiltersInScope(scope) {
    const root = scope && "querySelectorAll" in scope ? scope : document;
    root.querySelectorAll("[data-cm-table][data-cm-col-filters]").forEach((tableEl) => {
      var _a;
      const table = asHtmlTable(tableEl);
      if (table) (_a = ensureSimpleTableForTable(table)) == null ? void 0 : _a.applyAllFilters();
    });
  }
  var SimpleTable = class {
    constructor(wrapper, tableEl) {
      this.sortKey = null;
      this.sortDir = null;
      this.w = wrapper;
      const table = tableEl || asHtmlTable(wrapper.querySelector("[data-cm-table]"));
      if (!table) throw new Error("SimpleTable: missing [data-cm-table]");
      this.table = table;
      const tbody = table.querySelector("tbody");
      if (!(tbody instanceof HTMLTableSectionElement))
        throw new Error("SimpleTable: missing tbody");
      this.tbody = tbody;
      Array.from(this.tbody.querySelectorAll("tr")).forEach((row, index) => {
        row.dataset.cmIdx = String(index);
      });
      this.bind();
    }
    _hasSectionGroups() {
      return this.tbody.querySelector(".cm-row-section") !== null;
    }
    _rowGroups() {
      const groups = [];
      let current = null;
      Array.from(this.tbody.children).forEach((child) => {
        if (!(child instanceof HTMLTableRowElement)) return;
        const tr = child;
        if (tr.classList.contains("cm-row-section")) {
          current = { section: tr, rows: [] };
          groups.push(current);
          return;
        }
        if (tr.classList.contains("cm-row")) {
          if (!current) {
            current = { section: null, rows: [] };
            groups.push(current);
          }
          current.rows.push(tr);
        }
      });
      return groups;
    }
    _compareRows(a, b, idx) {
      var _a, _b, _c, _d, _e, _f;
      const num2 = (value) => {
        const parsed = parseFloat(String(value).replace(/[^\d.-]/g, ""));
        return Number.isNaN(parsed) ? null : parsed;
      };
      const cellA = a.querySelector('td[data-cm-col="' + idx + '"]') || a.children[idx];
      const cellB = b.querySelector('td[data-cm-col="' + idx + '"]') || b.children[idx];
      const cellAEl = asHTMLElement(cellA);
      const cellBEl = asHTMLElement(cellB);
      const va = (_c = (_b = cellAEl == null ? void 0 : cellAEl.dataset.cmSortVal) != null ? _b : (_a = cellAEl == null ? void 0 : cellAEl.textContent) == null ? void 0 : _a.trim()) != null ? _c : "";
      const vb = (_f = (_e = cellBEl == null ? void 0 : cellBEl.dataset.cmSortVal) != null ? _e : (_d = cellBEl == null ? void 0 : cellBEl.textContent) == null ? void 0 : _d.trim()) != null ? _f : "";
      const na = num2(va);
      const nb = num2(vb);
      if (na !== null && nb !== null) return na - nb;
      return String(va).localeCompare(String(vb), void 0, { numeric: true });
    }
    _appendRowGroups(groups) {
      groups.forEach((group) => {
        if (group.section) this.tbody.appendChild(group.section);
        group.rows.forEach((row) => {
          this.tbody.appendChild(row);
        });
      });
    }
    bind() {
      var _a;
      this.w.querySelectorAll("[data-cm-sort]").forEach((thEl) => {
        const th = asHTMLElement(thEl);
        if (!th) return;
        if (th.dataset.cmBound) return;
        th.dataset.cmBound = "1";
        th.addEventListener("click", (e) => {
          const target = eventTargetElement(e.target);
          if (target == null ? void 0 : target.closest(
            "[data-cm-col-filter-trigger], [data-cm-col-filter-clear], [data-cm-col-resize], .cm-th-header-tools, [data-cm-th-tools]"
          )) {
            return;
          }
          if (!th.dataset.cmSort) return;
          this._sort(th);
        });
      });
      const inp = asHTMLElement(
        this.w.querySelector("[data-cm-search]") || ((_a = this.w.closest(".cm-page-table-layout, .cm-dashboard-page, .cm-grid-view-spec")) == null ? void 0 : _a.querySelector("[data-cm-toolbar-search]"))
      );
      if (inp && !inp.dataset.cmBound) {
        inp.dataset.cmBound = "1";
        inp.addEventListener("input", () => {
          this.applyAllFilters();
        });
      }
      this.tbody.querySelectorAll("[data-cm-row-url]").forEach((rowEl) => {
        const row = asHTMLElement(rowEl);
        if (!row) return;
        if (row.dataset.cmRowUrlBound) return;
        row.dataset.cmRowUrlBound = "1";
        row.style.cursor = "pointer";
        row.addEventListener("click", (event) => {
          const target = eventTargetElement(event.target);
          if (target == null ? void 0 : target.closest("a,button,[data-cm-cell-action],[data-cm-cell-edit]"))
            return;
          const url = row.dataset.cmRowUrl;
          if (url) {
            confirmAndInvokeFromElement(row, () => {
              window.location.href = url;
            });
          }
        });
      });
      this.tbody.querySelectorAll("[data-cm-row-action]").forEach((rowEl) => {
        const row = asHTMLElement(rowEl);
        if (!row) return;
        if (row.dataset.cmRowActionBound) return;
        row.dataset.cmRowActionBound = "1";
        row.style.cursor = "pointer";
        row.addEventListener("click", (event) => {
          const target = eventTargetElement(event.target);
          if (target == null ? void 0 : target.closest("a,button,[data-cm-cell-action],[data-cm-cell-edit]"))
            return;
          const action = row.dataset.cmRowAction;
          if (!action) return;
          confirmAndInvokeFromElement(row, () => {
            invokeAction(action, {
              rowId: row.dataset.cmRowId,
              gridId: this.w.getAttribute("data-grid-id") || void 0,
              event,
              source: "row"
            });
          });
        });
      });
    }
    _colIndex(th) {
      const idx = th.dataset.cmCol;
      if (idx !== void 0 && idx !== "") {
        return parseInt(idx, 10);
      }
      return th.parentElement ? Array.from(th.parentElement.children).indexOf(th) : 0;
    }
    _sort(th) {
      const key = th.dataset.cmSort || "";
      this.sortDir = this.sortKey === key ? this.sortDir === "asc" ? "desc" : this.sortDir === "desc" ? null : "asc" : "asc";
      this.sortKey = this.sortDir ? key : null;
      const idx = this._colIndex(th);
      if (this._hasSectionGroups()) {
        if (!this.sortDir) {
          Array.from(this.tbody.querySelectorAll("tr")).sort((a, b) => Number(a.dataset.cmIdx) - Number(b.dataset.cmIdx)).forEach((row) => this.tbody.appendChild(row));
        } else {
          const groups = this._rowGroups();
          const dir = this.sortDir;
          groups.forEach((group) => {
            group.rows.sort((a, b) => {
              const cmp = this._compareRows(a, b, idx);
              return dir === "asc" ? cmp : -cmp;
            });
          });
          this._appendRowGroups(groups);
        }
      } else {
        const rows = Array.from(
          this.tbody.querySelectorAll(".cm-row")
        );
        if (!this.sortDir) {
          rows.sort((a, b) => Number(a.dataset.cmIdx) - Number(b.dataset.cmIdx));
        } else {
          const dir = this.sortDir;
          rows.sort((a, b) => {
            const cmp = this._compareRows(a, b, idx);
            return dir === "asc" ? cmp : -cmp;
          });
        }
        rows.forEach((row) => this.tbody.appendChild(row));
      }
      this.w.querySelectorAll("[data-cm-sort]").forEach((headerEl) => {
        const headerTh = asHTMLElement(headerEl);
        if (!headerTh) return;
        const isSorted = this.sortDir !== null && headerTh.dataset.cmSort === this.sortKey;
        headerTh.classList.toggle("cm-th-sorted", isSorted);
        headerTh.classList.toggle(
          "cm-th-sort-asc",
          isSorted && this.sortDir === "asc"
        );
        headerTh.classList.toggle(
          "cm-th-sort-desc",
          isSorted && this.sortDir === "desc"
        );
      });
    }
    clearAllFilters() {
      var _a;
      const toolbarSearch = (_a = this.w.closest(".cm-dashboard-page, .cm-grid-view-spec")) == null ? void 0 : _a.querySelector("[data-cm-toolbar-search]");
      if (toolbarSearch instanceof HTMLInputElement) {
        toolbarSearch.value = "";
        delete toolbarSearch.dataset.cmSearchCommitted;
        toolbarSearch.dispatchEvent(new Event("input", { bubbles: true }));
      }
      this.w.querySelectorAll("th[data-cm-col-key]").forEach((th) => {
        delete th.dataset.cmColFilterValue;
      });
      this.w.querySelectorAll(".cm-col-filter-btn").forEach((btn) => {
        btn.classList.remove("is-active", "is-open");
      });
      this.w.querySelectorAll(".cm-col-filter-clear").forEach((btn) => {
        btn.classList.remove("is-visible");
      });
      const url = new URL(window.location.href);
      ["q", "filters", "col_q"].forEach((key) => url.searchParams.delete(key));
      window.history.replaceState({}, "", url);
      const gridId = this._gridId();
      this.applyAllFilters();
      document.dispatchEvent(
        new CustomEvent("cm-grid-state-change", { detail: { gridId } })
      );
    }
    _gridId() {
      var _a;
      return this.w.dataset.gridId || ((_a = this.table.closest("[data-grid-id]")) == null ? void 0 : _a.dataset.gridId) || "";
    }
    hasActiveFilters() {
      var _a;
      const toolbarSearch = (_a = this.w.closest(".cm-dashboard-page, .cm-grid-view-spec")) == null ? void 0 : _a.querySelector("[data-cm-toolbar-search]");
      if (toolbarSearch instanceof HTMLInputElement) {
        if ((toolbarSearch.value || "").trim()) return true;
        if ((toolbarSearch.dataset.cmSearchCommitted || "").trim()) return true;
      }
      if (Object.keys(collectColumnFiltersFromTable(this.table)).length)
        return true;
      const params = new URLSearchParams(window.location.search);
      if (["q", "col_q"].some((key) => (params.get(key) || "").trim().length > 0))
        return true;
      return false;
    }
    syncFilterChrome() {
      syncColumnFilterChrome(this.table);
      const active = this.hasActiveFilters();
      const gridId = this._gridId();
      const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(gridId) : gridId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const buttons = gridId ? document.querySelectorAll(
        '[data-cm-grid-action="clearAllFilters"][data-cm-grid-id="' + esc + '"]'
      ) : document.querySelectorAll(
        '[data-cm-grid-action="clearAllFilters"]'
      );
      buttons.forEach((btn) => btn.classList.toggle("is-hidden", !active));
    }
    _queryUsesNumericCellText(query) {
      const q = String(query || "").trim();
      if (!q) return false;
      if (termIsExpression(q)) return true;
      for (const group of tokenizeSmartQuery(q)) {
        for (const item of group) {
          if (termIsExpression(item.term)) return true;
        }
      }
      return false;
    }
    _resolveToolbarQuery(toolbarSearch, localSearch) {
      const toolbarInput = toolbarSearch instanceof HTMLInputElement ? toolbarSearch : null;
      const localInput = localSearch instanceof HTMLInputElement ? localSearch : null;
      const raw = (toolbarInput && toolbarInput.value || localInput && localInput.value || "").trim();
      const input = toolbarInput || localInput;
      const searchColumns = collectSearchColumnsFromTable(this.table);
      if (input) {
        if (isToolbarQueryCommitReady(raw, { columns: searchColumns })) {
          if (raw) input.dataset.cmSearchCommitted = raw;
          else delete input.dataset.cmSearchCommitted;
          return raw;
        }
        return (input.dataset.cmSearchCommitted || "").trim();
      }
      return (raw || new URLSearchParams(window.location.search).get("q") || "").trim();
    }
    _cellTextForFilter(row, colKey, query) {
      var esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(colKey) : colKey.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      var cell = row.querySelector('td[data-cm-col-key="' + esc + '"]');
      const cellEl = asHTMLElement(cell);
      if (!cellEl) return "";
      if (this._queryUsesNumericCellText(query)) {
        return (cellEl.dataset.cmExportRaw || cellEl.dataset.cmSortVal || cellEl.textContent || "").trim();
      }
      return (cellEl.dataset.cmSortVal || cellEl.textContent || cellEl.dataset.cmExportRaw || "").trim();
    }
    _syncTableEmptyState(shownRows, filtered) {
      const emptyRow = asHTMLElement(
        this.tbody.querySelector("tr[data-cm-table-empty]")
      );
      if (!emptyRow) return;
      const hasDataRows = this.tbody.querySelectorAll(".cm-row").length > 0;
      if (!hasDataRows) {
        emptyRow.hidden = true;
        return;
      }
      emptyRow.hidden = !(filtered && shownRows === 0);
    }
    _syncSectionTotals(active) {
      this.tbody.querySelectorAll(".cm-row-section").forEach((sectionEl) => {
        const sectionRow = asHTMLElement(sectionEl);
        if (!sectionRow) return;
        const visibleRows = [];
        let next = sectionRow.nextElementSibling;
        while (next && !next.classList.contains("cm-row-section")) {
          const rowEl = asHTMLElement(next);
          if ((rowEl == null ? void 0 : rowEl.classList.contains("cm-row")) && !rowEl.hidden)
            visibleRows.push(rowEl);
          next = next.nextElementSibling;
        }
        sectionRow.querySelectorAll("td[data-cm-section-aggregate]").forEach((el) => {
          const key = el.dataset.cmColKey;
          if (!key) return;
          if (!el.dataset.cmSectionHtml) {
            el.dataset.cmSectionHtml = el.innerHTML;
          }
          if (!active) {
            el.innerHTML = el.dataset.cmSectionHtml;
            return;
          }
          let sum = 0;
          let hasNum = false;
          const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(key) : key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          visibleRows.forEach((row) => {
            var _a, _b;
            const bodyCell = row.querySelector(
              'td[data-cm-col-key="' + esc + '"]'
            );
            const raw = (_b = (_a = bodyCell == null ? void 0 : bodyCell.dataset.cmExportRaw) != null ? _a : bodyCell == null ? void 0 : bodyCell.dataset.cmSortVal) != null ? _b : "";
            const parsed = parseFloat(String(raw).replace(/[^\d.-]/g, ""));
            if (!Number.isNaN(parsed)) {
              sum += parsed;
              hasNum = true;
            }
          });
          if (!hasNum) {
            el.innerHTML = '<span class="cm-muted">\u2014</span>';
            return;
          }
          const base = el.dataset.cmExportRaw || "";
          if (base.includes("\u20B4") || el.dataset.cmSectionHtml.includes("\u20B4")) {
            el.textContent = sum.toLocaleString(void 0, { maximumFractionDigits: 2 }) + " \u20B4";
          } else {
            el.textContent = String(Math.round(sum) === sum ? sum : sum);
          }
        });
      });
    }
    _syncSectionVisibility(colKeys, globalActive) {
      const filtering = colKeys.length > 0 || globalActive;
      const hideSole = !!this.table.dataset.cmHideSoleSection;
      const sections = [];
      this.tbody.querySelectorAll(".cm-row-section").forEach((sectionEl) => {
        const sectionRow = asHTMLElement(sectionEl);
        if (!sectionRow) return;
        let next = sectionRow.nextElementSibling;
        let anyVisible = false;
        while (next && !next.classList.contains("cm-row-section")) {
          const rowEl = asHTMLElement(next);
          if ((rowEl == null ? void 0 : rowEl.classList.contains("cm-row")) && !rowEl.hidden)
            anyVisible = true;
          next = next.nextElementSibling;
        }
        sections.push({ el: sectionRow, hasVisible: anyVisible });
      });
      const visibleSectionCount = sections.filter((s) => s.hasVisible).length;
      for (const { el, hasVisible } of sections) {
        if (!filtering) {
          el.hidden = false;
        } else if (!hasVisible) {
          el.hidden = true;
        } else if (hideSole && visibleSectionCount === 1) {
          el.hidden = true;
        } else {
          el.hidden = false;
        }
      }
    }
    applyAllFilters() {
      var _a, _b;
      const layout = this.w;
      const table = this.table;
      const tbody = table.querySelector("tbody");
      if (!tbody) return;
      this.tbody = tbody;
      const toolbarSearch = layout.querySelector("[data-cm-toolbar-search]") || ((_a = layout.closest(".cm-page-table-layout, .cm-dashboard-page, .cm-grid-view-spec")) == null ? void 0 : _a.querySelector("[data-cm-toolbar-search]")) || null;
      const localSearch = layout.querySelector("[data-cm-search]");
      const shell = this.table.closest(".cm-table-shell");
      const hasServerPagination = !!(shell == null ? void 0 : shell.querySelector(
        "[data-cm-table-pagination]"
      ));
      const toolbarSearchEl = asHTMLElement(toolbarSearch);
      const serverToolbarSearch = hasServerPagination && ((_b = toolbarSearchEl == null ? void 0 : toolbarSearchEl.dataset) == null ? void 0 : _b.cmSearchBackend) === "server";
      const globalQ = serverToolbarSearch ? "" : this._resolveToolbarQuery(toolbarSearch, localSearch);
      const globalActive = !!globalQ;
      const colFilters = collectColumnFiltersFromTable(this.table);
      const colKeys = Object.keys(colFilters);
      const hasColFilters = colKeys.length > 0;
      let clientFilters = {};
      try {
        const parsed = JSON.parse(this.table.dataset.cmClientFilters || "{}");
        if (isClientFilterState(parsed)) clientFilters = parsed;
      } catch (e) {
        clientFilters = {};
      }
      const clientFilterKeys = Object.keys(clientFilters).filter((key) => {
        const value = clientFilters[key];
        return Array.isArray(value) ? value.length > 0 : value !== "";
      });
      const searchColumns = collectSearchColumnsFromTable(this.table);
      let shown = 0;
      this.tbody.querySelectorAll(".cm-row").forEach((rowEl) => {
        if (!(rowEl instanceof HTMLTableRowElement)) return;
        const row = rowEl;
        let match = true;
        if (hasColFilters) {
          match = colKeys.every((key) => {
            const entry = parseColumnFilterEntry(colFilters[key]);
            if (!entry) return true;
            var esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(key) : key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
            const th = table.querySelector('th[data-cm-col-key="' + esc + '"]');
            const td = row.querySelector(
              'td[data-cm-col-key="' + esc + '"]'
            );
            const colMatch = headerFilterMatch(th);
            const profile = tokenProfileForHeader(th);
            const tokens = parseCellFilterTokens(td, colMatch);
            const cellText = this._cellTextForFilter(
              row,
              key,
              typeof entry === "string" ? entry : ""
            );
            return matchColumnFilterEntry(cellText, entry, {
              tokens,
              match: colMatch,
              profile
            });
          });
        }
        if (match && globalActive) {
          const cellsByKey = collectRowCellsByKeyFromDom(row);
          const rowCells = Object.values(cellsByKey);
          match = matchToolbarQuery(buildRowHaystackFromDom(row), globalQ, {
            cells: rowCells.length ? rowCells : collectRowCellValuesFromDom(row),
            cellsByKey,
            columns: searchColumns
          });
        }
        if (match && clientFilterKeys.length) {
          match = clientFilterKeys.every((key) => {
            var _a2, _b2, _c;
            const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(key) : key.replace(/\\/g, "\\\\").replace(/\"/g, '\\"');
            const cell = row.querySelector('td[data-cm-col-key="' + esc + '"]');
            const cellValue = (_c = (_b2 = cell == null ? void 0 : cell.dataset.cmExportRaw) != null ? _b2 : (_a2 = cell == null ? void 0 : cell.textContent) == null ? void 0 : _a2.trim()) != null ? _c : "";
            const selected = clientFilters[key];
            const values = Array.isArray(selected) ? selected : [selected];
            return values.includes(cellValue);
          });
        }
        if (match) {
          row.hidden = false;
          row.removeAttribute("hidden");
        } else {
          row.hidden = true;
        }
        if (match) shown++;
      });
      const filtered = globalActive || hasColFilters || clientFilterKeys.length > 0;
      this._syncSectionVisibility(colKeys, filtered);
      this._syncSectionTotals(filtered);
      this._syncTableEmptyState(shown, filtered);
      this._syncRecordCounters(shown);
      this._syncTableFooter(filtered);
      this.syncFilterChrome();
      this._syncGridViewCharts();
    }
    _syncRecordCounters(shownRows) {
      queryRecordCounters(this.table, this.w).forEach((counterEl) => {
        const counter = asHTMLElement(counterEl);
        if (!counter) return;
        const totalAttr = counter.dataset.cmCountTotal;
        if (totalAttr) {
          counter.textContent = String(shownRows) + "/" + totalAttr;
          return;
        }
        const field = counter.dataset.cmCountField;
        if (field) {
          let sum = 0;
          this.tbody.querySelectorAll(".cm-row:not([hidden])").forEach((rowEl) => {
            var _a, _b, _c;
            const row = asHTMLElement(rowEl);
            if (!row) return;
            const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(field) : field.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
            const cell = row.querySelector('td[data-cm-col-key="' + esc + '"]');
            const cellEl = asHTMLElement(cell);
            const raw = (_c = (_b = (_a = cellEl == null ? void 0 : cellEl.dataset.cmExportRaw) != null ? _a : cellEl == null ? void 0 : cellEl.dataset.cmSortVal) != null ? _b : cellEl == null ? void 0 : cellEl.textContent) != null ? _c : "";
            const parsed = parseFloat(String(raw).replace(/[^\d.-]/g, ""));
            if (!Number.isNaN(parsed)) sum += parsed;
          });
          counter.textContent = String(Math.round(sum) === sum ? sum : sum);
          return;
        }
        counter.textContent = String(shownRows);
      });
    }
    _syncTableFooter(active) {
      const tfoot = this.table.querySelector("tfoot");
      if (!(tfoot instanceof HTMLElement)) return;
      if (this._hasSectionGroups()) {
        const visibleSections = this.tbody.querySelectorAll(
          ".cm-row-section:not([hidden])"
        ).length;
        tfoot.hidden = active && visibleSections <= 1;
        if (tfoot.hidden) return;
      }
      tfoot.hidden = false;
      tfoot.querySelectorAll("td[data-cm-footer-aggregate][data-cm-col-key]").forEach((cellEl) => {
        const cell = asHTMLElement(cellEl);
        if (!cell) return;
        const key = cell.dataset.cmColKey;
        if (!key) return;
        if (!cell.dataset.cmFooterHtml) {
          cell.dataset.cmFooterHtml = cell.innerHTML;
        }
        if (!active) {
          cell.innerHTML = cell.dataset.cmFooterHtml;
          return;
        }
        let sum = 0;
        let hasNum = false;
        this.tbody.querySelectorAll(".cm-row:not([hidden])").forEach((rowEl) => {
          var _a, _b;
          const row = asHTMLElement(rowEl);
          if (!row) return;
          const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(key) : key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          const bodyCell = row.querySelector(
            'td[data-cm-col-key="' + esc + '"]'
          );
          const bodyCellEl = asHTMLElement(bodyCell);
          const raw = (_b = (_a = bodyCellEl == null ? void 0 : bodyCellEl.dataset.cmExportRaw) != null ? _a : bodyCellEl == null ? void 0 : bodyCellEl.dataset.cmSortVal) != null ? _b : "";
          const parsed = parseFloat(String(raw).replace(/[^\d.-]/g, ""));
          if (!Number.isNaN(parsed)) {
            sum += parsed;
            hasNum = true;
          }
        });
        if (!hasNum) {
          cell.textContent = "\u2014";
          return;
        }
        const base = cell.dataset.cmExportRaw || "";
        if (base.includes("\u20B4") || String(cell.textContent || "").includes("\u20B4")) {
          cell.textContent = sum.toLocaleString(void 0, { maximumFractionDigits: 2 }) + " \u20B4";
        } else {
          cell.textContent = String(Math.round(sum) === sum ? sum : sum);
        }
      });
    }
    _syncGridViewCharts() {
      var _a;
      if (!this.w.dataset.cmChartSource) return;
      if (!this.tbody.querySelector(".cm-row[data-cm-chart-row]")) return;
      const rows = [];
      this.tbody.querySelectorAll(".cm-row:not([hidden])").forEach((trEl) => {
        const tr = asHTMLElement(trEl);
        if (!tr) return;
        const raw = tr.dataset.cmChartRow;
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (isRowDict(parsed)) rows.push(parsed);
        } catch (e) {
        }
      });
      const scope = (_a = this.w.closest("[data-cm-grid-view-spec]")) != null ? _a : this.w;
      scope.querySelectorAll("[data-cm-chart-config]").forEach((node) => {
        const el = asHTMLElement(node);
        if (!el || el.dataset.cmChartInteractive) return;
        let config;
        try {
          const parsed = JSON.parse(el.dataset.cmChartConfig || "{}");
          if (!isChartRuntimeDict(parsed)) return;
          config = parsed;
        } catch (e) {
          return;
        }
        if (config.dataSource === "grid_filtered") return;
        ChartsBridge.refreshChartWrap(node, config, rows);
      });
    }
    _search(_text) {
      this.applyAllFilters();
    }
  };
  function initAllSimpleTables(root) {
    const scope = root && "querySelectorAll" in root ? root : document;
    const safe = (name, fn) => {
      try {
        fn();
      } catch (err) {
        console.error("[GridView] simple-table init failed: " + name, err);
      }
    };
    safe("initColumnFilters", () => initColumnFilters(scope));
    const settingsRoots = scope instanceof Element && scope.matches('[data-cm-column-settings="1"]') ? [scope, ...Array.from(scope.querySelectorAll('[data-cm-column-settings="1"]'))] : Array.from(scope.querySelectorAll('[data-cm-column-settings="1"]'));
    settingsRoots.forEach((shell) => {
      safe(
        "initSimpleTableColumnSettings",
        () => initSimpleTableColumnSettings(shell)
      );
    });
    safe("initSimpleTableColumnResize", () => initSimpleTableColumnResize(scope));
    safe("initTableCellUi", () => initTableCellUi(scope));
    safe("applyFiltersInScope", () => applyFiltersInScope(scope));
  }

  // src/grid-view/set-filter-panel.ts
  function formatValueCount(template, count) {
    return template.replace("%(count)s", String(count));
  }
  function requiredElement(root, selector, constructorFn) {
    const element = root.querySelector(selector);
    if (element instanceof constructorFn) return element;
    throw new Error("SetFilterPanel: missing " + selector);
  }
  function isPresetMode(value) {
    return value === "all" || value === "empty" || value === "non_empty";
  }
  var SetFilterPanel = class {
    constructor(options) {
      this.selectedValues = /* @__PURE__ */ new Set();
      this.allValues = [];
      this.valueCounts = /* @__PURE__ */ new Map();
      this.hasEmptyCells = false;
      this.emptyCount = 0;
      this.filterMode = "all";
      this.searchDrivenFilter = false;
      this.searchDebounceTimer = null;
      this.fieldId = options.fieldId;
      this.onChange = options.onChange || (() => {
      });
      this.loadValues = options.loadValues || (() => ({ values: [], hasEmpty: false, emptyCount: 0 }));
      const L = options.labels || {};
      this.labels = {
        listSearchPlaceholder: L.listSearchPlaceholder || i18n.t("filter.list_search", "Search\u2026"),
        valueCountLabel: L.valueCountLabel || i18n.t("filter.value_count", "%(count)s values"),
        selectAll: L.selectAll || i18n.t("filter.select_all", "All"),
        onlyEmpty: L.onlyEmpty || i18n.t("filter.only_empty", "Empty"),
        nonEmpty: L.nonEmpty || i18n.t("filter.non_empty", "Non-empty"),
        loadingValues: L.loadingValues || i18n.t("filter.loading_values", "Loading values\u2026"),
        noMatches: L.noMatches || i18n.t("filter.no_matches", "No matches"),
        emptyModeHint: L.emptyModeHint || i18n.t("filter.empty_mode_hint", "Showing rows with empty cells")
      };
      this.gui = document.createElement("div");
      this.gui.className = "cm-set-filter-panel";
      this.gui.innerHTML = '<div class="cm-set-filter-modes">' + this._modeCheckbox("all", this.labels.selectAll, true) + this._modeCheckbox("empty", this.labels.onlyEmpty, false) + this._modeCheckbox("non_empty", this.labels.nonEmpty, false) + '</div><div class="cm-set-filter-search-row"><input type="search" class="cm-col-filter-input cm-set-filter-list-search" autocomplete="off"><span class="cm-set-filter-value-count"></span></div><div class="cm-set-filter-list"></div>';
      this.listSearchInput = requiredElement(
        this.gui,
        ".cm-set-filter-list-search",
        HTMLInputElement
      );
      this.valueCountEl = requiredElement(this.gui, ".cm-set-filter-value-count", HTMLElement);
      this.listContainer = requiredElement(this.gui, ".cm-set-filter-list", HTMLElement);
      this.modeCheckboxes = Array.from(
        this.gui.querySelectorAll('input[type="checkbox"][data-cm-filter-mode]')
      );
      this.listSearchInput.placeholder = this.labels.listSearchPlaceholder;
      this.listSearchInput.addEventListener("input", () => {
        this.scheduleSearchFilterApply();
        this.updateValueCount();
        this.renderList();
      });
      this.listSearchInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          this.listSearchInput.value = "";
          this.applyListSearchToFilter();
          this.updateValueCount();
          this.renderList();
          this.onChange();
        }
      });
      this.gui.addEventListener("mousedown", (e) => e.stopPropagation());
      this.gui.addEventListener("click", (e) => e.stopPropagation());
      this.modeCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener("mousedown", (e) => e.stopPropagation());
        checkbox.addEventListener("click", (e) => e.stopPropagation());
        checkbox.addEventListener("change", (e) => {
          e.stopPropagation();
          const target = e.target;
          if (!(target instanceof HTMLInputElement) || !isPresetMode(target.value)) return;
          const mode = target.value;
          if (target.checked) {
            this.searchDrivenFilter = false;
            this.modeCheckboxes.forEach((cb) => {
              if (cb !== target) cb.checked = false;
            });
            this.setFilterMode(mode);
            this.updateValueCount();
            this.renderList();
            this.onChange();
            return;
          }
          this.clearPresetModes();
          this.searchDrivenFilter = false;
          if (mode === "all") {
            this.filterMode = "custom";
            this.selectedValues.clear();
          } else {
            this.filterMode = "custom";
          }
          this.updateValueCount();
          this.renderList();
          this.onChange();
        });
      });
    }
    _modeCheckbox(value, label, checked) {
      return '<label class="cm-set-filter-mode"><input type="checkbox" data-cm-filter-mode="1" value="' + value + '"' + (checked ? " checked" : "") + "><span>" + label + "</span></label>";
    }
    getGui() {
      return this.gui;
    }
    clearPresetModes() {
      this.modeCheckboxes.forEach((cb) => {
        cb.checked = false;
      });
    }
    setFilterMode(mode) {
      this.filterMode = mode;
      if (mode === "all" || mode === "non_empty") {
        this.selectAllNonEmptyValues();
      } else if (mode === "empty") {
        this.selectedValues.clear();
      }
      this.syncPresetModesFromState();
    }
    selectAllNonEmptyValues() {
      this.selectedValues.clear();
      this.allValues.forEach((v) => this.selectedValues.add(v));
    }
    syncPresetModesFromState() {
      this.modeCheckboxes.forEach((checkbox) => {
        checkbox.checked = this.filterMode !== "custom" && checkbox.value === this.filterMode;
      });
    }
    ingestScan(raw) {
      if (Array.isArray(raw)) {
        const emptyInValues = raw.filter(isEmptyCellValue).length;
        this.ingestRawValues(raw, emptyInValues > 0, emptyInValues);
        return;
      }
      this.ingestRawValues(raw.values, raw.hasEmpty, raw.emptyCount, raw.counts);
    }
    ingestRawValues(rawValues, hasEmpty, emptyCount = 0, counts) {
      this.valueCounts.clear();
      if (counts) {
        for (const key in counts) this.valueCounts.set(String(key).trim(), counts[key]);
      }
      this.hasEmptyCells = hasEmpty || rawValues.some(isEmptyCellValue);
      this.emptyCount = emptyCount || (this.hasEmptyCells ? 1 : 0);
      this.allValues = Array.from(
        new Set(
          rawValues.map((v) => String(v != null ? v : "").trim()).filter((v) => !isEmptyCellValue(v))
        )
      ).sort();
      this.updateValueCount();
    }
    updateValueCount() {
      const term = this.listSearchInput.value.trim();
      let count;
      if (this.filterMode === "empty") {
        count = this.emptyCount;
      } else if (this.filterMode === "non_empty") {
        count = this.allValues.length;
      } else if (term) {
        count = this.visibleValues().length;
      } else {
        count = this.allValues.length;
      }
      this.valueCountEl.textContent = String(count);
      this.valueCountEl.setAttribute(
        "aria-label",
        formatValueCount(this.labels.valueCountLabel, count)
      );
    }
    scheduleSearchFilterApply() {
      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.searchDebounceTimer = null;
        this.applyListSearchToFilter();
        this.onChange();
      }, 200);
    }
    applyListSearchToFilter() {
      const term = this.listSearchInput.value.toLowerCase().trim();
      if (!term) {
        if (this.searchDrivenFilter) {
          this.searchDrivenFilter = false;
          this.filterMode = "all";
          this.selectAllNonEmptyValues();
          this.syncPresetModesFromState();
        }
        return;
      }
      this.searchDrivenFilter = true;
      this.clearPresetModes();
      this.filterMode = "custom";
      this.selectedValues.clear();
      this.visibleValues().forEach((v) => this.selectedValues.add(v));
    }
    visibleValues() {
      const searchTerm = this.listSearchInput.value.toLowerCase().trim();
      return this.allValues.filter((v) => v.toLowerCase().includes(searchTerm));
    }
    async refreshValues() {
      this.listContainer.innerHTML = '<div class="cm-set-filter-message">' + this.labels.loadingValues + "</div>";
      const raw = await this.loadValues();
      this.ingestScan(raw);
      if (this.filterMode === "all" && this.selectedValues.size === 0) {
        this.selectAllNonEmptyValues();
      }
      this.renderList();
    }
    renderList() {
      this.listContainer.innerHTML = "";
      this.updateValueCount();
      if (this.filterMode === "empty") {
        this.listContainer.innerHTML = '<div class="cm-set-filter-message">' + this.labels.emptyModeHint + "</div>";
        return;
      }
      const filteredValues = this.visibleValues();
      filteredValues.sort((a, b) => {
        const aChecked = this.isValueChecked(a);
        const bChecked = this.isValueChecked(b);
        if (aChecked && !bChecked) return -1;
        if (!aChecked && bChecked) return 1;
        return a.localeCompare(b);
      });
      if (!filteredValues.length) {
        this.listContainer.innerHTML = '<div class="cm-set-filter-message">' + this.noMatchesLabel() + "</div>";
        return;
      }
      let hasChecked = false;
      let hasUnchecked = false;
      filteredValues.forEach((val) => {
        const isChecked = this.isValueChecked(val);
        if (isChecked) hasChecked = true;
        if (!isChecked && hasChecked && !hasUnchecked) {
          const separator = document.createElement("div");
          separator.className = "cm-set-filter-separator";
          this.listContainer.appendChild(separator);
          hasUnchecked = true;
        }
        const safeIdSuffix = btoa(encodeURIComponent(val)).replace(/[^a-zA-Z0-9]/g, "");
        const id = "filter-" + this.fieldId + "-" + safeIdSuffix;
        const item = document.createElement("label");
        item.className = "cm-set-filter-item";
        item.htmlFor = id;
        const count = this.valueCounts.get(val);
        const countHtml = count === void 0 ? "" : '<span class="cm-set-filter-item-count">' + String(count) + "</span>";
        item.innerHTML = '<input type="checkbox" id="' + id + '"' + (isChecked ? " checked" : "") + '><span class="cm-set-filter-item-label"></span>' + countHtml;
        const label = requiredElement(item, ".cm-set-filter-item-label", HTMLElement);
        label.textContent = val;
        const checkbox = requiredElement(item, "input", HTMLInputElement);
        checkbox.addEventListener("mousedown", (e) => e.stopPropagation());
        checkbox.addEventListener("click", (e) => e.stopPropagation());
        checkbox.addEventListener("change", (e) => {
          e.stopPropagation();
          const target = e.target;
          if (!(target instanceof HTMLInputElement)) return;
          this.clearPresetModes();
          this.searchDrivenFilter = false;
          this.filterMode = "custom";
          if (target.checked) this.selectedValues.add(val);
          else this.selectedValues.delete(val);
          this.onChange();
          this.renderList();
        });
        this.listContainer.appendChild(item);
      });
      this.syncPresetModesFromState();
    }
    isValueChecked(val) {
      if (this.filterMode === "non_empty") return true;
      if (this.filterMode === "empty") return false;
      return this.selectedValues.has(val);
    }
    noMatchesLabel() {
      return this.labels.noMatches;
    }
    isFilterActive() {
      if (this.filterMode === "empty" || this.filterMode === "non_empty") return true;
      if (this.filterMode === "custom") {
        if (this.selectedValues.size === 0) return true;
        return this.selectedValues.size !== this.allValues.length;
      }
      return false;
    }
    getModel(match = "exact") {
      if (!this.isFilterActive()) return null;
      if (this.filterMode === "empty") return { mode: "empty", match };
      if (this.filterMode === "non_empty") return { mode: "non_empty", match };
      if (this.selectedValues.size === 0) return { values: [], match };
      return { values: Array.from(this.selectedValues), match };
    }
    setModel(model) {
      this.searchDrivenFilter = false;
      this.listSearchInput.value = "";
      if (!model) {
        this.filterMode = "all";
        this.selectAllNonEmptyValues();
      } else if ("mode" in model && model.mode === "empty") {
        this.filterMode = "empty";
        this.selectedValues.clear();
      } else if ("mode" in model && model.mode === "non_empty") {
        this.filterMode = "non_empty";
        this.selectAllNonEmptyValues();
      } else if ("values" in model && Array.isArray(model.values)) {
        this.filterMode = "custom";
        this.selectedValues.clear();
        model.values.forEach((v) => {
          if (!isEmptyCellValue(v)) this.selectedValues.add(String(v).trim());
        });
      }
      this.syncPresetModesFromState();
      this.renderList();
    }
  };

  // src/grid-view/expr-filter-panel.ts
  function requiredInput(root, selector) {
    const el = root.querySelector(selector);
    if (el instanceof HTMLInputElement) return el;
    throw new Error("ExprFilterPanel: missing " + selector);
  }
  var ExprFilterPanel = class {
    constructor(options) {
      this.mode = "all";
      this.query = "";
      this.debounceTimer = null;
      var _a, _b;
      this.fieldId = options.fieldId;
      this.profile = (_a = options.profile) != null ? _a : "default" /* Default */;
      this.match = (_b = options.match) != null ? _b : "exact";
      this.onChange = options.onChange || (() => {
      });
      this.gui = document.createElement("div");
      this.gui.className = "cm-set-filter-panel cm-expr-filter-panel";
      this.gui.innerHTML = '<div class="cm-set-filter-modes">' + this._modeCheckbox("all", i18n.t("filter.select_all", "All"), true) + this._modeCheckbox("empty", i18n.t("filter.only_empty", "Empty"), false) + this._modeCheckbox("non_empty", i18n.t("filter.non_empty", "Non-empty"), false) + '</div><div class="cm-set-filter-search-row"><input type="search" class="cm-col-filter-input cm-expr-filter-input" autocomplete="off"></div>';
      this.exprInput = requiredInput(this.gui, ".cm-expr-filter-input");
      this.exprInput.placeholder = i18n.t(
        columnFilterPlaceholderKey(this.profile),
        i18n.t("column_filter.placeholder", "Search: >10, %name%")
      );
      this.modeCheckboxes = Array.from(
        this.gui.querySelectorAll('input[type="checkbox"][data-cm-filter-mode]')
      );
      this.gui.addEventListener("mousedown", (e) => e.stopPropagation());
      this.gui.addEventListener("click", (e) => e.stopPropagation());
      this.exprInput.addEventListener("input", () => {
        this.query = this.exprInput.value;
        if (this.query.trim()) {
          this.mode = "expr";
          this._clearModeCheckboxes();
        } else {
          this.mode = "all";
          this._syncAllChecked();
        }
        this._scheduleApply();
      });
      this.exprInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          this._cancelTimer();
          this.query = this.exprInput.value;
          if (this.query.trim()) {
            this.mode = "expr";
            this._clearModeCheckboxes();
          }
          this.onChange();
        } else if (e.key === "Escape") {
          e.preventDefault();
          this.exprInput.value = "";
          this.query = "";
          this.mode = "all";
          this._cancelTimer();
          this.onChange();
        }
      });
      this.modeCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener("mousedown", (e) => e.stopPropagation());
        checkbox.addEventListener("click", (e) => e.stopPropagation());
        checkbox.addEventListener("change", (e) => {
          e.stopPropagation();
          const target = e.target;
          if (!(target instanceof HTMLInputElement)) return;
          this._cancelTimer();
          this.query = "";
          this.exprInput.value = "";
          if (target.checked && (target.value === "empty" || target.value === "non_empty")) {
            this.mode = target.value;
            this.modeCheckboxes.forEach((cb) => {
              cb.checked = cb === target;
            });
          } else {
            this.mode = "all";
            this._syncAllChecked();
          }
          this.onChange();
        });
      });
    }
    _modeCheckbox(value, label, checked) {
      return '<label class="cm-set-filter-mode"><input type="checkbox" data-cm-filter-mode="1" value="' + value + '"' + (checked ? " checked" : "") + "><span>" + label + "</span></label>";
    }
    _clearModeCheckboxes() {
      this.modeCheckboxes.forEach((cb) => {
        cb.checked = false;
      });
    }
    /** Reflect "no filter" state — only the "All" checkbox is ticked. */
    _syncAllChecked() {
      this.modeCheckboxes.forEach((cb) => {
        cb.checked = cb.value === "all";
      });
    }
    _cancelTimer() {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    }
    _scheduleApply() {
      this._cancelTimer();
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.onChange();
      }, 200);
    }
    getGui() {
      return this.gui;
    }
    getModel() {
      if (this.mode === "empty") return { mode: "empty", match: this.match };
      if (this.mode === "non_empty") return { mode: "non_empty", match: this.match };
      const q = this.query.trim();
      return q ? q : null;
    }
    setModel(entry) {
      this._clearModeCheckboxes();
      if (!entry) {
        this.mode = "all";
        this.query = "";
        this.exprInput.value = "";
        this._syncAllChecked();
      } else if (typeof entry === "string") {
        this.mode = "expr";
        this.query = entry;
        this.exprInput.value = entry;
      } else if ("mode" in entry && (entry.mode === "empty" || entry.mode === "non_empty")) {
        const modeValue = entry.mode;
        this.mode = modeValue;
        this.query = "";
        this.exprInput.value = "";
        const cb = this.modeCheckboxes.find((c) => c.value === modeValue);
        if (cb) cb.checked = true;
      }
    }
    isFilterActive() {
      if (this.mode === "empty" || this.mode === "non_empty") return true;
      return !!this.query.trim();
    }
    focus() {
      window.setTimeout(() => {
        this.exprInput.focus();
        this.exprInput.select();
      }, 0);
    }
  };

  // src/grid-view/search/column-filter-dictionary.ts
  function scanTableColumnValues(table, colKey, match) {
    const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(colKey) : colKey.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const values = /* @__PURE__ */ new Set();
    let hasEmpty = false;
    let emptyCount = 0;
    table.querySelectorAll('td[data-cm-col-key="' + esc + '"]').forEach((el) => {
      if (el.dataset.cmFilterEmpty === "1") {
        hasEmpty = true;
        emptyCount += 1;
        return;
      }
      if (match === "any_token") {
        const raw = el.dataset.cmFilterTokens;
        if (raw !== void 0) {
          try {
            const tokens = JSON.parse(raw);
            if (Array.isArray(tokens)) {
              if (!tokens.length) {
                hasEmpty = true;
                emptyCount += 1;
                return;
              }
              let cellEmpty = true;
              tokens.forEach((t3) => {
                const text2 = String(t3 != null ? t3 : "").trim();
                if (isEmptyCellValue(text2)) return;
                cellEmpty = false;
                values.add(text2);
              });
              if (cellEmpty) {
                hasEmpty = true;
                emptyCount += 1;
              }
              return;
            }
          } catch (e) {
          }
        }
      }
      const sortVal = (el.dataset.cmSortVal || "").trim();
      const exportRaw = (el.dataset.cmExportRaw || "").trim();
      const text = (sortVal || exportRaw || el.textContent || "").trim();
      if (isEmptyCellValue(text)) {
        hasEmpty = true;
        emptyCount += 1;
      } else values.add(text);
    });
    return {
      values: Array.from(values).filter((v) => !isEmptyCellValue(v)).sort((a, b) => a.localeCompare(b)),
      hasEmpty,
      emptyCount
    };
  }

  // src/grid-view/column-filters.ts
  var activeSetPanel = null;
  var activeExprPanel = null;
  var exprFilterTimer = null;
  function exprRowForPortal(portal) {
    if (!portal) return null;
    const row = portal.querySelector(".cm-col-filter-expr-row");
    return row instanceof HTMLElement ? row : null;
  }
  function setExprRowVisible(portal, visible) {
    const row = exprRowForPortal(portal);
    if (!row) return;
    row.hidden = !visible;
    const inp = row.querySelector("[data-cm-col-filter-input]");
    if (inp instanceof HTMLElement) inp.hidden = !visible;
  }
  function gridIdForTable(table) {
    if (!table) return "";
    var shell = table.closest("[data-grid-id]");
    if (shell instanceof HTMLElement && shell.dataset.gridId) return shell.dataset.gridId;
    if (table.id && table.id.indexOf("cm-table-inner-") === 0) {
      return table.id.slice("cm-table-inner-".length);
    }
    return "";
  }
  function tableForPortal(portal) {
    var _a;
    if (!portal) return null;
    var gridId = portal instanceof HTMLElement ? portal.dataset.cmColFilterTable : "";
    if (gridId) {
      var shellTable = (_a = document.getElementById("cm-table-" + gridId)) == null ? void 0 : _a.querySelector("[data-cm-table]");
      if (shellTable instanceof HTMLTableElement) return shellTable;
      var inner = document.getElementById("cm-table-inner-" + gridId);
      if (inner instanceof HTMLTableElement && inner.matches("[data-cm-table]")) return inner;
    }
    var prev = portal.previousElementSibling;
    if (prev && prev.classList && prev.classList.contains("cm-table-viewport")) {
      var nested = prev.querySelector("[data-cm-table]");
      if (nested instanceof HTMLTableElement) return nested;
    }
    if (prev instanceof HTMLTableElement && prev.matches("[data-cm-table]")) return prev;
    return null;
  }
  function columnFilterPortalForTable(table) {
    if (!table) return null;
    var viewport = table.closest(".cm-table-viewport");
    var next = viewport ? viewport.nextElementSibling : table.nextElementSibling;
    if (next instanceof HTMLElement && next.matches("[data-cm-col-filter-portal]")) {
      return next;
    }
    var portal = document.createElement("div");
    portal.className = "cm-col-filter-portal is-hidden";
    portal.dataset.cmColFilterPortal = "1";
    portal.dataset.cmColFilterTable = gridIdForTable(table);
    portal.setAttribute("aria-hidden", "true");
    var setHost = document.createElement("div");
    setHost.className = "cm-col-filter-set-host";
    setHost.dataset.cmColFilterSetHost = "1";
    setHost.hidden = true;
    portal.appendChild(setHost);
    var exprRow = document.createElement("div");
    exprRow.className = "cm-col-filter-expr-row";
    var inp = document.createElement("input");
    inp.type = "search";
    inp.className = "cm-col-filter-input";
    inp.dataset.cmColFilterInput = "1";
    inp.autocomplete = "off";
    inp.placeholder = i18n.t("column_filter.placeholder", "Search: >10, %name%");
    exprRow.appendChild(inp);
    appendSearchSyntaxHelp(exprRow, "default" /* Default */);
    portal.appendChild(exprRow);
    if (viewport) {
      viewport.insertAdjacentElement("afterend", portal);
    } else {
      table.insertAdjacentElement("afterend", portal);
    }
    return portal;
  }
  function openPortal() {
    var portal = document.querySelector("[data-cm-col-filter-portal]:not(.is-hidden)");
    return portal instanceof HTMLElement ? portal : null;
  }
  function updateTableFilterUrl(anchorEl) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var shell = asHTMLElement((_a = tableFilterShell(anchorEl)) != null ? _a : null);
    var page = shell == null ? void 0 : shell.closest(".cm-page-table-layout, .cm-dashboard-page");
    var filterBar = page == null ? void 0 : page.querySelector("[data-cm-filter-bar]");
    var url = filterNavigateHref();
    if (filterBar) {
      var state = selectedFilterValues(filterBar);
      var toolbarSearch = (page == null ? void 0 : page.querySelector("[data-cm-toolbar-search]")) || document.getElementById(
        "cm-toolbar-search-" + (((_b = shell == null ? void 0 : shell.dataset) == null ? void 0 : _b.gridId) || ((_d = (_c = asHTMLElement(page)) == null ? void 0 : _c.dataset) == null ? void 0 : _d.gridId) || "")
      );
      if (toolbarSearch instanceof HTMLInputElement) {
        var qName = toolbarSearch.name || "q";
        var qVal = (toolbarSearch.value || "").trim();
        if (qVal) state[qName] = qVal;
        else state[qName] = "";
      }
      url = buildFilterUrl(window.location.href, state);
    }
    url = withActiveTableColumns(url, anchorEl || shell || void 0);
    window.history.replaceState({}, "", url);
    var gridId = (_e = shell == null ? void 0 : shell.dataset) == null ? void 0 : _e.gridId;
    (_h = (_g = (_f = getGlobal().GridView) == null ? void 0 : _f.AgGrid) == null ? void 0 : _g.syncExportLinks) == null ? void 0 : _h.call(_g, gridId || "");
  }
  function closeColumnFilterPortals() {
    var openPortals = document.querySelectorAll("[data-cm-col-filter-portal]:not(.is-hidden)");
    openPortals.forEach(function(portalEl) {
      flushExprFilterPortal(portalEl);
    });
    activeSetPanel = null;
    activeExprPanel = null;
    document.querySelectorAll("[data-cm-col-filter-portal]").forEach(function(portalEl) {
      const portal = asHTMLElement(portalEl);
      if (!portal) return;
      portal.classList.add("is-hidden");
      portal.classList.remove("is-set");
      portal.setAttribute("aria-hidden", "true");
      var setHost = asHTMLElement(portal.querySelector("[data-cm-col-filter-set-host]"));
      if (setHost) {
        setHost.innerHTML = "";
        setHost.hidden = true;
      }
      setExprRowVisible(portal, true);
    });
    document.querySelectorAll("[data-cm-col-filter-trigger].is-open").forEach(function(btn) {
      btn.classList.remove("is-open");
    });
  }
  function positionColumnFilterPortal(portal, anchorBtn, kind) {
    var th = anchorBtn.closest("th");
    var anchorRect = anchorBtn.getBoundingClientRect();
    var thRect = th instanceof HTMLElement ? th.getBoundingClientRect() : anchorRect;
    var width = kind === "set" ? 300 : Math.max(196, Math.min(thRect.width, 260));
    var left = anchorRect.left + anchorRect.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    portal.classList.toggle("is-set", kind === "set");
    portal.style.top = Math.round(anchorRect.bottom + 6) + "px";
    portal.style.left = Math.round(left) + "px";
    portal.style.width = width + "px";
  }
  function handleColumnFilterScroll(event) {
    var portal = openPortal();
    if (!portal) return;
    if (event.target instanceof Node && portal.contains(event.target)) return;
    var openBtn = document.querySelector("[data-cm-col-filter-trigger].is-open");
    if (openBtn instanceof HTMLElement) {
      var th = openBtn.closest("th");
      var kind = th ? headerFilterKind(th) : "expr";
      if (kind === "none") {
        closeColumnFilterPortals();
        return;
      }
      positionColumnFilterPortal(portal, openBtn, kind);
      return;
    }
    closeColumnFilterPortals();
  }
  function commitColumnFilterValue(table, colKey, value) {
    if (!table || !colKey) return;
    var esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(colKey) : colKey.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    var th = table.querySelector('th[data-cm-col-key="' + esc + '"]');
    if (!(th instanceof HTMLElement)) return;
    var val = String(value || "").trim();
    if (val) th.dataset.cmColFilterValue = val;
    else delete th.dataset.cmColFilterValue;
  }
  function applyColumnFilterState(table, anchorEl) {
    syncColumnFilterChrome(table);
    applyTableFilters(table);
    updateTableFilterUrl(anchorEl || table);
    document.dispatchEvent(new CustomEvent("cm-grid-state-change", { detail: { source: "column-filter" } }));
  }
  function navigateWithTableFilters(anchorEl) {
    var shell = tableFilterShell(anchorEl);
    var table = shell && shell.querySelector("[data-cm-table][data-cm-col-filters]");
    if (table) {
      applyColumnFilterState(table, anchorEl);
      return;
    }
    updateTableFilterUrl(anchorEl);
  }
  function activeFilterColKey(portalInput) {
    var openBtn = document.querySelector("[data-cm-col-filter-trigger].is-open");
    var th = openBtn && openBtn.closest("th");
    if (th instanceof HTMLElement && th.dataset.cmColKey) return th.dataset.cmColKey;
    if (portalInput && portalInput.dataset.cmColKey) return portalInput.dataset.cmColKey;
    return "";
  }
  function applyExprFilterFromPortal(portal, portalInput) {
    var table = tableForPortal(portal);
    if (!table) return;
    var colKey = activeFilterColKey(portalInput) || portalInput.dataset.cmColKey || "";
    if (!colKey) return;
    commitColumnFilterValue(table, colKey, portalInput.value);
    applyColumnFilterState(table, portalInput);
  }
  function scheduleExprFilterApply(portal, portalInput) {
    if (exprFilterTimer) clearTimeout(exprFilterTimer);
    exprFilterTimer = setTimeout(function() {
      exprFilterTimer = null;
      tryApplyExprFilterFromPortal(portal, portalInput);
    }, 150);
  }
  function tryApplyExprFilterFromPortal(portal, portalInput) {
    var _a;
    var openTh = (_a = document.querySelector("[data-cm-col-filter-trigger].is-open")) == null ? void 0 : _a.closest("th");
    if (!isExprFilterCommitReady(portalInput.value, openTh)) return;
    applyExprFilterFromPortal(portal, portalInput);
  }
  function flushExprFilterPortal(portal) {
    var _a;
    var portalInput = portal && portal.querySelector("[data-cm-col-filter-input]");
    if (!(portalInput instanceof HTMLInputElement) || portalInput.hidden) return;
    var openTh = (_a = document.querySelector("[data-cm-col-filter-trigger].is-open")) == null ? void 0 : _a.closest("th");
    if (headerFilterKind(openTh) === "set") return;
    if (!tableForPortal(portal)) return;
    if (exprFilterTimer) {
      clearTimeout(exprFilterTimer);
      exprFilterTimer = null;
    }
    tryApplyExprFilterFromPortal(portal, portalInput);
  }
  function openExprFilter(portal, th, table, btn) {
    const colKey = th.dataset.cmColKey || "";
    const match = headerFilterMatch(th);
    const profile = bindSearchProfileForHeader(th);
    const setHost = asHTMLElement(portal.querySelector("[data-cm-col-filter-set-host]"));
    if (!setHost) return;
    setExprRowVisible(portal, false);
    setHost.hidden = false;
    setHost.innerHTML = "";
    const panel = new ExprFilterPanel({
      fieldId: colKey,
      profile,
      match,
      onChange: function() {
        const model = panel.getModel();
        commitColumnFilterValue(table, colKey, model ? serializeColumnFilterEntry(model) : "");
        applyColumnFilterState(table, setHost);
      }
    });
    activeExprPanel = panel;
    setHost.appendChild(panel.getGui());
    const existing = parseColumnFilterEntry(th.dataset.cmColFilterValue || "");
    if (existing) panel.setModel(existing);
    positionColumnFilterPortal(portal, btn, "set");
    portal.classList.remove("is-hidden");
    portal.setAttribute("aria-hidden", "false");
    btn.classList.add("is-open");
    panel.focus();
  }
  function openSetFilter(portal, portalInput, th, table, _shell, btn) {
    var colKey = th.dataset.cmColKey || "";
    var match = headerFilterMatch(th);
    var setHost = portal.querySelector("[data-cm-col-filter-set-host]");
    if (!(setHost instanceof HTMLElement)) return;
    setExprRowVisible(portal, false);
    setHost.hidden = false;
    setHost.innerHTML = "";
    var panel = new SetFilterPanel({
      fieldId: colKey,
      onChange: function() {
        var model = panel.getModel(match);
        commitColumnFilterValue(table, colKey, model ? serializeColumnFilterEntry(model) : "");
        applyColumnFilterState(table, setHost);
      },
      loadValues: function() {
        return scanTableColumnValues(table, colKey, match);
      }
    });
    activeSetPanel = panel;
    setHost.appendChild(panel.getGui());
    var existing = parseColumnFilterEntry(th.dataset.cmColFilterValue || "");
    if (isSetFilterModel(existing)) {
      panel.setModel(existing);
    }
    positionColumnFilterPortal(portal, btn, "set");
    portal.classList.remove("is-hidden");
    portal.setAttribute("aria-hidden", "false");
    btn.classList.add("is-open");
    void panel.refreshValues();
  }
  function shouldDismissColumnFilter(target) {
    if (!openPortal()) return false;
    if (!(target instanceof Node)) return true;
    var portal = openPortal();
    if (portal && portal.contains(target)) return false;
    if (target instanceof Element && target.closest("[data-cm-col-filter-trigger], [data-cm-col-filter-clear]")) {
      return false;
    }
    return true;
  }
  function bindGlobalColumnFilterHandlers() {
    if (getGlobal()._cmColFilterInputBound) return;
    getGlobal()._cmColFilterInputBound = true;
    document.addEventListener("input", function(e) {
      var _a;
      var target = e.target;
      if (!(target instanceof HTMLInputElement) || !target.matches("[data-cm-col-filter-input]")) return;
      var portal = target.closest("[data-cm-col-filter-portal]");
      if (!portal || portal.classList.contains("is-hidden") || target.hidden) return;
      var openTh = (_a = document.querySelector("[data-cm-col-filter-trigger].is-open")) == null ? void 0 : _a.closest("th");
      if (headerFilterKind(openTh) === "set") return;
      scheduleExprFilterApply(portal, target);
    });
    document.addEventListener("keydown", function(e) {
      var target = e.target;
      if (!(target instanceof HTMLInputElement) || !target.matches("[data-cm-col-filter-input]")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeColumnFilterPortals();
        return;
      }
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (exprFilterTimer) {
        clearTimeout(exprFilterTimer);
        exprFilterTimer = null;
      }
      var portal = target.closest("[data-cm-col-filter-portal]");
      tryApplyExprFilterFromPortal(portal, target);
      closeColumnFilterPortals();
    });
  }
  function bindGlobalDismissHandlers() {
    if (getGlobal()._cmColFilterDismissBound) return;
    getGlobal()._cmColFilterDismissBound = true;
    document.addEventListener(
      "mousedown",
      function(e) {
        if (!shouldDismissColumnFilter(e.target)) return;
        closeColumnFilterPortals();
      },
      true
    );
    window.addEventListener("resize", closeColumnFilterPortals);
    window.addEventListener("scroll", handleColumnFilterScroll, true);
  }
  function initColumnFilters(scope) {
    bindGlobalColumnFilterHandlers();
    bindGlobalDismissHandlers();
    var root = scope && "querySelectorAll" in scope ? scope : document;
    root.querySelectorAll("[data-cm-table][data-cm-col-filters]").forEach(function(tableEl) {
      var _a, _b, _c, _d;
      if (!(tableEl instanceof HTMLTableElement)) return;
      if (!tableEl.matches("[data-cm-table][data-cm-col-filters]")) return;
      const table = tableEl;
      if (table.dataset.cmColFiltersBound) return;
      table.dataset.cmColFiltersBound = "1";
      ensureSimpleTableForTable(table);
      var shell = tableFilterShell(table) || table;
      var gridId = gridIdForTable(table);
      var portal = columnFilterPortalForTable(table);
      if (portal && gridId && !portal.dataset.cmColFilterTable) {
        portal.dataset.cmColFilterTable = gridId;
      }
      var portalInput = asHtmlInput(portal == null ? void 0 : portal.querySelector("[data-cm-col-filter-input]"));
      if (!portal || !portalInput) return;
      const boundPortalInput = portalInput;
      var urlFilters = parseColumnFiltersFromUrl();
      table.querySelectorAll("th[data-cm-col-key]").forEach(function(thEl) {
        if (!(thEl instanceof HTMLElement)) return;
        var key = thEl.dataset.cmColKey;
        const filterVal = key ? urlFilters[key] : void 0;
        if (key && filterVal) {
          thEl.dataset.cmColFilterValue = Array.isArray(filterVal) ? filterVal.join(",") : filterVal;
        }
      });
      syncColumnFilterChrome(table);
      table.querySelectorAll("[data-cm-col-filter-clear]").forEach(function(btnEl) {
        const btn = asHTMLElement(btnEl);
        if (!btn) return;
        if (btn.dataset.cmColFilterClearBound) return;
        btn.dataset.cmColFilterClearBound = "1";
        btn.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();
          var th = btn.closest("th");
          var colKey = th instanceof HTMLElement ? th.dataset.cmColKey : "";
          if (!colKey) return;
          closeColumnFilterPortals();
          commitColumnFilterValue(table, colKey, "");
          applyColumnFilterState(table, btn);
        });
      });
      table.querySelectorAll("[data-cm-col-filter-trigger]").forEach(function(btnEl) {
        const btn = asHTMLElement(btnEl);
        if (!btn) return;
        if (btn.dataset.cmColFilterTriggerBound) return;
        btn.dataset.cmColFilterTriggerBound = "1";
        btn.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (!portal) return;
          var th = btn.closest("th");
          if (!(th instanceof HTMLElement)) return;
          var colKey = th.dataset.cmColKey;
          if (!colKey) return;
          var reopen = btn.classList.contains("is-open");
          closeColumnFilterPortals();
          if (reopen) return;
          if (headerFilterKind(th) === "set") {
            openSetFilter(portal, boundPortalInput, th, table, shell, btn);
          } else {
            openExprFilter(portal, th, table, btn);
          }
        });
      });
      if (Object.keys(urlFilters).length) {
        applyTableFilters(table);
      }
      var shellGridId = ((_a = asHTMLElement(shell)) == null ? void 0 : _a.dataset.gridId) || "";
      (_d = (_c = (_b = getGlobal().GridView) == null ? void 0 : _b.AgGrid) == null ? void 0 : _c.syncExportLinks) == null ? void 0 : _d.call(_c, shellGridId);
    });
  }

  // src/grid-view/toolbar-search-input.ts
  function cssEscapeId(id) {
    return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  function resolveToolbarSearchInput(gridId) {
    if (!gridId) return null;
    const legacy = document.getElementById("ag-quick-filter-" + gridId);
    if (legacy instanceof HTMLInputElement) return legacy;
    const esc = cssEscapeId(gridId);
    const toolbarRoot = document.querySelector(
      '[data-cm-toolbar-search-root][data-cm-table-grid-id="' + esc + '"]'
    );
    const toolbarSearch = toolbarRoot == null ? void 0 : toolbarRoot.querySelector("[data-cm-toolbar-search]");
    if (toolbarSearch) return toolbarSearch;
    const wrapper = document.querySelector('[data-grid-id="' + esc + '"]');
    const localSearch = wrapper == null ? void 0 : wrapper.querySelector("[data-cm-search]");
    return localSearch != null ? localSearch : null;
  }
  function resolveToolbarSearchInputForCtx(root, scope) {
    const tableGridId2 = root.dataset.cmTableGridId || scope;
    const bound = resolveToolbarSearchInput(tableGridId2);
    if (bound) return bound;
    const local = document.getElementById("cm-toolbar-search-" + scope);
    if (local instanceof HTMLInputElement) return local;
    const fromRoot = root.querySelector("[data-cm-toolbar-search]");
    return fromRoot != null ? fromRoot : null;
  }

  // src/page-state/page-state.ts
  var ROOT_SELECTOR = "[data-cm-grid-view-spec]";
  var STORAGE_PREFIX = "cmGridViewPageState:v1:";
  var VERSION = 1;
  var FORBIDDEN_OBJECT_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  var INVALID_JSON_VALUE = Symbol("invalid-json-value");
  function isSafeKey(key) {
    return !FORBIDDEN_OBJECT_KEYS.has(key);
  }
  function isRecord3(value) {
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
      if (!isRecord3(parsed)) return null;
      const envelope = parsed;
      if (envelope.version !== VERSION) return null;
      const namespaces = envelope.namespaces;
      if (!isRecord3(namespaces)) return null;
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

  // src/grid-view/filter-drawer.ts
  function drawerState(value) {
    if (!isRecord(value)) return null;
    if (typeof value.collapsed !== "boolean" || typeof value.width !== "number") return null;
    if (!Number.isFinite(value.width)) return null;
    return {
      collapsed: value.collapsed,
      width: value.width,
      activePanel: value.activePanel === "settings" ? "settings" : "filters"
    };
  }
  function bindLegacyDrawerSearch(drawer) {
    const search = drawer.querySelector("[data-cm-filter-drawer-search]");
    search == null ? void 0 : search.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase();
      drawer.querySelectorAll("[data-cm-filter-search-item]").forEach((item) => {
        var _a;
        const label = (item.dataset.placeholder || ((_a = item.querySelector(".cm-filter-field__label, .cm-filter-grouped-select__label")) == null ? void 0 : _a.textContent) || "").toLocaleLowerCase();
        const matchesLabel = !query || label.includes(query);
        let hasMatchingOption = false;
        item.querySelectorAll(".cm-multiselect-option").forEach((option) => {
          var _a2;
          const matchesOption = !query || matchesLabel || ((_a2 = option.textContent) == null ? void 0 : _a2.toLocaleLowerCase().includes(query));
          option.hidden = !matchesOption;
          hasMatchingOption || (hasMatchingOption = !!matchesOption);
        });
        if (!hasMatchingOption) {
          hasMatchingOption = Array.from(item.querySelectorAll("option")).some(
            (option) => {
              var _a2;
              return !query || matchesLabel || ((_a2 = option.textContent) == null ? void 0 : _a2.toLocaleLowerCase().includes(query));
            }
          );
        }
        const visible = matchesLabel || hasMatchingOption;
        item.hidden = !visible;
        item.querySelectorAll(".cm-multiselect-panel").forEach((panel) => {
          if (!query) {
            panel.classList.toggle("is-open", panel.dataset.cmDrawerSearchWasOpen === "1");
            delete panel.dataset.cmDrawerSearchWasOpen;
            return;
          }
          if (panel.dataset.cmDrawerSearchWasOpen === void 0) {
            panel.dataset.cmDrawerSearchWasOpen = panel.classList.contains("is-open") ? "1" : "0";
          }
          panel.classList.toggle("is-open", visible);
        });
      });
    });
  }
  function mountDrawerSettingsForGrid(gridId) {
    const grid = byId.get(gridId);
    if (!grid) return;
    document.querySelectorAll("[data-cm-filter-drawer-settings]").forEach((container) => {
      var _a;
      if (container.dataset.cmGridId === gridId) (_a = grid.mountColumnSettings) == null ? void 0 : _a.call(grid, container);
    });
  }
  function gridIdFromReadyEvent(event) {
    if (!(event instanceof CustomEvent)) return null;
    const detail = event.detail;
    if (typeof detail !== "object" || detail === null) return null;
    const gridId = Reflect.get(detail, "gridId");
    return typeof gridId === "string" ? gridId : null;
  }
  var gridReadyMountBound = false;
  function installGridReadySettingsMount() {
    if (gridReadyMountBound) return;
    gridReadyMountBound = true;
    document.addEventListener("cm-grid-ready", (event) => {
      const gridId = gridIdFromReadyEvent(event);
      if (gridId) mountDrawerSettingsForGrid(gridId);
    });
  }
  function bindFilterDrawer(drawer) {
    var _a, _b, _c;
    if (drawer.dataset.cmFilterDrawerBound) return;
    drawer.dataset.cmFilterDrawerBound = "1";
    const drawerId = drawer.dataset.cmFilterDrawerId || drawer.id;
    if (!drawerId) return;
    const pageState = PageState.forRoot(drawer);
    const namespace = `filters.${drawerId}.drawer`;
    const restored = drawerState(pageState == null ? void 0 : pageState.get(namespace));
    let state = {
      collapsed: (_a = restored == null ? void 0 : restored.collapsed) != null ? _a : false,
      width: Math.max(240, Math.min(520, Math.round((_b = restored == null ? void 0 : restored.width) != null ? _b : 320))),
      activePanel: (_c = restored == null ? void 0 : restored.activePanel) != null ? _c : "filters"
    };
    const mountSettings = () => {
      drawer.querySelectorAll("[data-cm-filter-drawer-settings]").forEach((container) => {
        const grid = byId.get(container.dataset.cmGridId || "");
        if (grid && typeof grid.mountColumnSettings === "function") {
          grid.mountColumnSettings(container);
        }
      });
    };
    const persist = () => pageState == null ? void 0 : pageState.put(namespace, {
      collapsed: state.collapsed,
      width: state.width,
      activePanel: state.activePanel
    });
    const apply = () => {
      var _a2;
      drawer.classList.toggle("is-collapsed", state.collapsed);
      drawer.style.setProperty("--cm-filter-drawer-width", `${state.width}px`);
      drawer.querySelectorAll("[data-cm-filter-drawer-open]").forEach((button) => {
        button.setAttribute("aria-expanded", String(!state.collapsed));
      });
      (_a2 = drawer.querySelector("[data-cm-filter-drawer-resize]")) == null ? void 0 : _a2.setAttribute("aria-valuenow", String(state.width));
      drawer.querySelectorAll("[data-cm-filter-drawer-tab]").forEach((tab) => {
        const active = tab.dataset.cmFilterDrawerTab === state.activePanel;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      drawer.querySelectorAll("[data-cm-filter-drawer-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.cmFilterDrawerPanel !== state.activePanel;
      });
      if (state.activePanel === "settings") mountSettings();
    };
    const setCollapsed = (collapsed) => {
      var _a2;
      state = { ...state, collapsed };
      apply();
      persist();
      (_a2 = drawer.querySelector(collapsed ? "[data-cm-filter-drawer-open]" : "[data-cm-filter-drawer-close]")) == null ? void 0 : _a2.focus();
    };
    drawer.querySelectorAll("[data-cm-filter-drawer-open]").forEach((button) => {
      button.addEventListener("click", () => setCollapsed(false));
    });
    drawer.querySelectorAll("[data-cm-filter-drawer-close]").forEach((button) => {
      button.addEventListener("click", () => setCollapsed(true));
    });
    drawer.querySelectorAll("[data-cm-filter-drawer-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const activePanel = tab.dataset.cmFilterDrawerTab === "settings" ? "settings" : "filters";
        if (!drawer.querySelector(`[data-cm-filter-drawer-panel="${activePanel}"]`)) return;
        state = { ...state, collapsed: false, activePanel };
        apply();
        persist();
      });
    });
    bindLegacyDrawerSearch(drawer);
    const resize = drawer.querySelector("[data-cm-filter-drawer-resize]");
    const setWidth = (width) => {
      state = { ...state, collapsed: false, width: Math.max(240, Math.min(520, Math.round(width))) };
      apply();
      persist();
    };
    resize == null ? void 0 : resize.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = state.width;
      const onMove = (move) => setWidth(startWidth + move.clientX - startX);
      const onEnd = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd, { once: true });
      window.addEventListener("pointercancel", onEnd, { once: true });
    });
    resize == null ? void 0 : resize.addEventListener("keydown", (event) => {
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
  function initFilterDrawers(scope) {
    installGridReadySettingsMount();
    const drawers = Array.from(scope.querySelectorAll("[data-cm-filter-drawer]"));
    if (scope instanceof HTMLElement && scope.matches("[data-cm-filter-drawer]")) drawers.unshift(scope);
    drawers.forEach(bindFilterDrawer);
  }

  // src/grid-view/filter-bar.ts
  var MS_VALUE_CHECKBOX = 'input[type="checkbox"]:checked:not([data-ui-only])';
  var MS_COUNTABLE = 'input[type="checkbox"]:not([data-period-all]):not([data-select-all]):not([data-ui-only]):not([data-exclusive-solo])';
  var MULTISELECT_CHANGE_DEBOUNCE_MS = 650;
  var multiselectChangeTimers = /* @__PURE__ */ new WeakMap();
  var multiselectPanelToRestore = null;
  var filterHistoryBound = false;
  var latestFilterNavigationUrl = "";
  var facetRefreshGeneration = 0;
  var activeFacetRefreshController = null;
  function setMultiselectTriggerLabel(root, text) {
    const trigger = root.querySelector(".cm-multiselect-trigger");
    if (!trigger) return;
    const label = trigger.querySelector(".cm-multiselect-trigger__label");
    if (label) label.textContent = text;
    else trigger.textContent = text;
  }
  function selectedFilterValues(root) {
    const state = {};
    root.querySelectorAll("[data-cm-multiselect]").forEach((msEl) => {
      const ms = asHTMLElement(msEl);
      if (!ms) return;
      const param = ms.dataset.filterParam || ms.dataset.filterId || "period";
      const vals = Array.from(ms.querySelectorAll(MS_VALUE_CHECKBOX)).map((cb) => cb.value);
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
      const vals = periodFilter && typeof periodFilter.selectedValues === "function" ? periodFilter.selectedValues(ms) : [];
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
    const groupedValues = /* @__PURE__ */ new Map();
    root.querySelectorAll("select[data-cm-grouped-select]").forEach((select) => {
      var _a;
      const param = select.name || ((_a = select.closest("[data-filter-id]")) == null ? void 0 : _a.dataset.filterParam);
      if (!param) return;
      const selected = groupedValues.get(param) || [];
      if (select.value) selected.push(select.value);
      groupedValues.set(param, selected);
    });
    groupedValues.forEach((values, param) => {
      state[param] = values;
    });
    root.querySelectorAll("[data-cm-filter-input]").forEach((input) => {
      const field = asHTMLElement(input.closest("[data-filter-id]"));
      const param = (field == null ? void 0 : field.dataset.filterParam) || (field == null ? void 0 : field.dataset.filterId) || input.name;
      if (!param) return;
      state[param] = input.type === "checkbox" ? input.checked ? input.value || "1" : "" : input.value;
    });
    const search = asHtmlInput(root.querySelector("[data-cm-search]"));
    if (search && search.name) state[search.name] = search.value;
    return state;
  }
  function _updateMultiSelectLabel(ms) {
    const placeholder = ms.dataset.placeholder || i18n.t("multiselect.select", "Select");
    const allLabel = ms.dataset.allLabel || placeholder;
    const total = ms.querySelectorAll(MS_COUNTABLE).length;
    const periodAll = ms.querySelector("[data-period-all]");
    if (periodAll == null ? void 0 : periodAll.checked) {
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
    const valueChecked = Array.from(ms.querySelectorAll(MS_VALUE_CHECKBOX));
    if (valueChecked.length === 1) {
      setMultiselectTriggerLabel(ms, valueChecked[0].dataset.label || valueChecked[0].value);
      return;
    }
    setMultiselectTriggerLabel(
      ms,
      valueChecked.map((cb) => cb.dataset.label || cb.value).join(", ")
    );
  }
  function applyFilterValues(root, state) {
    if (!root || !state) return;
    Object.entries(state).forEach(([param, val]) => {
      const values = Array.isArray(val) ? val.map(String) : String(val).split(",").map((v) => v.trim()).filter(Boolean);
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
      root.querySelectorAll("[data-cm-filter-input]").forEach((input) => {
        const field = asHTMLElement(input.closest("[data-filter-id]"));
        const fieldParam = (field == null ? void 0 : field.dataset.filterParam) || (field == null ? void 0 : field.dataset.filterId) || input.name;
        if (fieldParam !== param) return;
        if (input.type === "checkbox") input.checked = values.includes(input.value || "1");
        else input.value = Array.isArray(val) ? String(val[0] || "") : String(val != null ? val : "");
      });
    });
    root.querySelectorAll("select[data-cm-grouped-select]").forEach((select) => {
      var _a;
      const param = select.name || ((_a = select.closest("[data-filter-id]")) == null ? void 0 : _a.dataset.filterParam);
      if (!param) return;
      const rawValue = state[param];
      const values = Array.isArray(rawValue) ? rawValue.map(String) : String(rawValue || "").split(",").map((value) => value.trim()).filter(Boolean);
      const selected = Array.from(select.options).find(
        (option) => !option.disabled && values.includes(option.value)
      );
      const fallback2 = Array.from(select.options).find((option) => !option.disabled);
      select.value = (selected == null ? void 0 : selected.value) || (fallback2 == null ? void 0 : fallback2.value) || "";
    });
  }
  function filterNavigateHref() {
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/\/fragment\/?$/, "/");
    return url.href;
  }
  function resolveToolbarGridId(anchor) {
    var _a, _b, _c, _d;
    const anchorEl = asHTMLElement(anchor);
    const directGridId = anchorEl == null ? void 0 : anchorEl.getAttribute("data-cm-grid-id");
    if (directGridId) return directGridId;
    const drawerTarget = (_a = asHTMLElement(anchorEl == null ? void 0 : anchorEl.closest(".cm-filters"))) == null ? void 0 : _a.dataset.target;
    if (drawerTarget) return drawerTarget;
    const root = asHTMLElement(anchorEl == null ? void 0 : anchorEl.closest("[data-cm-toolbar-search-root]")) || asHTMLElement((_b = anchorEl == null ? void 0 : anchorEl.closest(".cm-toolbar-unified")) == null ? void 0 : _b.querySelector("[data-cm-toolbar-search-root]"));
    return ((_c = root == null ? void 0 : root.dataset) == null ? void 0 : _c.cmTableGridId) || ((_d = root == null ? void 0 : root.dataset) == null ? void 0 : _d.cmPrefGridId) || "";
  }
  function tableFragmentConfig(gridId, bar) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!gridId) return null;
    const barEl = bar instanceof HTMLElement ? bar : (_a = bar == null ? void 0 : bar.closest) == null ? void 0 : _a.call(bar, "[data-cm-filter-bar]");
    const b = barEl;
    const shell = document.getElementById("cm-table-" + gridId);
    const endpoint = ((_b = b == null ? void 0 : b.dataset) == null ? void 0 : _b.cmFragmentEndpoint) || ((_c = shell == null ? void 0 : shell.dataset) == null ? void 0 : _c.cmFragmentEndpoint) || "";
    if (!endpoint) return null;
    return {
      endpoint,
      target: ((_d = b == null ? void 0 : b.dataset) == null ? void 0 : _d.cmFragmentTarget) || ((_e = shell == null ? void 0 : shell.dataset) == null ? void 0 : _e.cmFragmentTarget) || "#block-" + gridId,
      swap: ((_f = b == null ? void 0 : b.dataset) == null ? void 0 : _f.cmFragmentSwap) || ((_g = shell == null ? void 0 : shell.dataset) == null ? void 0 : _g.cmFragmentSwap) || "outerHTML",
      gridId
    };
  }
  function buildFragmentRequestUrl(fragmentEndpoint, pagePathAndQuery) {
    const page = new URL(pagePathAndQuery, window.location.origin);
    const frag = new URL(fragmentEndpoint, window.location.origin);
    frag.search = page.search;
    return frag.pathname + frag.search;
  }
  function specWantsFacets(ref) {
    var _a;
    const el = asHTMLElement(ref);
    if (!el) return false;
    if ((_a = el.matches) == null ? void 0 : _a.call(el, "[data-cm-filter-bar][data-cm-facets]")) return true;
    const spec = el.closest("[data-cm-grid-view-spec]");
    if (spec == null ? void 0 : spec.querySelector("[data-cm-filter-bar][data-cm-facets]")) return true;
    return !!el.closest("[data-cm-filter-bar][data-cm-facets]");
  }
  function usesInPlaceFacets(bar) {
    return (bar == null ? void 0 : bar.dataset.cmFacets) === "1" && bar.dataset.cmFacetsRefreshMode === "in_place";
  }
  function filterControlRoots(bar) {
    const roots = /* @__PURE__ */ new Map();
    bar.querySelectorAll("[data-filter-id]").forEach((element) => {
      var _a;
      const parent = (_a = element.parentElement) == null ? void 0 : _a.closest("[data-filter-id]");
      if (parent && bar.contains(parent)) return;
      const id = element.dataset.filterId || "";
      if (!id || roots.has(id)) throw new Error("Facet response has an ambiguous filter control");
      roots.set(id, element);
    });
    return roots;
  }
  function syncAttribute(target, source, name) {
    const value = source.getAttribute(name);
    if (value === null) target.removeAttribute(name);
    else target.setAttribute(name, value);
  }
  function syncMultiselectAttributes(target, source) {
    [
      "data-filter-scope",
      "data-filter-param",
      "data-filter-type",
      "data-placeholder",
      "data-all-label",
      "data-select-all-option",
      "data-select-all-value",
      "data-exclusive-all",
      "data-cm-singleselect"
    ].forEach((name) => syncAttribute(target, source, name));
  }
  function prepareTreeOptionUpdates(currentRoot, nextRoot, operations) {
    const currentNodes = Array.from(
      currentRoot.querySelectorAll("[data-cm-filter-tree-node]")
    );
    const nextNodes = Array.from(nextRoot.querySelectorAll("[data-cm-filter-tree-node]"));
    if (!currentNodes.length && !nextNodes.length) return false;
    if (currentNodes.length !== nextNodes.length) {
      throw new Error("Facet response changes the tree control structure");
    }
    currentNodes.forEach((currentNode, index) => {
      const nextNode = nextNodes[index];
      const currentValue = currentNode.dataset.cmFilterTreeValue || "";
      const nextValue = nextNode.dataset.cmFilterTreeValue || "";
      if (currentValue !== nextValue || (currentNode.dataset.cmFilterTreeParent || "") !== (nextNode.dataset.cmFilterTreeParent || "")) {
        throw new Error("Facet response changes the tree control structure");
      }
      const currentInput = currentNode.querySelector('input[type="checkbox"]');
      const nextInput = nextNode.querySelector('input[type="checkbox"]');
      if (!currentInput || !nextInput || currentInput.value !== nextInput.value) {
        throw new Error("Facet response has a mismatched tree option");
      }
      const currentLabel = currentNode.querySelector(".cm-filter-drawer-option-label");
      const nextLabel = nextNode.querySelector(".cm-filter-drawer-option-label");
      const currentCount = currentNode.querySelector(".cm-filter-drawer-option-count");
      const nextCount = nextNode.querySelector(".cm-filter-drawer-option-count");
      const currentToggle = currentNode.querySelector("[data-cm-filter-tree-toggle]");
      const nextToggle = nextNode.querySelector("[data-cm-filter-tree-toggle]");
      const labelText = (nextLabel == null ? void 0 : nextLabel.textContent) || "";
      const countText = nextCount == null ? void 0 : nextCount.textContent;
      const checked = nextInput.checked;
      const disabled = nextInput.disabled;
      const facetCount = nextInput.dataset.cmFacetCount;
      const optionLabel = nextInput.dataset.label || "";
      const exclusive = nextInput.dataset.exclusiveSolo;
      const toggleLabel = nextToggle == null ? void 0 : nextToggle.getAttribute("aria-label");
      operations.push(() => {
        currentNode.classList.toggle(
          "cm-filter-drawer-option--disabled",
          nextNode.classList.contains("cm-filter-drawer-option--disabled")
        );
        currentInput.checked = checked;
        currentInput.disabled = disabled;
        currentInput.dataset.label = optionLabel;
        if (facetCount === void 0) delete currentInput.dataset.cmFacetCount;
        else currentInput.dataset.cmFacetCount = facetCount;
        if (exclusive === void 0) delete currentInput.dataset.exclusiveSolo;
        else currentInput.dataset.exclusiveSolo = exclusive;
        if (currentLabel && nextLabel) currentLabel.textContent = labelText;
        if (countText === void 0) {
          currentCount == null ? void 0 : currentCount.remove();
        } else if (currentCount) {
          currentCount.textContent = countText;
        } else {
          const count = document.createElement("span");
          count.className = "cm-filter-drawer-option-count";
          count.textContent = countText;
          currentNode.append(count);
        }
        if (currentToggle && toggleLabel !== null && toggleLabel !== void 0) {
          currentToggle.setAttribute("aria-label", toggleLabel);
        }
      });
    });
    return true;
  }
  function prepareMultiselectUpdate(currentRoot, nextRoot, operations) {
    const currentPanel = currentRoot.querySelector(".cm-multiselect-panel");
    const nextPanel = nextRoot.querySelector(".cm-multiselect-panel");
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
    const emptyPanel = (nextPanel == null ? void 0 : nextPanel.classList.contains("cm-multiselect-panel--empty")) || false;
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
  function prepareFilterControlUpdate(currentRoot, nextRoot, operations) {
    if (currentRoot.dataset.filterId !== nextRoot.dataset.filterId || currentRoot.dataset.filterType !== nextRoot.dataset.filterType || currentRoot.dataset.filterParam !== nextRoot.dataset.filterParam || currentRoot.dataset.filterScope !== nextRoot.dataset.filterScope) {
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
    const currentSelects = Array.from(currentRoot.querySelectorAll("select"));
    const nextSelects = Array.from(nextRoot.querySelectorAll("select"));
    const currentInputs = Array.from(currentRoot.querySelectorAll("input"));
    const nextInputs = Array.from(nextRoot.querySelectorAll("input"));
    const currentTextareas = Array.from(currentRoot.querySelectorAll("textarea"));
    const nextTextareas = Array.from(nextRoot.querySelectorAll("textarea"));
    if (currentSelects.length !== nextSelects.length || currentInputs.length !== nextInputs.length || currentTextareas.length !== nextTextareas.length) {
      throw new Error("Facet response changes the filter control structure");
    }
    currentSelects.forEach((currentSelect, index) => {
      const nextSelect = nextSelects[index];
      if (currentSelect.name !== nextSelect.name || currentSelect.multiple !== nextSelect.multiple || currentSelect.hasAttribute("data-cm-grouped-select") !== nextSelect.hasAttribute("data-cm-grouped-select")) {
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
      if (currentInput.type !== nextInput.type || currentInput.name !== nextInput.name || currentInput.hasAttribute("data-cm-filter-input") !== nextInput.hasAttribute("data-cm-filter-input")) {
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
  function captureFilterScroll(bar) {
    const elements = [bar, ...Array.from(bar.querySelectorAll("*"))];
    return elements.map((element) => ({ element, top: element.scrollTop, left: element.scrollLeft }));
  }
  function restoreFilterScroll(positions) {
    positions.forEach(({ element, top, left }) => {
      if (!element.isConnected) return;
      element.scrollTop = top;
      element.scrollLeft = left;
    });
  }
  function captureFilterFocus(bar) {
    var _a, _b, _c;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !bar.contains(active)) return null;
    const input = active instanceof HTMLInputElement ? active : null;
    const control = active instanceof HTMLSelectElement ? active : input;
    return {
      element: active,
      filterId: ((_a = active.closest("[data-filter-id]")) == null ? void 0 : _a.dataset.filterId) || "",
      tagName: active.tagName,
      name: (control == null ? void 0 : control.name) || "",
      value: (control == null ? void 0 : control.value) || "",
      inputType: (input == null ? void 0 : input.type) || "",
      selectionStart: (_b = input == null ? void 0 : input.selectionStart) != null ? _b : null,
      selectionEnd: (_c = input == null ? void 0 : input.selectionEnd) != null ? _c : null
    };
  }
  function restoreFilterFocus(bar, snapshot) {
    if (!snapshot || snapshot.element.isConnected) return;
    const candidates = Array.from(bar.querySelectorAll("input, select, button"));
    const filterCandidates = candidates.filter(
      (element) => {
        var _a;
        return ((_a = element.closest("[data-filter-id]")) == null ? void 0 : _a.dataset.filterId) === snapshot.filterId;
      }
    );
    const target = filterCandidates.find((element) => {
      if (element.tagName !== snapshot.tagName) return false;
      if (element instanceof HTMLInputElement) {
        return element.name === snapshot.name && element.type === snapshot.inputType && element.value === snapshot.value;
      }
      if (element instanceof HTMLSelectElement) return element.name === snapshot.name;
      return true;
    }) || filterCandidates[0];
    if (!target) return;
    target.focus({ preventScroll: true });
    if (target instanceof HTMLInputElement && snapshot.selectionStart !== null && snapshot.selectionEnd !== null) {
      try {
        target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
      } catch (e) {
      }
    }
  }
  function prepareFacetReconciliation(liveBar, incomingBar) {
    const currentRoots = filterControlRoots(liveBar);
    const nextRoots = filterControlRoots(incomingBar);
    if (currentRoots.size === 0 || currentRoots.size !== nextRoots.size) {
      throw new Error("Facet response does not contain the matching filter controls");
    }
    const operations = [];
    currentRoots.forEach((currentRoot, id) => {
      const nextRoot = nextRoots.get(id);
      if (!nextRoot) throw new Error("Facet response is missing a filter control");
      prepareFilterControlUpdate(currentRoot, nextRoot, operations);
    });
    const currentSearch = liveBar.querySelector("input[data-cm-search]");
    const nextSearch = incomingBar.querySelector("input[data-cm-search]");
    if (!!currentSearch !== !!nextSearch) {
      throw new Error("Facet response changes the filter search control");
    }
    if (currentSearch && nextSearch) {
      const value = nextSearch.value;
      operations.push(() => {
        currentSearch.value = value;
      });
    }
    const scrollPositions = captureFilterScroll(liveBar);
    const focus = captureFilterFocus(liveBar);
    return () => {
      operations.forEach((operation) => operation());
      liveBar.querySelectorAll("[data-cm-filter-workspace-search], [data-cm-filter-card-search]").forEach((input) => input.dispatchEvent(new Event("input", { bubbles: true })));
      liveBar.dispatchEvent(new Event("change", { bubbles: true }));
      liveBar.querySelectorAll("[data-cm-multiselect]").forEach((root) => {
        const updateLabel = root._cmUpdateLabel;
        if (typeof updateLabel === "function") updateLabel();
        else _updateMultiSelectLabel(root);
      });
      restoreFilterScroll(scrollPositions);
      restoreFilterFocus(liveBar, focus);
    };
  }
  function findIncomingFacetBar(responseHtml, liveBar) {
    const liveSpec = asHTMLElement(liveBar.closest("[data-cm-grid-view-spec]"));
    if (!(liveSpec == null ? void 0 : liveSpec.id) || !liveBar.id) throw new Error("The current filter workspace has no stable identity");
    const responseDocument = new DOMParser().parseFromString(responseHtml, "text/html");
    const responseSpec = asHTMLElement(responseDocument.getElementById(liveSpec.id));
    if (!(responseSpec == null ? void 0 : responseSpec.matches("[data-cm-grid-view-spec]"))) {
      throw new Error("Facet response does not contain the current GridViewSpec");
    }
    const responseBar = Array.from(responseSpec.querySelectorAll("[data-cm-filter-bar]")).find(
      (bar) => bar.id === liveBar.id
    );
    if (!usesInPlaceFacets(responseBar)) {
      throw new Error("Facet response does not contain the matching in-place filter workspace");
    }
    return responseBar;
  }
  function applyClientFacetFilters(bar, state) {
    var _a;
    const clientParams = new Set(
      Array.from(bar.querySelectorAll('[data-filter-scope="client"]')).map(
        (filter) => filter.dataset.filterParam || filter.dataset.filterId || ""
      )
    );
    const clientState = {};
    Object.entries(state).forEach(([param, value]) => {
      if (clientParams.has(param)) clientState[param] = value;
    });
    const target = (_a = asHTMLElement(bar.closest(".cm-filters, .cm-toolbar-unified"))) == null ? void 0 : _a.dataset.target;
    if (!target || !clientParams.size) return;
    const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(target) : target.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    applyClientFilterState(document.querySelector("#cm-table-" + escaped), clientState);
  }
  function dispatchFacetRefreshComplete(bar, state, pageUrl) {
    const nextState = { ...state, ...selectedFilterValues(bar) };
    const page = new URL(pageUrl, window.location.origin).searchParams.get("page");
    if (page) nextState.page = page;
    applyClientFacetFilters(bar, nextState);
    bar.dispatchEvent(
      new CustomEvent("cm-filter-change", {
        bubbles: true,
        detail: { state: nextState, bar, facetsRefreshComplete: true }
      })
    );
  }
  function cancelFacetRefresh() {
    facetRefreshGeneration += 1;
    activeFacetRefreshController == null ? void 0 : activeFacetRefreshController.abort();
    activeFacetRefreshController = null;
  }
  async function refreshFacetsInPlace(pageUrl, state, bar) {
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
        signal: controller.signal
      });
      if (generation !== facetRefreshGeneration) return;
      if (!response.ok) throw new Error("Facet refresh returned an unsuccessful response");
      const responseHtml = await response.text();
      if (generation !== facetRefreshGeneration) return;
      const incomingBar = findIncomingFacetBar(responseHtml, bar);
      const reconcile = prepareFacetReconciliation(bar, incomingBar);
      if (generation !== facetRefreshGeneration) return;
      reconcile();
      multiselectPanelToRestore = null;
      dispatchFacetRefreshComplete(bar, state, requestUrl.href);
    } catch (e) {
      if (generation !== facetRefreshGeneration) return;
      window.location.href = pageUrl;
    } finally {
      if (generation === facetRefreshGeneration) activeFacetRefreshController = null;
    }
  }
  function syncToolbarCounterFromTable(gridId) {
    var _a;
    if (!gridId) return;
    const block = document.getElementById("block-" + gridId);
    const counter = asHTMLElement(document.querySelector('[data-cm-count-for="' + gridId + '"]'));
    if (!block || !counter) return;
    const footer = asHTMLElement(block.querySelector("[data-cm-pagination-total]"));
    const total = ((_a = footer == null ? void 0 : footer.dataset) == null ? void 0 : _a.cmPaginationTotal) || counter.dataset.cmCountTotal || "";
    const shown = block.querySelectorAll("tbody .cm-row:not([hidden])").length;
    if (total) {
      counter.textContent = String(shown) + "/" + total;
      counter.dataset.cmCountTotal = total;
    } else {
      counter.textContent = String(shown);
    }
  }
  function navigateFilterState(state, anchorEl, bar) {
    var _a;
    const pageUrl = withActiveTableColumns(
      buildFilterUrl(filterNavigateHref(), state),
      anchorEl || bar
    );
    const gridId = resolveToolbarGridId(anchorEl || bar);
    const frag = tableFragmentConfig(gridId, bar);
    const wantsFacets = specWantsFacets(anchorEl || bar);
    const filterBar = bar instanceof HTMLElement ? bar : asHTMLElement((_a = bar == null ? void 0 : bar.closest) == null ? void 0 : _a.call(bar, "[data-cm-filter-bar]"));
    if (usesInPlaceFacets(filterBar)) {
      pushFilterHistory(pageUrl, filterBar);
      void refreshFacetsInPlace(pageUrl, state, filterBar);
      return true;
    }
    cancelFacetRefresh();
    const htmx = getGlobal().htmx;
    if (htmx && typeof htmx.ajax === "function") {
      if (frag && !wantsFacets) {
        htmx.ajax("GET", buildFragmentRequestUrl(frag.endpoint, pageUrl), {
          target: frag.target,
          swap: frag.swap
        });
        pushFilterHistory(pageUrl, anchorEl || bar);
        window.setTimeout(() => syncToolbarCounterFromTable(frag.gridId), 0);
        return true;
      }
      const ref = anchorEl || bar;
      const specRoot = ref instanceof Element ? ref.closest("[data-cm-grid-view-spec]") : null;
      if (specRoot == null ? void 0 : specRoot.id) {
        const wrapId = "cm-spec-wrap-" + specRoot.dataset.specId;
        htmx.ajax("GET", pageUrl, {
          target: "#" + wrapId,
          swap: "innerHTML",
          select: "#" + specRoot.id
        });
        pushFilterHistory(pageUrl, ref);
        return true;
      }
    }
    window.location.href = pageUrl;
    return false;
  }
  function pushFilterHistory(pageUrl, anchor) {
    const specRoot = anchor instanceof Element ? asHTMLElement(anchor.closest("[data-cm-grid-view-spec]")) : null;
    const state = isRecord(window.history.state) ? { ...window.history.state } : {};
    const specId = (specRoot == null ? void 0 : specRoot.dataset.specId) || "";
    if (specId && (typeof state.cmFilterSpecId !== "string" || !state.cmFilterSpecId)) {
      state.cmFilterSpecId = specId;
      window.history.replaceState(state, "", window.location.href);
    }
    if (specId) state.cmFilterSpecId = specId;
    window.history.pushState(state, "", pageUrl);
    latestFilterNavigationUrl = pageUrl;
  }
  function isSameFilterPage(previousUrl, nextUrl) {
    const previous = new URL(previousUrl, window.location.origin);
    const next = new URL(nextUrl, window.location.origin);
    return previous.pathname === next.pathname && previous.searchParams.get("tab") === next.searchParams.get("tab");
  }
  function restoreFilterHistorySpec() {
    if (filterHistoryBound) return;
    filterHistoryBound = true;
    window.addEventListener("popstate", () => {
      const nextUrl = filterNavigateHref();
      if (!isSameFilterPage(latestFilterNavigationUrl, nextUrl)) {
        cancelFacetRefresh();
        return;
      }
      latestFilterNavigationUrl = nextUrl;
      window.setTimeout(() => {
        const historyState = isRecord(window.history.state) ? window.history.state : {};
        const specId = typeof historyState.cmFilterSpecId === "string" ? historyState.cmFilterSpecId : "";
        const roots = Array.from(document.querySelectorAll("[data-cm-grid-view-spec]"));
        const specRoot = specId ? asHTMLElement(document.getElementById("cm-spec-" + specId)) : roots.length === 1 ? roots[0] : null;
        const filterBar = asHTMLElement(specRoot == null ? void 0 : specRoot.querySelector("[data-cm-filter-bar]"));
        if (usesInPlaceFacets(filterBar)) {
          const state = selectedFilterValues(filterBar);
          const page = new URL(nextUrl, window.location.origin).searchParams.get("page");
          if (page) state.page = page;
          void refreshFacetsInPlace(nextUrl, state, filterBar);
          return;
        }
        cancelFacetRefresh();
        const htmx = getGlobal().htmx;
        if (!(specRoot == null ? void 0 : specRoot.id) || !htmx || typeof htmx.ajax !== "function") return;
        const wrapId = "cm-spec-wrap-" + specRoot.dataset.specId;
        if (!document.getElementById(wrapId)) return;
        htmx.ajax("GET", filterNavigateHref(), {
          target: "#" + wrapId,
          swap: "innerHTML",
          select: "#" + specRoot.id
        });
      }, 0);
    });
  }
  function toolbarSearchUsesFragmentNavigation(searchInput) {
    if (specWantsFacets(searchInput)) return true;
    return !!tableFragmentConfig(resolveToolbarGridId(searchInput));
  }
  function buildFilterUrl(baseUrl, state) {
    const url = new URL(baseUrl, window.location.origin);
    Object.entries(state).forEach(([key, val]) => {
      if (val === "" || val == null || Array.isArray(val) && val.length === 0) {
        url.searchParams.delete(key);
        return;
      }
      if (Array.isArray(val)) url.searchParams.set(key, val.join(","));
      else url.searchParams.set(key, String(val));
    });
    return url.pathname + url.search;
  }
  function activeExportColIds(gridId) {
    if (!gridId) return "";
    const gridView2 = getGlobal().GridView;
    const handle = (gridView2 == null ? void 0 : gridView2.byId) && typeof gridView2.byId.get === "function" ? gridView2.byId.get(gridId) : null;
    if (handle && isRecord(handle) && isRecord(handle.adapter)) {
      const getDisplayed = handle.adapter.getDisplayedColumnIds;
      if (typeof getDisplayed === "function") {
        const ids = getDisplayed.call(handle.adapter);
        if (Array.isArray(ids)) return ids.map(String).join(",");
      }
    }
    return "";
  }
  function withActiveTableColumns(urlString, scopeEl) {
    const url = new URL(urlString, window.location.origin);
    const anchor = scopeEl && scopeEl.closest ? scopeEl.closest("[data-cm-toolbar-search-root], .cm-dashboard-page, .cm-page-table-layout") : null;
    const toolbarRoot = asHTMLElement(
      anchor == null ? void 0 : anchor.querySelector("[data-cm-toolbar-search-root][data-cm-table-grid-id]")
    );
    const tableShell = asHTMLElement(anchor == null ? void 0 : anchor.querySelector("[data-cm-table-shell][data-grid-id]"));
    const gridId = (toolbarRoot == null ? void 0 : toolbarRoot.dataset.cmTableGridId) || (tableShell == null ? void 0 : tableShell.dataset.gridId) || "";
    const cols = activeExportColIds(gridId);
    if (cols) url.searchParams.set("export_cols", cols);
    else url.searchParams.delete("export_cols");
    const colQ = serializeColumnFilters(anchor || document);
    if (colQ) url.searchParams.set("col_q", colQ);
    else url.searchParams.delete("col_q");
    return url.pathname + url.search;
  }
  function initMultiSelectWidget(rootEl) {
    const root = asHTMLElement(rootEl);
    if (!root) return;
    if (root.dataset.cmMsBound) return;
    root.dataset.cmMsBound = "1";
    const panel = root.querySelector(".cm-multiselect-panel");
    const trigger = root.querySelector(".cm-multiselect-trigger");
    const filterBar = asHTMLElement(root.closest("[data-cm-filter-bar]"));
    const restoreKey = {
      barId: (filterBar == null ? void 0 : filterBar.id) || "",
      filterId: root.dataset.filterId || ""
    };
    const regularCheckboxes = () => Array.from(root.querySelectorAll(MS_COUNTABLE));
    const selectAllCheckbox = () => root.querySelector('input[type="checkbox"][data-select-all]');
    const soloCheckboxes = () => Array.from(root.querySelectorAll("[data-select-all], [data-exclusive-solo]"));
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
    trigger == null ? void 0 : trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = panel == null ? void 0 : panel.classList.contains("is-open");
      const open = !isOpen;
      document.querySelectorAll(".cm-multiselect-panel.is-open").forEach((p) => p.classList.remove("is-open"));
      if (open) panel == null ? void 0 : panel.classList.add("is-open");
    });
    panel == null ? void 0 : panel.addEventListener("click", (e) => e.stopPropagation());
    root.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;
      const cb = target;
      if (root.dataset.cmSingleselect === "1" && cb.checked && cb.dataset.selectAll !== "1") {
        root.querySelectorAll('input[type="checkbox"]').forEach((otherEl) => {
          if (otherEl instanceof HTMLInputElement && otherEl !== cb) otherEl.checked = false;
        });
      }
      if ((cb.dataset.selectAll === "1" || cb.dataset.exclusiveSolo === "1") && cb.checked) {
        root.querySelectorAll('input[type="checkbox"]').forEach((oEl) => {
          if (oEl instanceof HTMLInputElement && oEl !== cb) oEl.checked = false;
        });
      } else if (root.dataset.exclusiveAll === "1" && cb.dataset.periodAll === "1" && cb.checked) {
        root.querySelectorAll('input[type="checkbox"]:not([data-period-all])').forEach((oEl) => {
          if (oEl instanceof HTMLInputElement) oEl.checked = false;
        });
      } else if (cb.dataset.periodAll !== "1" && cb.checked) {
        const allCb = root.querySelector("[data-period-all]");
        if (allCb) allCb.checked = false;
      }
      if (cb.dataset.selectAll !== "1" && cb.dataset.exclusiveSolo !== "1" && cb.dataset.periodAll !== "1" && cb.checked) {
        soloCheckboxes().forEach((o) => {
          o.checked = false;
        });
      }
      if (cb.dataset.selectAll !== "1") syncSelectAllState();
      updateLabel();
      if (root.dataset.cmSingleselect === "1") {
        root.dispatchEvent(new CustomEvent("cm-filter-change", { bubbles: true }));
        panel == null ? void 0 : panel.classList.remove("is-open");
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
    if (multiselectPanelToRestore && multiselectPanelToRestore.barId === restoreKey.barId && multiselectPanelToRestore.filterId === restoreKey.filterId) {
      panel == null ? void 0 : panel.classList.add("is-open");
      multiselectPanelToRestore = null;
    }
    if (!window.__cmMultiSelectCloseBound) {
      window.__cmMultiSelectCloseBound = true;
      document.addEventListener("click", () => {
        document.querySelectorAll(".cm-multiselect-panel.is-open").forEach((p) => p.classList.remove("is-open"));
      });
    }
  }
  function bindFilterBar(barEl, opts) {
    const bar = asHTMLElement(barEl);
    if (!bar) return { getState: () => ({}), buildUrl: buildFilterUrl };
    const options = opts || {};
    const navigateOnChange = options.navigate !== false && bar.dataset.navigateOnChange !== "0";
    bar.querySelectorAll("[data-cm-multiselect]").forEach(initMultiSelectWidget);
    const periodFilter = getGlobal().CMPeriodFilter;
    if (periodFilter && typeof periodFilter.bind === "function") {
      periodFilter.bind(bar);
    }
    const onChange = (event) => {
      var _a;
      const eventDetail = event instanceof CustomEvent && isRecord(event.detail) ? event.detail : null;
      if ((eventDetail == null ? void 0 : eventDetail.facetsRefreshComplete) === true) return;
      const state = selectedFilterValues(bar);
      state.page = "1";
      const clientParams = new Set(
        Array.from(bar.querySelectorAll('[data-filter-scope="client"]')).map(
          (filter) => filter.dataset.filterParam || filter.dataset.filterId || ""
        )
      );
      const clientState = {};
      Object.entries(state).forEach(([param, value]) => {
        if (clientParams.has(param)) clientState[param] = value;
      });
      const target = (_a = asHTMLElement(bar.closest(".cm-filters, .cm-toolbar-unified"))) == null ? void 0 : _a.dataset.target;
      if (!options.onChange && usesInPlaceFacets(bar)) {
        if ((event == null ? void 0 : event.type) === "cm-filter-change") event.stopPropagation();
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
        const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(target) : target.replace(/\\/g, "\\\\").replace(/\"/g, '\\"');
        applyClientFilterState(document.querySelector("#cm-table-" + escaped), clientState);
      }
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
    bar.addEventListener("cm-filter-change", onChange);
    bar.querySelectorAll("select[data-filter-scope='server']").forEach((selEl) => {
      if (selEl instanceof HTMLSelectElement) selEl.addEventListener("change", onChange);
    });
    bar.querySelectorAll("select[data-cm-grouped-select]").forEach((select) => {
      select.addEventListener("change", onChange);
    });
    bar.querySelectorAll("[data-cm-filter-input]").forEach((input) => {
      input.addEventListener("change", onChange);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onChange();
        }
      });
    });
    const search = asHtmlInput(bar.querySelector("[data-cm-search]"));
    if (search) {
      search.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && search.dataset.searchScope === "server") onChange();
      });
    }
    return { getState: () => selectedFilterValues(bar), buildUrl: buildFilterUrl };
  }
  function getCsrfToken() {
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
  function setSavedSearchPanelOpen(dropdown, open) {
    if (!dropdown) return;
    var scopeId = dropdown.dataset.cmSavedDropdownFor || "";
    var loadBtn = scopeId ? document.getElementById("cm-saved-searches-btn-" + scopeId) : null;
    const root = scopeId ? document.querySelector(
      '[data-cm-toolbar-search-root][data-cm-search-scope-id="' + scopeId + '"]'
    ) : null;
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
  var ToolbarSearch = {
    ctx: function(scopeId, wrap) {
      let root = asHTMLElement(wrap != null ? wrap : null);
      if (!root || !root.matches("[data-cm-toolbar-search-root]")) {
        if (!scopeId) return null;
        var esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(scopeId) : scopeId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
        prefId,
        backend,
        input,
        dropdown: asHTMLElement(document.getElementById("cm-saved-searches-dropdown-" + scope)),
        container: asHTMLElement(document.getElementById("cm-saved-searches-container-" + scope))
      };
    },
    load: function(ctx) {
      if (!ctx) return [];
      var raw = ctx.root.dataset.cmSavedSearches;
      if (raw) {
        try {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            var fromAttr = parsed.filter(function(s) {
              return typeof s === "string" && s;
            });
            if (fromAttr.length) return fromAttr;
          }
        } catch (e) {
        }
      }
      return [];
    },
    persist: function(ctx, items) {
      if (!ctx) return;
      ctx.root.dataset.cmSavedSearches = JSON.stringify(items);
      var host = byId.get(ctx.scopeId);
      if (host) host.savedQuickSearches = items;
      var url = getGlobal().GridView && getGlobal().GridView.preferencesUrl || "";
      if (!url) return;
      fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken()
        },
        body: JSON.stringify({ grid_id: ctx.prefId, searches: items })
      }).catch(function() {
      });
    },
    apply: function(ctx, text, onPick) {
      if (!ctx || !ctx.input) return;
      ctx.input.value = text;
      syncToolbarSearchChrome(ctx.input);
      if (ctx.backend === "ag_grid") {
        var host = byId.get(ctx.prefId);
        if (host) {
          if (host.gridApi && typeof host.gridApi.setFilterModel === "function") {
            host.gridApi.setFilterModel(null);
          }
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
    render: function(ctx, items, onPick) {
      if (!ctx || !ctx.container) return;
      const container = ctx.container;
      container.innerHTML = "";
      const i18n2 = getGlobal().GridViewI18n;
      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "cm-toolbar-search-saved-empty p-2 text-slate-400 dark:text-gray-500 text-center text-[11px]";
        empty.textContent = (i18n2 == null ? void 0 : i18n2["search.no_saved_searches"]) || "No saved searches";
        container.appendChild(empty);
        if (ctx.input) syncToolbarSearchChrome(ctx.input);
        return;
      }
      items.forEach(function(text) {
        var item = document.createElement("div");
        item.className = "cm-toolbar-search-saved-item";
        var label = document.createElement("span");
        label.textContent = text;
        item.appendChild(label);
        item.addEventListener("mousedown", function(e) {
          e.preventDefault();
          ToolbarSearch.apply(ctx, text, onPick != null ? onPick : void 0);
        });
        var del = document.createElement("button");
        del.type = "button";
        del.className = "cm-toolbar-search-btn";
        del.innerHTML = "&times;";
        del.addEventListener("mousedown", function(e) {
          e.stopPropagation();
          e.preventDefault();
          var next = items.filter(function(s) {
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
    save: function(scopeId) {
      var ctx = ToolbarSearch.ctx(scopeId);
      if (!ctx || !ctx.input) return;
      var val = ctx.input.value.trim();
      if (!val) return;
      var items = ToolbarSearch.load(ctx);
      if (items.indexOf(val) >= 0) return;
      items.push(val);
      ToolbarSearch.persist(ctx, items);
      var onPick = ctx.backend === "server" && ctx.input ? serverToolbarSearchApplyClient(ctx.input) : null;
      ToolbarSearch.render(ctx, items, onPick);
    },
    toggle: function(scopeId) {
      var ctx = ToolbarSearch.ctx(scopeId);
      if (!ctx || !ctx.dropdown) return;
      var opening = ctx.dropdown.classList.contains("is-hidden");
      if (opening) {
        var onPick = ctx.backend === "server" && ctx.input ? serverToolbarSearchApplyClient(ctx.input) : null;
        ToolbarSearch.render(ctx, ToolbarSearch.load(ctx), onPick);
      }
      setSavedSearchPanelOpen(ctx.dropdown, opening);
    },
    mount: function(scopeId, initialItems) {
      var ctx = ToolbarSearch.ctx(scopeId);
      if (!ctx) return;
      if (initialItems && initialItems.length) {
        ctx.root.dataset.cmSavedSearches = JSON.stringify(initialItems);
      }
      ToolbarSearch.render(ctx, ToolbarSearch.load(ctx), null);
    },
    bindDismiss: function() {
      if (getGlobal()._cmSavedSearchDismissBound) return;
      getGlobal()._cmSavedSearchDismissBound = true;
      document.addEventListener("click", function(e) {
        document.querySelectorAll('[id^="cm-saved-searches-dropdown-"]').forEach(function(ddEl) {
          const dd = asHTMLElement(ddEl);
          if (!dd || dd.classList.contains("is-hidden")) return;
          var scopeFor = dd.dataset.cmSavedDropdownFor || "";
          var esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(scopeFor) : scopeFor.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          if (!scopeFor) return;
          var root = document.querySelector(
            '[data-cm-toolbar-search-root][data-cm-search-scope-id="' + esc + '"]'
          );
          const target = e.target;
          if (root instanceof HTMLElement && target instanceof Node && !root.contains(target) && !dd.contains(target)) {
            setSavedSearchPanelOpen(dd, false);
          }
        });
      });
    }
  };
  ToolbarSearch.bindDismiss();
  function syncToolbarSearchChrome(input) {
    const wrap = asHTMLElement(input == null ? void 0 : input.closest("[data-cm-toolbar-search-root]"));
    if (!wrap || !input) return;
    const ctx = ToolbarSearch.ctx(wrap.dataset.cmSearchScopeId || "", wrap);
    const val = (input.value || "").trim();
    const clearBtn = wrap.querySelector(".cm-toolbar-search-clear");
    clearBtn == null ? void 0 : clearBtn.classList.toggle("is-visible", val.length > 0);
    const saveBtn = wrap.querySelector(
      '.cm-toolbar-search-action--save, [data-cm-grid-action="saveSearch"]'
    );
    const saved = ctx ? ToolbarSearch.load(ctx) : [];
    saveBtn == null ? void 0 : saveBtn.classList.toggle("is-active", !!(val && saved.includes(val)));
  }
  function serverToolbarSearchNavigate(searchInput) {
    var _a;
    const scopeId = ((_a = asHTMLElement(searchInput.closest("[data-cm-toolbar-search-root]"))) == null ? void 0 : _a.dataset.cmSearchScopeId) || "";
    const shell = searchInput.closest(".cm-dashboard-page, .cm-page-table-layout, .cm-simple-wrapper, .cm-table-shell") || document;
    const filterBar = shell.querySelector("[data-cm-filter-bar]");
    const searchName = searchInput.name || "q";
    const hiddenSearch = filterBar == null ? void 0 : filterBar.querySelector('input[data-cm-search][name="' + searchName + '"]');
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
  function serverToolbarSearchApplyClient(searchInput) {
    var _a;
    const scopeId = ((_a = asHTMLElement(searchInput.closest("[data-cm-toolbar-search-root]"))) == null ? void 0 : _a.dataset.cmSearchScopeId) || "";
    const shell = searchInput.closest(".cm-dashboard-page, .cm-page-table-layout, .cm-simple-wrapper, .cm-table-shell") || document;
    const filterBar = shell.querySelector("[data-cm-filter-bar]");
    const searchName = searchInput.name || "q";
    const hiddenSearch = filterBar == null ? void 0 : filterBar.querySelector('input[data-cm-search][name="' + searchName + '"]');
    return function applyClient() {
      syncToolbarSearchChrome(searchInput);
      if (hiddenSearch instanceof HTMLInputElement) {
        hiddenSearch.value = searchInput.value || "";
      }
      const layout = searchInput.closest(".cm-page-table-layout, .cm-dashboard-page, .cm-simple-wrapper, .cm-table-shell") || searchInput.closest(".cm-dashboard-page");
      applyFiltersInScope(layout || document);
    };
  }
  var _fragmentCounterBound = false;
  function bindFragmentCounterSync() {
    if (_fragmentCounterBound || typeof document === "undefined") return;
    _fragmentCounterBound = true;
    document.addEventListener("htmx:afterSwap", (event) => {
      var _a;
      const target = (_a = event.detail) == null ? void 0 : _a.target;
      const id = (target == null ? void 0 : target.id) || "";
      if (!id.startsWith("block-")) return;
      syncToolbarCounterFromTable(id.slice("block-".length));
    });
  }
  function initToolbarSearch(scope) {
    bindFragmentCounterSync();
    const root = scope && "querySelectorAll" in scope ? scope : document;
    root.querySelectorAll('[data-cm-search-backend="server"][data-cm-toolbar-search]').forEach((searchEl) => {
      const searchInput = asHtmlInput(searchEl);
      if (!searchInput) return;
      if (searchInput.dataset.cmToolbarSearchBound) return;
      searchInput.dataset.cmToolbarSearchBound = "1";
      const input = searchInput;
      const wrap = asHTMLElement(input.closest("[data-cm-toolbar-search-root]"));
      const scopeId = (wrap == null ? void 0 : wrap.dataset.cmSearchScopeId) || "";
      const clearBtn = wrap == null ? void 0 : wrap.querySelector(".cm-toolbar-search-clear");
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
      clearBtn == null ? void 0 : clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        input.value = "";
        syncStateUi();
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
      const tableGridId2 = (wrap == null ? void 0 : wrap.dataset.cmTableGridId) || (wrap == null ? void 0 : wrap.dataset.cmSearchScopeId) || "";
      const clearBtn = wrap == null ? void 0 : wrap.querySelector(".cm-toolbar-search-clear");
      let searchReloadTimer = 0;
      function reloadGridSearch() {
        if (!tableGridId2) return;
        invokeGridAction(tableGridId2, "onQuickFilterChanged");
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
        invokeGridAction(tableGridId2, "reloadData");
      });
      clearBtn == null ? void 0 : clearBtn.addEventListener("click", (event) => {
        event.preventDefault();
        input.value = "";
        syncToolbarSearchChrome(input);
        invokeGridAction(tableGridId2, "clearSearch");
      });
      syncToolbarSearchChrome(input);
    });
  }
  function initFilterBars(scope) {
    var _a, _b, _c;
    const root = scope && "querySelectorAll" in scope ? scope : document;
    latestFilterNavigationUrl = filterNavigateHref();
    root.querySelectorAll("[data-cm-filter-bar]").forEach((barEl) => {
      var _a2;
      const bar = asHTMLElement(barEl);
      if (!bar) return;
      if (!bar.dataset.cmFbBound) {
        bar.dataset.cmFbBound = "1";
        bindFilterBar(bar, { navigate: bar.dataset.navigateOnChange !== "0" });
      }
      const clientParams = Array.from(
        bar.querySelectorAll('[data-filter-scope="client"]')
      ).map((filter) => filter.dataset.filterParam || filter.dataset.filterId || "");
      const target = (_a2 = asHTMLElement(bar.closest(".cm-filters, .cm-toolbar-unified"))) == null ? void 0 : _a2.dataset.target;
      if (target && clientParams.length) {
        const selected = selectedFilterValues(bar);
        const clientState = {};
        clientParams.forEach((param) => {
          if (param in selected) clientState[param] = selected[param];
        });
        applyClientFilterState(document.getElementById("cm-table-" + target), clientState);
      }
    });
    initFilterDrawers(root);
    const workspaceRoot = root.querySelector("[data-cm-filter-drawer-workspace]");
    if (workspaceRoot) {
      const workspace = (_a = getGlobal().GridView) == null ? void 0 : _a.FilterDrawerWorkspace;
      if (workspace) {
        workspace.init(root);
      } else {
        const ensureWorkspace = (_c = (_b = getGlobal().GridView) == null ? void 0 : _b.assets) == null ? void 0 : _c.ensureFilterDrawerWorkspace;
        if (ensureWorkspace) {
          void ensureWorkspace().then(() => {
            var _a2, _b2;
            return (_b2 = (_a2 = getGlobal().GridView) == null ? void 0 : _a2.FilterDrawerWorkspace) == null ? void 0 : _b2.init(root);
          }).catch(() => void 0);
        }
      }
    }
    restoreFilterHistorySpec();
    initToolbarSearch(root);
  }
  function initTabGroups(scope) {
    const root = scope && "querySelectorAll" in scope ? scope : document;
    root.querySelectorAll("[data-cm-tab-group]").forEach((groupEl) => {
      const group = asHTMLElement(groupEl);
      if (!group) return;
      if (group.dataset.cmTabBound) return;
      group.dataset.cmTabBound = "1";
      group.addEventListener("click", (e) => {
        var _a;
        const btn = (_a = e.target) == null ? void 0 : _a.closest("[data-cm-tab-target]");
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
        const specRoot = group.closest("[data-cm-grid-view-spec]") || group.closest(".cm-dashboard-page") || group.parentElement;
        if (!specRoot) return;
        const isPageTabs = group.hasAttribute("data-cm-tabs-block");
        const paneHost = isPageTabs ? group.closest(".cm-area") : group.closest(".cm-area[data-cm-tab-pane]") || group.closest(".cm-area");
        if (!paneHost) return;
        const panes = paneHost.querySelectorAll(
          ":scope > .cm-area[data-cm-tab-pane], :scope > .cm-block[data-cm-tab-pane]"
        );
        let shownPane = null;
        panes.forEach((pane) => {
          const paneId = pane.getAttribute("data-cm-tab-pane") || pane.id.replace(/^tab-pane-/, "") || pane.id.replace(/^tab-/, "");
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
        const gv2 = window.GridView;
        if (shownPane && (gv2 == null ? void 0 : gv2.bootScope)) {
          gv2.bootScope(shownPane);
        }
      });
    });
  }
  document.addEventListener("click", () => {
    document.querySelectorAll(".cm-multiselect-panel.is-open").forEach((p) => p.classList.remove("is-open"));
  });
  var FilterBar = {
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

  // src/runtime/notifications.ts
  var toastContainer = null;
  var toastCount = 0;
  var channelBound = false;
  function ensureToastContainer() {
    if (toastContainer && document.body.contains(toastContainer)) {
      return toastContainer;
    }
    const el = document.createElement("div");
    el.id = "cm-toast-container";
    el.className = "cm-toast-container";
    el.setAttribute("aria-live", "polite");
    el.setAttribute("role", "status");
    document.body.appendChild(el);
    toastContainer = el;
    return el;
  }
  function resolveIcon(tone) {
    switch (tone) {
      case "success":
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
      case "warning":
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
      case "error":
      case "danger":
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      case "info":
      default:
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }
  }
  function notify(options) {
    var _a, _b;
    const opts = typeof options === "string" ? { message: options } : { ...options };
    const id = opts.id || `cm-toast-${++toastCount}`;
    const tone = (_a = opts.tone) != null ? _a : "info";
    const duration = (_b = opts.duration) != null ? _b : 4e3;
    const container = ensureToastContainer();
    const toastEl = document.createElement("div");
    toastEl.id = id;
    toastEl.className = `cm-toast cm-toast-${tone}`;
    toastEl.dataset.cmToastId = id;
    const headerHtml = opts.title ? `<div class="cm-toast-title">${escapeHtml2(opts.title)}</div>` : "";
    const actionHtml = opts.action ? `<button type="button" class="cm-toast-action-btn" data-cm-toast-action>${escapeHtml2(opts.action.label)}</button>` : "";
    toastEl.innerHTML = `
    <div class="cm-toast-icon">${resolveIcon(tone)}</div>
    <div class="cm-toast-content">
      ${headerHtml}
      <div class="cm-toast-message">${escapeHtml2(opts.message)}</div>
      ${actionHtml}
    </div>
    <button type="button" class="cm-toast-close" data-cm-toast-close aria-label="Close">&times;</button>
  `;
    let timer = null;
    let remainingMs = duration;
    let startedAt = Date.now();
    const dismiss = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      toastEl.classList.add("is-exiting");
      toastEl.addEventListener(
        "animationend",
        () => {
          if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
        },
        { once: true }
      );
      window.setTimeout(() => {
        if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
      }, 300);
    };
    const instance = { id, element: toastEl, dismiss };
    if (opts.action) {
      const actionBtn = toastEl.querySelector("[data-cm-toast-action]");
      actionBtn == null ? void 0 : actionBtn.addEventListener("click", (e) => {
        var _a2;
        e.stopPropagation();
        (_a2 = opts.action) == null ? void 0 : _a2.onClick(instance);
      });
    }
    const closeBtn = toastEl.querySelector("[data-cm-toast-close]");
    closeBtn == null ? void 0 : closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dismiss();
    });
    if (duration > 0) {
      const startTimer = () => {
        startedAt = Date.now();
        timer = window.setTimeout(dismiss, remainingMs);
      };
      const pauseTimer = () => {
        if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
          remainingMs -= Date.now() - startedAt;
        }
      };
      toastEl.addEventListener("mouseenter", pauseTimer);
      toastEl.addEventListener("mouseleave", () => {
        if (remainingMs > 0) startTimer();
        else dismiss();
      });
      startTimer();
    }
    container.appendChild(toastEl);
    return instance;
  }
  function escapeHtml2(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function bindNotificationChannel() {
    if (channelBound || typeof window === "undefined") return;
    channelBound = true;
    window.addEventListener("cm:notify", ((event) => {
      if (event.detail) {
        notify(event.detail);
      }
    }));
  }

  // src/grid-view/confirmation-interceptor.ts
  var nativeAlert = null;
  var interceptorsBound = false;
  function defaultConfirmMessage(message) {
    return (message == null ? void 0 : message.trim()) || "Are you sure?";
  }
  function findDialogDescriptor(name) {
    let owner = window;
    while (owner) {
      const descriptor = Object.getOwnPropertyDescriptor(owner, name);
      if (descriptor) return descriptor;
      owner = Object.getPrototypeOf(owner);
    }
    return void 0;
  }
  function defineDialogMethod(name, implementation) {
    const ownDescriptor = Object.getOwnPropertyDescriptor(window, name);
    const descriptor = ownDescriptor != null ? ownDescriptor : findDialogDescriptor(name);
    if (!descriptor) return false;
    if (ownDescriptor && !ownDescriptor.configurable) {
      if (!("value" in ownDescriptor) || !ownDescriptor.writable) return false;
      try {
        Object.defineProperty(window, name, {
          configurable: false,
          enumerable: ownDescriptor.enumerable,
          value: implementation,
          writable: true
        });
        return true;
      } catch (e) {
        return false;
      }
    }
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: descriptor.enumerable === true,
        value: implementation,
        writable: true
      });
      return true;
    } catch (e) {
      return false;
    }
  }
  function interceptedAlert(message) {
    const normalizedMessage = String(message != null ? message : "");
    try {
      notify({ message: normalizedMessage, tone: "error" });
    } catch (e) {
      nativeAlert == null ? void 0 : nativeAlert(normalizedMessage);
    }
  }
  function isHtmxConfirmDetail(value) {
    if (!isRecord(value) || typeof value.issueRequest !== "function") return false;
    return value.question === void 0 || typeof value.question === "string";
  }
  function continueConfirmedLink(link) {
    const target = link.target.trim();
    const reservedTarget = target.toLowerCase();
    if (!target || reservedTarget === "_self") {
      window.location.href = link.href;
      return;
    }
    if (reservedTarget === "_parent" || reservedTarget === "_top") {
      const destination = reservedTarget === "_top" ? window.top : window.parent;
      if (destination) destination.location.href = link.href;
      return;
    }
    if (reservedTarget === "_blank") {
      window.open(link.href, "_blank", "noopener,noreferrer");
      return;
    }
    if (/^[A-Za-z][A-Za-z0-9._:-]*$/.test(target)) {
      window.open(link.href, target, "noopener,noreferrer");
    }
  }
  function bindHtmxConfirmationBridge() {
    document.addEventListener(
      "htmx:confirm",
      (event) => {
        var _a;
        if (!(event instanceof CustomEvent) || !isHtmxConfirmDetail(event.detail)) return;
        if (!((_a = event.detail.question) == null ? void 0 : _a.trim())) return;
        event.preventDefault();
        let settled = false;
        const issueRequestOnce = () => {
          if (settled) return;
          settled = true;
          event.detail.issueRequest(true);
        };
        const question = defaultConfirmMessage(event.detail.question);
        void confirmDialog({ message: question, tone: "danger" }).then(
          (confirmed) => {
            if (confirmed) issueRequestOnce();
            else settled = true;
          },
          () => {
            settled = true;
          }
        );
      },
      true
    );
  }
  function installGlobalDialogInterceptors() {
    if (!nativeAlert) {
      const currentAlert = window.alert;
      if (typeof currentAlert === "function") {
        const originalAlert = currentAlert.bind(window);
        if (defineDialogMethod("alert", interceptedAlert)) nativeAlert = originalAlert;
      }
    }
  }
  function installConfirmationInterceptors() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    installGlobalDialogInterceptors();
    if (interceptorsBound) return;
    interceptorsBound = true;
    bindHtmxConfirmationBridge();
  }

  // src/grid-view/actions.ts
  function cssAttr(value) {
    return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  function hasActiveToolbarSearch(toolbar) {
    if (!toolbar) return false;
    return Array.from(
      toolbar.querySelectorAll("[data-cm-toolbar-search], [data-cm-search]")
    ).some(
      (input) => input.value.trim().length > 0 || (input.dataset.cmSearchCommitted || "").trim().length > 0
    );
  }
  function hasActiveUrlFilterState() {
    const params = new URLSearchParams(window.location.search);
    return ["q", "filters", "col_q"].some(
      (key) => (params.get(key) || "").trim().length > 0
    );
  }
  function clearUrlFilterState() {
    const url = new URL(window.location.href);
    let changed = false;
    ["q", "filters", "col_q"].forEach((key) => {
      if (!url.searchParams.has(key)) return;
      url.searchParams.delete(key);
      changed = true;
    });
    if (changed) window.history.replaceState({}, "", url);
  }
  function clearToolbarSearchState(scope, gridId, filterBar) {
    const inputs = /* @__PURE__ */ new Set();
    const collect = (root) => {
      root == null ? void 0 : root.querySelectorAll("[data-cm-toolbar-search], [data-cm-search]").forEach((input) => inputs.add(input));
    };
    collect(scope == null ? void 0 : scope.closest(".cm-toolbar-unified, [data-cm-toolbar]"));
    collect(filterBar);
    if (gridId) {
      const escaped = cssAttr(gridId);
      collect(
        document.querySelector(
          '[data-cm-toolbar-search-root][data-cm-table-grid-id="' + escaped + '"]'
        )
      );
      collect(document.querySelector('[data-grid-id="' + escaped + '"]'));
    }
    inputs.forEach((input) => {
      input.value = "";
      delete input.dataset.cmSearchCommitted;
      syncToolbarSearchChrome(input);
    });
    clearUrlFilterState();
  }
  function syncClearAllButtons() {
    document.querySelectorAll('[data-cm-grid-action="clearAllFilters"]').forEach((btn) => {
      var _a, _b, _c, _d, _e;
      if (btn.dataset.cmServerFilterState === "1") {
        btn.classList.remove("is-hidden");
        return;
      }
      const gridId = btn.getAttribute("data-cm-grid-id") || "";
      const handle = (_b = (_a = window.GridView) == null ? void 0 : _a.byId) == null ? void 0 : _b.get(gridId);
      const toolbar = btn.closest(".cm-toolbar-unified");
      const toolbarFilterActive = !!(toolbar == null ? void 0 : toolbar.querySelector(
        '[data-cm-multiselect] input[type="checkbox"]:checked'
      ));
      const table = gridId ? document.querySelector('[data-grid-id="' + cssAttr(gridId) + '"]') : null;
      const simpleActive = !!(table == null ? void 0 : table.querySelector(".cm-col-filter-btn.is-active"));
      const model = (_e = (_d = (_c = handle == null ? void 0 : handle.gridApi) == null ? void 0 : _c.getFilterModel) == null ? void 0 : _d.call(_c)) != null ? _e : {};
      const agActive = Object.keys(model).length > 0;
      const handleActive = handle && typeof handle.hasActiveFilters === "function" ? handle.hasActiveFilters() : false;
      const toolbarSearchActive = hasActiveToolbarSearch(toolbar);
      btn.classList.toggle(
        "is-hidden",
        !(handleActive || toolbarFilterActive || simpleActive || agActive || toolbarSearchActive || hasActiveUrlFilterState())
      );
    });
  }
  function handleToolbarSavedSearchClick(e) {
    var _a, _b;
    const target = eventTargetElement(e.target);
    if (!target) return;
    const gridBtn = target.closest(
      '[data-cm-grid-action="saveSearch"], [data-cm-grid-action="toggleSavedSearches"], [data-cm-grid-action="clearSearch"], [data-cm-grid-action="clearAllFilters"], [data-cm-grid-action="reloadData"], [data-cm-toolbar-search-clear][data-cm-grid-action="clearSearch"]'
    );
    if (!gridBtn) return;
    e.preventDefault();
    e.stopPropagation();
    const scopeId = gridBtn.getAttribute("data-cm-grid-id") || gridBtn.getAttribute("data-cm-search-scope-id") || ((_a = asHTMLElement(gridBtn.closest("[data-cm-toolbar-search-root]"))) == null ? void 0 : _a.dataset.cmSearchScopeId) || "";
    if (!scopeId) return;
    const action = gridBtn.getAttribute("data-cm-grid-action");
    if (action === "saveSearch") ToolbarSearch.save(scopeId);
    else if (action === "toggleSavedSearches") ToolbarSearch.toggle(scopeId);
    else if (action === "clearAllFilters") {
      const clearGridId = gridBtn.getAttribute("data-cm-grid-id") || scopeId;
      const toolbar = gridBtn.closest(".cm-toolbar-unified");
      const filterBar = (toolbar == null ? void 0 : toolbar.querySelector("[data-cm-filter-bar]")) || Array.from(document.querySelectorAll("[data-cm-filter-bar]")).find(
        (bar) => {
          var _a2;
          return ((_a2 = asHTMLElement(bar.closest(".cm-filters"))) == null ? void 0 : _a2.dataset.target) === clearGridId;
        }
      );
      clearToolbarSearchState(toolbar, clearGridId, filterBar || null);
      if (filterBar) {
        filterBar.querySelectorAll('input[type="checkbox"]').forEach((input) => {
          input.checked = false;
        });
        filterBar.querySelectorAll("[data-cm-search]").forEach((input) => {
          input.value = "";
        });
        filterBar.querySelectorAll("[data-cm-filter-input]").forEach((input) => {
          if (input.type === "checkbox") input.checked = false;
          else input.value = "";
        });
        filterBar.querySelectorAll("select[data-cm-grouped-select]").forEach((select) => {
          const defaultOption = Array.from(select.options).find((option) => !option.disabled);
          select.value = (defaultOption == null ? void 0 : defaultOption.value) || "";
        });
        invokeGridAction(clearGridId, "clearAllFilters", { purgeInfiniteCache: false });
        navigateFilterState(selectedFilterValues(filterBar), gridBtn, filterBar);
        return;
      }
      invokeGridAction(clearGridId, "clearAllFilters");
      clearSimpleTableFiltersForGrid(clearGridId);
      window.setTimeout(syncClearAllButtons, 0);
    } else if (action === "reloadData") {
      invokeGridAction(gridBtn.getAttribute("data-cm-grid-id") || scopeId, "reloadData");
    } else if (action === "clearSearch") {
      const clearInput = asHtmlInput(
        (_b = gridBtn.closest("[data-cm-toolbar-search-root]")) == null ? void 0 : _b.querySelector("[data-cm-toolbar-search]")
      );
      if (clearInput) {
        clearInput.value = "";
        clearInput.dispatchEvent(new Event("input", { bubbles: true }));
        syncToolbarSearchChrome(clearInput);
      }
      const root = asHTMLElement(gridBtn.closest("[data-cm-toolbar-search-root]"));
      const tableId = (root == null ? void 0 : root.dataset.cmTableGridId) || (root == null ? void 0 : root.dataset.cmPrefGridId) || scopeId;
      invokeGridAction(tableId, "clearSearch");
      window.setTimeout(syncClearAllButtons, 0);
    }
  }
  function bindDelegatedGridActions() {
    installConfirmationInterceptors();
    if (getGlobal()._cmGridActionsBound) {
      window.setTimeout(syncClearAllButtons, 0);
      return;
    }
    getGlobal()._cmGridActionsBound = true;
    document.addEventListener("click", handleToolbarSavedSearchClick, true);
    document.addEventListener("input", () => window.setTimeout(syncClearAllButtons, 0), true);
    document.addEventListener("cm-filter-change", () => window.setTimeout(syncClearAllButtons, 0));
    document.addEventListener("cm-grid-state-change", () => window.setTimeout(syncClearAllButtons, 0));
    window.setTimeout(syncClearAllButtons, 0);
    document.addEventListener("click", (e) => {
      var _a, _b, _c;
      const target = eventTargetElement(e.target);
      if (!target) return;
      const cellBtn = target.closest("[data-cm-cell-action]");
      if (cellBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (isDisabledElement(cellBtn)) return;
        const cellAction = cellBtn.getAttribute("data-cm-cell-action");
        if (cellAction) {
          confirmAndInvokeFromElement(cellBtn, () => {
            var _a2;
            invokeAction(cellAction, {
              rowId: cellBtn.getAttribute("data-cm-row-id") || void 0,
              gridId: ((_a2 = cellBtn.closest("[data-grid-id]")) == null ? void 0 : _a2.getAttribute("data-grid-id")) || void 0,
              event: e,
              source: "cell"
            });
          });
        }
        return;
      }
      const confirmedLink = target.closest("a[data-cm-confirm]");
      if (confirmedLink) {
        if (isDisabledElement(confirmedLink)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        confirmAndInvokeFromElement(confirmedLink, () => {
          continueConfirmedLink(confirmedLink);
        });
        return;
      }
      const actBtn = target.closest("[data-cm-action]");
      if (actBtn) {
        if (isDisabledElement(actBtn)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const actionName = actBtn.getAttribute("data-cm-action");
        if (actionName && actionName !== "show_content") {
          e.preventDefault();
          e.stopPropagation();
          const toolbar = actBtn.closest(".cm-toolbar-unified, [data-cm-toolbar]");
          const targetTableId = actBtn.getAttribute("data-cm-action-target") || (toolbar == null ? void 0 : toolbar.getAttribute("data-cm-toolbar-target")) || ((_a = actBtn.closest("[data-grid-id]")) == null ? void 0 : _a.getAttribute("data-grid-id")) || void 0;
          const selectRef = actBtn.getAttribute("data-cm-action-select-ref");
          let selectedValue = void 0;
          if (selectRef) {
            const selectEl = (_b = actBtn.parentElement) == null ? void 0 : _b.querySelector(
              `[data-cm-action-select="${selectRef}"]`
            );
            selectedValue = selectEl == null ? void 0 : selectEl.value;
          }
          confirmAndInvokeFromElement(actBtn, () => {
            invokeAction(actionName, {
              gridId: targetTableId,
              selectedValue,
              event: e,
              source: "batch"
            });
          });
          return;
        }
      }
      const colBtn = target.closest("[data-cm-col-action]");
      if (colBtn) {
        const colAction = colBtn.getAttribute("data-cm-col-action");
        const colGridId = colBtn.getAttribute("data-cm-grid-id");
        if (colAction === "toggle") invokeGridAction(colGridId, "toggleColSelector");
        else if (colAction === "toggle-modal") invokeGridAction(colGridId, "openColSelectorModal");
        else if (colAction === "close") invokeGridAction(colGridId, "closeColSelectorModal");
        else if (colAction === "reset") invokeGridAction(colGridId, "resetColumnsToDefault");
        else if (colAction === "savePreset") invokeGridAction(colGridId, "saveCurrentPreset");
        return;
      }
      const openMoreMenus = document.querySelectorAll("details.cm-toolbar-more-menu[open]");
      if (openMoreMenus.length > 0) {
        openMoreMenus.forEach((menu) => {
          if (!menu.contains(target) || target.closest(".cm-toolbar-more-item")) {
            menu.removeAttribute("open");
          }
        });
      }
      const filtersToggle = target.closest("[data-cm-filters-toggle]");
      if (filtersToggle) {
        const targetId = filtersToggle.dataset.cmTarget;
        const center = targetId ? document.getElementById(targetId) : (_c = filtersToggle.closest(".cm-toolbar-unified")) == null ? void 0 : _c.querySelector(".cm-toolbar-center");
        if (center) {
          const isOpen = center.classList.contains("is-open");
          document.querySelectorAll(".cm-toolbar-center.is-open").forEach((el) => el.classList.remove("is-open"));
          document.querySelectorAll("[data-cm-filters-toggle].is-active-open").forEach((el) => el.classList.remove("is-active-open"));
          if (!isOpen) {
            center.classList.add("is-open");
            filtersToggle.classList.add("is-active-open");
          }
        }
        return;
      }
      const filtersClose = target.closest("[data-cm-filters-close]");
      if (filtersClose) {
        document.querySelectorAll(".cm-toolbar-center.is-open").forEach((el) => el.classList.remove("is-open"));
        document.querySelectorAll("[data-cm-filters-toggle].is-active-open").forEach((el) => el.classList.remove("is-active-open"));
        return;
      }
      if (!target.closest(".cm-toolbar-center") && !target.closest("[data-cm-filters-toggle]")) {
        document.querySelectorAll(".cm-toolbar-center.is-open").forEach((el) => el.classList.remove("is-open"));
        document.querySelectorAll("[data-cm-filters-toggle].is-active-open").forEach((el) => el.classList.remove("is-active-open"));
      }
    });
    document.addEventListener("input", (e) => {
      var _a, _b;
      const inp = asHtmlInput((_b = (_a = eventTargetElement(e.target)) == null ? void 0 : _a.closest("[data-cm-grid-search]")) != null ? _b : null);
      if (!inp) return;
      if (inp.getAttribute("data-cm-grid-search-apply") === "enter") return;
      invokeGridAction(inp.getAttribute("data-cm-grid-id"), "onQuickFilterChanged");
    });
    document.addEventListener("keydown", (e) => {
      var _a, _b;
      if (e.key === "Escape") {
        document.querySelectorAll(".cm-toolbar-center.is-open").forEach((el) => el.classList.remove("is-open"));
        document.querySelectorAll("[data-cm-filters-toggle].is-active-open").forEach((el) => el.classList.remove("is-active-open"));
      }
      if (e.key !== "Enter") return;
      const inp = asHtmlInput(
        (_b = (_a = eventTargetElement(e.target)) == null ? void 0 : _a.closest(
          '[data-cm-grid-search][data-cm-grid-search-apply="enter"]'
        )) != null ? _b : null
      );
      if (!inp) return;
      e.preventDefault();
      invokeGridAction(inp.getAttribute("data-cm-grid-id"), "reloadData");
    });
    initResponsiveToolbars();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initResponsiveToolbars);
    }
  }
  function initResponsiveToolbars() {
    const toolbars = document.querySelectorAll(".cm-toolbar-unified");
    toolbars.forEach((toolbar) => {
      if (toolbar.dataset.cmResponsiveInit) return;
      toolbar.dataset.cmResponsiveInit = "1";
      const left = toolbar.querySelector(".cm-toolbar-left");
      const center = toolbar.querySelector(".cm-toolbar-center");
      const desktopActions = toolbar.querySelector(".cm-toolbar-desktop-actions");
      const moreMenu = toolbar.querySelector(".cm-toolbar-more-menu");
      const filtersToggle = toolbar.querySelector(".cm-toolbar-filters-toggle");
      const update = () => {
        const width = toolbar.clientWidth;
        if (width === 0) return;
        const searchField = left == null ? void 0 : left.querySelector(".cm-toolbar-search-field");
        const hasSearch = !!searchField;
        toolbar.classList.toggle("cm-toolbar--no-search", !hasSearch);
        const isMobile = hasSearch && window.innerWidth <= 768;
        if (isMobile) {
          toolbar.classList.add("cm-toolbar--mobile");
          toolbar.classList.remove("cm-toolbar--actions-collapsed");
          if (filtersToggle) filtersToggle.style.display = "";
          if (desktopActions) desktopActions.style.display = "";
          if (moreMenu) moreMenu.style.display = "";
          return;
        }
        toolbar.classList.remove("cm-toolbar--mobile");
        if (filtersToggle) filtersToggle.style.display = "none";
        const searchActions = left == null ? void 0 : left.querySelector(".cm-toolbar-search-actions");
        const leftW = (searchField ? 220 : (left == null ? void 0 : left.scrollWidth) || 0) + ((searchActions == null ? void 0 : searchActions.scrollWidth) || 0);
        const centerW = (center == null ? void 0 : center.scrollWidth) || 0;
        const counters = toolbar.querySelector(".cm-toolbar-counters");
        const countersW = counters && counters.offsetWidth > 0 ? counters.offsetWidth : 0;
        const actionsW = desktopActions && desktopActions.offsetWidth > 0 ? desktopActions.offsetWidth : 160;
        const requiredW = leftW + centerW + countersW + actionsW + 40;
        const shouldCollapse = width < requiredW;
        toolbar.classList.toggle("cm-toolbar--actions-collapsed", shouldCollapse);
        if (desktopActions) desktopActions.style.display = shouldCollapse ? "none" : "";
        if (moreMenu) moreMenu.style.display = shouldCollapse ? "block" : "";
      };
      update();
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(update).observe(toolbar);
      } else {
        window.addEventListener("resize", update);
      }
    });
  }
  function initSimpleTableColumnSettings(wrapper) {
    var _a;
    const fn = (_a = getGlobal().GridView) == null ? void 0 : _a.initSimpleTableColumnSettings;
    if (typeof fn === "function" && fn !== initSimpleTableColumnSettings) {
      return fn(wrapper);
    }
    return null;
  }

  // src/grid-view/format.ts
  function num(value) {
    if (value === null || value === void 0 || value === "") return null;
    const parsed = Number(String(value).replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  function uiLocale() {
    if (typeof document === "undefined" || !document.documentElement) return void 0;
    return document.documentElement.lang || void 0;
  }

  // src/grid-view/kpi.ts
  function formatKpiValue(value, fmt) {
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    fmt = fmt || "number";
    if (fmt === "currency") {
      return n.toLocaleString(uiLocale(), { maximumFractionDigits: 0 });
    }
    if (fmt === "percent") {
      return n.toFixed(1) + "%";
    }
    if (fmt === "number") {
      if (Math.abs(n - Math.round(n)) < 1e-9) {
        return Math.round(n).toLocaleString(uiLocale());
      }
      return n.toLocaleString(uiLocale(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
    return String(value);
  }
  function aggregateKpi(spec, rows) {
    var _a, _b;
    const agg = spec.aggregate || "count";
    if (agg === "count") return rows.length;
    const key = (_b = (_a = spec.columnKey) != null ? _a : spec.column_key) != null ? _b : spec.field;
    if (!key) return 0;
    const nums = [];
    rows.forEach((row) => {
      const parsed = num(row[key]);
      if (parsed !== null) nums.push(parsed);
    });
    if (agg === "sum")
      return nums.reduce(function(a, b) {
        return a + b;
      }, 0);
    if (agg === "avg")
      return nums.length ? nums.reduce(function(a, b) {
        return a + b;
      }, 0) / nums.length : 0;
    if (agg === "min") return nums.length ? Math.min.apply(null, nums) : 0;
    if (agg === "max") return nums.length ? Math.max.apply(null, nums) : 0;
    return 0;
  }
  function resolveKpis(specs, rows) {
    return (specs || []).map(function(spec) {
      var raw = aggregateKpi(spec, rows);
      return {
        label: spec.label || "",
        valueFmt: formatKpiValue(raw, spec.format),
        rawValue: raw,
        tone: spec.tone || "default",
        icon: spec.icon || void 0
      };
    });
  }
  function kpiCardHtml(kpi) {
    var icon = kpi.icon || "\u{1F4CA}";
    var label = kpi.label || "";
    var value = kpi.valueFmt || kpi.value_fmt || "";
    return '<span class="cm-kpi-icon" aria-hidden="true">' + icon + '</span><div class="cm-kpi-body"><span class="cm-kpi-label">' + label + '</span><span class="cm-kpi-value">' + value + "</span></div>";
  }
  function initKpiStrip(root, kpis, columns) {
    if (!root || !(kpis == null ? void 0 : kpis.length)) return;
    root.innerHTML = "";
    root.className = `cm-kpi-grid cm-kpi-cols-${columns || 4}`;
    kpis.forEach((kpi) => {
      const card = document.createElement("div");
      card.className = `cm-kpi-card cm-kpi-tone-${kpi.tone || "default"}`;
      card.innerHTML = kpiCardHtml(kpi);
      root.appendChild(card);
    });
  }
  function initAllKpi(scope) {
    const root = scope || document;
    root.querySelectorAll("[data-cm-kpi-config]").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.dataset.cmKpiReady) return;
      const kpis = JSON.parse(
        node.dataset.cmKpiConfig || "[]"
      );
      const columns = parseInt(node.dataset.cmKpiColumns || "4", 10);
      initKpiStrip(node, kpis, columns);
      node.dataset.cmKpiReady = "1";
    });
  }
  var Kpi = { initKpiStrip, initAllKpi, kpiCardHtml };

  // src/grid-view/grid-adapter.ts
  function staticRowsAdapter(rows) {
    const snapshot = rows != null ? rows : [];
    return {
      getRows: () => snapshot,
      onChange: () => () => {
      }
    };
  }
  function createAgGridAdapter(gridApi) {
    if (!gridApi) return staticRowsAdapter([]);
    return {
      getRows: () => {
        var _a;
        const out = [];
        (_a = gridApi.forEachNodeAfterFilterAndSort) == null ? void 0 : _a.call(gridApi, (node) => {
          if (node == null ? void 0 : node.data) out.push(node.data);
        });
        return out;
      },
      onChange: (cb) => {
        const events = ["filterChanged", "sortChanged", "modelUpdated"];
        events.forEach((ev) => {
          var _a;
          (_a = gridApi.addEventListener) == null ? void 0 : _a.call(gridApi, ev, cb);
        });
        return () => {
          events.forEach((ev) => {
            var _a;
            (_a = gridApi.removeEventListener) == null ? void 0 : _a.call(gridApi, ev, cb);
          });
        };
      }
    };
  }
  function initGridKpiStrip(kpiRoot, specs, adapter, columns) {
    if (!kpiRoot || !specs.length || !adapter) return null;
    const refresh = () => {
      Kpi.initKpiStrip(kpiRoot, resolveKpis(specs, adapter.getRows()), columns);
    };
    refresh();
    return adapter.onChange(refresh);
  }
  function bindGridKpis(opts = {}) {
    var _a;
    const scope = (_a = opts.root) != null ? _a : document;
    const adapter = opts.gridAdapter;
    if (!adapter) return null;
    const unsubs = [];
    scope.querySelectorAll("[data-cm-grid-kpi]").forEach((wrap) => {
      if (!(wrap instanceof HTMLElement)) return;
      if (wrap.dataset.cmGridKpiReady) return;
      let specs = [];
      try {
        specs = JSON.parse(wrap.dataset.cmGridKpiSpecs || "[]");
      } catch (_e) {
        specs = [];
      }
      const columns = parseInt(wrap.dataset.cmKpiColumns || "4", 10);
      const kpiRoot = wrap.querySelector("[data-cm-kpi-root]") || wrap;
      const unsub = initGridKpiStrip(kpiRoot, specs, adapter, columns);
      if (typeof unsub === "function") unsubs.push(unsub);
      wrap.dataset.cmGridKpiReady = "1";
    });
    return () => {
      unsubs.forEach((u) => u());
    };
  }
  function bindGridFilteredCharts(scope, adapter) {
    const unsubs = [];
    scope.querySelectorAll("[data-cm-chart-config]").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.dataset.cmChartInteractive) return;
      let config;
      try {
        config = JSON.parse(node.dataset.cmChartConfig || "{}");
      } catch (_e) {
        return;
      }
      if (config.dataSource !== "grid_filtered") return;
      const refresh = () => {
        ChartsBridge.refreshChartWrap(node, config, adapter.getRows());
      };
      refresh();
      const unsub = adapter.onChange(refresh);
      if (typeof unsub === "function") unsubs.push(unsub);
      node.dataset.cmChartReady = "1";
    });
    return () => {
      unsubs.forEach((u) => u());
    };
  }
  var GridAdapter = {
    staticRowsAdapter,
    createAgGridAdapter,
    resolveKpis,
    bindGridKpis,
    bindGridFilteredCharts
  };

  // src/grid-view/table-edit.ts
  function csrfToken() {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }
  function interpolateEndpoint(template, rowId) {
    return template.replace(/\{id\}/g, rowId);
  }
  async function postCommitEndpoint(endpoint, rowId, field, newValue) {
    const url = interpolateEndpoint(endpoint, rowId);
    const body = {};
    if (field.includes("department")) {
      body.department_id = newValue ? Number(newValue) : null;
    } else {
      body[field] = newValue;
    }
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken()
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) return false;
    try {
      const data = await res.json();
      return !data || data.status !== "error";
    } catch (e) {
      return res.ok;
    }
  }
  function updateSelectView(cell, select, saved) {
    var _a, _b;
    const view = cell.querySelector(".cm-dept-view, .cm-cell-edit-view");
    if (!view) return;
    const emptyLabel = cell.getAttribute("data-cm-empty-label") || "\u2014";
    if (!select.value) {
      view.textContent = emptyLabel;
      return;
    }
    const savedName = saved && typeof saved.department_name === "string" ? saved.department_name : "";
    const optionText = ((_b = (_a = select.options[select.selectedIndex]) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || "";
    view.textContent = savedName || optionText;
  }
  function flashCell(cell) {
    cell.classList.add("cm-dept-cell--saved", "cm-cell-edit--saved");
    setTimeout(() => {
      cell.classList.remove("cm-dept-cell--saved", "cm-cell-edit--saved");
    }, 1500);
  }
  async function saveSelect(shell, config, select) {
    const rowId = select.getAttribute("data-cm-row-id") || "";
    const cell = select.closest("[data-cm-cell-edit]");
    const field = (cell == null ? void 0 : cell.getAttribute("data-cm-field")) || "";
    const prev = select.dataset.cmEditPrev || "";
    const value = select.value;
    if (value === prev) return true;
    select.disabled = true;
    let ok = false;
    try {
      if (config.commitCallback) {
        ok = await invokeCommit(config.commitCallback, {
          rowId,
          gridId: shell.getAttribute("data-grid-id") || void 0,
          columnId: field,
          field,
          oldValue: prev,
          newValue: value
        });
      } else if (config.commitEndpoint) {
        ok = await postCommitEndpoint(config.commitEndpoint, rowId, field, value);
      }
      if (!ok) {
        select.value = prev;
        const i18n2 = window.GridViewI18n;
        notify({
          message: (i18n2 == null ? void 0 : i18n2["table.save_error"]) || "Failed to save changes",
          tone: "error"
        });
        return false;
      }
      select.dataset.cmEditPrev = value;
      if (cell) {
        updateSelectView(cell, select);
        flashCell(cell);
      }
      return true;
    } catch (e) {
      select.value = prev;
      const i18n2 = window.GridViewI18n;
      notify({
        message: (i18n2 == null ? void 0 : i18n2["table.network_error"]) || "Network error",
        tone: "error"
      });
      return false;
    } finally {
      select.disabled = false;
    }
  }
  function ensureHeaderControls(shell, config) {
    var _a;
    if (!config.confirm || config.mode !== "row") return;
    if (!((_a = config.columns) == null ? void 0 : _a.length) || shell.querySelector(".cm-table-edit-tools")) return;
    const tools = document.createElement("div");
    tools.className = "cm-table-edit-tools cm-table-edit-toolbar";
    tools.innerHTML = '<button type="button" class="cm-table-edit-toggle cm-dept-edit-toggle" title="Edit" aria-label="Edit">Edit</button><button type="button" class="cm-table-edit-done cm-dept-edit-done" hidden title="Done" aria-label="Done">Done</button>';
    shell.prepend(tools);
    const gv2 = getGlobal().GridView;
    if (gv2 && typeof gv2.initButtonEllipsisTips === "function") {
      gv2.initButtonEllipsisTips(tools);
    }
    const toggle = tools.querySelector(".cm-table-edit-toggle");
    const done = tools.querySelector(".cm-table-edit-done");
    const layout = shell.closest(".cm-page-table-layout, .cm-dashboard-page") || shell;
    toggle == null ? void 0 : toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      layout.classList.add("cm-table--row-edit", "cm-doctor-page--dept-edit");
      shell.setAttribute("data-cm-inline-edit-active", "");
      if (toggle) toggle.hidden = true;
      if (done) done.hidden = false;
    });
    done == null ? void 0 : done.addEventListener("click", (e) => {
      e.stopPropagation();
      const selects = shell.querySelectorAll(
        "[data-cm-inline-edit]"
      );
      const pending = [];
      selects.forEach((select) => {
        if (select.value !== (select.dataset.cmEditPrev || "")) {
          pending.push(saveSelect(shell, config, select));
        }
      });
      const finish = () => {
        layout.classList.remove("cm-table--row-edit", "cm-doctor-page--dept-edit");
        shell.removeAttribute("data-cm-inline-edit-active");
        if (done) done.hidden = true;
        if (toggle) toggle.hidden = false;
      };
      if (!pending.length) {
        finish();
        return;
      }
      if (done) done.disabled = true;
      Promise.all(pending).finally(() => {
        if (done) done.disabled = false;
        finish();
      });
    });
  }
  function bindSelectCells(shell, config) {
    shell.querySelectorAll("[data-cm-inline-edit]").forEach((select) => {
      if (!select.dataset.cmEditPrev) {
        select.dataset.cmEditPrev = select.value;
      }
    });
    if (shell.dataset.cmTableEditChangeBound) return;
    shell.dataset.cmTableEditChangeBound = "1";
    shell.addEventListener("change", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLSelectElement)) return;
      if (!target.matches("[data-cm-inline-edit]")) return;
      if (!config.confirm) {
        void saveSelect(shell, config, target);
      }
    });
  }
  function initTableEdit(scope = document) {
    scope.querySelectorAll("[data-cm-table-edit]").forEach((shell) => {
      var _a;
      if (shell.dataset.cmTableEditBound) return;
      let config;
      try {
        config = JSON.parse(shell.getAttribute("data-cm-table-edit") || "{}");
      } catch (e) {
        return;
      }
      if (!((_a = config.columns) == null ? void 0 : _a.length)) return;
      shell.dataset.cmTableEditBound = "1";
      bindSelectCells(shell, config);
      ensureHeaderControls(shell, config);
    });
  }

  // src/grid-view/init.ts
  function init(opts) {
    var _a, _b, _c, _d;
    const options = opts != null ? opts : {};
    const scope = (_a = options.root) != null ? _a : document;
    const adapter = options.gridAdapter;
    const disconnectFns = [];
    if (options.artifact) {
      const artifact = options.artifact;
      if ((_b = artifact.kpis) == null ? void 0 : _b.length) {
        const kpiRoot = scope.querySelector("[data-cm-kpi-root]");
        if (kpiRoot) {
          Kpi.initKpiStrip(kpiRoot, artifact.kpis, (_c = artifact.layout) == null ? void 0 : _c.kpiColumns);
        }
      }
      ((_d = artifact.charts) != null ? _d : []).forEach((chartCfg) => {
        var _a2, _b2;
        const el = scope.querySelector(`[data-cm-chart-id="${chartCfg.id}"]`);
        if (el) {
          const chartRoot = (_a2 = el.querySelector("[data-cm-chart-root]")) != null ? _a2 : el;
          ChartsBridge.initChart(chartRoot, chartCfg, (_b2 = artifact.rows) != null ? _b2 : []);
        }
      });
    }
    if (adapter) {
      const dKpi = bindGridKpis({ root: scope, gridAdapter: adapter });
      if (dKpi) disconnectFns.push(dKpi);
      const dCharts = bindGridFilteredCharts(scope, adapter);
      if (dCharts) disconnectFns.push(dCharts);
    }
    Kpi.initAllKpi(scope);
    ChartsBridge.initAllCharts(scope);
    initAllSimpleTables(scope);
    initTableEdit(scope);
    initFilterBars(scope);
    initButtonEllipsisTips(scope);
    initTabGroups(scope);
    const onCellEdit = options.onCellEdit;
    if (typeof onCellEdit === "function") {
      scope.querySelectorAll("[data-cm-editable]").forEach((cellEl) => {
        const cell = asHTMLElement(cellEl);
        if (!cell || cell.dataset.cmEditBound) return;
        cell.dataset.cmEditBound = "1";
        cell.addEventListener("blur", () => {
          var _a2, _b2, _c2, _d2;
          const row = cell.closest(".cm-row");
          const rowEl = asHTMLElement(row);
          onCellEdit({
            gridId: (_b2 = (_a2 = rowEl == null ? void 0 : rowEl.closest("[data-grid-id]")) == null ? void 0 : _a2.getAttribute("data-grid-id")) != null ? _b2 : void 0,
            rowId: (_c2 = rowEl == null ? void 0 : rowEl.dataset.cmRowId) != null ? _c2 : void 0,
            columnKey: cell.dataset.cmColumnKey,
            oldValue: cell.dataset.cmOldValue,
            newValue: (_d2 = cell.textContent) == null ? void 0 : _d2.trim(),
            row: {}
          });
        });
      });
    }
    if (disconnectFns.length) {
      return () => {
        disconnectFns.forEach((fn) => fn());
      };
    }
    return void 0;
  }

  // src/grid-view/ag-grid.ts
  function isExtraParamsProvider(fn) {
    return typeof fn === "function";
  }
  function isAgGridSortState(col) {
    return typeof col === "object" && col !== null && Boolean(Reflect.get(col, "sort"));
  }
  function getQuickSearchText(gridIdOrHandle) {
    var _a, _b;
    const handle = typeof gridIdOrHandle === "string" ? byId.get(gridIdOrHandle) : gridIdOrHandle != null ? gridIdOrHandle : null;
    const id = (_a = handle == null ? void 0 : handle.gridId) != null ? _a : typeof gridIdOrHandle === "string" ? gridIdOrHandle : "";
    const input = id ? resolveToolbarSearchInput(id) : null;
    if (input == null ? void 0 : input.value) return input.value.trim();
    if (handle == null ? void 0 : handle._searchText) return handle._searchText;
    return ((_b = new URLSearchParams(window.location.search).get("q")) != null ? _b : "").trim();
  }
  function absorbUrlSearchQuery(handle, options = {}) {
    var _a;
    const paramName = (_a = options.urlSearchParam) != null ? _a : "q";
    const urlQ = new URLSearchParams(window.location.search).get(paramName);
    if (!urlQ || handle._urlQAbsorbed) return "";
    handle._searchText = urlQ;
    handle._urlQAbsorbed = true;
    window.setTimeout(() => {
      var _a2;
      const searchInput = resolveToolbarSearchInput((_a2 = handle.gridId) != null ? _a2 : "");
      if (searchInput) searchInput.value = urlQ;
    }, 50);
    return urlQ;
  }
  function buildInfiniteQueryParams(blockParams, gridIdOrHandle, options) {
    options = options || {};
    var handle = typeof gridIdOrHandle === "string" ? byId.get(gridIdOrHandle) : gridIdOrHandle;
    var extra = options.getExtraParams && options.getExtraParams() || {};
    var qf = getQuickSearchText(handle);
    if (options.absorbUrlSearch !== false && handle) {
      var absorbed = absorbUrlSearchQuery(handle, options);
      if (absorbed) qf = absorbed;
    }
    var params = new URLSearchParams();
    Object.keys(extra).forEach(function(key) {
      var val = extra[key];
      if (val == null || val === "") return;
      if (Array.isArray(val)) {
        if (val.length) params.set(key, val.join(","));
        return;
      }
      params.set(key, String(val));
    });
    if (blockParams) {
      params.set("startRow", String(blockParams.startRow));
      params.set("endRow", String(blockParams.endRow));
      var filterModel = blockParams.filterModel || {};
      if (Object.keys(filterModel).length) {
        params.set("filters", JSON.stringify(filterModel));
      }
      if (blockParams.sortModel && blockParams.sortModel.length) {
        params.set("sort", JSON.stringify(blockParams.sortModel));
      }
    }
    if (qf) params.set("q", qf);
    if (handle && handle.gridApi && typeof handle.gridApi.getAllDisplayedColumns === "function" && options.includeVisibleCols !== false) {
      var visibleCols = handle.gridApi.getAllDisplayedColumns().map(function(col) {
        return col.getColId();
      }).join(",");
      if (visibleCols) params.set("cols", visibleCols);
    }
    return params;
  }
  function createInfiniteDatasource(options) {
    const url = options.url;
    const gridId = options.gridId;
    return {
      getRows: function(blockParams) {
        var _a;
        const handle = gridId ? byId.get(gridId) : null;
        if (!handle) {
          blockParams.failCallback();
          return;
        }
        const params = buildInfiniteQueryParams(blockParams, handle, options);
        if (blockParams.startRow === 0) {
          (_a = handle.showLoading) == null ? void 0 : _a.call(handle);
        }
        const requestUrl = new URL(url, window.location.origin);
        params.forEach((value, key) => requestUrl.searchParams.set(key, value));
        fetch(requestUrl.toString()).then(function(response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json();
        }).then(function(data) {
          var _a2, _b;
          const lastRow = typeof data.lastRow === "number" && Number.isSafeInteger(data.lastRow) && data.lastRow >= 0 ? data.lastRow : void 0;
          const totalCount = typeof data.totalCount === "number" && Number.isSafeInteger(data.totalCount) && data.totalCount >= 0 ? data.totalCount : void 0;
          (_a2 = handle.hideOverlay) == null ? void 0 : _a2.call(handle);
          blockParams.successCallback(data.data, lastRow);
          if (gridId && totalCount !== void 0) updateRecordCounters(gridId, totalCount);
          else if (gridId && lastRow !== void 0) updateRecordCounters(gridId, lastRow);
          if (lastRow !== void 0) (_b = options.onLastRow) == null ? void 0 : _b.call(options, lastRow);
        }).catch(function(error) {
          var _a2;
          console.error("[GridView.AgGrid] infinite fetch failed:", error);
          (_a2 = handle.hideOverlay) == null ? void 0 : _a2.call(handle);
          blockParams.failCallback();
        });
      }
    };
  }
  function syncExportLinks(gridIdOrHandle, options) {
    options = options || {};
    var gridId = typeof gridIdOrHandle === "string" ? gridIdOrHandle : gridIdOrHandle && gridIdOrHandle.gridId;
    if (!gridId) return;
    var esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(gridId) : gridId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    document.querySelectorAll('[data-cm-export-sync][data-cm-grid-id="' + esc + '"]').forEach(function(linkEl) {
      var extraFn = linkEl.getAttribute("data-cm-export-extra-fn");
      var linkOpts = Object.assign({}, options);
      if (extraFn) {
        var provider = Reflect.get(getGlobal(), extraFn);
        if (isExtraParamsProvider(provider) && !linkOpts.getExtraParams) {
          linkOpts.getExtraParams = provider;
        }
      }
      syncExportHref(linkEl, gridId, linkOpts);
    });
  }
  function syncExportHref(linkEl, gridIdOrHandle, options) {
    if (!(linkEl instanceof HTMLAnchorElement) || !linkEl.href) return;
    options = options || {};
    var target = new URL(linkEl.href, window.location.origin);
    var extra = options.getExtraParams && options.getExtraParams() || {};
    Object.keys(extra).forEach(function(key) {
      var val = extra[key];
      if (val != null && val !== "") target.searchParams.set(key, String(val));
      else target.searchParams.delete(key);
    });
    var handle = typeof gridIdOrHandle === "string" ? byId.get(gridIdOrHandle) : gridIdOrHandle;
    var qf = getQuickSearchText(handle || gridIdOrHandle);
    if (qf) target.searchParams.set("q", qf);
    else target.searchParams.delete("q");
    var gridId = handle && handle.gridId || (typeof gridIdOrHandle === "string" ? gridIdOrHandle : "");
    var colScope = linkEl;
    if (gridId) {
      var escGrid = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(gridId) : gridId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      colScope = document.querySelector('[data-grid-id="' + escGrid + '"]') || linkEl.closest(
        ".cm-page-table-layout, .cm-dashboard-page, .cm-simple-wrapper, .cm-table-shell"
      ) || document;
    }
    var colQ = serializeColumnFilters(colScope);
    if (colQ) target.searchParams.set("col_q", colQ);
    else target.searchParams.delete("col_q");
    if (handle && handle.gridApi && typeof handle.gridApi.getFilterModel === "function" && typeof handle.gridApi.getColumnState === "function" && typeof handle.gridApi.getAllDisplayedColumns === "function") {
      var filterModel = handle.gridApi.getFilterModel() || {};
      if (Object.keys(filterModel).length) {
        target.searchParams.set("filters", JSON.stringify(filterModel));
      } else {
        target.searchParams.delete("filters");
      }
      var colState = handle.gridApi.getColumnState();
      var sortState = Array.isArray(colState) ? colState.filter(isAgGridSortState) : [];
      if (sortState.length) {
        target.searchParams.set(
          "sort",
          JSON.stringify(
            sortState.map(function(col) {
              return { colId: col.colId, sort: col.sort };
            })
          )
        );
      } else {
        target.searchParams.delete("sort");
      }
      if (options.exportColumns !== false) {
        var visibleCols = handle.gridApi.getAllDisplayedColumns().map(function(col) {
          return col.getColId();
        }).join(",");
        if (visibleCols) target.searchParams.set("export_cols", visibleCols);
        else target.searchParams.delete("export_cols");
      } else {
        target.searchParams.delete("export_cols");
      }
      if (options.includeVisibleCols) {
        var gridCols = handle.gridApi.getAllDisplayedColumns().map(function(col) {
          return col.getColId();
        }).join(",");
        if (gridCols) target.searchParams.set("cols", gridCols);
        else target.searchParams.delete("cols");
      } else {
        target.searchParams.delete("cols");
      }
    } else if (handle && handle.adapter && typeof handle.adapter.getDisplayedColumnIds === "function") {
      var domCols = handle.adapter.getDisplayedColumnIds().join(",");
      if (domCols) target.searchParams.set("export_cols", domCols);
      else target.searchParams.delete("export_cols");
    }
    linkEl.href = target.toString();
  }
  var AgGrid = {
    resolveToolbarSearchInput,
    getQuickSearchText,
    buildInfiniteQueryParams,
    createInfiniteDatasource,
    syncExportHref,
    syncExportLinks
  };

  // src/runtime/content-actions.ts
  function resolveContentBlock(targetId) {
    var _a;
    return (_a = document.getElementById(`block-${targetId}`)) != null ? _a : document.querySelector(`[data-block-id="${targetId}"]`);
  }
  function showContentBlock(targetId, autoHideMs) {
    const block = resolveContentBlock(targetId);
    if (!block) return;
    block.classList.remove("hidden");
    if (autoHideMs && autoHideMs > 0) {
      window.setTimeout(() => block.classList.add("hidden"), autoHideMs);
    }
  }
  function resolveOverlay(overlayId) {
    return document.getElementById(`cm-overlay-${overlayId}`);
  }
  function closeOverlay(overlay2) {
    var _a;
    overlay2.hidden = true;
    const triggerId = overlay2.dataset.cmOverlayTrigger;
    if (triggerId) (_a = document.getElementById(triggerId)) == null ? void 0 : _a.focus();
  }
  var overlayEscapeBound = false;
  function bindOverlayEscapeClose() {
    if (overlayEscapeBound) return;
    overlayEscapeBound = true;
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll("[data-cm-overlay]:not([hidden])").forEach((overlay2) => {
        if (overlay2.dataset.cmCloseOnEscape === "1") closeOverlay(overlay2);
      });
    });
  }
  function initOverlayActions(scope) {
    bindOverlayEscapeClose();
    scope.querySelectorAll("[data-overlay-id]").forEach((trigger) => {
      if (trigger.dataset.cmOverlayInit) return;
      trigger.dataset.cmOverlayInit = "1";
      trigger.addEventListener("click", () => {
        confirmAndInvokeFromElement(trigger, () => {
          var _a, _b;
          const overlayId = (_a = trigger.getAttribute("data-overlay-id")) != null ? _a : "";
          const overlay2 = resolveOverlay(overlayId);
          if (!overlay2) return;
          if (!trigger.id) trigger.id = `cm-overlay-trigger-${overlayId}`;
          overlay2.dataset.cmOverlayTrigger = trigger.id;
          overlay2.hidden = false;
          (_b = overlay2.querySelector("[data-cm-overlay-close]")) == null ? void 0 : _b.focus();
        });
      });
    });
    scope.querySelectorAll("[data-cm-overlay]").forEach((overlay2) => {
      if (overlay2.dataset.cmOverlayInit) return;
      overlay2.dataset.cmOverlayInit = "1";
      overlay2.addEventListener("click", (event) => {
        if (event.target === overlay2 && overlay2.dataset.cmCloseOnBackdrop === "1") {
          closeOverlay(overlay2);
        }
      });
      overlay2.querySelectorAll("[data-cm-overlay-close]").forEach((button) => {
        button.addEventListener("click", () => closeOverlay(overlay2));
      });
    });
  }
  function applyDismissStorage(scope) {
    scope.querySelectorAll("[data-cm-content-dismissible]").forEach((el) => {
      var _a;
      const key = el.getAttribute("data-cm-dismiss-key");
      if (key && sessionStorage.getItem(key) === "1") {
        (_a = el.closest(".cm-block")) == null ? void 0 : _a.classList.add("hidden");
      }
    });
  }
  function initContentActions(scope) {
    applyDismissStorage(scope);
    initOverlayActions(scope);
    scope.querySelectorAll("[data-cm-content-dismiss]").forEach((btn) => {
      if (btn.dataset.cmContentDismissInit) return;
      btn.dataset.cmContentDismissInit = "1";
      btn.addEventListener("click", () => {
        var _a;
        const host = btn.closest("[data-cm-content-dismissible]");
        const key = host == null ? void 0 : host.getAttribute("data-cm-dismiss-key");
        if (key) sessionStorage.setItem(key, "1");
        (_a = btn.closest(".cm-block")) == null ? void 0 : _a.classList.add("hidden");
      });
    });
    scope.querySelectorAll('[data-cm-action="show_content"]').forEach((btn) => {
      if (btn.dataset.cmShowContentInit) return;
      btn.dataset.cmShowContentInit = "1";
      btn.addEventListener("click", () => {
        confirmAndInvokeFromElement(btn, () => {
          var _a;
          const targetId = (_a = btn.getAttribute("data-cm-action-target")) != null ? _a : "";
          if (!targetId) return;
          const autoHideRaw = btn.getAttribute("data-cm-auto-hide-ms");
          const autoHideMs = autoHideRaw ? parseInt(autoHideRaw, 10) : void 0;
          showContentBlock(targetId, Number.isFinite(autoHideMs) ? autoHideMs : void 0);
        });
      });
    });
  }

  // src/runtime/nav.ts
  function matchQuery(haystack, query) {
    if (!query || !query.trim()) return true;
    const gv2 = window.GridView;
    if (gv2 && typeof gv2.matchToolbarQuery === "function") {
      return gv2.matchToolbarQuery(haystack, query);
    }
    return haystack.toLowerCase().includes(query.trim().toLowerCase());
  }
  var _outsideClickBound = false;
  function bindOutsideClick() {
    if (_outsideClickBound || typeof document === "undefined") return;
    _outsideClickBound = true;
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target == null ? void 0 : target.closest("[data-cm-tree-create-container]"))) {
        document.querySelectorAll("[data-cm-tree-create-menu]").forEach((menu) => {
          var _a;
          menu.classList.add("hidden");
          const trigger = (_a = menu.parentElement) == null ? void 0 : _a.querySelector("[data-cm-tree-create-trigger]");
          const arrow = trigger == null ? void 0 : trigger.querySelector(".cm-nav-tree-create-arrow");
          if (arrow) arrow.classList.remove("rotate-180");
        });
      }
      if (!(target == null ? void 0 : target.closest("[data-cm-tree-saved-container]"))) {
        document.querySelectorAll("[data-cm-tree-saved-menu]").forEach((menu) => {
          menu.classList.add("hidden");
        });
      }
    });
  }
  function moveTreeNode(source, target, root) {
    var _a, _b, _c;
    if (target.classList.contains("cm-root-drop-zone")) {
      root == null ? void 0 : root.append(source);
    } else {
      const sourceAtRoot = (_a = source.parentElement) == null ? void 0 : _a.classList.contains("cm-nav-tree-items");
      const targetAtRoot = (_b = target.parentElement) == null ? void 0 : _b.classList.contains("cm-nav-tree-items");
      let children = target.querySelector(":scope > .cm-nav-tree-children");
      if (sourceAtRoot && targetAtRoot) {
        target.after(source);
      } else if (targetAtRoot || children || target.getAttribute("data-cm-node-can-have-children") === "1") {
        if (!children) {
          children = document.createElement("div");
          children.className = "cm-nav-tree-children pl-3 space-y-0.5 border-l border-slate-100 dark:border-[#1e263d] ml-3 mt-0.5";
          target.append(children);
        }
        children.append(source);
      } else {
        target.after(source);
      }
    }
    const parent = (_c = source.parentElement) == null ? void 0 : _c.closest(".cm-nav-tree-node");
    const parentId = parent == null ? void 0 : parent.getAttribute("data-node-id");
    if (parentId) {
      source.setAttribute("data-parent-id", parentId);
    } else {
      source.removeAttribute("data-parent-id");
    }
  }
  function initNavTrees(scope) {
    const root = scope && "querySelectorAll" in scope ? scope : document;
    const trees = [];
    if ("nodeType" in root && root.nodeType === 1) {
      const el = root;
      if (el.hasAttribute("data-cm-nav-tree")) {
        trees.push(el);
      }
    }
    root.querySelectorAll("[data-cm-nav-tree]").forEach((t3) => {
      if (!trees.includes(t3)) trees.push(t3);
    });
    bindOutsideClick();
    trees.forEach((tree) => {
      const treeEl = tree;
      if (treeEl.__cmTreeInit) return;
      treeEl.__cmTreeInit = true;
      tree.addEventListener("click", (e) => {
        var _a;
        const target = e.target;
        if (!target) return;
        const toggle = target.closest('[data-tree-toggle="1"]');
        if (toggle) {
          e.stopPropagation();
          const node = toggle.closest(".cm-nav-tree-node");
          const children = node == null ? void 0 : node.querySelector(".cm-nav-tree-children");
          if (children) {
            const isHidden = children.style.display === "none";
            children.style.display = isHidden ? "" : "none";
            const svg = toggle.querySelector("svg");
            if (svg) {
              svg.style.transform = isHidden ? "" : "rotate(-90deg)";
            }
          }
          return;
        }
        const createTrigger = target.closest("[data-cm-tree-create-trigger]");
        if (createTrigger) {
          const container = createTrigger.closest("[data-cm-tree-create-container]");
          const menu = container == null ? void 0 : container.querySelector("[data-cm-tree-create-menu]");
          const arrow = createTrigger.querySelector(".cm-nav-tree-create-arrow");
          if (menu) {
            const isHidden = menu.classList.contains("hidden");
            if (isHidden) {
              menu.classList.remove("hidden");
              if (arrow) arrow.classList.add("rotate-180");
            } else {
              menu.classList.add("hidden");
              if (arrow) arrow.classList.remove("rotate-180");
            }
          }
          return;
        }
        const createOption = target.closest("[data-cm-tree-create-menu] button");
        if (createOption) {
          const menu = createOption.closest("[data-cm-tree-create-menu]");
          if (menu) {
            menu.classList.add("hidden");
            const trigger = (_a = menu.parentElement) == null ? void 0 : _a.querySelector("[data-cm-tree-create-trigger]");
            const arrow = trigger == null ? void 0 : trigger.querySelector(".cm-nav-tree-create-arrow");
            if (arrow) arrow.classList.remove("rotate-180");
          }
        }
        if (target.closest(".cm-nav-tree-action")) {
          e.stopPropagation();
          return;
        }
        const row = target.closest(".cm-nav-tree-row");
        if (row && !row.hasAttribute("data-disabled") && !target.closest(".cm-nav-tree-action")) {
          tree.querySelectorAll(".cm-nav-tree-row.is-active").forEach((r) => {
            r.classList.remove(
              "is-active",
              "font-semibold",
              "text-indigo-600",
              "dark:text-indigo-400",
              "bg-indigo-50/70",
              "dark:bg-indigo-950/40"
            );
          });
          row.classList.add(
            "is-active",
            "font-semibold",
            "text-indigo-600",
            "dark:text-indigo-400",
            "bg-indigo-50/70",
            "dark:bg-indigo-950/40"
          );
        }
      });
      const searchInput = tree.querySelector('[data-cm-tree-search="1"]');
      const clearBtn = tree.querySelector('[data-cm-tree-search-clear="1"]');
      if (searchInput) {
        const applySearch = () => {
          const q = (searchInput.value || "").trim();
          if (clearBtn) clearBtn.classList.toggle("hidden", !q);
          const nodes = tree.querySelectorAll(".cm-nav-tree-node");
          if (!q) {
            nodes.forEach((n) => {
              n.style.display = "";
              const ch = n.querySelector(".cm-nav-tree-children");
              if (ch) ch.style.display = "";
            });
            return;
          }
          nodes.forEach((n) => {
            var _a, _b, _c;
            const label = ((_a = n.querySelector(".cm-nav-tree-label")) == null ? void 0 : _a.textContent) || "";
            const hasMatch = matchQuery(label, q);
            n.style.display = hasMatch ? "" : "none";
            if (hasMatch) {
              let parent = (_b = n.parentElement) == null ? void 0 : _b.closest(".cm-nav-tree-node");
              while (parent) {
                parent.style.display = "";
                const ch = parent.querySelector(".cm-nav-tree-children");
                if (ch) ch.style.display = "";
                parent = (_c = parent.parentElement) == null ? void 0 : _c.closest(".cm-nav-tree-node");
              }
            }
          });
        };
        searchInput.addEventListener("input", applySearch);
        if (clearBtn && !clearBtn._cmBound) {
          clearBtn._cmBound = true;
          clearBtn.addEventListener("click", (e) => {
            e.preventDefault();
            searchInput.value = "";
            applySearch();
            searchInput.focus();
          });
        }
        const savedContainer = tree.querySelector("[data-cm-tree-saved-container]");
        const savedTrigger = tree.querySelector("[data-cm-tree-saved-trigger]");
        const savedMenu = tree.querySelector("[data-cm-tree-saved-menu]");
        const savedList = tree.querySelector("[data-cm-tree-saved-list]");
        const saveCurrentBtn = tree.querySelector("[data-cm-tree-save-current]");
        if (savedContainer && savedTrigger && savedMenu && savedList) {
          const treeId = tree.getAttribute("data-cm-nav-tree") || "default";
          const storageKey = `gvs_tree_saved_searches_${treeId}`;
          const loadSaved = () => {
            try {
              const raw = localStorage.getItem(storageKey);
              return raw ? JSON.parse(raw) : [];
            } catch (e) {
              return [];
            }
          };
          const persistSaved = (items) => {
            try {
              localStorage.setItem(storageKey, JSON.stringify(items));
            } catch (e) {
            }
          };
          const renderSaved = () => {
            var _a;
            const items = loadSaved();
            savedList.innerHTML = "";
            if (!items.length) {
              const empty = document.createElement("div");
              empty.className = "p-2 text-slate-400 dark:text-gray-500 text-center text-[11px]";
              empty.textContent = savedList.getAttribute("data-empty-label") || ((_a = window.GridViewI18n) == null ? void 0 : _a["search.no_saved_searches"]) || "No saved searches";
              savedList.appendChild(empty);
              return;
            }
            items.forEach((query) => {
              var _a2;
              const row = document.createElement("div");
              row.className = "flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#202b48] cursor-pointer group";
              const label = document.createElement("span");
              label.className = "truncate flex-1 font-mono text-[11px] text-slate-700 dark:text-gray-200";
              label.textContent = query;
              label.title = query;
              label.addEventListener("click", () => {
                searchInput.value = query;
                applySearch();
                savedMenu.classList.add("hidden");
              });
              const delBtn = document.createElement("button");
              delBtn.type = "button";
              delBtn.className = "text-slate-400 hover:text-rose-500 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer";
              delBtn.title = savedList.getAttribute("data-delete-title") || ((_a2 = window.GridViewI18n) == null ? void 0 : _a2["common.delete"]) || "Delete";
              delBtn.textContent = "\xD7";
              delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const current = loadSaved();
                const updated = current.filter((q) => q !== query);
                persistSaved(updated);
                renderSaved();
              });
              row.appendChild(label);
              row.appendChild(delBtn);
              savedList.appendChild(row);
            });
          };
          savedTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            const isHidden = savedMenu.classList.contains("hidden");
            document.querySelectorAll("[data-cm-tree-saved-menu]").forEach((m) => m.classList.add("hidden"));
            if (isHidden) {
              savedMenu.classList.remove("hidden");
              renderSaved();
            }
          });
          if (saveCurrentBtn) {
            saveCurrentBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              const q = (searchInput.value || "").trim();
              if (!q) return;
              const current = loadSaved();
              if (!current.includes(q)) {
                current.unshift(q);
                if (current.length > 20) current.pop();
                persistSaved(current);
                renderSaved();
              }
            });
          }
        }
      }
      const isDraggable = tree.hasAttribute("data-cm-nav-draggable") || tree.getAttribute("data-cm-nav-tree") === "categories_page_nav";
      if (isDraggable) {
        let draggedNode = null;
        let isDraggingTree = false;
        let dragEndTime = 0;
        let savingDrop = false;
        const dropAction = tree.getAttribute("data-cm-drop-action") || "";
        const clearDropZones = () => {
          tree.querySelectorAll(".cm-tree-drop-inside, .cm-tree-drop-after").forEach((node) => {
            node.classList.remove("cm-tree-drop-inside", "cm-tree-drop-after");
          });
        };
        const dropPosition = (source, target) => {
          var _a, _b;
          const sourceAtRoot = (_a = source.parentElement) == null ? void 0 : _a.classList.contains("cm-nav-tree-items");
          const targetAtRoot = (_b = target.parentElement) == null ? void 0 : _b.classList.contains("cm-nav-tree-items");
          const hasChildren = !!target.querySelector(":scope > .cm-nav-tree-children");
          const acceptsChildren = target.getAttribute("data-cm-node-can-have-children") === "1";
          return sourceAtRoot && targetAtRoot || !targetAtRoot && !hasChildren && !acceptsChildren ? "after" : "inside";
        };
        const acceptsDrop = (source, target) => {
          if (!dropAction) return true;
          if (source.getAttribute("data-cm-node-draggable") !== "1") return false;
          if (target.classList.contains("cm-root-drop-zone")) return true;
          if (target.getAttribute("data-cm-node-droppable") !== "1") return false;
          const sourceType = source.getAttribute("data-node-type") || "";
          let accepted;
          try {
            accepted = JSON.parse(target.getAttribute("data-cm-node-accept") || "[]");
          } catch (e) {
            return false;
          }
          return Boolean(sourceType) && Array.isArray(accepted) && accepted.some((type) => type === sourceType);
        };
        const commitDrop = async (source, target, targetId, position, originalEvent) => {
          if (savingDrop || !acceptsDrop(source, target)) return;
          const sourceId = source.getAttribute("data-node-id") || "";
          if (!sourceId) return;
          const dropEvent = new CustomEvent("cm:nav-item-drop", {
            bubbles: true,
            cancelable: true,
            detail: {
              treeId: tree.getAttribute("data-cm-nav-tree") || "",
              sourceId,
              targetId,
              position,
              sourceNode: source,
              targetNode: target,
              originalEvent
            }
          });
          if (!tree.dispatchEvent(dropEvent)) return;
          if (dropAction) {
            savingDrop = true;
            const accepted = await invokeDrop(dropAction, {
              treeId: tree.getAttribute("data-cm-nav-tree") || "",
              sourceId,
              targetId,
              sourceType: source.getAttribute("data-node-type") || "",
              targetType: target.getAttribute("data-node-type") || "root",
              position
            });
            savingDrop = false;
            if (!accepted || !source.isConnected || !target.isConnected) return;
          }
          moveTreeNode(source, target, itemsContainer);
        };
        const itemsContainer = tree.querySelector(".cm-nav-tree-items");
        let rootDropZone = tree.querySelector(".cm-root-drop-zone");
        const rootDropLabel = tree.getAttribute("data-cm-root-drop-label") || null;
        if (!rootDropZone && itemsContainer && rootDropLabel) {
          rootDropZone = document.createElement("div");
          rootDropZone.className = "cm-root-drop-zone hidden p-2 mb-1.5 rounded-lg border border-dashed border-indigo-400/50 dark:border-indigo-400/40 bg-indigo-50/20 dark:bg-indigo-950/15 text-center text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition-all cursor-pointer";
          rootDropZone.textContent = rootDropLabel;
          itemsContainer.insertBefore(rootDropZone, itemsContainer.firstChild);
          rootDropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
            rootDropZone == null ? void 0 : rootDropZone.classList.add(
              "ring-1",
              "ring-indigo-400/50",
              "bg-indigo-50/30",
              "dark:bg-indigo-900/20"
            );
          });
          rootDropZone.addEventListener("dragleave", () => {
            rootDropZone == null ? void 0 : rootDropZone.classList.remove(
              "ring-1",
              "ring-indigo-400/50",
              "bg-indigo-50/30",
              "dark:bg-indigo-900/20"
            );
          });
          rootDropZone.addEventListener("drop", async (e) => {
            e.preventDefault();
            rootDropZone == null ? void 0 : rootDropZone.classList.remove(
              "ring-1",
              "ring-indigo-400/50",
              "bg-indigo-50/30",
              "dark:bg-indigo-900/20"
            );
            if (!draggedNode) return;
            if (rootDropZone) await commitDrop(draggedNode, rootDropZone, "root", "inside", e);
          });
        }
        tree.querySelectorAll(".cm-nav-tree-row").forEach((row) => {
          if (row.hasAttribute("data-disabled")) {
            row.addEventListener("drop", (e) => {
              e.preventDefault();
              e.stopPropagation();
            });
            return;
          }
          const rowNode = row.closest(".cm-nav-tree-node");
          const canStartDrag = !dropAction || (rowNode == null ? void 0 : rowNode.getAttribute("data-cm-node-draggable")) === "1";
          if (canStartDrag) row.setAttribute("draggable", "true");
          row.addEventListener("dragstart", (e) => {
            var _a;
            if (!canStartDrag) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            e.stopPropagation();
            const node = row.closest(".cm-nav-tree-node");
            draggedNode = node;
            isDraggingTree = true;
            if (e.dataTransfer) {
              e.dataTransfer.setData("text/plain", (node == null ? void 0 : node.getAttribute("data-node-id")) || "");
              e.dataTransfer.effectAllowed = "move";
            }
            row.classList.add("opacity-50");
            const parentNode = (_a = draggedNode == null ? void 0 : draggedNode.parentElement) == null ? void 0 : _a.closest(".cm-nav-tree-node");
            if (rootDropZone && parentNode) {
              rootDropZone.classList.remove("hidden");
            }
          });
          row.addEventListener("dragend", () => {
            row.classList.remove("opacity-50");
            if (rootDropZone) rootDropZone.classList.add("hidden");
            clearDropZones();
            dragEndTime = Date.now();
            setTimeout(() => {
              isDraggingTree = false;
              draggedNode = null;
            }, 100);
          });
          row.addEventListener("dragover", (e) => {
            const node = row.closest(".cm-nav-tree-node");
            if (!draggedNode || !node || draggedNode === node || draggedNode.contains(node) || !acceptsDrop(draggedNode, node)) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
            clearDropZones();
            node.classList.add(dropPosition(draggedNode, node) === "inside" ? "cm-tree-drop-inside" : "cm-tree-drop-after");
          });
          row.addEventListener("dragleave", (e) => {
            if (!row.contains(e.relatedTarget)) {
              rowNode == null ? void 0 : rowNode.classList.remove("cm-tree-drop-inside", "cm-tree-drop-after");
            }
          });
          row.addEventListener("drop", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearDropZones();
            const targetNode = row.closest(".cm-nav-tree-node");
            if (!draggedNode || !targetNode || draggedNode === targetNode || draggedNode.contains(targetNode) || !acceptsDrop(draggedNode, targetNode)) {
              return;
            }
            const targetId = targetNode == null ? void 0 : targetNode.getAttribute("data-node-id");
            if (!targetId) return;
            const position = dropPosition(draggedNode, targetNode);
            await commitDrop(draggedNode, targetNode, targetId, position, e);
          });
          row.addEventListener(
            "click",
            (e) => {
              if (isDraggingTree || Date.now() - dragEndTime < 250) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
              }
            },
            true
          );
        });
      }
    });
  }

  // src/runtime/gallery.ts
  var OVERLAY_ID = "cm-gallery-overlay";
  var overlay = null;
  var stageImg = null;
  var captionEl = null;
  var prevBtn = null;
  var nextBtn = null;
  var activeItems = [];
  var activeIndex = 0;
  var activeGalleryId = "";
  var lastFocus = null;
  var delegated = false;
  function t2(key, fallback2) {
    return i18n.t(key, fallback2);
  }
  function parseLightboxEnabled(root) {
    return root.getAttribute("data-cm-gallery-lightbox") !== "false";
  }
  function itemsFromDom(root) {
    const nodes = root.querySelectorAll("[data-cm-gallery-item]");
    const items = [];
    nodes.forEach((node) => {
      const url = node.getAttribute("data-cm-gallery-full") || "";
      if (!url) return;
      const img = node.querySelector("img");
      items.push({ url, alt: (img == null ? void 0 : img.getAttribute("alt")) || "" });
    });
    return items;
  }
  function ensureOverlay() {
    if (overlay) return overlay;
    const root = document.createElement("div");
    root.id = OVERLAY_ID;
    root.className = "cm-gallery-overlay";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.tabIndex = -1;
    root.innerHTML = '<button type="button" class="cm-gallery-close" data-cm-gallery-close></button><button type="button" class="cm-gallery-prev" data-cm-gallery-prev></button><button type="button" class="cm-gallery-next" data-cm-gallery-next></button><div class="cm-gallery-stage"><img alt="" /><div class="cm-gallery-caption" data-cm-gallery-caption></div></div>';
    document.body.appendChild(root);
    overlay = root;
    stageImg = root.querySelector("img");
    captionEl = root.querySelector("[data-cm-gallery-caption]");
    prevBtn = root.querySelector("[data-cm-gallery-prev]");
    nextBtn = root.querySelector("[data-cm-gallery-next]");
    const closeBtn = root.querySelector("[data-cm-gallery-close]");
    if (closeBtn) closeBtn.textContent = "\xD7";
    if (closeBtn) closeBtn.setAttribute("aria-label", t2("gallery.close", "Close"));
    if (prevBtn) prevBtn.textContent = "\u2039";
    if (prevBtn) prevBtn.setAttribute("aria-label", t2("gallery.prev", "Previous"));
    if (nextBtn) nextBtn.textContent = "\u203A";
    if (nextBtn) nextBtn.setAttribute("aria-label", t2("gallery.next", "Next"));
    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target === root || target.closest("[data-cm-gallery-close]")) {
        closeLightbox();
        return;
      }
      if (target.closest("[data-cm-gallery-prev]")) {
        step(-1);
        return;
      }
      if (target.closest("[data-cm-gallery-next]")) {
        step(1);
      }
    });
    return root;
  }
  function renderSlide() {
    if (!stageImg || !activeItems.length) return;
    const item = activeItems[activeIndex];
    if (!item) return;
    stageImg.src = item.url;
    stageImg.alt = item.alt;
    if (captionEl) {
      const of = t2("gallery.of", "%(current)s of %(total)s").replace("%(current)s", String(activeIndex + 1)).replace("%(total)s", String(activeItems.length));
      captionEl.textContent = item.alt ? `${item.alt} \xB7 ${of}` : of;
    }
    const many = activeItems.length > 1;
    if (prevBtn) prevBtn.hidden = !many;
    if (nextBtn) nextBtn.hidden = !many;
  }
  function openLightbox(galleryId, items, index) {
    if (!items.length) return;
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    activeGalleryId = galleryId;
    activeItems = items;
    activeIndex = index >= 0 && index < items.length ? index : 0;
    const node = ensureOverlay();
    node.hidden = false;
    renderSlide();
    node.focus();
    const detail = {
      galleryId,
      index: activeIndex,
      images: items
    };
    document.dispatchEvent(new CustomEvent("gridview:gallery-open", { detail }));
  }
  function closeLightbox() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    if (stageImg) stageImg.removeAttribute("src");
    document.dispatchEvent(
      new CustomEvent("gridview:gallery-close", {
        detail: { galleryId: activeGalleryId, index: activeIndex, images: activeItems }
      })
    );
    activeItems = [];
    activeGalleryId = "";
    lastFocus == null ? void 0 : lastFocus.focus();
    lastFocus = null;
  }
  function step(delta) {
    if (!activeItems.length) return;
    activeIndex = (activeIndex + delta + activeItems.length) % activeItems.length;
    renderSlide();
  }
  function onKey(event) {
    if (!overlay || overlay.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeLightbox();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      step(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      step(1);
    }
  }
  function itemIndex(node) {
    var _a;
    const raw = (_a = node.closest("[data-cm-gallery-item]")) == null ? void 0 : _a.getAttribute("data-cm-gallery-index");
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  function onDocumentClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const openBtn = target.closest("[data-cm-gallery-open]");
    if (!openBtn) return;
    const gallery = openBtn.closest("[data-cm-gallery]");
    if (!gallery || !parseLightboxEnabled(gallery)) return;
    event.preventDefault();
    const galleryId = gallery.getAttribute("data-cm-gallery-id") || "";
    openLightbox(galleryId, itemsFromDom(gallery), itemIndex(openBtn));
  }
  function normalizePayload(data) {
    const list = Array.isArray(data) ? data : data && typeof data === "object" && Array.isArray(data.images) ? data.images : [];
    const items = [];
    for (const row of list) {
      if (!row || typeof row !== "object") continue;
      const rec = row;
      if (typeof rec.url !== "string" || !rec.url) continue;
      items.push({ url: rec.url, alt: typeof rec.alt === "string" ? rec.alt : "" });
    }
    return items;
  }
  function appendThumbs(root, items) {
    items.forEach((item, index) => {
      const figure = document.createElement("figure");
      figure.className = "cm-gallery-item";
      figure.setAttribute("data-cm-gallery-item", "");
      figure.setAttribute("data-cm-gallery-index", String(index));
      figure.setAttribute("data-cm-gallery-full", item.url);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cm-gallery-open";
      button.setAttribute("data-cm-gallery-open", "");
      button.setAttribute("aria-label", item.alt);
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.alt;
      button.appendChild(img);
      figure.appendChild(button);
      root.appendChild(figure);
    });
  }
  async function hydrateLazy(root) {
    const endpoint = root.getAttribute("data-cm-gallery-src");
    if (!endpoint || root.querySelector("[data-cm-gallery-item]")) return;
    try {
      const response = await fetch(endpoint);
      if (!response.ok) return;
      const payload = await response.json();
      const items = normalizePayload(payload);
      if (!items.length) return;
      appendThumbs(root, items);
    } catch (e) {
    }
  }
  function ensureDelegated() {
    if (delegated) return;
    delegated = true;
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKey, true);
  }
  function initGalleryBlocks(scope = document) {
    ensureDelegated();
    const galleries = scope.querySelectorAll("[data-cm-gallery]");
    galleries.forEach((node) => {
      void hydrateLazy(node);
    });
  }
  function openGalleryLightbox(images, index = 0, galleryId = "host") {
    ensureDelegated();
    openLightbox(galleryId, normalizePayload(images), index);
  }
  function closeGalleryLightbox() {
    closeLightbox();
  }

  // src/runtime/renderers/date-time.ts
  var htmlEscapes = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;"
  };
  function isRecord4(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function isFormatterConfig(value) {
    if (!isRecord4(value)) return false;
    const format = value.format;
    return (format === "date" || format === "datetime" || format === "time" || format === "iso") && typeof value.locale === "string" && typeof value.timezone === "string" && value.timezone !== "" && (value.emptyValue === void 0 || typeof value.emptyValue === "string") && (value.strict === void 0 || typeof value.strict === "boolean");
  }
  function escapeHtml3(value) {
    return value.replace(/[&<>"']/g, (character) => {
      var _a;
      return (_a = htmlEscapes[character]) != null ? _a : character;
    });
  }
  function fallback(formatter) {
    const emptyValue = isRecord4(formatter) && typeof formatter.emptyValue === "string" ? formatter.emptyValue : "\u2014";
    return escapeHtml3(emptyValue);
  }
  function isValidDate(year, month, day) {
    var _a;
    if (year < 1 || month < 1 || month > 12) return false;
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysByMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day >= 1 && day <= ((_a = daysByMonth[month - 1]) != null ? _a : 0);
  }
  function isValidTime(hour, minute, second) {
    return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 && second >= 0 && second < 60;
  }
  function parseOffset(offset) {
    if (!offset || offset.toUpperCase() === "Z") return "Z";
    const digits = offset.slice(1).replace(":", "");
    const hours = Number(digits.slice(0, 2));
    const minutes = Number(digits.slice(2, 4));
    if (hours > 23 || minutes > 59) throw new RangeError("Invalid UTC offset");
    return `${offset[0]}${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  }
  function parseCalendarDate(value) {
    var _a, _b, _c;
    const dateMatch = /^(?:(\d{4})-(\d{2})-(\d{2})|(\d{4})(\d{2})(\d{2}))$/.exec(value);
    if (!dateMatch) return void 0;
    const year = Number((_a = dateMatch[1]) != null ? _a : dateMatch[4]);
    const month = Number((_b = dateMatch[2]) != null ? _b : dateMatch[5]);
    const day = Number((_c = dateMatch[3]) != null ? _c : dateMatch[6]);
    if (!isValidDate(year, month, day)) throw new RangeError("Invalid calendar date");
    return { year, month, day };
  }
  function parseClockTime(value) {
    var _a, _b, _c, _d, _e;
    const timeMatch = /^(?:(\d{2}):(\d{2})(?::(\d{2}))?|(\d{2})(?:(\d{2})(\d{2})?)?)(?:[.,](\d+))?(Z|[+-]\d{2}:?\d{2})?$/i.exec(value);
    if (!timeMatch) return void 0;
    const fractionDigits = timeMatch[7];
    if (fractionDigits && timeMatch[3] === void 0 && timeMatch[6] === void 0) {
      throw new RangeError("Fraction requires clock seconds");
    }
    const hour = Number((_a = timeMatch[1]) != null ? _a : timeMatch[4]);
    const minute = Number((_c = (_b = timeMatch[2]) != null ? _b : timeMatch[5]) != null ? _c : "0");
    const second = Number((_e = (_d = timeMatch[3]) != null ? _d : timeMatch[6]) != null ? _e : "0");
    if (!isValidTime(hour, minute, second)) throw new RangeError("Invalid clock time");
    return {
      hour,
      minute,
      second,
      fraction: fractionDigits ? `.${fractionDigits.slice(0, 3)}` : "",
      offset: parseOffset(timeMatch[8])
    };
  }
  function parseValue(value) {
    var _a, _b;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new RangeError("Epoch value must be finite");
      const milliseconds = Math.abs(value) >= 1e11 ? value : value * 1e3;
      const instant = new Date(milliseconds);
      if (Number.isNaN(instant.getTime())) throw new RangeError("Epoch value is outside the supported range");
      return { kind: "instant", value: instant };
    }
    if (typeof value !== "string") throw new TypeError("Unsupported date and time value");
    const date = parseCalendarDate(value);
    if (date) return { kind: "date", ...date };
    const dateTimeMatch = /^(\d{4}-\d{2}-\d{2}|\d{8})[Tt ](.+)$/i.exec(value);
    if (dateTimeMatch) {
      const dateParts = parseCalendarDate((_a = dateTimeMatch[1]) != null ? _a : "");
      const clock2 = parseClockTime((_b = dateTimeMatch[2]) != null ? _b : "");
      if (!dateParts || !clock2) throw new TypeError("Value is not a supported ISO datetime");
      const canonical = `${pad(dateParts.year, 4)}-${pad(dateParts.month)}-${pad(dateParts.day)}T${pad(clock2.hour)}:${pad(clock2.minute)}:${pad(clock2.second)}${clock2.fraction}${clock2.offset}`;
      const instant = new Date(canonical);
      if (Number.isNaN(instant.getTime())) throw new RangeError("Datetime is outside the supported range");
      return { kind: "instant", value: instant };
    }
    const clock = parseClockTime(value);
    if (clock) return { kind: "time", hour: clock.hour, minute: clock.minute, second: clock.second };
    throw new TypeError("Value is not a supported ISO date or time");
  }
  function normalizedLocale(locale) {
    return locale.trim().replace(/_/g, "-").toLowerCase() === "en-us" ? "en-US" : "uk-UA";
  }
  function partValue(parts, type) {
    const part = parts.find((item) => item.type === type);
    if (!part) throw new RangeError(`Missing ${type} date part`);
    return part.value;
  }
  function zonedParts(value, timezone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(value);
    const hour = Number(partValue(parts, "hour"));
    return {
      year: Number(partValue(parts, "year")),
      month: Number(partValue(parts, "month")),
      day: Number(partValue(parts, "day")),
      hour: hour === 24 ? 0 : hour,
      minute: Number(partValue(parts, "minute")),
      second: Number(partValue(parts, "second"))
    };
  }
  function pad(value, length = 2) {
    return String(value).padStart(length, "0");
  }
  function dateText(year, month, day, locale) {
    const yyyy = pad(year, 4);
    const mm = pad(month);
    const dd = pad(day);
    return locale === "en-US" ? `${mm}/${dd}/${yyyy}` : `${dd}.${mm}.${yyyy}`;
  }
  function timeText(hour, minute, second) {
    return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
  }
  function isoOffset(value, parts) {
    const localTime = /* @__PURE__ */ new Date(0);
    localTime.setUTCFullYear(parts.year, parts.month - 1, parts.day);
    localTime.setUTCHours(parts.hour, parts.minute, parts.second, 0);
    const instantSecond = Math.floor(value.getTime() / 1e3) * 1e3;
    const offsetMinutes = Math.round((localTime.getTime() - instantSecond) / 6e4);
    if (offsetMinutes === 0) return "Z";
    const sign = offsetMinutes < 0 ? "-" : "+";
    const absoluteMinutes = Math.abs(offsetMinutes);
    return `${sign}${pad(Math.floor(absoluteMinutes / 60))}:${pad(absoluteMinutes % 60)}`;
  }
  function formatParsed(value, formatter, locale) {
    if (value.kind === "date") {
      if (formatter.format === "time") throw new RangeError("A date cannot be formatted as a time");
      if (formatter.format === "iso") return `${pad(value.year, 4)}-${pad(value.month)}-${pad(value.day)}`;
      const date2 = dateText(value.year, value.month, value.day, locale);
      return formatter.format === "datetime" ? `${date2} 00:00:00` : date2;
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
  function dateTimeRenderer(params) {
    const colDef = isRecord4(params) && isRecord4(params.colDef) ? params.colDef : void 0;
    const rendererParams = colDef && isRecord4(colDef.cellRendererParams) ? colDef.cellRendererParams : void 0;
    const formatter = rendererParams == null ? void 0 : rendererParams.dateTimeFormatter;
    const emptyHtml = () => fallback(formatter);
    const input = isRecord4(params) ? params.value : void 0;
    if (input === null || input === void 0 || input === "") return emptyHtml();
    if (!isFormatterConfig(formatter)) return emptyHtml();
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: formatter.timezone });
      const parsed = parseValue(input);
      return escapeHtml3(formatParsed(parsed, formatter, normalizedLocale(formatter.locale)));
    } catch (e) {
      return emptyHtml();
    }
  }

  // src/runtime/renderers/builtins.ts
  function isCurrencyFormatterConfig(value) {
    if (typeof value !== "object" || value === null || !("currency" in value) || !("locale" in value) || !("precision" in value) || !("showSymbol" in value)) return false;
    const c = value;
    return typeof c.currency === "string" && typeof c.locale === "string" && typeof c.precision === "number" && typeof c.showSymbol === "boolean" && (!("emptyValue" in c) || typeof c.emptyValue === "string" || c.emptyValue === void 0) && (!("strict" in c) || typeof c.strict === "boolean" || c.strict === void 0);
  }
  function escHtml(value) {
    if (value === void 0 || value === null || value === "") return "";
    const d = document.createElement("div");
    d.textContent = String(value);
    return d.innerHTML;
  }
  function isValidGrouping(groups) {
    if (!groups || groups.length < 2) return false;
    const first = groups[0];
    if (first.length < 1 || first.length > 3 || !/^\d+$/.test(first)) return false;
    return groups.slice(1).every((g) => g.length === 3 && /^\d+$/.test(g));
  }
  function parseFormattedNumber(value, locale) {
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
    let normalized = null;
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
  function formatCurrencyParts(value, formatter, currencyOverride = null) {
    var _a, _b, _c, _d, _e;
    if (!isCurrencyFormatterConfig(formatter)) return ["", "", "", ""];
    const fallback2 = [(_a = formatter.emptyValue) != null ? _a : "", "", "", ""];
    try {
      if (value === void 0 || value === null || typeof value === "string" && !value.trim() || typeof value === "boolean" || formatter.strict && typeof value === "string") return fallback2;
      const currency = currencyOverride === null || currencyOverride === void 0 || currencyOverride === "" ? formatter.currency : currencyOverride;
      if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency.toUpperCase())) return fallback2;
      const code = currency.toUpperCase();
      const precision = (_c = (_b = formatter.precisionByCurrency) == null ? void 0 : _b[code]) != null ? _c : formatter.precision;
      if (!Number.isInteger(precision) || precision < 0 || precision > 6) return fallback2;
      const color = (_e = (_d = formatter.symbolColors) == null ? void 0 : _d[code]) != null ? _e : "";
      if (typeof color !== "string" || color && !/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(color)) return fallback2;
      const number = parseFormattedNumber(value, formatter.locale);
      if (number === null) return fallback2;
      const formatted = new Intl.NumberFormat(
        formatter.locale,
        formatter.showSymbol ? { style: "currency", currency: code, minimumFractionDigits: precision, maximumFractionDigits: precision } : { minimumFractionDigits: precision, maximumFractionDigits: precision }
      ).formatToParts(number);
      const index = formatted.findIndex((part) => part.type === "currency");
      if (index < 0) return [formatted.map((part) => part.value).join(""), "", "", ""];
      return [
        formatted.slice(0, index).map((part) => part.value).join(""),
        formatted[index].value,
        formatted.slice(index + 1).map((part) => part.value).join(""),
        color
      ];
    } catch (e) {
      return fallback2;
    }
  }
  function moneyRenderer(params) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    try {
      const value = params.value;
      const formatter = (_b = (_a = params.colDef) == null ? void 0 : _a.cellRendererParams) == null ? void 0 : _b.currencyFormatter;
      if (formatter !== void 0 && formatter !== null) {
        const field2 = ((_c = params.colDef) == null ? void 0 : _c.field) || "";
        const [prefix, symbol, suffix, color] = formatCurrencyParts(
          value,
          formatter,
          (_d = params.data) == null ? void 0 : _d[`${field2}_currency`]
        );
        const safeValue = escHtml(prefix) + (symbol ? color ? `<span style="color:${color}">${escHtml(symbol)}</span>` : escHtml(symbol) : "") + escHtml(suffix);
        const cssClass2 = String(((_f = (_e = params.colDef) == null ? void 0 : _e.cellRendererParams) == null ? void 0 : _f.css_class) || "");
        return cssClass2 ? `<span class="${escHtml(cssClass2)}">${safeValue}</span>` : safeValue;
      }
      if (value === void 0 || value === null || typeof value === "string" && value.trim() === "" || typeof value === "boolean") return "";
      const field = ((_g = params.colDef) == null ? void 0 : _g.field) || "";
      const rowCurr = (_h = params.data) == null ? void 0 : _h[`${field}_currency`];
      const curr = typeof rowCurr === "string" && rowCurr || "UAH";
      const symbols = { USD: "$", EUR: "\u20AC", UAH: "\u20B4", PLN: "z\u0142", GBP: "\xA3" };
      const sym = symbols[curr] || curr;
      const numValue = Number(value);
      const useDecimals = curr !== "UAH";
      const displayValue = useDecimals ? numValue.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(numValue).toLocaleString("uk-UA");
      const cssClass = String(((_j = (_i = params.colDef) == null ? void 0 : _i.cellRendererParams) == null ? void 0 : _j.css_class) || "");
      const inner = escHtml(displayValue) + ` ${escHtml(sym)}`;
      return cssClass ? `<span class="${escHtml(cssClass)}">${inner}</span>` : inner;
    } catch (e) {
      return "";
    }
  }
  function linkRenderer(params) {
    var _a, _b, _c, _d, _e;
    const field = ((_a = params.colDef) == null ? void 0 : _a.field) || "";
    const extra = ((_b = params.colDef) == null ? void 0 : _b.cellRendererParams) || {};
    const url = (_c = params.data) == null ? void 0 : _c[`${field}__url`];
    const text = (_d = params.value) != null ? _d : "";
    const action = extra.action ? String(extra.action) : "";
    const recordKey = String(extra.record_key || "id");
    const rowId = (_e = params.data) == null ? void 0 : _e[recordKey];
    const rowAttr = rowId != null ? ` data-cm-row-id="${escHtml(rowId)}"` : "";
    const confirm = serializeConfirmAttribute(extra.confirm);
    const confirmAttr = confirm ? ` data-cm-confirm="${escHtml(confirm)}"` : "";
    if (typeof url === "string" && url) {
      const actionAttr = action ? ` data-cm-cell-action="${escHtml(action)}"` : "";
      return `<a href="${escHtml(url)}" class="cm-grid-link cm-link"${actionAttr}${rowAttr}${confirmAttr} style="font-weight:500;color:#818cf8">${escHtml(text)}</a>`;
    }
    if (action) {
      return `<span class="cm-grid-link cm-link" role="button" tabindex="0" data-cm-cell-action="${escHtml(action)}"${rowAttr}${confirmAttr} style="font-weight:500;cursor:pointer;color:#818cf8">${escHtml(text)}</span>`;
    }
    return escHtml(text);
  }
  function badgeRenderer(params) {
    var _a, _b;
    const value = params.value;
    if (value === void 0 || value === null || value === "") return "";
    const extra = ((_a = params.colDef) == null ? void 0 : _a.cellRendererParams) || {};
    const badges = extra.badges || {};
    const labels = extra.badge_labels || {};
    const labelField = extra.label_field ? String(extra.label_field) : "";
    const key = String(value);
    const cls = badges[key] || "badge-slate";
    let label = labels[key] || key;
    if (labelField && ((_b = params.data) == null ? void 0 : _b[labelField]) != null) {
      label = String(params.data[labelField]);
    }
    return `<span class="badge ${escHtml(cls)}">${escHtml(label)}</span>`;
  }
  function dateRenderer(params) {
    const value = params.value;
    if (!value) return "";
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return escHtml(value);
    return escHtml(date.toLocaleDateString("uk-UA"));
  }
  function buttonRenderer(params) {
    var _a, _b, _c, _d;
    const extra = ((_a = params.colDef) == null ? void 0 : _a.cellRendererParams) || {};
    const action = String(extra.action || "");
    if (!action) return escHtml((_b = params.value) != null ? _b : "");
    const label = String(extra.label || "") || (extra.label_from_field && params.data ? String(params.data[String(extra.label_from_field)] || "") : "") || String((_c = params.value) != null ? _c : "");
    const btnClass = String(extra.button_class || "cm-record-detail-btn");
    const recordKey = String(extra.record_key || "id");
    const rowId = (_d = params.data) == null ? void 0 : _d[recordKey];
    const confirm = serializeConfirmAttribute(extra.confirm);
    const confirmAttr = confirm ? ` data-cm-confirm="${escHtml(confirm)}"` : "";
    return `<button type="button" class="${escHtml(btnClass)}" data-cm-cell-action="${escHtml(action)}" data-cm-row-id="${escHtml(rowId != null ? rowId : "")}"${confirmAttr}>${escHtml(label)}</button>`;
  }
  function imageRenderer(params) {
    const value = params.value;
    if (!value || typeof value !== "string") {
      return '<div class="cm-grid-img-cell flex items-center justify-center text-slate-400 text-xs">\u{1F4E6}</div>';
    }
    return `<div class="cm-grid-img-cell flex items-center justify-center" style="width:36px;height:36px;margin:auto"><img src="${escHtml(value)}" alt="" style="width:36px;height:36px;object-fit:contain;border-radius:4px" loading="lazy" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='inline')" /><span class="text-xs text-slate-400" style="display:none">\u{1F4E6}</span></div>`;
  }
  function thumbnailRenderer(params) {
    return imageRenderer(params);
  }
  var _registered = false;
  function initBuiltinRenderers() {
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

  // src/runtime/renderers/image.ts
  function initImageRenderers(_scope = document) {
  }

  // src/runtime/asset-loader.ts
  function manifest() {
    var _a;
    const w = getGlobal();
    return (_a = w.__GridViewAssets) != null ? _a : {};
  }
  function loadStylesheet(href, lazy = true) {
    if (!href) return;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    if (lazy) {
      link.dataset.cmAgGridAsset = "1";
    }
    document.head.appendChild(link);
  }
  function unloadAgGridStyles() {
    document.querySelectorAll('link[data-cm-ag-grid-asset="1"], link[href*="ag-grid"]').forEach((node) => node.remove());
  }
  function loadScript(src, isReady) {
    if (!src) return Promise.resolve();
    if (isReady()) return Promise.resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      return new Promise((resolve) => {
        const poll = window.setInterval(() => {
          if (isReady()) {
            window.clearInterval(poll);
            resolve();
          }
        }, 50);
        window.setTimeout(() => {
          window.clearInterval(poll);
          resolve();
        }, 15e3);
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => {
        const poll = window.setInterval(() => {
          if (isReady()) {
            window.clearInterval(poll);
            resolve();
          }
        }, 50);
        window.setTimeout(() => {
          window.clearInterval(poll);
          resolve();
        }, 15e3);
      };
      script.onerror = () => reject(new Error(`[GridView] Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }
  var agGridLoadPromise = null;
  function ensureAgGridAssetsLoaded() {
    var _a, _b;
    const cfg = manifest();
    ((_a = cfg.agGridCss) != null ? _a : []).forEach((href) => loadStylesheet(href));
    const gv2 = getGlobal().GridView;
    if ((_b = gv2 == null ? void 0 : gv2.AgGrid) == null ? void 0 : _b.Host) return Promise.resolve();
    if (agGridLoadPromise) return agGridLoadPromise;
    agGridLoadPromise = (async () => {
      var _a2, _b2;
      await loadScript((_a2 = cfg.agGridCdn) != null ? _a2 : "", () => typeof getGlobal().agGrid !== "undefined");
      await loadScript((_b2 = cfg.agGridPlugin) != null ? _b2 : "", () => {
        var _a3, _b3;
        return !!((_b3 = (_a3 = getGlobal().GridView) == null ? void 0 : _a3.AgGrid) == null ? void 0 : _b3.Host);
      });
    })().catch((error) => {
      agGridLoadPromise = null;
      throw error;
    });
    return agGridLoadPromise;
  }
  var chartsLoadPromise = null;
  function ensureChartsAssetsLoaded() {
    var _a;
    const g = getGlobal();
    if (((_a = g.GridView) == null ? void 0 : _a._chartsApiReady) && typeof g.echarts !== "undefined") return Promise.resolve();
    if (chartsLoadPromise) return chartsLoadPromise;
    const cfg = manifest();
    chartsLoadPromise = (async () => {
      var _a2, _b;
      await loadScript((_a2 = cfg.chartsCdn) != null ? _a2 : "", () => typeof getGlobal().echarts !== "undefined");
      await loadScript(
        (_b = cfg.chartsPlugin) != null ? _b : "",
        () => {
          var _a3;
          return !!((_a3 = getGlobal().GridView) == null ? void 0 : _a3._chartsApiReady);
        }
      );
    })().catch((error) => {
      chartsLoadPromise = null;
      throw error;
    });
    return chartsLoadPromise;
  }
  var filterWorkspaceLoadPromise = null;
  function ensureFilterDrawerWorkspaceAssetsLoaded() {
    var _a;
    const cfg = manifest();
    if (cfg.filterWorkspaceCss) loadStylesheet(cfg.filterWorkspaceCss, false);
    const gv2 = getGlobal().GridView;
    if (gv2 == null ? void 0 : gv2.FilterDrawerWorkspace) return Promise.resolve();
    if (filterWorkspaceLoadPromise) return filterWorkspaceLoadPromise;
    filterWorkspaceLoadPromise = loadScript(
      (_a = cfg.filterWorkspacePlugin) != null ? _a : "",
      () => {
        var _a2;
        return !!((_a2 = getGlobal().GridView) == null ? void 0 : _a2.FilterDrawerWorkspace);
      }
    ).catch((error) => {
      filterWorkspaceLoadPromise = null;
      throw error;
    });
    return filterWorkspaceLoadPromise;
  }
  function installAssetLoader(gv2) {
    var _a;
    gv2.assets = (_a = gv2.assets) != null ? _a : {};
    gv2.assets.ensureAgGrid = ensureAgGridAssetsLoaded;
    gv2.assets.ensureCharts = ensureChartsAssetsLoaded;
    gv2.assets.ensureFilterDrawerWorkspace = ensureFilterDrawerWorkspaceAssetsLoaded;
  }

  // src/runtime/table-ag-grid.ts
  var specGridStates = /* @__PURE__ */ new Map();
  var specFilterListeners = /* @__PURE__ */ new Set();
  function isRecord5(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function collectColumnIds(columns, ids = /* @__PURE__ */ new Set()) {
    for (const column of columns) {
      const id = column.colId || column.field;
      if (Array.isArray(column.children)) collectColumnIds(column.children.filter(isRecord5), ids);
      else if (typeof id === "string" && id) ids.add(id);
    }
    return ids;
  }
  function setColumnDefsPreservingState(gridApi, columnDefs) {
    var _a, _b;
    if (!gridApi.setGridOption) return;
    let columnState = [];
    try {
      columnState = (_b = (_a = gridApi.getColumnState) == null ? void 0 : _a.call(gridApi)) != null ? _b : [];
    } catch (error) {
      console.warn("[GridView.AgGrid] Column state unavailable; refreshing definitions anyway:", error);
    }
    gridApi.setGridOption("columnDefs", columnDefs);
    if (!gridApi.applyColumnState) return;
    const columnIds = [...collectColumnIds(columnDefs)];
    const retainedState = columnState.filter(({ colId }) => columnIds.includes(colId));
    const retainedIds = new Set(retainedState.map(({ colId }) => colId));
    const newColumnIds = columnIds.filter((colId) => !retainedIds.has(colId));
    for (const colId of newColumnIds) {
      const nextId = columnIds.slice(columnIds.indexOf(colId) + 1).find((id) => retainedIds.has(id));
      const index = nextId ? retainedState.findIndex(({ colId: colId2 }) => colId2 === nextId) : -1;
      retainedState.splice(index < 0 ? retainedState.length : index, 0, { colId });
    }
    if (retainedState.length) gridApi.applyColumnState({ state: retainedState, applyOrder: true });
  }
  function isColumnStateItem(value) {
    if (!isRecord5(value) || typeof value.colId !== "string" || typeof value.hide !== "boolean") {
      return false;
    }
    if (value.pinned !== null && typeof value.pinned !== "string") return false;
    return value.width === void 0 || value.width === null || typeof value.width === "string" || typeof value.width === "number";
  }
  function isColumnState(value) {
    return Array.isArray(value) && value.every(isColumnStateItem);
  }
  function isStoredColumnPreset(value) {
    if (isColumnState(value)) return true;
    return isRecord5(value) && isColumnState(value.columns) && (value.pageState === void 0 || isRecord5(value.pageState));
  }
  function resolvePresets(fromConfig) {
    if (!fromConfig) return {};
    const presets = {};
    Object.entries(fromConfig).forEach(([name, preset]) => {
      if (isStoredColumnPreset(preset)) presets[name] = preset;
    });
    return presets;
  }
  function resolveSearches(fromConfig) {
    if (fromConfig) return fromConfig;
    return [];
  }
  function resolveAgColumnFilter(col) {
    if (col.agFilter === "none") return false;
    if (col.agFilter === "smart") return "customSetFilter";
    return "customExprFilter";
  }
  function exprColumnFilterKind(col) {
    return col.type === "number" || col.type === "currency" ? "numeric" : "text";
  }
  function resolveRendererId(col) {
    if (col.renderer) return col.renderer;
    if (col.dateTimeFormatter !== void 0 && col.dateTimeFormatter !== null && (col.type === "date" || col.type === "datetime")) return "dateTimeRenderer";
    if (col.type === "currency") return "money";
    return "";
  }
  function wrapRegisteredRenderer(rendererId) {
    return (params) => {
      const regFn = getRegisteredRenderer(rendererId);
      if (!regFn) {
        const value = typeof params === "object" && params !== null && "value" in params ? params.value : params;
        if (value === void 0 || value === null || typeof value === "object") return "";
        return String(value);
      }
      return regFn(params);
    };
  }
  function buildColumnDefsFromSpec(columns) {
    return columns.map((col) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
      const field = col.field || col.id;
      const rendererId = resolveRendererId(col);
      const agFilter = resolveAgColumnFilter(col);
      const def = {
        field,
        colId: col.id,
        headerName: col.label,
        hide: (_a = col.hidden) != null ? _a : false,
        filter: agFilter,
        suppressMenu: agFilter === false,
        suppressHeaderFilterButton: agFilter === false,
        sortable: col.sortable !== false,
        resizable: ((_b = col.extra) == null ? void 0 : _b.resizable) !== false,
        suppressSizeToFit: ((_c = col.extra) == null ? void 0 : _c.suppress_size_to_fit) === true,
        enableCellTextSelection: true,
        tooltipValueGetter: (params) => {
          var _a2, _b2;
          if (((_a2 = col.extra) == null ? void 0 : _a2.tooltips) === false || ((_b2 = col.extra) == null ? void 0 : _b2.suppressTooltips) === true) return null;
          const value = isRecord5(params) ? params.value : void 0;
          if (value === null || value === void 0 || value === "" || typeof value === "object") return null;
          return String(value);
        }
      };
      if (agFilter === "customExprFilter") def.columnFilter = exprColumnFilterKind(col);
      if (col.pinned === "left" || col.pinned === "right") def.pinned = col.pinned;
      if (col.menuGroup) def.menuGroup = col.menuGroup;
      if (col.checkboxSelection || ((_d = col.extra) == null ? void 0 : _d.checkbox_selection)) {
        def.checkboxSelection = true;
        if ((_g = (_f = col.headerCheckboxSelection) != null ? _f : (_e = col.extra) == null ? void 0 : _e.header_checkbox_selection) != null ? _g : true) {
          def.headerCheckboxSelection = true;
        }
      }
      if (col.dndSource || ((_h = col.extra) == null ? void 0 : _h.dnd_source)) def.dndSource = true;
      if (col.rowDrag || ((_i = col.extra) == null ? void 0 : _i.row_drag)) def.rowDrag = true;
      if (col.editable) def.editable = true;
      if (col.width) {
        const width = Number.parseInt(col.width, 10);
        if (!Number.isNaN(width)) def.width = width;
      }
      if (col.minWidth) {
        const minWidth = Number.parseInt(col.minWidth, 10);
        if (!Number.isNaN(minWidth)) def.minWidth = minWidth;
      } else if (!col.width && (col.id === "name" || col.id === "original_name" || col.id === "title")) {
        def.flex = 1;
        def.minWidth = 200;
      }
      if (rendererId) def.cellRenderer = wrapRegisteredRenderer(rendererId);
      const hasDateTimeFormatter = col.dateTimeFormatter !== void 0 && col.dateTimeFormatter !== null && (col.type === "date" || col.type === "datetime");
      if (col.extra && Object.keys(col.extra).length > 0 || col.currencyFormatter || hasDateTimeFormatter) {
        def.cellRendererParams = {
          ...col.extra,
          ...col.currencyFormatter ? { currencyFormatter: col.currencyFormatter } : {},
          ...hasDateTimeFormatter ? { dateTimeFormatter: col.dateTimeFormatter } : {}
        };
        if (((_j = col.extra) == null ? void 0 : _j.flex) != null) def.flex = Number(col.extra.flex);
        const cellClass = (_k = col.extra) == null ? void 0 : _k.cell_class;
        if (typeof cellClass === "string" && cellClass) def.cellClass = cellClass;
      }
      return def;
    });
  }
  function columnSourceReady(source, pageState) {
    const deps = source.dependsOn || [];
    if (!deps.length) return true;
    return deps.every((dep) => {
      const val = pageState[dep];
      if (val == null || val === "") return false;
      if (Array.isArray(val)) return val.length > 0 && !(val.length === 1 && val[0] === "");
      return true;
    });
  }
  async function fetchColumnSourceColumns(source, pageState) {
    if (!columnSourceReady(source, pageState)) return [];
    const url = new URL(source.endpoint, window.location.origin);
    (source.dependsOn || []).forEach((dep) => {
      const val = pageState[dep];
      if (Array.isArray(val)) url.searchParams.set(dep, val.join(","));
      else if (val != null && val !== "") url.searchParams.set(dep, String(val));
    });
    if (source.params) {
      Object.entries(source.params).forEach(([key, val]) => {
        if (val != null && val !== "") url.searchParams.set(key, String(val));
      });
    }
    const response = await fetch(url.toString(), { method: source.method || "GET" });
    if (!response.ok) throw new Error(`[GridView.AgGrid] column_source HTTP ${response.status}`);
    const data = await response.json();
    return data.columns || [];
  }
  function mergeColumnDefsAtAnchor(base, dynamic, anchor) {
    const dynamicIds = new Set(dynamic.map((col) => String(col.colId || col.field)));
    const result = base.filter((col) => !dynamicIds.has(String(col.colId || col.field)));
    if (!anchor) return [...result, ...dynamic];
    const idx = result.findIndex((col) => String(col.colId || col.field) === anchor);
    if (idx < 0) return [...result, ...dynamic];
    return [...result.slice(0, idx + 1), ...dynamic, ...result.slice(idx + 1)];
  }
  async function resolveColumnDefs(config, getPageState) {
    var _a, _b;
    const g = getGlobal();
    let columnDefs = [];
    if (config.columnsVar) {
      const parts = config.columnsVar.split(".");
      let obj = g;
      for (const part of parts) {
        obj = obj == null ? void 0 : obj[part];
      }
      if (Array.isArray(obj)) columnDefs = obj;
    }
    if (!columnDefs.length && ((_a = config.columns) == null ? void 0 : _a.length)) {
      columnDefs = buildColumnDefsFromSpec(config.columns);
    }
    const pageState = getPageState();
    const anchor = ((_b = config.columnSource) == null ? void 0 : _b.anchor) || "";
    if (config.columnSource) {
      const dynamicCols = await fetchColumnSourceColumns(config.columnSource, pageState);
      columnDefs = mergeColumnDefsAtAnchor(columnDefs, buildColumnDefsFromSpec(dynamicCols), anchor);
    }
    return columnDefs;
  }
  function bootFromSpecConfig(config) {
    var _a, _b;
    const gv2 = getGlobal().GridView;
    if (!gv2 || !config.gridId) return;
    const gridId = config.gridId;
    const generation = (((_a = specGridStates.get(gridId)) == null ? void 0 : _a.generation) || 0) + 1;
    specGridStates.set(gridId, { generation, filterGeneration: 0, config });
    const isCurrent = () => {
      var _a2;
      return ((_a2 = specGridStates.get(gridId)) == null ? void 0 : _a2.generation) === generation;
    };
    const containerId = config.containerId || `cm-ag-grid-container-${gridId}`;
    const groupsOrder = config.groupsOrder || [];
    const presets = resolvePresets(config.presets);
    const searches = resolveSearches(config.searches);
    const startUp = async () => {
      var _a2, _b2, _c, _d;
      await ensureAgGridAssetsLoaded();
      if (!isCurrent()) return;
      const g = getGlobal();
      const agModule = gv2.AgGrid;
      const HostCtor = agModule == null ? void 0 : agModule.Host;
      if (!HostCtor) {
        console.error("[GridView.AgGrid] Host plugin unavailable after asset load");
        return;
      }
      const registry = gv2.byId;
      if (!registry) return;
      function getPageState() {
        var _a3, _b3;
        const currentConfig = ((_a3 = specGridStates.get(gridId)) == null ? void 0 : _a3.config) || config;
        const url = new URL(window.location.href);
        const state = {};
        (currentConfig.urlPageStateKeys || []).forEach((key) => {
          const val = url.searchParams.get(key);
          if (val) state[key] = val;
        });
        (((_b3 = currentConfig.columnSource) == null ? void 0 : _b3.dependsOn) || []).forEach((key) => {
          const val = url.searchParams.get(key);
          if (val) state[key] = val;
        });
        if (currentConfig.filtersSelector) {
          const root = document.querySelector(currentConfig.filtersSelector);
          const filterBar = gv2.FilterBar;
          if (root && filterBar) {
            root.querySelectorAll("[data-cm-filter-bar]").forEach((bar) => {
              Object.assign(state, filterBar.selectedFilterValues(bar));
            });
          }
        }
        return state;
      }
      const columnDefs = await resolveColumnDefs(config, getPageState);
      if (!isCurrent()) return;
      const optionsObj = {
        columnDefs,
        rowModelType: config.datasourceUrl ? "infinite" : "clientSide",
        rowHeight: config.rowHeight || 60,
        getRowClass: (params) => {
          var _a3;
          return ((_a3 = params.data) == null ? void 0 : _a3.is_child) ? "cm-child-variant-row" : "";
        },
        ...config.rowSelection ? { rowSelection: config.rowSelection } : {},
        ...config.rowClickSelection === "toggle" ? {
          rowMultiSelectWithClick: true,
          suppressCellFocus: true
        } : {},
        ...config.rowDragEntireRow ? { rowDragEntireRow: true } : {},
        ...config.rowDragMultiRow ? { rowDragMultiRow: true } : {},
        // fitColumns: fill the grid width and shrink columns to fit (no horizontal
        ...config.fitColumns ? {
          autoSizeStrategy: {
            type: "fitGridWidth",
            defaultMinWidth: 40
          },
          onGridSizeChanged: (p) => {
            var _a3, _b3;
            return (_b3 = (_a3 = p.api) == null ? void 0 : _a3.sizeColumnsToFit) == null ? void 0 : _b3.call(_a3);
          }
        } : {},
        maxBlocksInCache: 10,
        rowBuffer: 20,
        suppressPropertyNamesCheck: true,
        enableCellTextSelection: true,
        tooltipShowDelay: 500,
        tooltipInteraction: true,
        animateRows: false,
        pagination: false,
        // Keep the column-menu (filter) button always visible, matching the
        // SimpleTable default where the filter control is not hover-only.
        suppressMenuHide: true,
        defaultColDef: {
          sortable: true,
          filter: true,
          resizable: true,
          floatingFilter: false,
          // Always render the unsorted (⇅) indicator, matching SimpleTable's
          // always-visible sort glyph next to the filter control.
          unSortIcon: true,
          tooltipValueGetter: (params) => {
            const value = isRecord5(params) ? params.value : void 0;
            if (value === null || value === void 0 || value === "" || typeof value === "object") return null;
            return String(value);
          }
        },
        localeText: g.AG_GRID_LOCALE_UK || {},
        getRowId: (params) => {
          var _a3;
          const data = (_a3 = params.data) != null ? _a3 : {};
          const id = data.id;
          if (id != null && id !== "") return String(id);
          return `cm-row-${Object.values(data).map(String).join("|")}`;
        },
        components: {
          customTooltip: agModule == null ? void 0 : agModule.Tooltip,
          customSetFilter: agModule == null ? void 0 : agModule.SmartFilter,
          customExprFilter: agModule == null ? void 0 : agModule.ExprFilter
        },
        context: {
          gridId,
          syncUrlState: (_a2 = config.syncUrlState) != null ? _a2 : true,
          urlPageStateKeys: config.urlPageStateKeys || [],
          getPageState,
          dictionaryUrl: config.dictionaryUrl || ""
        }
      };
      if (config.datasourceUrl && typeof (agModule == null ? void 0 : agModule.createInfiniteDatasource) === "function") {
        const createDs = agModule.createInfiniteDatasource;
        optionsObj.datasource = createDs({
          url: config.datasourceUrl,
          gridId,
          getExtraParams: getPageState,
          onLastRow: (count) => {
            if (config.rowCountSelector) {
              const el = document.querySelector(config.rowCountSelector);
              if (el) el.textContent = String(count);
            }
            if (config.xlsxExportSelector && typeof (agModule == null ? void 0 : agModule.syncExportHref) === "function") {
              const exportEl = document.querySelector(config.xlsxExportSelector);
              if (exportEl) {
                agModule.syncExportHref(exportEl, gridId, { getExtraParams: getPageState, exportColumns: true });
              }
            }
          }
        });
      }
      let host = registry.get(gridId);
      if (!host) {
        host = new HostCtor(gridId, containerId, optionsObj, presets, searches, groupsOrder);
      } else {
        host.gridOptions = optionsObj;
        host.savedColPresets = presets || {};
        host.savedQuickSearches = searches || [];
        if (host.gridApi) {
          try {
            (_c = (_b2 = host.gridApi).destroy) == null ? void 0 : _c.call(_b2);
          } catch (error) {
            console.warn(
              "[GridView.AgGrid] Clean destruction of old grid failed. Proceeding with DOM swap. Error:",
              error
            );
          }
          host.gridApi = null;
        }
      }
      if (!host.gridApi) {
        if (typeof getGlobal().agGrid !== "undefined") {
          (_d = host.initGrid) == null ? void 0 : _d.call(host);
        } else {
          const poll = window.setInterval(() => {
            var _a3;
            if (typeof getGlobal().agGrid !== "undefined") {
              window.clearInterval(poll);
              (_a3 = host == null ? void 0 : host.initGrid) == null ? void 0 : _a3.call(host);
            }
          }, 50);
          window.setTimeout(() => window.clearInterval(poll), 15e3);
        }
      }
      if (!specFilterListeners.has(gridId)) {
        specFilterListeners.add(gridId);
        document.addEventListener("cm-filter-change", (e) => {
          void (async () => {
            var _a3, _b3, _c2, _d2, _e, _f;
            const state = specGridStates.get(gridId);
            if (!state) return;
            const currentConfig = state.config;
            const detail = e.detail;
            const bar = detail == null ? void 0 : detail.bar;
            if (!bar) return;
            if (currentConfig.filtersSelector && !bar.closest(currentConfig.filtersSelector)) return;
            const filterBar = bar.closest("[data-cm-filter-bar]");
            const navigates = ((_a3 = filterBar == null ? void 0 : filterBar.dataset) == null ? void 0 : _a3.navigateOnChange) !== "0";
            const refreshesFacetsInPlace = ((_b3 = filterBar == null ? void 0 : filterBar.dataset) == null ? void 0 : _b3.cmFacets) === "1" && filterBar.dataset.cmFacetsRefreshMode === "in_place";
            if (((_c2 = filterBar == null ? void 0 : filterBar.dataset) == null ? void 0 : _c2.autoApply) === "1" && navigates && !refreshesFacetsInPlace) return;
            const current = registry.get(gridId);
            if (!current) return;
            const filterGeneration = ++state.filterGeneration;
            if (currentConfig.columnSource && current.gridApi) {
              try {
                const nextDefs = await resolveColumnDefs(currentConfig, getPageState);
                if (((_d2 = specGridStates.get(gridId)) == null ? void 0 : _d2.generation) !== state.generation || state.filterGeneration !== filterGeneration) return;
                setColumnDefsPreservingState(current.gridApi, nextDefs);
              } catch (error) {
                console.error("[GridView.AgGrid] column_source refresh failed:", error);
              }
            }
            if (((_e = specGridStates.get(gridId)) == null ? void 0 : _e.generation) !== state.generation || state.filterGeneration !== filterGeneration) return;
            (_f = current.reloadData) == null ? void 0 : _f.call(current);
            const syncExportLinks2 = agModule == null ? void 0 : agModule.syncExportLinks;
            syncExportLinks2 == null ? void 0 : syncExportLinks2(gridId, { getExtraParams: getPageState, exportColumns: true });
          })();
        });
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startUp);
    } else {
      startUp();
    }
    (_b = gv2.byId) == null ? void 0 : _b.registerBoot(gridId, startUp);
  }
  function queryRoot(root) {
    if (root && typeof root === "object" && "querySelectorAll" in root) {
      return root;
    }
    return document;
  }
  function bootAgGridSpecFromDocument(root = document) {
    const scope = queryRoot(root);
    scope.querySelectorAll("script.cm-ag-grid-spec-config").forEach((node) => {
      const el = node;
      if (el.dataset.cmAgBooted) return;
      el.dataset.cmAgBooted = "1";
      try {
        const config = JSON.parse(node.textContent || "{}");
        if (config.gridId) bootFromSpecConfig(config);
      } catch (error) {
        console.error("[GridView.AgGrid] Invalid spec config JSON:", error);
      }
    });
  }

  // src/runtime/boot.ts
  var LAZY_SEL = ".cm-lazy-placeholder[data-endpoint]";
  async function fetchAndReplace(placeholder, gv2) {
    var _a;
    if (placeholder.dataset.cmLazyLoading) return;
    placeholder.dataset.cmLazyLoading = "1";
    const endpoint = placeholder.dataset.endpoint;
    const method = ((_a = placeholder.dataset.method) != null ? _a : "get").toLowerCase();
    const timeoutMs = placeholder.dataset.timeout ? parseInt(placeholder.dataset.timeout, 10) : 3e4;
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
      const url = new URL(endpoint, window.location.href);
      const pageParams = new URLSearchParams(window.location.search);
      pageParams.forEach((value, key) => {
        if (!url.searchParams.has(key)) {
          url.searchParams.set(key, value);
        }
      });
      const resp = await fetch(url.toString(), {
        method,
        signal: ctrl.signal,
        credentials: "same-origin"
      });
      window.clearTimeout(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      const wrapper = document.createElement("div");
      wrapper.innerHTML = html;
      placeholder.replaceWith(wrapper);
      bootScope(wrapper, gv2);
      wrapper.replaceWith(...Array.from(wrapper.childNodes));
    } catch (e) {
      placeholder.classList.add("cm-lazy-error");
      delete placeholder.dataset.cmLazyLoading;
      delete placeholder.dataset.cmLazyInit;
    }
  }
  function initLazyBlocks(scope, gv2) {
    scope.querySelectorAll(LAZY_SEL).forEach((el) => {
      var _a;
      if (el.dataset.cmLazyInit) return;
      el.dataset.cmLazyInit = "1";
      const trigger = (_a = el.dataset.trigger) != null ? _a : "visible";
      if (trigger === "load") {
        void fetchAndReplace(el, gv2);
      } else if (trigger === "visible") {
        const obs = new IntersectionObserver((entries, o) => {
          var _a2;
          if ((_a2 = entries[0]) == null ? void 0 : _a2.isIntersecting) {
            o.disconnect();
            void fetchAndReplace(el, gv2);
          }
        });
        obs.observe(el);
      }
    });
  }
  var CHART_BOOT_INTERVAL_MS = 50;
  var MAX_CHART_BOOT_ATTEMPTS = 200;
  function scopeElement(scope) {
    if (scope && "querySelectorAll" in scope) return scope;
    return document;
  }
  function hasWidgetMarkers(root) {
    const hasMarker = (selector) => root instanceof Element && root.matches(selector) || !!root.querySelector(selector);
    return !!(hasMarker("[data-cm-table]") || hasMarker("[data-cm-filter-bar]") || hasMarker("[data-cm-chart-config]") || hasMarker("[data-cm-kpi-root]") || hasMarker("[data-cm-tab-group]") || hasMarker("[data-cm-nav-tree]") || hasMarker('[data-cm-action="show_content"]') || hasMarker("[data-cm-content-dismissible]") || hasMarker("[data-cm-grid-view-spec]") || hasMarker("script.cm-ag-grid-spec-config") || hasMarker('[data-cm-column-settings="1"]') || hasMarker(LAZY_SEL));
  }
  function bootAgGridInScope(root, gridView2) {
    var _a;
    if (!root.querySelector("script.cm-ag-grid-spec-config")) return;
    const ensure = (_a = gridView2.assets) == null ? void 0 : _a.ensureAgGrid;
    if (ensure) {
      void ensure().then(() => bootAgGridSpecFromDocument(root));
      return;
    }
    bootAgGridSpecFromDocument(root);
  }
  function bootChartsWhenReady(scope, gv2) {
    if (!scope.querySelector("[data-cm-chart-config]")) return;
    let attempts = 0;
    const tryInit = () => {
      var _a, _b;
      const g = window;
      const chartsReady = typeof g.echarts !== "undefined" && !!((_a = g.GridView) == null ? void 0 : _a._chartsApiReady) || !scope.querySelector("[data-cm-chart-config]");
      if (gv2 && chartsReady) {
        gv2.initAllCharts(scope);
        return;
      }
      if (attempts === 0 && ((_b = gv2.assets) == null ? void 0 : _b.ensureCharts)) {
        void gv2.assets.ensureCharts().then(() => {
          attempts += 1;
          tryInit();
        });
        return;
      }
      attempts += 1;
      if (attempts >= MAX_CHART_BOOT_ATTEMPTS) return;
      window.setTimeout(tryInit, CHART_BOOT_INTERVAL_MS);
    };
    tryInit();
  }
  function syncAgGridStyles() {
    if (!document.querySelector("script.cm-ag-grid-spec-config")) {
      unloadAgGridStyles();
    }
  }
  function bootScope(scope, gv2) {
    installConfirmationInterceptors();
    syncAgGridStyles();
    const gridView2 = gv2 != null ? gv2 : window.GridView;
    if (!gridView2) return;
    const root = scopeElement(scope);
    if (!("querySelector" in root)) return;
    if (!hasWidgetMarkers(root)) return;
    const safe = (name, fn) => {
      try {
        fn();
      } catch (err) {
        console.error("[GridView] boot step failed: " + name, err);
      }
    };
    safe("initLazyBlocks", () => initLazyBlocks(root, gridView2));
    safe("initAllSimpleTables", () => initAllSimpleTables(root));
    safe("initTableEdit", () => initTableEdit(root));
    safe("initFilterBars", () => initFilterBars(root));
    safe("initButtonEllipsisTips", () => initButtonEllipsisTips(root));
    safe("initTabGroups", () => initTabGroups(root));
    safe("initNavTrees", () => initNavTrees(root));
    safe("initContentActions", () => initContentActions(root));
    safe("bindDelegatedGridActions", () => bindDelegatedGridActions());
    safe("initGalleryBlocks", () => initGalleryBlocks(root));
    safe("initImageRenderers", () => initImageRenderers(root));
    safe("initAllKpi", () => gridView2.initAllKpi(root));
    safe("bootChartsWhenReady", () => bootChartsWhenReady(root, gridView2));
    safe("bootAgGridInScope", () => bootAgGridInScope(root, gridView2));
  }
  function boot(root, gv2) {
    const gridView2 = gv2 != null ? gv2 : window.GridView;
    if (!gridView2 || !root) {
      bootScope(document, gv2);
      return;
    }
    if (root === document || root instanceof Document) {
      bootScope(root, gridView2);
      return;
    }
    const el = root;
    if (el.matches("[data-cm-grid-view-spec]")) {
      const host = el;
      delete host.dataset.cmGridViewSpecBooted;
      bootScope(host, gridView2);
      return;
    }
    bootScope(el, gridView2);
  }
  var _htmxBound = false;
  function installRuntimeBoot(gv2) {
    initBuiltinRenderers();
    installConfirmationInterceptors();
    if (_htmxBound || typeof document === "undefined") return;
    _htmxBound = true;
    document.addEventListener("htmx:afterSwap", (event) => {
      const detail = event.detail;
      const target = detail == null ? void 0 : detail.target;
      const scope = (target == null ? void 0 : target.isConnected) ? target : document;
      bootScope(scope, gv2);
    });
    document.addEventListener("htmx:oobAfterSwap", (event) => {
      var _a, _b;
      const oobTarget = (_a = event.target) != null ? _a : null;
      const scope = (_b = oobTarget == null ? void 0 : oobTarget.parentElement) != null ? _b : oobTarget;
      if (scope) bootScope(scope, gv2);
    });
  }

  // src/grid-view/create-grid-view.ts
  function mergePluginExports(base, prior) {
    if (!prior) return base;
    return { ...base, ...prior };
  }
  function createGridView() {
    var _a;
    const g = getGlobal();
    const inheritedPreferencesUrl = ((_a = g.GridView) == null ? void 0 : _a.preferencesUrl) || "";
    return {
      preferencesUrl: inheritedPreferencesUrl,
      PageState,
      init,
      boot,
      byId,
      SimpleTable: { initAll: initAllSimpleTables },
      initSimpleTableColumnSettings,
      Charts: ChartsBridge,
      Kpi,
      GridAdapter,
      i18n,
      initChart: (root, config, rows) => root ? ChartsBridge.initChart(root, config, rows) : void 0,
      refreshChartWrap: ChartsBridge.refreshChartWrap,
      initAllCharts: ChartsBridge.initAllCharts,
      initAllKpi: Kpi.initAllKpi,
      buildEchartsOption: ChartsBridge.buildEchartsOption,
      staticRowsAdapter,
      createAgGridAdapter,
      resolveKpis,
      bindGridKpis,
      bindGridFilteredCharts,
      FilterBar,
      initToolbarSearch,
      ToolbarSearch,
      AgGrid,
      bootScope,
      parseSmartQuery,
      matchColumnFilter,
      matchToolbarQuery,
      matchAgGridQuickFilter,
      buildFilterUrl,
      initButtonEllipsisTips,
      initTableEdit,
      registerRenderer,
      formatCurrencyParts,
      registerCommit,
      registerDrop,
      registerAction,
      invokeCommit,
      invokeDrop,
      invokeAction,
      openGallery: openGalleryLightbox,
      closeGallery: closeGalleryLightbox,
      confirm: confirmDialog,
      notify
    };
  }
  function bootstrapGridView() {
    var _a, _b;
    const g = getGlobal();
    const prior = (_a = g.GridView) != null ? _a : {};
    const GridView = createGridView();
    bindNotificationChannel();
    GridView.AgGrid = mergePluginExports(
      GridView.AgGrid,
      prior.AgGrid
    );
    GridView.Charts = mergePluginExports(
      GridView.Charts,
      prior.Charts
    );
    if (prior.FilterDrawerWorkspace) {
      GridView.FilterDrawerWorkspace = prior.FilterDrawerWorkspace;
    }
    if (prior.assets && typeof prior.assets === "object") {
      GridView.assets = { ...prior.assets, ...(_b = GridView.assets) != null ? _b : {} };
    }
    for (const key of [
      "ColumnSettings",
      "createColumnSettings",
      "createDomTableColumnAdapter",
      "createAgGridColumnAdapter"
    ]) {
      const fn = prior[key];
      if (fn != null && GridView[key] == null) {
        GridView[key] = fn;
      }
    }
    const priorInit = prior.initSimpleTableColumnSettings;
    if (typeof priorInit === "function" && priorInit !== GridView.initSimpleTableColumnSettings) {
      GridView.initSimpleTableColumnSettings = priorInit;
    }
    if (g.GridViewI18n) {
      i18n.initI18n(g.GridViewI18n);
    }
    bindDelegatedGridActions();
    getGlobal().GridView = GridView;
    return GridView;
  }

  // src/column-settings/ag-grid-adapter.ts
  function createAgGridColumnAdapter(gridApi, columnMeta) {
    const meta = columnMeta || {};
    const getDefaultColumnState = () => {
      if (!gridApi || !gridApi.getColumns) return [];
      return gridApi.getColumns().map((col) => {
        const colDef = col.getColDef();
        const colId = col.getColId();
        return {
          colId,
          hide: colDef.hide === true,
          pinned: colDef.pinned === "left" || colDef.pinned === "right" ? colDef.pinned : null,
          ...colDef.width !== void 0 ? { width: colDef.width } : {}
        };
      });
    };
    return {
      hasGroupedHeaders() {
        return false;
      },
      getDescriptors() {
        if (!gridApi || !gridApi.getColumns) return [];
        return gridApi.getColumns().map((col) => {
          const colDef = col.getColDef();
          const colId = col.getColId();
          const saved = meta[colId] || {};
          return {
            colId,
            label: colDef.headerName || colId,
            defaultHide: colDef.hide === true,
            menuGroup: saved.menuGroup || colDef.menuGroup || colDef.contextGroup || "",
            exportable: colDef.suppressExport !== true,
            _col: col
          };
        });
      },
      getLeafLabel(colId) {
        var _a;
        if (!gridApi || !gridApi.getColumn) return colId;
        const col = gridApi.getColumn(colId);
        const colDef = col == null ? void 0 : col.getColDef();
        return (colDef == null ? void 0 : colDef.headerName) || ((_a = meta[colId]) == null ? void 0 : _a.label) || colId;
      },
      isVisible(colId) {
        const col = gridApi.getColumn(colId);
        return col ? col.isVisible() : false;
      },
      setVisible(colId, visible) {
        gridApi.setColumnsVisible([colId], visible);
      },
      getPinned(colId) {
        const col = gridApi.getColumn(colId);
        return col ? col.getPinned() : null;
      },
      setPinned(colId, pinned) {
        var _a;
        const hide = ((_a = gridApi.getColumn(colId)) == null ? void 0 : _a.isVisible()) === false;
        gridApi.applyColumnState({ state: [{ colId, pinned, hide }] });
      },
      getColumnState() {
        const state = gridApi.getColumnState();
        return Array.isArray(state) ? state : [];
      },
      applyColumnState(state, applyOrder) {
        gridApi.applyColumnState({ state, applyOrder: !!applyOrder });
      },
      resetColumnState() {
        const defaultState = getDefaultColumnState();
        if (defaultState.length) {
          gridApi.applyColumnState({ state: defaultState, applyOrder: true });
        }
      },
      getDisplayedColumnIds() {
        if (!gridApi.getAllDisplayedColumns) return [];
        return gridApi.getAllDisplayedColumns().map((col) => col.getColId());
      },
      getColumnsForUi() {
        if (!gridApi.getColumns) return [];
        return gridApi.getColumns();
      },
      uiItemFromDescriptor(desc) {
        return { col: desc._col, label: desc.label, colId: desc.colId };
      }
    };
  }

  // src/column-settings/dom-table-adapter.ts
  function createDomTableColumnAdapter(tableEl, columnsMeta) {
    const groupedMode = tableEl.hasAttribute("data-cm-grouped-headers");
    const metaById = {};
    const leafMetaByKey = {};
    (columnsMeta || []).forEach((meta) => {
      metaById[meta.colId] = meta;
      if (meta.isGroup && meta.columnKeys) {
        meta.columnKeys.forEach((key) => {
          const leaf = meta.leafMeta && meta.leafMeta[key] || {};
          leafMetaByKey[key] = {
            exportable: leaf.exportable !== false,
            hide: !!leaf.hide,
            groupId: meta.colId
          };
        });
      } else if (!meta.isGroup) {
        leafMetaByKey[meta.colId] = {
          exportable: meta.exportable !== false,
          hide: !!meta.hide,
          groupId: null
        };
      }
    });
    function leafHeaderRow() {
      const rows = tableEl.querySelectorAll("thead tr");
      return rows.length ? rows[rows.length - 1] : null;
    }
    function headerRow1() {
      const rows = tableEl.querySelectorAll("thead tr");
      return rows.length ? rows[0] : null;
    }
    function cellsForKey(colId) {
      return tableEl.querySelectorAll('[data-cm-col-key="' + colId + '"]');
    }
    function findGroupIdForLeafKey(key) {
      const leaf = leafMetaByKey[key];
      return leaf && leaf.groupId ? leaf.groupId : null;
    }
    function expandKeys(unitId) {
      const meta = metaById[unitId];
      if (meta && meta.isGroup && meta.columnKeys) return meta.columnKeys.slice();
      return [unitId];
    }
    function isLeafHidden(colId) {
      const leaf = tableEl.querySelector('thead tr:last-child [data-cm-col-key="' + colId + '"]') || tableEl.querySelector('thead [data-cm-col-key="' + colId + '"]');
      return !leaf || leaf.classList.contains("cm-col-hidden");
    }
    function isUnitVisible(unitId) {
      return expandKeys(unitId).some((key) => !isLeafHidden(key));
    }
    function readPin(colId) {
      const cell = tableEl.querySelector('thead [data-cm-col-key="' + colId + '"]');
      if (!cell) return null;
      if (cell.classList.contains("cm-col-pin-left")) return "left";
      if (cell.classList.contains("cm-col-pin-right")) return "right";
      return null;
    }
    function applyPin(colId, pinned) {
      cellsForKey(colId).forEach((el) => {
        el.classList.remove("cm-col-pin-left", "cm-col-pin-right");
        if (pinned === "left") el.classList.add("cm-col-pin-left");
        if (pinned === "right") el.classList.add("cm-col-pin-right");
      });
    }
    function syncGroupHeaders() {
      if (!groupedMode) return;
      const row1 = headerRow1();
      if (!row1) return;
      row1.querySelectorAll("[data-cm-col-group-id]").forEach((groupTh) => {
        const unitId = groupTh.getAttribute("data-cm-col-group-id");
        if (!unitId) return;
        const keys = expandKeys(unitId);
        const visibleCount = keys.filter((k) => !isLeafHidden(k)).length;
        if (visibleCount === 0) {
          groupTh.classList.add("cm-col-hidden");
          if (groupTh instanceof HTMLTableCellElement) {
            groupTh.colSpan = 1;
          }
        } else {
          groupTh.classList.remove("cm-col-hidden");
          if (groupTh instanceof HTMLTableCellElement) {
            groupTh.colSpan = visibleCount;
          }
        }
      });
      row1.querySelectorAll("[data-cm-col-key]").forEach((th) => {
        const key = th.getAttribute("data-cm-col-key");
        if (!key) return;
        th.classList.toggle("cm-col-hidden", isLeafHidden(key));
      });
    }
    function setUnitVisible(unitId, visible) {
      expandKeys(unitId).forEach((key) => {
        cellsForKey(key).forEach((el) => {
          el.classList.toggle("cm-col-hidden", !visible);
        });
      });
      if (groupedMode) {
        const meta = metaById[unitId];
        if (meta && meta.isGroup) {
          const groupTh = tableEl.querySelector('[data-cm-col-group-id="' + unitId + '"]');
          if (groupTh) groupTh.classList.toggle("cm-col-hidden", !visible);
        }
        syncGroupHeaders();
      }
      rebalanceTableLayout();
    }
    function readUnitOrderFromDom() {
      if (!groupedMode) {
        const row = leafHeaderRow();
        if (!row) return (columnsMeta || []).map((m) => m.colId);
        return Array.from(row.querySelectorAll("[data-cm-col-key]")).map((th) => th.getAttribute("data-cm-col-key")).filter((key) => key !== null);
      }
      const row2 = leafHeaderRow();
      if (!row2) return (columnsMeta || []).map((m) => m.colId);
      const order = [];
      const ths = Array.from(row2.querySelectorAll("[data-cm-col-key]"));
      for (let i = 0; i < ths.length; i++) {
        const key = ths[i].getAttribute("data-cm-col-key");
        const groupId = key ? findGroupIdForLeafKey(key) : null;
        if (groupId) {
          if (order.indexOf(groupId) === -1) order.push(groupId);
          i += expandKeys(groupId).length - 1;
        } else if (key && order.indexOf(key) === -1) {
          order.push(key);
        }
      }
      return order;
    }
    function readWidth(colId) {
      const col = tableEl.querySelector('colgroup col[data-cm-col-key="' + colId + '"]');
      if (col instanceof HTMLElement && col.style && col.style.width) return col.style.width;
      const th = tableEl.querySelector('thead [data-cm-col-key="' + colId + '"]');
      if (th instanceof HTMLElement) {
        if (th.dataset && th.dataset.cmColWidth) return th.dataset.cmColWidth + "px";
        if (th.style && th.style.width) return th.style.width;
      }
      return null;
    }
    function rebalanceTableLayout() {
      if (window.GridViewColumnLayout && tableEl instanceof HTMLTableElement) {
        window.GridViewColumnLayout.rebalance(tableEl);
      }
    }
    function applyWidth(colId, width) {
      if (!width) return;
      if (isLeafHidden(colId)) return;
      const px = typeof width === "number" ? width + "px" : String(width);
      tableEl.classList.add("cm-table--has-col-widths");
      const col = tableEl.querySelector('colgroup col[data-cm-col-key="' + colId + '"]');
      if (col instanceof HTMLElement) {
        col.style.width = px;
        col.style.minWidth = "";
        delete col.dataset.cmColZero;
      }
      const th = tableEl.querySelector('thead [data-cm-col-key="' + colId + '"]');
      if (th instanceof HTMLElement) {
        th.style.width = px;
        th.style.minWidth = "";
        const num2 = parseFloat(String(px).replace(/px$/i, ""));
        if (!isNaN(num2)) th.dataset.cmColWidth = String(num2);
      }
      rebalanceTableLayout();
    }
    function clearWidths() {
      tableEl.classList.remove("cm-table--has-col-widths");
      if (tableEl instanceof HTMLElement) {
        tableEl.style.width = "";
      }
      tableEl.querySelectorAll("colgroup col[data-cm-col-key]").forEach((col) => {
        if (col instanceof HTMLElement) {
          col.style.width = "";
          col.style.minWidth = "";
        }
      });
      tableEl.querySelectorAll("thead th[data-cm-col-key]").forEach((th) => {
        if (th instanceof HTMLElement) {
          th.style.width = "";
          th.style.minWidth = "";
          delete th.dataset.cmColWidth;
        }
      });
    }
    function syncColgroupOrder(state) {
      const cg = tableEl.querySelector("colgroup[data-cm-colgroup]");
      if (!cg) return;
      if (!groupedMode) {
        state.forEach((item) => {
          if (!item || !item.colId) return;
          const col = cg.querySelector('[data-cm-col-key="' + item.colId + '"]');
          if (col) cg.appendChild(col);
        });
        return;
      }
      state.forEach((item) => {
        if (!item || !item.colId) return;
        expandKeys(item.colId).forEach((key) => {
          const col = cg.querySelector('[data-cm-col-key="' + key + '"]');
          if (col) cg.appendChild(col);
        });
      });
    }
    function reorderUnits(state) {
      if (!groupedMode) {
        const row = leafHeaderRow();
        if (!row) return;
        const byId2 = {};
        Array.from(row.querySelectorAll("[data-cm-col-key]")).forEach((th) => {
          const id = th.getAttribute("data-cm-col-key");
          if (id) byId2[id] = th;
        });
        state.forEach((item) => {
          if (item && item.colId && byId2[item.colId]) row.appendChild(byId2[item.colId]);
        });
        tableEl.querySelectorAll("tbody tr.cm-row").forEach((tr) => {
          const tds = {};
          tr.querySelectorAll("[data-cm-col-key]").forEach((td) => {
            const id = td.getAttribute("data-cm-col-key");
            if (id) tds[id] = td;
          });
          state.forEach((item) => {
            if (item && item.colId && tds[item.colId]) tr.appendChild(tds[item.colId]);
          });
        });
        syncColgroupOrder(state);
        return;
      }
      const row1 = headerRow1();
      const row2 = leafHeaderRow();
      if (!row1 || !row2) return;
      const row1El = row1;
      const row2El = row2;
      function appendUnit(unitId) {
        const meta = metaById[unitId];
        if (meta && meta.isGroup && meta.columnKeys) {
          const groupTh = row1El.querySelector('[data-cm-col-group-id="' + unitId + '"]');
          if (groupTh) row1El.appendChild(groupTh);
          meta.columnKeys.forEach((key) => {
            const th = row2El.querySelector('[data-cm-col-key="' + key + '"]');
            if (th) row2El.appendChild(th);
          });
          return;
        }
        const th1 = row1El.querySelector('[data-cm-col-key="' + unitId + '"]');
        if (th1) row1El.appendChild(th1);
        const th2 = row2El.querySelector('[data-cm-col-key="' + unitId + '"]');
        if (th2) row2El.appendChild(th2);
      }
      state.forEach((item) => {
        if (item && item.colId) appendUnit(item.colId);
      });
      tableEl.querySelectorAll("tbody tr.cm-row").forEach((tr) => {
        state.forEach((item) => {
          if (!item || !item.colId) return;
          expandKeys(item.colId).forEach((key) => {
            const td = tr.querySelector('[data-cm-col-key="' + key + '"]');
            if (td) tr.appendChild(td);
          });
        });
      });
      syncColgroupOrder(state);
    }
    const adapter = {
      hasGroupedHeaders() {
        return groupedMode;
      },
      getDescriptors() {
        return (columnsMeta || []).map((meta) => ({
          colId: meta.colId,
          label: meta.label || meta.colId,
          defaultHide: !!meta.hide,
          menuGroup: meta.menuGroup || "",
          exportable: meta.exportable !== false,
          isGroup: !!meta.isGroup,
          columnKeys: meta.columnKeys || null
        }));
      },
      getLeafLabel(leafKey) {
        const th = tableEl.querySelector(
          'thead [data-cm-col-key="' + leafKey + '"] .cm-th-label'
        );
        if (th && th.textContent) return th.textContent.trim();
        const leaf = leafMetaByKey[leafKey];
        if (leaf && leaf.label) return leaf.label;
        return leafKey;
      },
      isVisible(colId) {
        if (groupedMode && metaById[colId] && metaById[colId].isGroup) {
          return isUnitVisible(colId);
        }
        return !isLeafHidden(colId);
      },
      setVisible(colId, visible) {
        if (groupedMode && metaById[colId] && metaById[colId].isGroup) {
          setUnitVisible(colId, visible);
          return;
        }
        setUnitVisible(colId, visible);
        if (!groupedMode) syncGroupHeaders();
      },
      getPinned(colId) {
        if (groupedMode && metaById[colId] && metaById[colId].isGroup) return null;
        return readPin(colId);
      },
      setPinned(colId, pinned) {
        if (groupedMode && metaById[colId] && metaById[colId].isGroup) return;
        applyPin(colId, pinned);
      },
      getColumnState() {
        return readUnitOrderFromDom().map((unitId) => {
          const meta = metaById[unitId];
          const width = meta && meta.isGroup ? null : readWidth(unitId);
          return {
            colId: unitId,
            hide: !isUnitVisible(unitId),
            pinned: groupedMode ? null : readPin(unitId),
            width: width || null
          };
        });
      },
      applyColumnState(state, applyOrder) {
        if (!Array.isArray(state)) return;
        state.forEach((item) => {
          if (!item || !item.colId) return;
          setUnitVisible(item.colId, !item.hide);
          if (!groupedMode) applyPin(item.colId, item.pinned || null);
          if (item.width && !(metaById[item.colId] && metaById[item.colId].isGroup)) {
            applyWidth(item.colId, item.width);
          }
        });
        if (applyOrder) reorderUnits(state);
        syncGroupHeaders();
        rebalanceTableLayout();
      },
      resetColumnState() {
        clearWidths();
        const defaultState = (columnsMeta || []).map((meta) => ({
          colId: meta.colId,
          hide: !!meta.hide,
          pinned: null,
          width: null
        }));
        adapter.applyColumnState(defaultState, true);
      },
      clearWidths,
      getDisplayedColumnIds() {
        const out = [];
        readUnitOrderFromDom().forEach((unitId) => {
          if (!isUnitVisible(unitId)) return;
          expandKeys(unitId).forEach((key) => {
            const leaf = leafMetaByKey[key];
            if (leaf && leaf.exportable === false) return;
            out.push(key);
          });
        });
        return out;
      },
      syncGroupHeaders
    };
    return adapter;
  }

  // src/column-settings/helpers.ts
  function colT(key, fallback2) {
    const catalog2 = window.GridViewI18n;
    if (catalog2 && catalog2[key]) {
      const val = catalog2[key];
      if (val && val !== key) return val;
    }
    return fallback2;
  }
  function portColSelectorPanel(panel) {
    if (panel.dataset.cmColSelectorPortaled === "1") return panel;
    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
    panel.dataset.cmColSelectorPortaled = "1";
    return panel;
  }
  function getColSelectorPanel(gridId) {
    const panel = document.getElementById("col-selector-panel-" + gridId);
    return panel ? portColSelectorPanel(panel) : null;
  }
  function colPanelIsHidden(panel) {
    return panel.classList.contains("is-hidden") || panel.classList.contains("hidden");
  }
  function setColPanelHidden(panel, hidden) {
    panel.classList.toggle("is-hidden", hidden);
    panel.classList.toggle("hidden", hidden);
  }
  function getCookie(name) {
    if (!document.cookie) return null;
    const parts = document.cookie.split(";");
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (part.indexOf(name + "=") === 0) {
        return decodeURIComponent(part.substring(name.length + 1));
      }
    }
    return null;
  }

  // src/grid-view/drag-drop.ts
  function enableDragReorder(options) {
    const {
      container,
      itemSelector,
      handleSelector,
      draggingClass = "is-dragging",
      dataKey = "cmDragItem",
      onReorder
    } = options;
    let draggedEl = null;
    let canDrag = !handleSelector;
    if (handleSelector) {
      container.addEventListener("mousedown", (e) => {
        const target = e.target;
        canDrag = Boolean(target && target.closest(handleSelector));
      });
      container.addEventListener("mouseup", () => {
        canDrag = false;
      });
    }
    const onDragStart = (e) => {
      var _a;
      if (handleSelector && !canDrag) {
        e.preventDefault();
        return;
      }
      const target = (_a = e.target) == null ? void 0 : _a.closest(itemSelector);
      if (!target || !container.contains(target)) {
        e.preventDefault();
        return;
      }
      draggedEl = target;
      if (e.dataTransfer) {
        e.dataTransfer.setData("text/plain", target.dataset[dataKey] || target.id || "");
        e.dataTransfer.effectAllowed = "move";
      }
      target.classList.add(draggingClass);
    };
    const onDragEnd = () => {
      if (draggedEl) {
        draggedEl.classList.remove(draggingClass);
        draggedEl = null;
      }
    };
    const onDragOver = (e) => {
      var _a;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
      const overTarget = (_a = e.target) == null ? void 0 : _a.closest(itemSelector);
      if (!overTarget || overTarget === draggedEl || !container.contains(overTarget)) return;
      const rect = overTarget.getBoundingClientRect();
      const isVertical = getComputedStyle(container).flexDirection.startsWith("column");
      const offset = isVertical ? e.clientY - rect.top : e.clientX - rect.left;
      const threshold = isVertical ? rect.height / 2 : rect.width / 2;
      if (offset < threshold) {
        container.insertBefore(draggedEl, overTarget);
      } else {
        container.insertBefore(draggedEl, overTarget.nextSibling);
      }
    };
    const onDrop = (e) => {
      e.preventDefault();
      if (!draggedEl) return;
      const items = Array.from(container.querySelectorAll(itemSelector));
      onReorder(items);
    };
    container.addEventListener("dragstart", onDragStart);
    container.addEventListener("dragend", onDragEnd);
    container.addEventListener("dragover", onDragOver);
    container.addEventListener("drop", onDrop);
    return {
      destroy: () => {
        container.removeEventListener("dragstart", onDragStart);
        container.removeEventListener("dragend", onDragEnd);
        container.removeEventListener("dragover", onDragOver);
        container.removeEventListener("drop", onDrop);
      }
    };
  }

  // src/column-settings/page-state.ts
  var WIDTH_PATTERN = /^\d+(?:\.\d+)?(?:px|%|rem|em|vw|vh)?$/i;
  var FORBIDDEN_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  function isRecord6(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function isSafeKey2(key) {
    return !FORBIDDEN_KEYS.has(key);
  }
  function isJsonValue(value, seen = /* @__PURE__ */ new WeakSet()) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value !== "object" || seen.has(value)) return false;
    seen.add(value);
    try {
      if (Array.isArray(value)) return value.every((item) => isJsonValue(item, seen));
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) return false;
      return Object.entries(value).every(
        ([key, item]) => isSafeKey2(key) && isJsonValue(item, seen)
      );
    } finally {
      seen.delete(value);
    }
  }
  function isJsonRecord(value) {
    return isRecord6(value) && isJsonValue(value);
  }
  function normalizeWidth(value) {
    if (value == null) return null;
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
    if (typeof value !== "string") return null;
    const width = value.trim();
    return width.length <= 32 && WIDTH_PATTERN.test(width) ? width : null;
  }
  function normalizeColumnState(value) {
    if (!Array.isArray(value)) return null;
    const seen = /* @__PURE__ */ new Set();
    const normalized = [];
    for (const raw of value) {
      if (!isRecord6(raw) || typeof raw.colId !== "string") return null;
      const colId = raw.colId.trim();
      if (!colId || colId.length > 256 || seen.has(colId)) return null;
      seen.add(colId);
      normalized.push({
        colId,
        hide: raw.hide === true,
        pinned: raw.pinned === "left" || raw.pinned === "right" ? raw.pinned : null,
        width: normalizeWidth(raw.width)
      });
    }
    return normalized;
  }
  function normalizePageColumnState(value) {
    if (!Array.isArray(value)) return null;
    const seen = /* @__PURE__ */ new Set();
    const normalized = [];
    for (const raw of value) {
      if (!isJsonRecord(raw) || typeof raw.id !== "string" || typeof raw.hidden !== "boolean") {
        return null;
      }
      const colId = raw.id.trim();
      if (!colId || colId.length > 256 || seen.has(colId)) return null;
      const pinned = raw.pinned;
      if (pinned !== void 0 && pinned !== "left" && pinned !== "right" && pinned !== null) {
        return null;
      }
      const width = raw.width === void 0 ? null : normalizeWidth(raw.width);
      if (raw.width !== void 0 && width === null) return null;
      seen.add(colId);
      normalized.push({
        colId,
        hide: raw.hidden,
        pinned: pinned === "left" || pinned === "right" ? pinned : null,
        width
      });
    }
    return normalized;
  }
  function statesEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  function pageColumnStoreForRoot(root, gridId) {
    const handle = PageState.forRoot(root);
    if (!handle) return null;
    return {
      handle,
      columnsNamespace: `grid.${gridId}.columns`,
      presetsNamespace: `grid.${gridId}.presets`,
      agGridNamespace: `grid.${gridId}.ag_grid`
    };
  }
  function readPageColumns(store) {
    return normalizePageColumnState(store.handle.get(store.columnsNamespace));
  }
  function serializeColumnState(state) {
    return state.map((column) => {
      const serialized = {
        id: column.colId,
        hidden: column.hide
      };
      if (column.pinned) serialized.pinned = column.pinned;
      if (column.width != null) serialized.width = column.width;
      return serialized;
    });
  }
  function putPageColumns(store, state) {
    const normalized = normalizeColumnState(state);
    if (!normalized) return false;
    store.handle.put(store.columnsNamespace, serializeColumnState(normalized));
    const persisted = readPageColumns(store);
    return persisted !== null && statesEqual(persisted, normalized);
  }
  function readPageColumnPresets(store) {
    const value = store.handle.get(store.presetsNamespace);
    if (!isJsonRecord(value)) return {};
    const presets = {};
    for (const [name, rawPreset] of Object.entries(value)) {
      if (!isSafeKey2(name)) continue;
      const columns = Array.isArray(rawPreset) ? normalizePageColumnState(rawPreset) : isJsonRecord(rawPreset) ? normalizePageColumnState(rawPreset.columns) : null;
      if (!columns) continue;
      if (!Array.isArray(rawPreset) && isJsonRecord(rawPreset) && rawPreset.pageState !== void 0) {
        if (!isJsonRecord(rawPreset.pageState)) continue;
        presets[name] = { columns, pageState: rawPreset.pageState };
      } else {
        presets[name] = columns;
      }
    }
    return presets;
  }
  function putPageColumnPresets(store, presets) {
    const serializable = {};
    for (const [name, preset] of Object.entries(presets)) {
      if (!isSafeKey2(name)) continue;
      const columns = normalizeColumnState(Array.isArray(preset) ? preset : preset.columns);
      if (!columns) continue;
      const value = { columns: serializeColumnState(columns) };
      if (Array.isArray(preset)) {
        serializable[name] = value.columns;
      } else if (preset.pageState === void 0 || isJsonRecord(preset.pageState)) {
        if (preset.pageState !== void 0) value.pageState = preset.pageState;
        serializable[name] = value;
      }
    }
    store.handle.put(store.presetsNamespace, serializable);
  }

  // src/column-settings/drawer-settings.ts
  function dragHandle() {
    const handle = document.createElement("span");
    handle.className = "cm-col-settings-drag-handle";
    handle.dataset.cmColDragHandle = "1";
    handle.setAttribute("aria-label", colT("column_settings.reorder", "Reorder column"));
    handle.textContent = "\u283F";
    return handle;
  }
  function columnRow(actions, state) {
    var _a, _b;
    const visible = !state.hide;
    const row = document.createElement("div");
    row.className = `cm-col-settings-chip cm-col-settings-chip--drawer ${visible ? "is-on" : "is-off"}`;
    row.dataset.cmColumnKey = state.colId;
    row.draggable = true;
    row.appendChild(dragHandle());
    const dot = document.createElement("span");
    dot.className = "cm-col-settings-state-dot";
    dot.setAttribute("aria-hidden", "true");
    row.appendChild(dot);
    const toggleVisibility = () => {
      actions.adapter.setVisible(state.colId, !visible);
      actions.refresh();
      actions.saveColumns();
    };
    row.addEventListener("click", (event) => {
      const target = event.target;
      if ((target == null ? void 0 : target.closest("[data-cm-col-drag-handle]")) || (target == null ? void 0 : target.closest(".cm-col-settings-pin-btn"))) {
        return;
      }
      toggleVisibility();
    });
    const label = document.createElement("button");
    label.type = "button";
    label.className = "cm-col-settings-chip-label";
    label.textContent = ((_b = (_a = actions.adapter).getLeafLabel) == null ? void 0 : _b.call(_a, state.colId)) || state.colId;
    row.appendChild(label);
    const pins = document.createElement("div");
    pins.className = `cm-col-settings-chip-pins${visible ? "" : " is-dimmed"}`;
    ["left", "right"].forEach((direction) => {
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "cm-col-settings-pin-btn";
      pin.textContent = direction === "left" ? "L" : "R";
      pin.setAttribute("aria-pressed", String(state.pinned === direction));
      pin.addEventListener("click", () => {
        actions.adapter.setPinned(state.colId, state.pinned === direction ? null : direction);
        actions.refresh();
        actions.saveColumns();
      });
      pins.appendChild(pin);
    });
    row.appendChild(pins);
    return row;
  }
  function renderPresetList(actions) {
    const section = document.createElement("section");
    section.className = "cm-filter-drawer-card cm-filter-drawer-presets";
    const header = document.createElement("header");
    header.className = "cm-filter-drawer-card-header";
    const heading = document.createElement("div");
    heading.className = "cm-filter-drawer-card-heading";
    const title = document.createElement("h3");
    title.textContent = colT("column_settings.presets", "Saved presets");
    const count = document.createElement("span");
    count.className = "cm-filter-drawer-card-count";
    count.textContent = String(Object.keys(actions.savedPresets).length);
    heading.append(title, count);
    header.append(heading);
    section.appendChild(header);
    const inputRow = document.createElement("div");
    inputRow.className = "cm-filter-drawer-preset-input";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = colT("column_settings.preset_placeholder", "Preset name");
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = colT("column_settings.save", "Save");
    const saveCurrent = () => {
      if (!actions.savePreset(input.value)) return;
      input.value = "";
      actions.refresh();
    };
    save.addEventListener("click", saveCurrent);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      saveCurrent();
    });
    inputRow.append(input, save);
    section.appendChild(inputRow);
    const list = document.createElement("div");
    list.className = "cm-filter-drawer-presets-list";
    Object.keys(actions.savedPresets).forEach((name) => {
      const item = document.createElement("div");
      item.className = "cm-filter-drawer-preset";
      if (name === actions.activePresetName) item.classList.add("is-active");
      const apply = document.createElement("button");
      apply.type = "button";
      apply.className = "cm-filter-drawer-preset-apply";
      apply.textContent = name;
      apply.addEventListener("click", () => actions.applyPreset(name));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "cm-filter-drawer-preset-delete";
      remove.setAttribute("aria-label", colT("column_settings.delete", "Delete preset"));
      remove.textContent = "\xD7";
      remove.addEventListener("click", () => {
        actions.deletePreset(name);
        actions.refresh();
      });
      item.append(apply, remove);
      list.appendChild(item);
    });
    if (!list.childElementCount) {
      const empty = document.createElement("p");
      empty.className = "cm-filter-drawer-presets-empty";
      empty.textContent = colT("column_settings.no_presets_hint", "No saved presets yet.");
      list.appendChild(empty);
    }
    section.appendChild(list);
    const resetLink = document.createElement("button");
    resetLink.type = "button";
    resetLink.className = "cm-filter-drawer-settings-reset-link";
    resetLink.textContent = colT("column_settings.reset", "Reset to default");
    resetLink.addEventListener("click", actions.resetColumns);
    section.appendChild(resetLink);
    return section;
  }
  function saveOrder(actions, list) {
    const stateById = new Map(actions.getColumnState().map((state) => [state.colId, state]));
    const ordered = Array.from(list.children).map((element) => element instanceof HTMLElement ? element.dataset.cmColumnKey || "" : "").map((columnId) => stateById.get(columnId)).filter((state) => state !== void 0);
    if (ordered.length !== stateById.size) return;
    actions.adapter.applyColumnState(ordered, true);
    actions.refresh();
    actions.saveColumns();
  }
  function renderDrawerColumnSettings(container, actions) {
    var _a;
    const header = document.createElement("header");
    header.className = "cm-filter-drawer-card-header";
    const heading = document.createElement("div");
    heading.className = "cm-filter-drawer-card-heading";
    const title = document.createElement("h3");
    title.textContent = colT("column_settings.title", "Column Settings");
    heading.append(title);
    header.append(heading);
    const list = document.createElement("div");
    list.className = "cm-col-checkboxes cm-col-checkboxes--drawer";
    list.dataset.cmColSettingsDrawerList = actions.gridId;
    actions.getColumnState().forEach((state) => list.appendChild(columnRow(actions, state)));
    const externalPresetsContainer = (_a = container.parentElement) == null ? void 0 : _a.querySelector(
      `[data-cm-filter-drawer-presets][data-cm-grid-id="${actions.gridId}"]`
    );
    if (externalPresetsContainer) {
      container.replaceChildren(header, list);
      externalPresetsContainer.replaceChildren(renderPresetList(actions));
    } else {
      container.replaceChildren(header, list, renderPresetList(actions));
    }
    const dragHandle2 = enableDragReorder({
      container: list,
      itemSelector: ".cm-col-settings-chip--drawer",
      handleSelector: "[data-cm-col-drag-handle]",
      draggingClass: "is-dragging",
      onReorder: () => saveOrder(actions, list)
    });
    return dragHandle2;
  }

  // src/column-settings/host.ts
  function isSavedColumnPreset(value) {
    return !Array.isArray(value);
  }
  var ColumnSettingsHost = class {
    constructor(gridId, adapter, options) {
      this.activePresetName = null;
      this.drawerSettingsContainers = /* @__PURE__ */ new Set();
      this.drawerOrderSortables = /* @__PURE__ */ new Map();
      const opts = options || {};
      this.gridId = gridId;
      this.adapter = adapter;
      this.groupsOrder = opts.groupsOrder || [];
      this.savedColPresets = opts.initialPresets || {};
      this.pageStateHooks = opts.pageStateHooks || {};
      this.preferencesUrl = opts.preferencesUrl || "";
      this.pageColumnStore = pageColumnStoreForRoot(opts.pageStateRoot, this.gridId);
      if (Object.keys(this.savedColPresets).length === 0 && this.pageColumnStore) {
        this.savedColPresets = readPageColumnPresets(this.pageColumnStore);
      }
      this.onStateChange = opts.onStateChange || null;
      this.colOrderSortable = null;
      this._bindModalDismiss();
      this._applyInitialState(opts.initialState);
      this.renderSavedPresets();
      this.syncExportLinks();
    }
    applyPreset(name) {
      const preset = this.savedColPresets[name];
      if (!preset) return;
      const columns = Array.isArray(preset) ? preset : preset.columns;
      this.adapter.applyColumnState(columns, true);
      if (isSavedColumnPreset(preset) && preset.pageState && this.pageStateHooks.applyPageState) {
        this.pageStateHooks.applyPageState(preset.pageState);
      }
      this.activePresetName = name;
      this.saveState();
      this.syncExportLinks();
      this.refreshColumnSettings();
      this.renderSavedPresets();
    }
    _bindModalDismiss() {
      if (window._cmColSettingsEscBound) return;
      window._cmColSettingsEscBound = true;
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        document.querySelectorAll(".cm-col-presets-dropdown:not(.is-hidden)").forEach((dd) => {
          dd.classList.add("is-hidden");
        });
        document.querySelectorAll('[id^="col-selector-panel-"]').forEach((panel) => {
          if (panel instanceof HTMLElement && !colPanelIsHidden(panel)) {
            setColPanelHidden(panel, true);
          }
        });
      });
      document.addEventListener("click", (e) => {
        const target = e.target;
        document.querySelectorAll(".cm-col-presets-dropdown:not(.is-hidden)").forEach((dd) => {
          const gridId = dd.id.replace("col-presets-dropdown-", "");
          const btn = document.getElementById("col-selector-btn-" + gridId) || document.querySelector(`[data-cm-col-action="toggle"][data-cm-grid-id="${gridId}"]`);
          if (target instanceof Element && (dd.contains(target) || btn && btn.contains(target))) return;
          dd.classList.add("is-hidden");
        });
        document.querySelectorAll('[id^="col-selector-panel-"]').forEach((panel) => {
          if (!(panel instanceof HTMLElement) || colPanelIsHidden(panel)) return;
          if (target === panel || target instanceof Element && target.classList.contains("cm-col-selector-backdrop") || target instanceof Element && target.closest(".cm-col-selector-close")) {
            setColPanelHidden(panel, true);
          }
        });
      });
    }
    _applyInitialState(initialState) {
      var _a;
      const state = initialState != null ? initialState : this.pageColumnStore ? (_a = readPageColumns(this.pageColumnStore)) != null ? _a : void 0 : void 0;
      if (state && Array.isArray(state)) {
        this.adapter.applyColumnState(state, true);
      }
    }
    getColumnState() {
      return this.adapter.getColumnState();
    }
    setPageStateHooks(hooks) {
      this.pageStateHooks = hooks;
    }
    saveState() {
      const state = this.getColumnState();
      if (this.pageColumnStore) {
        putPageColumns(this.pageColumnStore, state);
      }
      this.syncExportLinks();
      if (typeof this.onStateChange === "function") this.onStateChange(state);
    }
    openColSelectorModal() {
      this.closePresetsDropdown();
      const panel = getColSelectorPanel(this.gridId);
      if (!panel) return;
      setColPanelHidden(panel, false);
      this.refreshColumnSettings();
    }
    closeColSelectorModal() {
      this.closePresetsDropdown();
      const panel = getColSelectorPanel(this.gridId);
      if (!panel) return;
      setColPanelHidden(panel, true);
    }
    closePresetsDropdown() {
      const dd = document.getElementById("col-presets-dropdown-" + this.gridId);
      if (dd) dd.classList.add("is-hidden");
    }
    toggleColSelector(forceModal = false) {
      const panel = getColSelectorPanel(this.gridId);
      if (panel && !colPanelIsHidden(panel)) {
        setColPanelHidden(panel, true);
        return;
      }
      const presetNames = Object.keys(this.savedColPresets || {});
      if (presetNames.length === 0 || forceModal) {
        this.closePresetsDropdown();
        if (!panel) return;
        setColPanelHidden(panel, false);
        this.refreshColumnSettings();
        return;
      }
      this.togglePresetsDropdown();
    }
    togglePresetsDropdown() {
      let dd = document.getElementById("col-presets-dropdown-" + this.gridId);
      if (dd && !dd.classList.contains("is-hidden")) {
        dd.classList.add("is-hidden");
        return;
      }
      const btn = document.getElementById("col-selector-btn-" + this.gridId) || document.querySelector(`[data-cm-col-action="toggle"][data-cm-grid-id="${this.gridId}"]`);
      if (!btn) {
        this.openColSelectorModal();
        return;
      }
      if (!dd) {
        dd = document.createElement("div");
        dd.id = "col-presets-dropdown-" + this.gridId;
        dd.className = "cm-col-presets-dropdown";
        if (btn.parentElement) {
          btn.parentElement.appendChild(dd);
        } else {
          btn.insertAdjacentElement("afterend", dd);
        }
      }
      this.renderPresetsDropdownContent(dd);
      dd.classList.remove("is-hidden");
    }
    renderPresetsDropdownContent(dd) {
      dd.innerHTML = "";
      const header = document.createElement("div");
      header.className = "cm-col-presets-dropdown-header";
      header.textContent = colT("column_settings.presets", "Presets");
      dd.appendChild(header);
      const list = document.createElement("div");
      list.className = "cm-col-presets-dropdown-list";
      if (this.activePresetName) {
        const defaultItem = document.createElement("div");
        defaultItem.className = "cm-col-preset-dropdown-item cm-col-preset-dropdown-item--default";
        defaultItem.innerHTML = `
        <svg class="cm-col-preset-dropdown-item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        <span class="cm-col-preset-dropdown-item-name">${colT("column_settings.preset_default", "Default")}</span>
      `;
        defaultItem.onclick = (e) => {
          e.stopPropagation();
          this.resetColumnsToDefault();
          this.closePresetsDropdown();
        };
        list.appendChild(defaultItem);
      }
      const presetNames = Object.keys(this.savedColPresets || {});
      presetNames.forEach((name) => {
        const item = document.createElement("div");
        item.className = "cm-col-preset-dropdown-item";
        const isActive = this.activePresetName === name;
        if (isActive) {
          item.classList.add("is-active");
        }
        item.innerHTML = `
        <svg class="cm-col-preset-dropdown-item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        <span class="cm-col-preset-dropdown-item-name" style="flex: 1;"></span>
        ${isActive ? '<svg class="cm-col-preset-active-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : ""}
      `;
        const nameSpan = item.querySelector(".cm-col-preset-dropdown-item-name");
        if (nameSpan) nameSpan.textContent = name;
        item.onclick = (e) => {
          e.stopPropagation();
          this.applyPreset(name);
          this.closePresetsDropdown();
        };
        list.appendChild(item);
      });
      dd.appendChild(list);
      const divider = document.createElement("div");
      divider.className = "cm-col-preset-dropdown-divider";
      dd.appendChild(divider);
      const settingsBtn = document.createElement("button");
      settingsBtn.type = "button";
      settingsBtn.className = "cm-col-preset-dropdown-action";
      settingsBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      <span>${colT("column_settings.title", "Column Settings")}...</span>
    `;
      settingsBtn.onclick = (e) => {
        e.stopPropagation();
        this.openColSelectorModal();
      };
      dd.appendChild(settingsBtn);
    }
    resetColumnsToDefault() {
      this.adapter.resetColumnState();
      this.activePresetName = null;
      this.refreshColumnSettings();
      this.saveState();
      this.syncExportLinks();
      this.renderSavedPresets();
    }
    mountColumnSettings(container) {
      this.drawerSettingsContainers.add(container);
      this.renderDrawerSettings(container);
    }
    refreshColumnSettings() {
      this.buildColCheckboxes();
      this.drawerSettingsContainers.forEach((container) => {
        var _a;
        if (!container.isConnected) {
          this.drawerSettingsContainers.delete(container);
          (_a = this.drawerOrderSortables.get(container)) == null ? void 0 : _a.destroy();
          this.drawerOrderSortables.delete(container);
          return;
        }
        this.renderDrawerSettings(container);
      });
    }
    renderDrawerSettings(container) {
      var _a;
      (_a = this.drawerOrderSortables.get(container)) == null ? void 0 : _a.destroy();
      const sortable = renderDrawerColumnSettings(container, {
        gridId: this.gridId,
        adapter: this.adapter,
        savedPresets: this.savedColPresets,
        activePresetName: this.activePresetName,
        getColumnState: () => this.getColumnState(),
        resetColumns: () => this.resetColumnsToDefault(),
        applyPreset: (name) => this.applyPreset(name),
        savePreset: (name) => this.savePreset(name),
        deletePreset: (name) => this.deletePreset(name),
        saveColumns: () => this.saveState(),
        refresh: () => this.refreshColumnSettings()
      });
      if (sortable) this.drawerOrderSortables.set(container, sortable);
      else this.drawerOrderSortables.delete(container);
    }
    buildColCheckboxes(container) {
      const target = container || document.getElementById("col-checkboxes-" + this.gridId);
      if (!target) return;
      target.innerHTML = "";
      const descriptors = this.adapter.getDescriptors();
      const groups = {};
      const mainLabel = colT("column_settings.main_group", "Main");
      descriptors.forEach((desc) => {
        const groupName = desc.isGroup ? desc.label : desc.menuGroup || mainLabel;
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(desc);
      });
      Object.keys(groups).forEach((g) => {
        groups[g].sort((a, b) => String(a.label).localeCompare(String(b.label)));
      });
      const sectionNames = [];
      if (groups[mainLabel] && groups[mainLabel].length) sectionNames.push(mainLabel);
      this.groupsOrder.forEach((g) => {
        if (groups[g] && groups[g].length && sectionNames.indexOf(g) === -1) sectionNames.push(g);
      });
      Object.keys(groups).forEach((g) => {
        if (sectionNames.indexOf(g) === -1 && groups[g].length) sectionNames.push(g);
      });
      const appendLeafChip = (itemsCont, leafKey, groupDesc) => {
        const visible = this.adapter.isVisible(leafKey);
        const chip = document.createElement("div");
        chip.className = "cm-col-settings-chip " + (visible ? "is-on" : "is-off");
        chip.dataset.cmColumnKey = leafKey;
        const textWrap = document.createElement("div");
        textWrap.className = "cm-col-settings-chip-label";
        textWrap.textContent = typeof this.adapter.getLeafLabel === "function" ? this.adapter.getLeafLabel(leafKey) : leafKey;
        textWrap.onclick = (e) => {
          e.stopPropagation();
          this.adapter.setVisible(leafKey, !visible);
          this.refreshColumnSettings();
          this.saveState();
        };
        chip.appendChild(textWrap);
        if (!groupDesc || !groupDesc.isGroup) {
          const pins = document.createElement("div");
          const pinnedState = this.adapter.getPinned(leafKey);
          pins.className = "cm-col-settings-chip-pins" + (visible ? "" : " is-dimmed");
          ["left", "right"].forEach((dir) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = dir === "left" ? "L" : "R";
            btn.className = "cm-col-settings-pin-btn";
            btn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              const next = pinnedState === dir ? null : dir;
              this.adapter.setPinned(leafKey, next);
              this.refreshColumnSettings();
              this.saveState();
            };
            pins.appendChild(btn);
          });
          chip.appendChild(pins);
        }
        itemsCont.appendChild(chip);
      };
      sectionNames.forEach((groupName) => {
        const groupCols = groups[groupName];
        if (!groupCols.length) return;
        const groupColDiv = document.createElement("div");
        groupColDiv.className = "cm-col-settings-group";
        const groupHeader = document.createElement("div");
        groupHeader.className = "cm-col-settings-group-header";
        const titleSpan = document.createElement("div");
        titleSpan.className = "cm-col-settings-group-title";
        titleSpan.textContent = groupName;
        const rightControls = document.createElement("div");
        rightControls.className = "cm-col-settings-group-actions";
        const lbl = document.createElement("span");
        lbl.textContent = colT("column_settings.select", "Select:") + " ";
        rightControls.appendChild(lbl);
        ["All", "None", "Standard"].forEach((kind) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "cm-col-settings-action-link";
          btn.textContent = colT("column_settings." + kind.toLowerCase(), kind);
          btn.onclick = (e) => {
            e.preventDefault();
            groupCols.forEach((desc) => {
              if (desc.isGroup && desc.columnKeys) {
                desc.columnKeys.forEach((leafKey) => {
                  if (kind === "All") this.adapter.setVisible(leafKey, true);
                  else if (kind === "None") this.adapter.setVisible(leafKey, false);
                  else {
                    const leafDesc = descriptors.find((d) => !d.isGroup && d.colId === leafKey);
                    this.adapter.setVisible(leafKey, !(leafDesc && leafDesc.defaultHide));
                  }
                });
                return;
              }
              if (kind === "All") this.adapter.setVisible(desc.colId, true);
              else if (kind === "None") this.adapter.setVisible(desc.colId, false);
              else this.adapter.setVisible(desc.colId, !desc.defaultHide);
            });
            this.refreshColumnSettings();
            this.saveState();
          };
          rightControls.appendChild(btn);
        });
        groupHeader.appendChild(titleSpan);
        groupHeader.appendChild(rightControls);
        groupColDiv.appendChild(groupHeader);
        const itemsCont = document.createElement("div");
        itemsCont.className = "cm-col-settings-items";
        groupCols.forEach((desc) => {
          if (desc.isGroup && desc.columnKeys && desc.columnKeys.length) {
            desc.columnKeys.forEach((leafKey) => {
              appendLeafChip(itemsCont, leafKey, desc);
            });
            return;
          }
          appendLeafChip(itemsCont, desc.colId, desc);
        });
        groupColDiv.appendChild(itemsCont);
        target.appendChild(groupColDiv);
      });
      if (!container) this.buildColOrderList();
    }
    buildColOrderList() {
      const listContainer = document.getElementById("col-order-list-" + this.gridId);
      if (!listContainer) return;
      listContainer.innerHTML = "";
      const descriptors = this.adapter.getDescriptors();
      const visible = this.getColumnState().filter((item) => !item.hide);
      const mainItems = [];
      const groupItems = [];
      visible.forEach((item) => {
        const desc = descriptors.find((d) => d.colId === item.colId);
        if (desc && desc.isGroup) groupItems.push(item);
        else mainItems.push(item);
      });
      groupItems.sort((a, b) => {
        const descA = descriptors.find((d) => d.colId === a.colId);
        const descB = descriptors.find((d) => d.colId === b.colId);
        let idxA = descA ? this.groupsOrder.indexOf(descA.label) : -1;
        let idxB = descB ? this.groupsOrder.indexOf(descB.label) : -1;
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
      });
      mainItems.concat(groupItems).forEach((item) => {
        const desc = descriptors.find((d) => d.colId === item.colId);
        const label = desc ? desc.label : item.colId;
        const pill = document.createElement("div");
        pill.className = "cm-col-order-pill" + (item.pinned ? " is-pinned" : "");
        pill.draggable = true;
        pill.dataset.colid = item.colId;
        pill.textContent = label;
        listContainer.appendChild(pill);
      });
      const host = this;
      this.colOrderSortable = enableDragReorder({
        container: listContainer,
        itemSelector: ".cm-col-order-pill",
        draggingClass: "sortable-chosen",
        onReorder() {
          const newState = [];
          for (let i = 0; i < listContainer.children.length; i++) {
            const child = listContainer.children[i];
            if (!(child instanceof HTMLElement)) continue;
            const colId = child.dataset.colid;
            if (!colId) continue;
            const prev = host.getColumnState().find((c) => c.colId === colId) || { colId, hide: false, pinned: null };
            newState.push({
              colId,
              hide: !!prev.hide,
              pinned: prev.pinned || null
            });
          }
          host.getColumnState().filter((c) => c.hide).forEach((c) => {
            newState.push(c);
          });
          host.adapter.applyColumnState(newState, true);
          host.saveState();
        }
      });
    }
    renderSavedPresets() {
      const container = document.getElementById("presets-container-" + this.gridId);
      if (!container) return;
      container.innerHTML = "";
      const presetNames = Object.keys(this.savedColPresets);
      if (presetNames.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "cm-col-presets-empty";
        emptyMsg.textContent = colT(
          "column_settings.no_presets_hint",
          "No saved presets yet. Configure columns above, enter a name, and click Save."
        );
        container.appendChild(emptyMsg);
      } else {
        presetNames.forEach((name) => {
          const chip = document.createElement("div");
          chip.className = "cm-col-preset-chip";
          chip.onclick = () => {
            const input = document.getElementById("preset-name-" + this.gridId);
            if (input instanceof HTMLInputElement) input.value = name;
          };
          const text = document.createElement("span");
          text.className = "cm-col-preset-chip-label";
          text.textContent = name;
          const applyBtn = document.createElement("button");
          applyBtn.type = "button";
          applyBtn.className = "cm-col-preset-apply-btn";
          applyBtn.textContent = colT("column_settings.load", colT("column_settings.apply", "Load"));
          applyBtn.onclick = (e) => {
            e.stopPropagation();
            this.applyPreset(name);
          };
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "cm-col-preset-delete-btn";
          delBtn.innerHTML = "&times;";
          delBtn.onclick = (e) => {
            e.stopPropagation();
            this.deletePreset(name);
          };
          chip.appendChild(text);
          chip.appendChild(applyBtn);
          chip.appendChild(delBtn);
          container.appendChild(chip);
        });
      }
      const dd = document.getElementById("col-presets-dropdown-" + this.gridId);
      if (dd) {
        if (Object.keys(this.savedColPresets).length === 0) {
          dd.classList.add("is-hidden");
        } else if (!dd.classList.contains("is-hidden")) {
          this.renderPresetsDropdownContent(dd);
        }
      }
      const moreContainer = document.querySelector(
        `[data-cm-more-presets="${this.gridId}"]`
      );
      if (moreContainer) {
        moreContainer.innerHTML = "";
        const presetNames2 = Object.keys(this.savedColPresets || {});
        if (presetNames2.length > 0) {
          const divider = document.createElement("div");
          divider.className = "cm-toolbar-more-divider";
          moreContainer.appendChild(divider);
          const header = document.createElement("div");
          header.className = "cm-toolbar-more-header";
          header.textContent = colT("column_settings.presets", "Presets");
          moreContainer.appendChild(header);
          if (this.activePresetName) {
            const defaultItem = document.createElement("button");
            defaultItem.type = "button";
            defaultItem.className = "cm-toolbar-more-item cm-toolbar-more-item--preset cm-toolbar-more-item--default";
            defaultItem.role = "menuitem";
            defaultItem.innerHTML = `
            <svg class="cm-toolbar-more-icon cm-toolbar-more-icon--preset" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span>${colT("column_settings.preset_default", "Default")}</span>
          `;
            defaultItem.onclick = (e) => {
              e.stopPropagation();
              this.resetColumnsToDefault();
              const details = defaultItem.closest("details");
              if (details) details.removeAttribute("open");
            };
            moreContainer.appendChild(defaultItem);
          }
          presetNames2.forEach((name) => {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "cm-toolbar-more-item cm-toolbar-more-item--preset";
            const isActive = this.activePresetName === name;
            if (isActive) {
              item.classList.add("is-active");
            }
            item.role = "menuitem";
            item.innerHTML = `
            <svg class="cm-toolbar-more-icon cm-toolbar-more-icon--preset" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            <span style="flex: 1; text-align: left;"></span>
            ${isActive ? '<svg class="cm-col-preset-active-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : ""}
          `;
            const nameSpan = item.querySelector("span");
            if (nameSpan) nameSpan.textContent = name;
            item.onclick = (e) => {
              e.stopPropagation();
              this.applyPreset(name);
              const details = item.closest("details");
              if (details) details.removeAttribute("open");
            };
            moreContainer.appendChild(item);
          });
          const divider2 = document.createElement("div");
          divider2.className = "cm-toolbar-more-divider";
          moreContainer.appendChild(divider2);
        }
      }
    }
    savePreset(name) {
      var _a, _b, _c;
      const normalizedName = name.trim();
      if (!normalizedName) return false;
      const pageState = (_c = (_b = (_a = this.pageStateHooks).getPageState) == null ? void 0 : _b.call(_a)) != null ? _c : {};
      this.savedColPresets[normalizedName] = Object.keys(pageState).length ? { columns: this.getColumnState(), pageState } : this.getColumnState();
      this.renderSavedPresets();
      this.saveColPresetsToServer();
      return true;
    }
    deletePreset(name) {
      delete this.savedColPresets[name];
      if (this.activePresetName === name) {
        this.activePresetName = null;
      }
      this.saveColPresetsToServer();
      this.renderSavedPresets();
    }
    saveCurrentPreset() {
      const nameInput = document.getElementById("preset-name-" + this.gridId);
      if (!(nameInput instanceof HTMLInputElement) || !this.savePreset(nameInput.value)) return;
      nameInput.value = "";
    }
    saveColPresetsToServer() {
      if (this.pageColumnStore) putPageColumnPresets(this.pageColumnStore, this.savedColPresets);
      if (!this.preferencesUrl) return;
      fetch(this.preferencesUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken") || ""
        },
        body: JSON.stringify({ grid_id: this.gridId, colPresets: this.savedColPresets })
      }).catch((err) => {
        console.error("column presets save failed", err);
      });
    }
    syncExportLinks() {
      var _a, _b;
      const syncFn = (_b = (_a = window.GridView) == null ? void 0 : _a.AgGrid) == null ? void 0 : _b.syncExportHref;
      const gridId = this.gridId;
      const adapter = this.adapter;
      document.querySelectorAll('[data-cm-export-sync][data-cm-grid-id="' + gridId + '"]').forEach((link) => {
        if (!(link instanceof HTMLAnchorElement) || !link.href) return;
        if (syncFn) {
          try {
            syncFn(link, gridId);
          } catch (e) {
          }
          return;
        }
        const ids = adapter.getDisplayedColumnIds().join(",");
        const url = new URL(link.href, window.location.origin);
        if (ids) url.searchParams.set("export_cols", ids);
        else url.searchParams.delete("export_cols");
        link.href = url.toString();
      });
    }
  };

  // src/column-settings/install.ts
  function isColumnMetaInput(value) {
    return typeof value === "object" && value !== null && "colId" in value && typeof value.colId === "string";
  }
  function parseColumnsMeta(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isColumnMetaInput);
    } catch (e) {
      return [];
    }
  }
  function parseStringArray(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => typeof item === "string");
    } catch (e) {
      return [];
    }
  }
  function isColumnStateItem2(value) {
    return typeof value === "object" && value !== null && "colId" in value && typeof value.colId === "string";
  }
  function isSavedColumnPreset2(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value) && "columns" in value && Array.isArray(value.columns) && value.columns.every(isColumnStateItem2);
  }
  function parsePresets(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const out = {};
      for (const [name, state] of Object.entries(parsed)) {
        if (Array.isArray(state) && state.every(isColumnStateItem2)) {
          out[name] = state;
        } else if (isSavedColumnPreset2(state)) {
          out[name] = state;
        }
      }
      return out;
    } catch (e) {
      return {};
    }
  }
  function createColumnSettings(gridId, adapter, options) {
    return new ColumnSettingsHost(gridId, adapter, options);
  }
  function initSimpleTableColumnSettings2(wrapper) {
    var _a, _b;
    if (!(wrapper instanceof HTMLElement)) return null;
    const shell = wrapper;
    if (shell.dataset.cmColSettingsBound) return (_a = shell._colSettings) != null ? _a : null;
    if (shell.dataset.cmColumnSettings !== "1") return null;
    const table = shell.querySelector("[data-cm-table]");
    if (!table) return null;
    let columnsMeta = [];
    let groupsOrder = [];
    let presets = {};
    columnsMeta = parseColumnsMeta(shell.dataset.cmColumns || "[]");
    groupsOrder = parseStringArray(shell.dataset.cmGroupsOrder || "[]");
    presets = parsePresets(shell.dataset.cmPresets || "{}");
    const adapter = createDomTableColumnAdapter(table, columnsMeta);
    const host = new ColumnSettingsHost(shell.dataset.gridId || "table", adapter, {
      groupsOrder,
      initialPresets: presets,
      preferencesUrl: shell.dataset.cmPreferencesUrl || "",
      pageStateRoot: shell
    });
    shell.dataset.cmColSettingsBound = "1";
    shell._colSettings = host;
    getColSelectorPanel(host.gridId);
    if ((_b = window.GridView) == null ? void 0 : _b.byId) {
      window.GridView.byId.register(host.gridId, host);
    }
    if (typeof adapter.syncGroupHeaders === "function") adapter.syncGroupHeaders();
    document.querySelectorAll('[data-cm-export-sync][data-cm-grid-id="' + host.gridId + '"]').forEach((link) => {
      if (link instanceof HTMLElement && !link.dataset.cmExportClickBound) {
        link.dataset.cmExportClickBound = "1";
        link.addEventListener("click", () => {
          host.syncExportLinks();
        });
      }
    });
    return host;
  }
  function installColumnSettings(gv2) {
    gv2.ColumnSettings = ColumnSettingsHost;
    gv2.createColumnSettings = createColumnSettings;
    gv2.createDomTableColumnAdapter = createDomTableColumnAdapter;
    gv2.createAgGridColumnAdapter = createAgGridColumnAdapter;
    gv2.initSimpleTableColumnSettings = initSimpleTableColumnSettings2;
    document.querySelectorAll('[data-cm-column-settings="1"]').forEach((shell) => {
      if (shell instanceof HTMLElement && !shell.dataset.cmColSettingsBound) {
        initSimpleTableColumnSettings2(shell);
      }
    });
  }

  // src/column-settings.ts
  var gv = window.GridView = window.GridView || {};
  installColumnSettings(gv);

  // src/spec-boot.ts
  var gridView = bootstrapGridView();
  installAssetLoader(gridView);
  installRuntimeBoot(gridView);
})();
