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
from grid_view_spec.types.nav import GridViewNav, GridViewNavItem, GridViewNavLevel
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


def test_tree_drop_waits_for_host_and_enforces_level_rules(tmp_path: Path) -> None:
    chromium = shutil.which("chromium")
    if not chromium:
        pytest.skip("Chromium is required for browser rendering")
    tree = GridViewNav(
        id="tree",
        presentation="tree",
        levels=(
            GridViewNavLevel(
                level=0,
                type="group",
                draggable=True,
                droppable=True,
                accept_drop_types=("resource,external",),
            ),
            GridViewNavLevel(level=1, type="group", draggable=False, droppable=False),
            GridViewNavLevel(level=2, type="resource,external", draggable=True),
        ),
        items=(
            GridViewNavItem(
                id="group-a",
                label="Group A",
                type="group",
                children=(
                    GridViewNavItem(
                        id="nested-group",
                        label="Nested group",
                        type="group",
                        children=(
                            GridViewNavItem(
                                id="resource-1", label="Resource", type="resource,external"
                            ),
                        ),
                    ),
                ),
            ),
            GridViewNavItem(id="group-b", label="Group B", type="group"),
        ),
        extra={
            "allow_drag": True,
            "drop_action": "resources.move",
            "root_drop_label": "Root",
        },
    )
    spec = GridViewSpec(
        id="nav_async_drop_browser",
        blocks=(tree,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(tree.id,))),
    )
    markup = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    bundle = (
        Path(__file__).resolve().parents[1]
        / "src/grid_view_spec/static/grid_view_spec/gridviewspec.js"
    )
    page = tmp_path / "nav-async-drop.html"
    scenario = """
<pre id="result"></pre>
<script>
window.addEventListener("load", async () => {
  window.GridView.bootScope(document);
  const tree = document.querySelector('[data-cm-nav-tree="tree"]');
  const node = id => tree.querySelector(`[data-node-id="${id}"]`);
  const row = id => node(id).firstElementChild;
  const parent = id => (
    node(id).parentElement.closest('.cm-nav-tree-node')?.dataset.nodeId || 'root'
  );
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const drop = (sourceId, target) => {
    const source = row(sourceId);
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
  };

  const rootDropZone = tree.querySelector('.cm-root-drop-zone');
  const nestedSource = row('resource-1');
  const nestedTransfer = new DataTransfer();
  nestedSource.dispatchEvent(
    new DragEvent('dragstart', { bubbles: true, dataTransfer: nestedTransfer })
  );
  const nestedRootZoneVisible = !rootDropZone.classList.contains('hidden');
  const parentIdAttributeAbsent = !node('resource-1').hasAttribute('data-parent-id');
  nestedSource.dispatchEvent(
    new DragEvent('dragend', { bubbles: true, dataTransfer: nestedTransfer })
  );

  drop('resource-1', row('group-b'));
  await tick();
  const missingHandlerRejected = parent('resource-1') === 'nested-group';

  let resolveMove;
  let received;
  GridView.registerDrop('resources.move', context => {
    received = context;
    return new Promise(resolve => { resolveMove = resolve; });
  });
  drop('resource-1', row('group-b'));
  const unchangedWhilePending = parent('resource-1') === 'nested-group';
  resolveMove(true);
  await tick();
  const movedAfterSuccess = parent('resource-1') === 'group-b';

  GridView.registerDrop('resources.move', () => false);
  drop('resource-1', tree.querySelector('.cm-root-drop-zone'));
  await tick();
  const unchangedAfterRefusal = parent('resource-1') === 'group-b';

  let wrongTypeCalls = 0;
  GridView.registerDrop('resources.move', () => { wrongTypeCalls += 1; return true; });
  drop('group-a', row('group-b'));
  await tick();
  const wrongTypeRejected = wrongTypeCalls === 0 && parent('group-a') === 'root';

  let wrongDepthCalls = 0;
  GridView.registerDrop('resources.move', () => { wrongDepthCalls += 1; return true; });
  drop('resource-1', row('nested-group'));
  await tick();
  const wrongDepthRejected = wrongDepthCalls === 0 && parent('resource-1') === 'group-b';

  document.getElementById('result').textContent = JSON.stringify({
    missingHandlerRejected,
    nestedRootZoneVisible,
    parentIdAttributeAbsent,
    unchangedWhilePending,
    movedAfterSuccess,
    unchangedAfterRefusal,
    wrongTypeRejected,
    wrongDepthRejected,
    context: received,
  });
});
</script>
"""
    page.write_text(
        f'<html><body>{markup}<script src="{bundle.as_uri()}"></script>{scenario}</body></html>',
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
    assert state["missingHandlerRejected"]
    assert state["nestedRootZoneVisible"]
    assert state["parentIdAttributeAbsent"]
    assert state["unchangedWhilePending"]
    assert state["movedAfterSuccess"]
    assert state["unchangedAfterRefusal"]
    assert state["wrongTypeRejected"]
    assert state["wrongDepthRejected"]
    assert state["context"] == {
        "treeId": "tree",
        "sourceId": "resource-1",
        "targetId": "group-b",
        "sourceType": "resource,external",
        "targetType": "group",
        "position": "inside",
    }
