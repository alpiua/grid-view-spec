import { i18n } from "../grid-view/i18n";

interface GalleryItem {
  url: string;
  alt: string;
}

interface GalleryOpenDetail {
  galleryId: string;
  index: number;
  images: GalleryItem[];
}

const OVERLAY_ID = "cm-gallery-overlay";

let overlay: HTMLElement | null = null;
let stageImg: HTMLImageElement | null = null;
let captionEl: HTMLElement | null = null;
let prevBtn: HTMLButtonElement | null = null;
let nextBtn: HTMLButtonElement | null = null;
let activeItems: GalleryItem[] = [];
let activeIndex = 0;
let activeGalleryId = "";
let lastFocus: HTMLElement | null = null;
let delegated = false;

function t(key: string, fallback: string): string {
  return i18n.t(key, fallback);
}

function parseLightboxEnabled(root: Element): boolean {
  return root.getAttribute("data-cm-gallery-lightbox") !== "false";
}

function itemsFromDom(root: Element): GalleryItem[] {
  const nodes = root.querySelectorAll<HTMLElement>("[data-cm-gallery-item]");
  const items: GalleryItem[] = [];
  nodes.forEach((node) => {
    const url = node.getAttribute("data-cm-gallery-full") || "";
    if (!url) return;
    const img = node.querySelector("img");
    items.push({ url, alt: img?.getAttribute("alt") || "" });
  });
  return items;
}

function ensureOverlay(): HTMLElement {
  if (overlay) return overlay;
  const root = document.createElement("div");
  root.id = OVERLAY_ID;
  root.className = "cm-gallery-overlay";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.tabIndex = -1;
  root.innerHTML =
    '<button type="button" class="cm-gallery-close" data-cm-gallery-close></button>' +
    '<button type="button" class="cm-gallery-prev" data-cm-gallery-prev></button>' +
    '<button type="button" class="cm-gallery-next" data-cm-gallery-next></button>' +
    '<div class="cm-gallery-stage">' +
    '<img alt="" />' +
    '<div class="cm-gallery-caption" data-cm-gallery-caption></div>' +
    "</div>";
  document.body.appendChild(root);
  overlay = root;
  stageImg = root.querySelector("img");
  captionEl = root.querySelector("[data-cm-gallery-caption]");
  prevBtn = root.querySelector("[data-cm-gallery-prev]");
  nextBtn = root.querySelector("[data-cm-gallery-next]");
  const closeBtn = root.querySelector<HTMLButtonElement>("[data-cm-gallery-close]");
  if (closeBtn) closeBtn.textContent = "×";
  if (closeBtn) closeBtn.setAttribute("aria-label", t("gallery.close", "Close"));
  if (prevBtn) prevBtn.textContent = "‹";
  if (prevBtn) prevBtn.setAttribute("aria-label", t("gallery.prev", "Previous"));
  if (nextBtn) nextBtn.textContent = "›";
  if (nextBtn) nextBtn.setAttribute("aria-label", t("gallery.next", "Next"));
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

function renderSlide(): void {
  if (!stageImg || !activeItems.length) return;
  const item = activeItems[activeIndex];
  if (!item) return;
  stageImg.src = item.url;
  stageImg.alt = item.alt;
  if (captionEl) {
    const of = t("gallery.of", "%(current)s of %(total)s")
      .replace("%(current)s", String(activeIndex + 1))
      .replace("%(total)s", String(activeItems.length));
    captionEl.textContent = item.alt ? `${item.alt} · ${of}` : of;
  }
  const many = activeItems.length > 1;
  if (prevBtn) prevBtn.hidden = !many;
  if (nextBtn) nextBtn.hidden = !many;
}

function openLightbox(galleryId: string, items: GalleryItem[], index: number): void {
  if (!items.length) return;
  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeGalleryId = galleryId;
  activeItems = items;
  activeIndex = index >= 0 && index < items.length ? index : 0;
  const node = ensureOverlay();
  node.hidden = false;
  renderSlide();
  node.focus();
  const detail: GalleryOpenDetail = {
    galleryId,
    index: activeIndex,
    images: items,
  };
  document.dispatchEvent(new CustomEvent("gridview:gallery-open", { detail }));
}

function closeLightbox(): void {
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  if (stageImg) stageImg.removeAttribute("src");
  document.dispatchEvent(
    new CustomEvent("gridview:gallery-close", {
      detail: { galleryId: activeGalleryId, index: activeIndex, images: activeItems },
    }),
  );
  activeItems = [];
  activeGalleryId = "";
  lastFocus?.focus();
  lastFocus = null;
}

function step(delta: number): void {
  if (!activeItems.length) return;
  activeIndex = (activeIndex + delta + activeItems.length) % activeItems.length;
  renderSlide();
}

function onKey(event: KeyboardEvent): void {
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

function itemIndex(node: Element): number {
  const raw = node.closest("[data-cm-gallery-item]")?.getAttribute("data-cm-gallery-index");
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function onDocumentClick(event: MouseEvent): void {
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

function normalizePayload(data: unknown): GalleryItem[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { images?: unknown }).images)
      ? (data as { images: unknown[] }).images
      : [];
  const items: GalleryItem[] = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { url?: unknown; alt?: unknown };
    if (typeof rec.url !== "string" || !rec.url) continue;
    items.push({ url: rec.url, alt: typeof rec.alt === "string" ? rec.alt : "" });
  }
  return items;
}

function appendThumbs(root: Element, items: GalleryItem[]): void {
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

async function hydrateLazy(root: Element): Promise<void> {
  const endpoint = root.getAttribute("data-cm-gallery-src");
  if (!endpoint || root.querySelector("[data-cm-gallery-item]")) return;
  try {
    const response = await fetch(endpoint);
    if (!response.ok) return;
    const payload: unknown = await response.json();
    const items = normalizePayload(payload);
    if (!items.length) return;
    appendThumbs(root, items);
  } catch {
    /* host endpoint may be absent in static render tests */
  }
}

function ensureDelegated(): void {
  if (delegated) return;
  delegated = true;
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKey, true);
}

export function initGalleryBlocks(scope: Document | Element = document): void {
  ensureDelegated();
  const galleries = scope.querySelectorAll("[data-cm-gallery]");
  galleries.forEach((node) => {
    void hydrateLazy(node);
  });
}

export function openGalleryLightbox(
  images: { url: string; alt?: string }[],
  index = 0,
  galleryId = "host",
): void {
  ensureDelegated();
  openLightbox(galleryId, normalizePayload(images), index);
}

export function closeGalleryLightbox(): void {
  closeLightbox();
}
