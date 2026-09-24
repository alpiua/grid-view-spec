"""GridViewNav tree interaction rendering contracts."""

from __future__ import annotations

from html.parser import HTMLParser

from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render import render_grid_view_spec
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.nav import GridViewNav, GridViewNavItem
from grid_view_spec.types.spec import GridViewSpec


class _ActionAttributeParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.actions: list[str | None] = []
        self.inline_handlers: list[str | None] = []
        self.elements: list[tuple[str, dict[str, str | None], int | None]] = []
        self.stack: list[int] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if "data-cm-action" in attributes:
            self.actions.append(attributes["data-cm-action"])
        if "onclick" in attributes:
            self.inline_handlers.append(attributes["onclick"])
        parent = self.stack[-1] if self.stack else None
        index = len(self.elements)
        self.elements.append((tag, attributes, parent))
        if tag not in {
            "area",
            "base",
            "br",
            "col",
            "embed",
            "hr",
            "img",
            "input",
            "link",
            "meta",
            "param",
            "source",
            "track",
            "wbr",
        }:
            self.stack.append(index)

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self.stack) - 1, -1, -1):
            if self.elements[self.stack[index]][0] == tag:
                del self.stack[index:]
                return


def test_tree_href_leaf_is_a_native_link() -> None:
    spec = GridViewSpec(
        id="tree_href",
        blocks=(
            GridViewNav(
                id="nav",
                presentation="tree",
                items=(GridViewNavItem(id="item", label="Item", href="/items/1"),),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("nav",))),
    )
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    assert '<a href="/items/1"' in html
    assert 'data-href="/items/1"' in html


def test_tree_href_with_action_keeps_action_outside_link() -> None:
    spec = GridViewSpec(
        id="tree_href_action",
        blocks=(
            GridViewNav(
                id="nav",
                presentation="tree",
                items=(
                    GridViewNavItem(
                        id="item",
                        label="Item",
                        href="/items/1",
                        extra={"action_url": "/items/1/add"},
                    ),
                ),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("nav",))),
    )
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    assert '<a href="/items/1"' in html
    assert html.index("</a>") < html.index('hx-get="/items/1/add"')


def test_tree_disabled_item_omits_link_and_htmx_request() -> None:
    spec = GridViewSpec(
        id="tree_disabled",
        blocks=(
            GridViewNav(
                id="nav",
                presentation="tree",
                items=(
                    GridViewNavItem(
                        id="item",
                        label="Item",
                        href="/items/1",
                        disabled=True,
                        extra={"hx_get": "/items/1/pane/"},
                    ),
                ),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("nav",))),
    )
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    assert 'data-disabled="1" aria-disabled="true"' in html
    assert '<a href="/items/1"' not in html
    assert 'hx-get="/items/1/pane/"' not in html


def test_tree_children_are_siblings_of_row() -> None:
    spec = GridViewSpec(
        id="tree_children",
        blocks=(
            GridViewNav(
                id="nav",
                presentation="tree",
                items=(
                    GridViewNavItem(
                        id="parent",
                        label="Parent",
                        children=(GridViewNavItem(id="child", label="Child"),),
                    ),
                ),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("nav",))),
    )
    parser = _ActionAttributeParser()
    parser.feed(render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html"))
    node_index = next(
        index
        for index, (tag, attrs, _) in enumerate(parser.elements)
        if tag == "div" and attrs.get("data-node-id") == "parent"
    )
    row_index = next(
        index
        for index, (tag, attrs, _) in enumerate(parser.elements)
        if tag == "div" and "cm-nav-tree-row" in (attrs.get("class") or "").split()
    )
    children_index = next(
        index
        for index, (tag, attrs, _) in enumerate(parser.elements)
        if tag == "div" and "cm-nav-tree-children" in (attrs.get("class") or "").split()
    )
    assert parser.elements[row_index][2] == node_index
    assert parser.elements[children_index][2] == node_index
    assert row_index < children_index


def test_tree_action_button_has_no_inline_handler() -> None:
    spec = GridViewSpec(
        id="tree_action_button",
        blocks=(
            GridViewNav(
                id="nav",
                presentation="tree",
                items=(
                    GridViewNavItem(
                        id="item",
                        label="Item",
                        extra={"action_url": "/items/1/add"},
                    ),
                ),
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("nav",))),
    )
    parser = _ActionAttributeParser()
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    parser.feed(html)
    assert parser.inline_handlers == []
    assert 'hx-get="/items/1/add"' in html


def test_tree_create_option_renders_action_without_inline_javascript() -> None:
    spec = GridViewSpec(
        id="tree_create_action",
        blocks=(
            GridViewNav(
                id="nav",
                presentation="tree",
                allow_create=True,
                extra={
                    "create_options": (
                        {
                            "label": "Create Category",
                            "action": 'create_technology_category" onclick="alert(1)',
                            "click": "window.dispatchEvent(new CustomEvent('unsafe'))",
                        },
                    ),
                },
            ),
        ),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("nav",))),
    )
    html = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    parser = _ActionAttributeParser()
    parser.feed(html)
    assert parser.inline_handlers == []
    assert parser.actions == ['create_technology_category" onclick="alert(1)']
