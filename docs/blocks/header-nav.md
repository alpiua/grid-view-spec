# Header and navigation

## GridViewHeader

Page or entity identity in the layout (distinct from `GridViewMeta.title` for document chrome).

```python
from grid_view_spec.types.header import GridViewFact, GridViewEntity, GridViewHeader
from grid_view_spec.types.nav import GridViewNav, GridViewNavItem

GridViewHeader(
    id="page_header",
    presentation="entity",  # plain | entity | split | compact | hero
    subtitle="February 2026",
    entity=GridViewEntity(
        id="dept-12",
        title="Cardiology",
        facts=(
            GridViewFact(label="Code", value="CARD"),
            GridViewFact(label="Head", value="Dr. Smith"),
        ),
    ),
    nav="main_nav",
    actions="header_actions",
)
```

| Field | Role |
|-------|------|
| `entity` | Simple label/value pairs for entity pages |
| `content` | Block id of `GridViewTemplate` for complex aside HTML |
| `nav` | Block id of `GridViewNav` |
| `actions` | Block id of `GridViewActions` |

## GridViewNav

Breadcrumbs, back links, and section navigation. Referenced from header or placed in layout.

```python
GridViewNav(
    id="inventory_nav",
    presentation="menu",
    items=(
        GridViewNavItem(id="stock", label="Stock", href="/inventory/", active=True),
        GridViewNavItem(id="reports", label="Reports", href="https://reports.example.test/"),
        GridViewNavItem(id="restricted", label="Restricted", disabled=True),
    ),
)
```

Relative links and absolute `http`/`https` links render as native anchors. Other explicit
URL schemes are rejected. Disabled items are inert: they render without a link or HTMX
request, even if an `href` or tree action is supplied.

Tree navigation can use host-owned HTMX fragments and registered named actions:

```python
GridViewNav(
    id="resource_tree",
    presentation="tree",
    allow_create=True,
    items=(
        GridViewNavItem(
            id="resource_1",
            label="Resource one",
            extra={"hx_get": "/resources/1/", "hx_target": "#resource_detail"},
        ),
    ),
    extra={"create_options": [{"label": "Create resource", "action": "create_resource"}]},
)
```

Register `create_resource` through `GridView.registerAction`; navigation markup never
contains inline event handlers.

Tree drag and drop uses a named host action. The spec contains only JSON data:

```python
GridViewNav(
    id="resource_tree",
    presentation="tree",
    levels=(
        GridViewNavLevel(level=0, type="group", draggable=True, droppable=True,
                         accept_drop_types=("group", "resource")),
        GridViewNavLevel(level=1, type="resource", draggable=True, droppable=False),
    ),
    items=items,
    extra={"allow_drag": True, "drop_action": "resources.move"},
)
```

Register the handler once in a host JavaScript module, before the first drop:

```javascript
GridView.registerDrop("resources.move", async ({ sourceId, targetId, position }) => {
  const response = await fetch("/resources/move/", {
    method: "POST",
    headers: { "X-CSRFToken": csrfToken() },
    body: new URLSearchParams({ source_id: sourceId, target_id: targetId, position }),
  });
  return response.ok;
});
```

The host owns authorization, validation, persistence, and refresh when server
ordering differs from the requested placement. GVS uses `GridViewNavLevel`
(`draggable`, `droppable`, `accept_drop_types`, and `can_have_children`) to
allow only declared sources and targets, including empty branches. It awaits the handler and moves the DOM
only when the handler returns `true`; a missing handler, `false`, or an exception
leaves the tree unchanged. `position` is `inside` or `after` for current tree
targets. `extra={"root_drop_label": "Root"}` enables a root drop zone with
`targetId="root"` and `position="inside"`.

While dragging, GVS outlines the whole target subtree for `inside`, including
its child content, or draws a line across the subtree's lower edge for `after`.
The zone uses a faint fill and thin strokes; the title row itself is not
highlighted. The root drop zone uses a similarly light outline.

The runtime also emits the cancelable `cm:nav-item-drop` event for existing
hosts. A listener can call `preventDefault()` synchronously. For new hosts,
prefer `drop_action` so an asynchronous write cannot move the tree before it
finishes. The drop configuration contains no URL, HTTP method, or executable callback.

This contract moves nodes within one `GridViewNav` tree. Dropping a table row,
file, or host-rendered item onto another component uses the host's own
interaction until that source and target have a separate GVS contract.
