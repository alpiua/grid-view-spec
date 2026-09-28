"""Real-browser currency cells retain row identity and optional symbol colors."""

import shutil
import subprocess
from pathlib import Path

import pytest

from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render import render_grid_view_spec
from grid_view_spec.types.formatters import CurrencyFormatter
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.spec import GridViewSpec
from grid_view_spec.types.table_v2 import GridViewColumn, GridViewTable


def test_currency_cells_render_in_browser_with_raw_values(tmp_path: Path) -> None:
    chromium = shutil.which("chromium")
    if not chromium:
        pytest.skip("Chromium is required for browser rendering")
    bundle = (
        Path(__file__).resolve().parents[1]
        / "src/grid_view_spec/static/grid_view_spec/gridviewspec.js"
    )
    table = GridViewTable(
        id="prices",
        columns=(
            GridViewColumn(
                id="price",
                label="Price",
                type="currency",
                currency_formatter=CurrencyFormatter(
                    currency="UAH",
                    locale="en-US",
                    precision=2,
                    precision_by_currency={"UAH": 0},
                    symbol_colors={"EUR": "#3b82f6"},
                ),
            ),
        ),
        rows=({"price": 1234.5, "price_currency": "EUR"}, {"price": 22, "price_currency": "UAH"}),
    )
    spec = GridViewSpec(
        id="currency_browser",
        blocks=(table,),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(table.id,))),
    )
    markup = render_grid_view_spec(spec, (), host=InMemoryHost(), backend="html")
    page = tmp_path / "currency.html"
    page.write_text(
        f'<html><body>{markup}<script src="{bundle.as_uri()}"></script>'
        '<pre id="currency-js"></pre><script>'
        'document.getElementById("currency-js").textContent = JSON.stringify('
        'window.GridView.formatCurrencyParts(12.5, {currency:"UAH",locale:"en-US",'
        'precision:2,showSymbol:true,symbolColors:{EUR:"#3b82f6"}}, "EUR"));'
        "</script></body></html>",
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
    assert 'data-cm-sort-val="1234.5"' in result.stdout
    assert 'style="color:#3b82f6">€</span>' in result.stdout
    assert 'id="currency-js">["","€","12.50","#3b82f6"]' in result.stdout
