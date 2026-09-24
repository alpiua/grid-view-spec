/**
 * Reusable HTML5 Drag and Drop list reordering utility.
 * Lightweight, zero-dependency, works across desktop and touch-compatible webviews.
 */

export interface DragReorderOptions<T extends HTMLElement = HTMLElement> {
  /** Container holding the draggable items */
  container: HTMLElement;
  /** CSS selector for draggable items (e.g. '.cm-col-settings-chip--drawer') */
  itemSelector: string;
  /** Optional handle selector. If specified, drag only initiates when starting on this handle */
  handleSelector?: string;
  /** Class added to item being dragged */
  draggingClass?: string;
  /** Data attribute or key name to transfer in DragEvent */
  dataKey?: string;
  /** Callback fired after items are reordered */
  onReorder: (items: T[]) => void;
}

export interface DragReorderHandle {
  destroy: () => void;
}

export function enableDragReorder<T extends HTMLElement = HTMLElement>(
  options: DragReorderOptions<T>
): DragReorderHandle {
  const {
    container,
    itemSelector,
    handleSelector,
    draggingClass = "is-dragging",
    dataKey = "cmDragItem",
    onReorder,
  } = options;

  let draggedEl: T | null = null;
  let canDrag = !handleSelector;

  if (handleSelector) {
    container.addEventListener("mousedown", (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      canDrag = Boolean(target && target.closest(handleSelector));
    });
    container.addEventListener("mouseup", () => {
      canDrag = false;
    });
  }

  const onDragStart = (e: DragEvent) => {
    if (handleSelector && !canDrag) {
      e.preventDefault();
      return;
    }
    const target = (e.target as HTMLElement | null)?.closest<T>(itemSelector);
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

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    const overTarget = (e.target as HTMLElement | null)?.closest<T>(itemSelector);
    if (!overTarget || overTarget === draggedEl || !container.contains(overTarget)) return;

    const rect = overTarget.getBoundingClientRect();
    const isVertical = rect.height >= rect.width;
    const offset = isVertical ? e.clientY - rect.top : e.clientX - rect.left;
    const threshold = isVertical ? rect.height / 2 : rect.width / 2;

    if (offset < threshold) {
      container.insertBefore(draggedEl!, overTarget);
    } else {
      container.insertBefore(draggedEl!, overTarget.nextSibling);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (!draggedEl) return;
    const items = Array.from(container.querySelectorAll<T>(itemSelector));
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
    },
  };
}
