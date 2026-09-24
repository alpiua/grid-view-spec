/** Search syntax help button — profile-aware tooltip content. */

import { i18n } from "./i18n";
import { positionFixedOverlay } from "./dom-utils";
import { SearchProfile, resolveSearchProfile } from "./search/contract";
import { buildSearchSyntaxTipHtml } from "./search-syntax-tip-html";

const INFO_ICON =
  '<svg class="cm-search-help-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>' +
  '<circle cx="12" cy="8" r="1.35" fill="currentColor" stroke="none"/>' +
  '<path d="M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

let searchHelpSequence = 0;

function searchHelpTipFor(btn: HTMLElement): HTMLElement | null {
  const tipId = btn.dataset.cmSearchHelpTipId;
  if (tipId) {
    const ownedTip = document.getElementById(tipId);
    if (ownedTip instanceof HTMLElement) return ownedTip;
  }
  return btn.closest<HTMLElement>(".cm-toolbar-search")?.querySelector<HTMLElement>(
    ":scope > .cm-ellipsis-tip--search-help"
  ) || btn.querySelector<HTMLElement>(":scope > .cm-ellipsis-tip--search-help") || null;
}


function showSearchHelpTip(btn: HTMLElement): void {
  const tip = searchHelpTipFor(btn);
  if (!tip) return;
  document.body.appendChild(tip);
  tip.classList.add("cm-ellipsis-tip--search-help-portal");
  tip.style.visibility = "hidden";
  positionFixedOverlay(tip, btn, "start", true);
  tip.style.removeProperty("visibility");
}

function hideSearchHelpTip(btn: HTMLElement): void {
  const tip = searchHelpTipFor(btn);
  const host = btn.closest<HTMLElement>(".cm-toolbar-search");
  if (!tip || !host) return;
  tip.classList.remove("cm-ellipsis-tip--search-help-portal");
  tip.style.removeProperty("left");
  tip.style.removeProperty("top");
  tip.style.removeProperty("width");
  host.appendChild(tip);
}


export function bindSearchSyntaxHelp(btn: HTMLElement): void {
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
    if (tip?.classList.contains("cm-ellipsis-tip--search-help-portal")) {
      positionFixedOverlay(tip, btn, "start", true);
    }
  });
}

export function refreshSearchSyntaxHelp(btn: HTMLElement, profile: SearchProfile): void {
  const host = btn.closest<HTMLElement>(".cm-toolbar-search") || btn;
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

export function appendSearchSyntaxHelp(
  container: HTMLElement,
  profile: SearchProfile = SearchProfile.Default
): HTMLButtonElement {
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

export function initSearchSyntaxHelp(scope?: Document | Element | null): void {
  const root = scope && "querySelectorAll" in scope ? scope : document;
  root.querySelectorAll(".cm-search-help-btn").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const closestHost = node.closest("[data-cm-tip-profile]");
    const host = closestHost instanceof HTMLElement ? closestHost : null;
    const profile = resolveSearchProfile(
      host?.dataset.cmTipProfile ?? node.dataset.cmTipProfile ?? SearchProfile.Toolbar
    );
    refreshSearchSyntaxHelp(node, profile);
  });
}
