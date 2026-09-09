# Cards and gallery

## GridViewCards

Card grid layout for non-tabular summaries. Data from host `rows` or resolved in `page_data`.

```python
GridViewCards(
    id="product_cards",
    items=(),  # host-resolved card payloads
    presentation="grid",
)
```

## GridViewGallery / GridViewImage

The spec carries only resolved `url` / `thumb` / `variants`. Storage (disk, S3, CDN) is a
host `page_data` builder — never a field on the spec.

`lightbox=True` (the default) uses the **package** viewer in `gridviewspec.min.js`: click a
thumb, overlay with prev/next, Escape, and arrows. There is no extra pip extra or JS library.
`lightbox=False` renders thumbs only. Overlay DOM is created on first open.

```python
from grid_view_spec.types.media import GridViewGallery, GridViewImageSource
from grid_view_spec.types.table_v2 import GridViewDataSource

GridViewGallery(
    id="photos",
    images=(
        GridViewImageSource(id="p1", url="https://cdn.example/p1.jpg", alt="Product"),
    ),
    presentation="grid",  # grid | filmstrip | masonry | carousel
    lightbox=True,
)
```

Lazy gallery: leave `images` empty and set `datasource.endpoint`. The runtime GETs JSON
(`{"images":[{"id","url","alt"}]}` or a list of those objects) and fills thumbs.

```python
GridViewGallery(
    id="photos",
    images=(),
    lightbox=True,
    datasource=GridViewDataSource(endpoint="/api/gallery/"),
)
```

Optional host hooks: `gridview:gallery-open` and `gridview:gallery-close` on `document`
(`detail`: `galleryId`, `index`, `images`). Domain actions (delete, set primary) stay on
the host.

Cell thumbnails in tables: `GridViewColumn(renderer="image", extra={...})`.
