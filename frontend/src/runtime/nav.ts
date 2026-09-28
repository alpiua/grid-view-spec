/**
 * GridViewNav presentation="tree" client runtime.
 *
 * Handles:
 * 1. Expand / collapse branch nodes ([data-tree-toggle="1"]).
 * 2. In-tree search filtering ([data-cm-tree-search="1"]).
 * 3. "+ Create" dropdown menu toggling ([data-cm-tree-create-trigger]).
 * 4. Active row selection styling (.cm-nav-tree-row).
 * 5. Drag & Drop: emits a cancellable event, then moves the node in the tree.
 */

type NavScope = Document | Element | null | undefined;

function matchQuery(haystack: string, query: string): boolean {
  if (!query || !query.trim()) return true;
  const gv = (window as unknown as { GridView?: { matchToolbarQuery?: (h: string, q: string) => boolean } }).GridView;
  if (gv && typeof gv.matchToolbarQuery === "function") {
    return gv.matchToolbarQuery(haystack, query);
  }
  return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

let _outsideClickBound = false;

function bindOutsideClick(): void {
  if (_outsideClickBound || typeof document === "undefined") return;
  _outsideClickBound = true;

  document.addEventListener("click", (e) => {
    const target = e.target as Element | null;
    if (!target?.closest("[data-cm-tree-create-container]")) {
      document.querySelectorAll<HTMLElement>("[data-cm-tree-create-menu]").forEach((menu) => {
        menu.classList.add("hidden");
        const trigger = menu.parentElement?.querySelector("[data-cm-tree-create-trigger]");
        const arrow = trigger?.querySelector(".cm-nav-tree-create-arrow");
        if (arrow) arrow.classList.remove("rotate-180");
      });
    }
    if (!target?.closest("[data-cm-tree-saved-container]")) {
      document.querySelectorAll<HTMLElement>("[data-cm-tree-saved-menu]").forEach((menu) => {
        menu.classList.add("hidden");
      });
    }
  });
}

function moveTreeNode(source: HTMLElement, target: HTMLElement, root: Element | null): void {
  if (target.classList.contains("cm-root-drop-zone")) {
    root?.append(source);
  } else {
    const sourceAtRoot = source.parentElement?.classList.contains("cm-nav-tree-items");
    const targetAtRoot = target.parentElement?.classList.contains("cm-nav-tree-items");
    let children = target.querySelector<HTMLElement>(":scope > .cm-nav-tree-children");
    if (sourceAtRoot && targetAtRoot) {
      target.after(source);
    } else if (targetAtRoot || children) {
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
  const parent = source.parentElement?.closest<HTMLElement>(".cm-nav-tree-node");
  const parentId = parent?.getAttribute("data-node-id");
  if (parentId) {
    source.setAttribute("data-parent-id", parentId);
  } else {
    source.removeAttribute("data-parent-id");
  }
}

export function initNavTrees(scope?: NavScope): void {
  const root = scope && "querySelectorAll" in scope ? scope : document;
  const trees: HTMLElement[] = [];

  if ("nodeType" in root && root.nodeType === 1) {
    const el = root as HTMLElement;
    if (el.hasAttribute("data-cm-nav-tree")) {
      trees.push(el);
    }
  }
  root.querySelectorAll<HTMLElement>("[data-cm-nav-tree]").forEach((t) => {
    if (!trees.includes(t)) trees.push(t);
  });

  bindOutsideClick();

  trees.forEach((tree) => {
    const treeEl = tree as HTMLElement & { __cmTreeInit?: boolean };
    if (treeEl.__cmTreeInit) return;
    treeEl.__cmTreeInit = true;

    // 1. Click delegation
    tree.addEventListener("click", (e) => {
      const target = e.target as Element | null;
      if (!target) return;

      const toggle = target.closest('[data-tree-toggle="1"]');
      if (toggle) {
        e.stopPropagation();
        const node = toggle.closest(".cm-nav-tree-node");
        const children = node?.querySelector<HTMLElement>(".cm-nav-tree-children");
        if (children) {
          const isHidden = children.style.display === "none";
          children.style.display = isHidden ? "" : "none";
          const svg = toggle.querySelector<SVGElement>("svg");
          if (svg) {
            svg.style.transform = isHidden ? "" : "rotate(-90deg)";
          }
        }
        return;
      }

      const createTrigger = target.closest("[data-cm-tree-create-trigger]");
      if (createTrigger) {
        const container = createTrigger.closest("[data-cm-tree-create-container]");
        const menu = container?.querySelector<HTMLElement>("[data-cm-tree-create-menu]");
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
        const menu = createOption.closest<HTMLElement>("[data-cm-tree-create-menu]");
        if (menu) {
          menu.classList.add("hidden");
          const trigger = menu.parentElement?.querySelector("[data-cm-tree-create-trigger]");
          const arrow = trigger?.querySelector(".cm-nav-tree-create-arrow");
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

    // 2. In-tree search
    const searchInput = tree.querySelector<HTMLInputElement>('[data-cm-tree-search="1"]');
    const clearBtn = tree.querySelector<HTMLElement>('[data-cm-tree-search-clear="1"]');
    if (searchInput) {
      const applySearch = (): void => {
        const q = (searchInput.value || "").trim();
        if (clearBtn) clearBtn.classList.toggle("hidden", !q);
        const nodes = tree.querySelectorAll<HTMLElement>(".cm-nav-tree-node");
        if (!q) {
          nodes.forEach((n) => {
            n.style.display = "";
            const ch = n.querySelector<HTMLElement>(".cm-nav-tree-children");
            if (ch) ch.style.display = "";
          });
          return;
        }
        nodes.forEach((n) => {
          const label = n.querySelector(".cm-nav-tree-label")?.textContent || "";
          const hasMatch = matchQuery(label, q);
          n.style.display = hasMatch ? "" : "none";
          if (hasMatch) {
            let parent = n.parentElement?.closest<HTMLElement>(".cm-nav-tree-node");
            while (parent) {
              parent.style.display = "";
              const ch = parent.querySelector<HTMLElement>(".cm-nav-tree-children");
              if (ch) ch.style.display = "";
              parent = parent.parentElement?.closest<HTMLElement>(".cm-nav-tree-node");
            }
          }
        });
      };

      searchInput.addEventListener("input", applySearch);
      if (clearBtn && !(clearBtn as HTMLElement & { _cmBound?: boolean })._cmBound) {
        (clearBtn as HTMLElement & { _cmBound?: boolean })._cmBound = true;
        clearBtn.addEventListener("click", (e) => {
          e.preventDefault();
          searchInput.value = "";
          applySearch();
          searchInput.focus();
        });
      }

      // Saved searches
      const savedContainer = tree.querySelector<HTMLElement>("[data-cm-tree-saved-container]");
      const savedTrigger = tree.querySelector<HTMLElement>("[data-cm-tree-saved-trigger]");
      const savedMenu = tree.querySelector<HTMLElement>("[data-cm-tree-saved-menu]");
      const savedList = tree.querySelector<HTMLElement>("[data-cm-tree-saved-list]");
      const saveCurrentBtn = tree.querySelector<HTMLButtonElement>("[data-cm-tree-save-current]");

      if (savedContainer && savedTrigger && savedMenu && savedList) {
        const treeId = tree.getAttribute("data-cm-nav-tree") || "default";
        const storageKey = `gvs_tree_saved_searches_${treeId}`;

        const loadSaved = (): string[] => {
          try {
            const raw = localStorage.getItem(storageKey);
            return raw ? JSON.parse(raw) : [];
          } catch {
            return [];
          }
        };

        const persistSaved = (items: string[]): void => {
          try {
            localStorage.setItem(storageKey, JSON.stringify(items));
          } catch {
            // ignore storage errors
          }
        };

        const renderSaved = (): void => {
          const items = loadSaved();
          savedList.innerHTML = "";
          if (!items.length) {
            const empty = document.createElement("div");
            empty.className = "p-2 text-slate-400 dark:text-gray-500 text-center text-[11px]";
            empty.textContent =
              savedList.getAttribute("data-empty-label") ||
              (window as unknown as { GridViewI18n?: Record<string, string> }).GridViewI18n?.["search.no_saved_searches"] ||
              "No saved searches";
            savedList.appendChild(empty);
            return;
          }
          items.forEach((query) => {
            const row = document.createElement("div");
            row.className =
              "flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#202b48] cursor-pointer group";

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
            delBtn.className =
              "text-slate-400 hover:text-rose-500 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer";
            delBtn.title =
              savedList.getAttribute("data-delete-title") ||
              (window as unknown as { GridViewI18n?: Record<string, string> }).GridViewI18n?.["common.delete"] ||
              "Delete";
            delBtn.textContent = "×";
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
          document
            .querySelectorAll<HTMLElement>("[data-cm-tree-saved-menu]")
            .forEach((m) => m.classList.add("hidden"));
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

    // 3. Drag & Drop
    const isDraggable =
      tree.hasAttribute("data-cm-nav-draggable") ||
      tree.getAttribute("data-cm-nav-tree") === "categories_page_nav";

    if (isDraggable) {
      let draggedNode: HTMLElement | null = null;
      let isDraggingTree = false;
      let dragEndTime = 0;

      const itemsContainer = tree.querySelector(".cm-nav-tree-items");
      let rootDropZone = tree.querySelector<HTMLElement>(".cm-root-drop-zone");
      const rootDropLabel = tree.getAttribute("data-cm-root-drop-label") || null;

      if (!rootDropZone && itemsContainer && rootDropLabel) {
        rootDropZone = document.createElement("div");
        rootDropZone.className =
          "cm-root-drop-zone hidden p-2 mb-1.5 rounded-lg border-2 border-dashed border-indigo-400 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-center text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition-all cursor-pointer";
        rootDropZone.textContent = rootDropLabel;
        itemsContainer.insertBefore(rootDropZone, itemsContainer.firstChild);

        rootDropZone.addEventListener("dragover", (e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
          rootDropZone?.classList.add(
            "ring-2",
            "ring-indigo-600",
            "bg-indigo-100/80",
            "dark:bg-indigo-900/60"
          );
        });
        rootDropZone.addEventListener("dragleave", () => {
          rootDropZone?.classList.remove(
            "ring-2",
            "ring-indigo-600",
            "bg-indigo-100/80",
            "dark:bg-indigo-900/60"
          );
        });
        rootDropZone.addEventListener("drop", (e) => {
          e.preventDefault();
          rootDropZone?.classList.remove(
            "ring-2",
            "ring-indigo-600",
            "bg-indigo-100/80",
            "dark:bg-indigo-900/60"
          );
          if (!draggedNode) return;
          const sourceId = draggedNode.getAttribute("data-node-id");
          if (!sourceId) return;

          const dropEvent = new CustomEvent("cm:nav-item-drop", {
            bubbles: true,
            cancelable: true,
            detail: {
              treeId: tree.getAttribute("data-cm-nav-tree") || "",
              sourceId,
              targetId: "root",
              position: "inside",
              sourceNode: draggedNode,
              targetNode: rootDropZone,
              originalEvent: e,
            },
          });
          if (rootDropZone && tree.dispatchEvent(dropEvent)) {
            moveTreeNode(draggedNode, rootDropZone, itemsContainer);
          }
        });
      }

      tree.querySelectorAll<HTMLElement>(".cm-nav-tree-row").forEach((row) => {
        if (row.hasAttribute("data-disabled")) return;
        row.setAttribute("draggable", "true");

        row.addEventListener("dragstart", (e) => {
          const node = row.closest<HTMLElement>(".cm-nav-tree-node");
          draggedNode = node;
          isDraggingTree = true;
          if (e.dataTransfer) {
            e.dataTransfer.setData("text/plain", node?.getAttribute("data-node-id") || "");
            e.dataTransfer.effectAllowed = "move";
          }
          row.classList.add("opacity-50");
          if (rootDropZone && draggedNode?.getAttribute("data-parent-id")) {
            rootDropZone.classList.remove("hidden");
          }
        });

        row.addEventListener("dragend", () => {
          row.classList.remove("opacity-50");
          if (rootDropZone) rootDropZone.classList.add("hidden");
          tree.querySelectorAll(".cm-drop-target").forEach((el) => {
            el.classList.remove(
              "cm-drop-target",
              "ring-2",
              "ring-indigo-500",
              "bg-indigo-50/70",
              "dark:bg-indigo-950/50"
            );
          });
          dragEndTime = Date.now();
          setTimeout(() => {
            isDraggingTree = false;
            draggedNode = null;
          }, 100);
        });

        row.addEventListener("dragover", (e) => {
          const node = row.closest<HTMLElement>(".cm-nav-tree-node");
          if (!draggedNode || draggedNode === node || (node && draggedNode.contains(node))) return;
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
          row.classList.add(
            "cm-drop-target",
            "ring-2",
            "ring-indigo-500",
            "bg-indigo-50/70",
            "dark:bg-indigo-950/50"
          );
        });

        row.addEventListener("dragleave", (e) => {
          if (!row.contains(e.relatedTarget as Node | null)) {
            row.classList.remove(
              "cm-drop-target",
              "ring-2",
              "ring-indigo-500",
              "bg-indigo-50/70",
              "dark:bg-indigo-950/50"
            );
          }
        });

        row.addEventListener("drop", (e) => {
          e.preventDefault();
          row.classList.remove(
            "cm-drop-target",
            "ring-2",
            "ring-indigo-500",
            "bg-indigo-50/70",
            "dark:bg-indigo-950/50"
          );
          const targetNode = row.closest<HTMLElement>(".cm-nav-tree-node");
          if (!draggedNode || !targetNode || draggedNode === targetNode || draggedNode.contains(targetNode)) {
            return;
          }

          const sourceId = draggedNode.getAttribute("data-node-id");
          const targetId = targetNode?.getAttribute("data-node-id");
          if (!sourceId || !targetId) return;

          const sourceAtRoot = draggedNode.parentElement?.classList.contains("cm-nav-tree-items");
          const targetAtRoot = targetNode.parentElement?.classList.contains("cm-nav-tree-items");
          const hasChildren = !!targetNode.querySelector(":scope > .cm-nav-tree-children");
          const position = (sourceAtRoot && targetAtRoot) || (!targetAtRoot && !hasChildren) ? "after" : "inside";
          const dropEvent = new CustomEvent("cm:nav-item-drop", {
            bubbles: true,
            cancelable: true,
            detail: {
              treeId: tree.getAttribute("data-cm-nav-tree") || "",
              sourceId,
              targetId,
              position,
              sourceNode: draggedNode,
              targetNode,
              originalEvent: e,
            },
          });
          if (tree.dispatchEvent(dropEvent)) {
            moveTreeNode(draggedNode, targetNode, itemsContainer);
          }
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
