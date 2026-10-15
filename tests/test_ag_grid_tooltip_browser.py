"""Browser proof for the public AG Grid tooltip component."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from tests.browser_testing import require_chromium, run_headless_chromium


def test_ag_grid_tooltip_keeps_its_skin_and_displays_falsey_scalars(tmp_path: Path) -> None:
    chromium = require_chromium()

    static = Path(__file__).resolve().parents[1] / "src/grid_view_spec/static/grid_view_spec"
    page = tmp_path / "ag-grid-tooltip.html"
    page.write_text(
        f"""<!doctype html>
<html><head><link rel="stylesheet" href="{(static / "gridviewspec.css").as_uri()}"></head>
<body>
<script src="{(static / "gridviewspec.js").as_uri()}"></script>
<script src="{(static / "gridviewspec-ag-grid.js").as_uri()}"></script>
<pre id="result"></pre>
<script>
window.addEventListener("load", () => {{
  const Tooltip = window.GridView?.AgGrid?.Tooltip;
  if (typeof Tooltip !== "function") throw new Error("AG Grid tooltip was not installed");
  const render = value => {{
    const component = new Tooltip();
    component.init({{ value }});
    const element = component.getGui();
    document.body.appendChild(element);
    return {{
      element,
      text: element.textContent,
      display: getComputedStyle(element).display,
      position: getComputedStyle(element).position,
      floating: element.classList.contains("cm-ellipsis-tip--floating"),
    }};
  }};
  const zero = render(0);
  const falseValue = render(false);
  const blank = render("  ");
  const hostile = render("<img src=x onerror=alert(1)>");
  document.getElementById("result").textContent = JSON.stringify({{
    zero: [zero.text, zero.display, zero.position, zero.floating],
    falseValue: [falseValue.text, falseValue.display, falseValue.position, falseValue.floating],
    blank: [blank.text, blank.display],
    hostile: [hostile.text, hostile.element.querySelector("img") === null],
  }});
}});
</script>
</body></html>
""",
        encoding="utf-8",
    )
    result = run_headless_chromium(chromium, page, tmp_path)
    assert result.returncode == 0, result.stderr
    match = re.search(r'<pre id="result">(.*?)</pre>', result.stdout, re.S)
    assert match is not None, result.stdout
    state = json.loads(html.unescape(match.group(1)))
    assert state["zero"] == ["0", "block", "fixed", True]
    assert state["falseValue"] == ["false", "block", "fixed", True]
    assert state["blank"] == ["", "none"]
    assert state["hostile"] == ["<img src=x onerror=alert(1)>", True]
