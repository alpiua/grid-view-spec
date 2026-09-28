"""Browser proof for native tree moves and host cancellation."""

from __future__ import annotations

import html
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render import render_grid_view_spec
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.nav import GridViewNav, GridViewNavItem
from grid_view_spec.types.spec import GridViewSpec

_SCENARIO = """
<pre id="result"></pre>
<script>
window.addEventListener("load", () => {
  window.GridView.bootScope(document);
  const tree = document.querySelector('[data-cm-nav-tree="tree"]');
  const node = id => tree.querySelector(`[data-node-id="${id}"]`);
  const row = id => node(id).firstElementChild;
  const events = [];
  tree.addEventListener('cm:nav-item-drop', event => {
    events.push([event.detail.sourceId, event.detail.targetId, event.detail.position]);
    if (event.detail.sourceId === 'a3') event.preventDefault();
  });
  const drop = (sourceId, target) => {
    const source = row(sourceId);
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
  };
  const parent = id =>
    node(id).parentElement.closest('.cm-nav-tree-node')?.dataset.nodeId || 'root';
  drop('a1', row('cat-b'));
  const movedIntoBranch = parent('a1') === 'cat-b' && node('a1').dataset.parentId === 'cat-b';
  drop('a2', row('b1'));
  const movedAfterLeaf = parent('a2') === 'cat-b' && node('b1').nextElementSibling === node('a2');
  drop('cat-a', row('cat-b'));
  const rootOrder = Array.from(tree.querySelector('.cm-nav-tree-items').children)
    .filter(element => element.matches('.cm-nav-tree-node'))
    .map(element => element.dataset.nodeId);
  drop('a3', row('cat-b'));
  const cancelled = parent('a3') === 'cat-a';
  drop('cat-b', row('b1'));
  const descendantRejected = parent('cat-b') === 'root';
  drop('a1', tree.querySelector('.cm-root-drop-zone'));
  const movedToRoot = parent('a1') === 'root' && !node('a1').hasAttribute('data-parent-id');
  drop('a2', row('cat-empty'));
  const movedIntoEmptyBranch =
    parent('a2') === 'cat-empty' && node('a2').dataset.parentId === 'cat-empty';
  document.getElementById('result').textContent = JSON.stringify({
    movedIntoBranch, movedAfterLeaf, rootOrder, cancelled, descendantRejected,
    movedToRoot, movedIntoEmptyBranch, events,
  });
});
</script>
"""


def test_tree_drop_moves_dom_and_honors_host_cancellation(tmp_path: Path) -> None:
    chromium = shutil.which("chromium")
    if not chromium:
        pytest.skip("Chromium is required for browser rendering")
    tree = GridViewNav(
        id="tree",
        presentation="tree",
        items=(
            GridViewNavItem(
                id="cat-a",
                label="Category A",
                children=tuple(GridViewNavItem(id=f"a{n}", label=f"A {n}") for n in range(1, 4)),
            ),
            GridViewNavItem(
                id="cat-b",
                label="Category B",
                children=(GridViewNavItem(id="b1", label="B 1"),),
            ),
            GridViewNavItem(id="cat-empty", label="Empty category"),
        ),
        extra={"allow_drag": True, "root_drop_label": "Root"},
    )
    spec = GridViewSpec(
        id="nav_move_browser",
        blocks=(tree,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(tree.id,))),
    )
    markup = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    bundle = (
        Path(__file__).resolve().parents[1]
        / "src/grid_view_spec/static/grid_view_spec/gridviewspec.js"
    )
    page = tmp_path / "nav-move.html"
    page.write_text(
        f'<html><body>{markup}<script src="{bundle.as_uri()}"></script>{_SCENARIO}</body></html>',
        encoding="utf-8",
    )
    result = subprocess.run(
        [
            chromium,
            "--headless",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--virtual-time-budget=3000",
            "--dump-dom",
            page.as_uri(),
        ],
        text=True,
        capture_output=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    match = re.search(r'<pre id="result">(.*?)</pre>', result.stdout, re.S)
    assert match is not None, result.stdout
    state = json.loads(html.unescape(match.group(1)))
    assert state["movedIntoBranch"]
    assert state["movedAfterLeaf"]
    assert state["rootOrder"] == ["cat-b", "cat-a", "cat-empty"]
    assert state["cancelled"]
    assert state["descendantRejected"]
    assert state["movedToRoot"]
    assert state["movedIntoEmptyBranch"]
    assert state["events"] == [
        ["a1", "cat-b", "inside"],
        ["a2", "b1", "after"],
        ["cat-a", "cat-b", "after"],
        ["a3", "cat-b", "inside"],
        ["a1", "root", "inside"],
        ["a2", "cat-empty", "inside"],
    ]
