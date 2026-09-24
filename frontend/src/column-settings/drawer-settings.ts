import { enableDragReorder } from "../grid-view/drag-drop";
import { colT } from "./helpers";
import type { ColumnAdapter, ColumnStateItem, StoredColumnPreset } from "./types";
export interface DrawerSettingsActions {
  gridId: string;
  adapter: ColumnAdapter;
  savedPresets: Record<string, StoredColumnPreset>;
  activePresetName: string | null;
  getColumnState: () => ColumnStateItem[];
  resetColumns: () => void;
  applyPreset: (name: string) => void;
  savePreset: (name: string) => boolean;
  deletePreset: (name: string) => void;
  saveColumns: () => void;
  refresh: () => void;
}

function dragHandle(): HTMLElement {
  const handle = document.createElement("span");
  handle.className = "cm-col-settings-drag-handle";
  handle.dataset.cmColDragHandle = "1";
  handle.setAttribute("aria-label", colT("column_settings.reorder", "Reorder column"));
  handle.textContent = "⠿";
  return handle;
}

function columnRow(actions: DrawerSettingsActions, state: ColumnStateItem): HTMLElement {
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
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-cm-col-drag-handle]") || target?.closest(".cm-col-settings-pin-btn")) {
      return;
    }
    toggleVisibility();
  });

  const label = document.createElement("button");
  label.type = "button";
  label.className = "cm-col-settings-chip-label";
  label.textContent = actions.adapter.getLeafLabel?.(state.colId) || state.colId;
  row.appendChild(label);
  const pins = document.createElement("div");
  pins.className = `cm-col-settings-chip-pins${visible ? "" : " is-dimmed"}`;
  (["left", "right"] as const).forEach((direction) => {
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

function renderPresetList(actions: DrawerSettingsActions): HTMLElement {
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
    remove.textContent = "×";
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

function saveOrder(actions: DrawerSettingsActions, list: HTMLElement): void {
  const stateById = new Map(actions.getColumnState().map((state) => [state.colId, state]));
  const ordered = Array.from(list.children)
    .map((element) => (element instanceof HTMLElement ? element.dataset.cmColumnKey || "" : ""))
    .map((columnId) => stateById.get(columnId))
    .filter((state): state is ColumnStateItem => state !== undefined);
  if (ordered.length !== stateById.size) return;
  actions.adapter.applyColumnState(ordered, true);
  actions.refresh();
  actions.saveColumns();
}
export function renderDrawerColumnSettings(container: HTMLElement, actions: DrawerSettingsActions): { destroy: () => void } | null {
  const header = document.createElement("header");
  header.className = "cm-filter-drawer-card-header";
  const heading = document.createElement("div");
  heading.className = "cm-filter-drawer-card-heading";
  const title = document.createElement("h3");
  title.textContent = colT("column_settings.title", "Налаштування колонок");
  heading.append(title);
  header.append(heading);
  const list = document.createElement("div");
  list.className = "cm-col-checkboxes cm-col-checkboxes--drawer";
  list.dataset.cmColSettingsDrawerList = actions.gridId;
  actions.getColumnState().forEach((state) => list.appendChild(columnRow(actions, state)));

  const externalPresetsContainer = container.parentElement?.querySelector<HTMLElement>(
    `[data-cm-filter-drawer-presets][data-cm-grid-id="${actions.gridId}"]`
  );
  if (externalPresetsContainer) {
    container.replaceChildren(header, list);
    externalPresetsContainer.replaceChildren(renderPresetList(actions));
  } else {
    container.replaceChildren(header, list, renderPresetList(actions));
  }
  const dragHandle = enableDragReorder({
    container: list,
    itemSelector: ".cm-col-settings-chip--drawer",
    handleSelector: "[data-cm-col-drag-handle]",
    draggingClass: "is-dragging",
    onReorder: () => saveOrder(actions, list),
  });

  return dragHandle;
}
