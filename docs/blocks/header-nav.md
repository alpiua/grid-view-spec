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
