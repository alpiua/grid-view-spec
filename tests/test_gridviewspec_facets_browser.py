"""Production-browser proof for the opt-in in-place faceted refresh path."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from grid_view_spec.backends.fragment.html import render_block_fragment
from grid_view_spec.hosts.memory import InMemoryHost
from grid_view_spec.render import build_render_context, render_grid_view_spec
from grid_view_spec.types.filters_v2 import (
    GridViewFilter,
    GridViewFilterDrawerSection,
    GridViewFilterOption,
    GridViewFilters,
    GridViewFilterState,
    GridViewFilterValue,
)
from grid_view_spec.types.layout import GridViewArea, GridViewLayout
from grid_view_spec.types.spec import GridViewSpec
from grid_view_spec.types.table_v2 import (
    GridViewColumn,
    GridViewColumnSource,
    GridViewDataSource,
    GridViewTable,
)
from tests.browser_testing import require_chromium, run_headless_chromium


def _options(prefix: str) -> tuple[GridViewFilterOption, ...]:
    """Return dependent brand options with changing counts and disabled state."""
    return (
        GridViewFilterOption(value="carry-brand", label="Carry-over brand", count=1),
        GridViewFilterOption(value=f"{prefix}-brand", label=f"{prefix} brand", count=4),
        GridViewFilterOption(
            value=f"{prefix}-unavailable",
            label="Unavailable brand",
            count=0,
            disabled=True,
        ),
    )


def _spec(dealer: str = "", brand: str = "") -> GridViewSpec:
    """Build a host-owned stock-like faceted page with dynamic price columns."""
    table = GridViewTable(
        id="offers",
        backend="ag_grid",
        columns=(GridViewColumn(id="name", label="Product", field="name"),),
        column_source=GridViewColumnSource(
            endpoint="/columns/",
            depends_on=("dealer",),
        ),
        datasource=GridViewDataSource(endpoint="/rows/"),
        settings=("drawer",),
    )
    selected_state: dict[str, GridViewFilterValue] = {
        "price_tier": f"{dealer or 'all'}-retail",
    }
    if dealer:
        selected_state["dealer"] = dealer
    if brand:
        selected_state["brand"] = (brand,)
    if dealer == "d2":
        settings_filter = GridViewFilter(
            id="price_columns",
            label="Visible price columns",
            param="price_columns",
            type="multiselect",
            options=(
                GridViewFilterOption(value="d2-retail", label="Retail", count=3),
                GridViewFilterOption(value="d2-wholesale", label="Wholesale", count=2),
            ),
        )
        selected_state["price_columns"] = ("d2-retail", "d2-wholesale")
    else:
        settings_filter = GridViewFilter(
            id="wholesale_price_columns",
            label="Wholesale price columns",
            param="wholesale_price_columns",
            type="multiselect",
            options=(
                GridViewFilterOption(
                    value=f"{dealer or 'all'}-wholesale",
                    label="Wholesale",
                    count=1,
                ),
            ),
        )
        selected_state["wholesale_price_columns"] = (f"{dealer or 'all'}-wholesale",)
    price_basis_value = f"{dealer or 'all'}-retail"
    price_basis_filter = GridViewFilter(
        id="price_basis",
        label="Price basis",
        param="price_basis",
        type="grouped_select",
        options=(
            GridViewFilterOption(
                value="price-basis",
                label="Price basis",
                children=(
                    GridViewFilterOption(value=price_basis_value, label="Retail basis"),
                    GridViewFilterOption(
                        value=f"{dealer or 'all'}-wholesale",
                        label="Wholesale basis",
                    ),
                ),
            ),
        ),
    )
    selected_state["price_basis"] = (price_basis_value,)
    filters = GridViewFilters(
        id="stock_filters",
        presentation="drawer",
        drawer_layout="workspace",
        target=table.id,
        facets=True,
        facets_refresh_mode="in_place",
        schema=(
            GridViewFilter(
                id="dealer",
                label="Dealer",
                param="dealer",
                type="select",
                options=(
                    GridViewFilterOption(value="", label="All dealers"),
                    GridViewFilterOption(value="d1", label="Dealer 1"),
                    GridViewFilterOption(value="d2", label="Dealer 2"),
                ),
            ),
            GridViewFilter(
                id="brand",
                label="Brand",
                param="brand",
                type="multiselect",
                options=_options(dealer or "all"),
            ),
            GridViewFilter(
                id="price_tier",
                label="Price tier",
                param="price_tier",
                type="select",
                options=(
                    GridViewFilterOption(
                        value=f"{dealer or 'all'}-retail",
                        label="Retail",
                        count=2 if dealer else 5,
                    ),
                    GridViewFilterOption(
                        value=f"{dealer or 'all'}-wholesale",
                        label="Wholesale",
                        count=0,
                        disabled=True,
                    ),
                ),
            ),
            settings_filter,
            price_basis_filter,
        ),
        drawer_sections=(
            GridViewFilterDrawerSection(
                id="supplier",
                label="Supplier",
                filter_ids=("dealer",),
            ),
            GridViewFilterDrawerSection(
                id="brands",
                label="Brands and prices",
                filter_ids=("brand", "price_tier"),
                searchable=True,
                list_size="lg",
            ),
            GridViewFilterDrawerSection(
                id="price-settings",
                label="Price columns",
                filter_ids=(settings_filter.id, price_basis_filter.id),
                searchable=True,
                list_size="lg",
                panel="settings",
            ),
        ),
        state=GridViewFilterState(values=selected_state),
    )
    return GridViewSpec(
        id="stock_facets_browser",
        blocks=(filters, table),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=(filters.id, table.id))),
    )


def _markup(dealer: str = "", brand: str = "") -> str:
    return render_grid_view_spec(
        _spec(dealer, brand),
        (),
        host=InMemoryHost(),
        backend="html",
    )


_SCENARIO = r"""
<pre id="result"></pre>
<script>
window.addEventListener('beforeunload', () => {
  const brand = document.querySelector('[data-filter-id="brand"][data-cm-multiselect]');
  const dealer = document.querySelector('select[name="dealer"]');
  sessionStorage.setItem('facet-navigation-fallback', JSON.stringify({
    url: location.search,
    requestUrl: window.__requests.facets.at(-1) || '',
    dealer: dealer?.value || '',
    brandValues: Array.from(
      brand?.querySelectorAll('input[type="checkbox"]') || []
    ).map(input => input.value),
  }));
});
window.addEventListener("load", async () => {
  const fallback = sessionStorage.getItem('facet-navigation-fallback');
  if (fallback) {
    const state = JSON.parse(sessionStorage.getItem('facet-success-state') || '{}');
    state.afterFailure = {fullNavigationFallback: true, ...JSON.parse(fallback)};
    document.getElementById('result').textContent = JSON.stringify(state);
    sessionStorage.removeItem('facet-navigation-fallback');
    sessionStorage.removeItem('facet-success-state');
    return;
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const bar = document.querySelector('[data-cm-filter-drawer-workspace]');
  const dealer = bar.querySelector('select[name="dealer"]');
  const brandList = bar.querySelector('[data-filter-id="brand"][data-cm-multiselect]');
  const tierField = bar.querySelector('[data-filter-id="price_tier"]');
  const workspaceSearch = bar.querySelector('[data-cm-filter-workspace-search]');
  const card = bar.querySelector('[data-cm-filter-card-id="brands"]');
  const cardSearch = card.querySelector('[data-cm-filter-card-search]');
  const cardList = card.querySelector('.cm-filter-drawer-card-controls');
  const settingsBar = document.querySelector('[data-cm-filter-workspace-panel="settings"]');
  const settingsCard = settingsBar.querySelector('[data-cm-filter-card-id="price-settings"]');
  const settingsCardSearch = settingsCard.querySelector('[data-cm-filter-card-search]');
  const settingsCardList = settingsCard.querySelector('.cm-filter-drawer-card-controls');
  const priceBasisSelect = settingsCard.querySelector('select[data-cm-grouped-select]');
  const originalWholesaleColumns = settingsCard.querySelector(
    '[data-filter-id="wholesale_price_columns"][data-cm-multiselect]'
  );
  brandList.style.height = '42px';
  brandList.style.overflowY = 'auto';
  brandList.scrollTop = 18;
  workspaceSearch.value = 'Brands';
  cardSearch.value = 'brand query';
  settingsCardSearch.value = 'price query';
  const original = {
    bar,
    dealer,
    brandList,
    tierField,
    workspaceSearch,
    card,
    cardSearch,
    cardList,
    settingsBar,
    settingsCard,
    settingsCardSearch,
    settingsCardList,
    priceBasisSelect,
    originalWholesaleColumns,
    scrollTop: brandList.scrollTop,
    pushCount: 0,
    rowCount: window.__requests.rows.length,
    filterEvents: 0,
  };
  const pushState = history.pushState.bind(history);
  history.pushState = (...args) => {
    original.pushCount += 1;
    return pushState(...args);
  };
  document.addEventListener('cm-filter-change', event => {
    if (
      event.target === bar ||
      event.target === bar.querySelector('.cm-filter-drawer-workspace-cards') ||
      event.target === settingsBar ||
      event.target === settingsBar.querySelector('.cm-filter-drawer-workspace-cards')
    ) {
      original.filterEvents += 1;
    }
  });
  GridView.bootScope(document);
  settingsBar.dataset.cmFbBound = '';
  GridView.bootScope(document);
  const groupedChangeListeners = window.__groupedServerChangeListeners;
  await wait(150);
  const initialRows = window.__requests.rows.length;
  dealer.value = 'd1';
  dealer.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(5);
  dealer.value = 'd2';
  dealer.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(210);
  const d2Brand = brandList.querySelector('input[value="d2-brand"]');
  const d2Unavailable = brandList.querySelector('input[value="d2-unavailable"]');
  const d2Tier = tierField.querySelector('select');
  const settingsPriceColumns = settingsCard.querySelector(
    '[data-filter-id="price_columns"][data-cm-multiselect]'
  );
  const settingsRetail = settingsPriceColumns?.querySelector('input[value="d2-retail"]');
  const settingsWholesale = settingsPriceColumns?.querySelector('input[value="d2-wholesale"]');
  const afterLatest = {
    urlDealer: new URL(location.href).searchParams.get('dealer'),
    stableNodes: document.querySelector('[data-cm-filter-drawer-workspace]') === original.bar &&
      bar.querySelector('select[name="dealer"]') === original.dealer &&
      bar.querySelector('[data-filter-id="brand"][data-cm-multiselect]') === original.brandList &&
      bar.querySelector('[data-filter-id="price_tier"]') === original.tierField &&
      bar.querySelector('[data-cm-filter-workspace-search]') === original.workspaceSearch &&
      bar.querySelector('[data-cm-filter-card-id="brands"]') === original.card &&
      card.querySelector('[data-cm-filter-card-search]') === original.cardSearch &&
      card.querySelector('.cm-filter-drawer-card-controls') === original.cardList,
    searchValues: workspaceSearch.value === 'Brands' && cardSearch.value === 'brand query',
    settingsNodes: settingsBar === original.settingsBar &&
      settingsCard === original.settingsCard &&
      settingsCardSearch === original.settingsCardSearch &&
      settingsCardList === original.settingsCardList,
    settingsSearchValue: settingsCardSearch.value === 'price query',
    settingsFilterShape: !originalWholesaleColumns.isConnected && !!settingsPriceColumns &&
      settingsRetail?.checked === true && settingsWholesale?.checked === true &&
      !settingsCard.querySelector('[data-filter-id="wholesale_price_columns"]'),
    settingsWidgetInitialized: settingsPriceColumns?.dataset.cmMsBound === '1',
    scrollPreserved: brandList.scrollTop === original.scrollTop && original.scrollTop > 0,
    dependentOptions: !!d2Brand && !!d2Unavailable && !!d2Tier &&
      d2Tier.value === 'd2-retail' &&
      brandList.querySelector('label[data-cm-filter-option] input[value="d2-brand"]')
        ?.closest('label')?.querySelector('.cm-filter-drawer-option-count')?.textContent === '4',
    dependentCountsAndDisabled: d2Brand?.dataset.cmFacetCount === '4' &&
      d2Unavailable?.dataset.cmFacetCount === '0' && d2Unavailable.disabled &&
      tierField.querySelector('option[value="d2-wholesale"]')?.disabled === true,
    selectedBrand: brandList.querySelector('input[value="carry-brand"]')?.checked === true,
    rowRequests: window.__requests.rows.length - initialRows,
    acceptedFilterEvents: original.filterEvents,
    pushCount: original.pushCount,
    latestColumnQuery: window.__requests.columns.at(-1) || null,
    dynamicPriceColumn: window.__grid.columnDefs.some(column => column.colId === 'price_d2'),
    staleDealer: !brandList.querySelector('input[value="d1-brand"]'),
  };

  const eventCountBeforeBack = original.filterEvents;
  const rowsBeforeBack = window.__requests.rows.length;
  history.back();
  await wait(160);
  const afterBack = {
    urlDealer: new URL(location.href).searchParams.get('dealer'),
    selectedDealer: dealer.value,
    selectedBrand: brandList.querySelector('input[value="carry-brand"]')?.checked === true,
    pushCountUnchanged: original.pushCount === 2,
    rowRequests: window.__requests.rows.length - rowsBeforeBack,
    acceptedFilterEvents: original.filterEvents - eventCountBeforeBack,
    latestColumnQuery: window.__requests.columns.at(-1) || null,
  };

  const rowsBeforeForward = window.__requests.rows.length;
  const eventCountBeforeForward = original.filterEvents;
  history.forward();
  await wait(160);
  const afterForward = {
    urlDealer: new URL(location.href).searchParams.get('dealer'),
    selectedDealer: dealer.value,
    selectedBrand: brandList.querySelector('input[value="carry-brand"]')?.checked === true,
    pushCountUnchanged: original.pushCount === 2,
    rowRequests: window.__requests.rows.length - rowsBeforeForward,
    acceptedFilterEvents: original.filterEvents - eventCountBeforeForward,
    latestColumnQuery: window.__requests.columns.at(-1) || null,
  };

  const rowsBeforeReset = window.__requests.rows.length;
  const eventCountBeforeReset = original.filterEvents;
  const reset = bar.querySelector('[data-cm-filter-drawer-reset-all]');
  reset.hidden = false;
  reset.click();
  await wait(160);
  const afterReset = {
    urlDealer: new URL(location.href).searchParams.get('dealer'),
    selectedDealer: dealer.value,
    selectedBrand: brandList.querySelector('input[value="carry-brand"]')?.checked === true,
    defaultBrandOption: !!brandList.querySelector('input[value="all-brand"]'),
    rowRequests: window.__requests.rows.length - rowsBeforeReset,
    acceptedFilterEvents: original.filterEvents - eventCountBeforeReset,
    pushCount: original.pushCount,
  };

  const rowsBeforeSettingsInsert = window.__requests.rows.length;
  const eventsBeforeSettingsInsert = original.filterEvents;
  const pushesBeforeSettingsInsert = original.pushCount;
  const requestsBeforeSettingsInsert = window.__requests.facets.length;
  dealer.value = 'd2';
  dealer.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(220);
  const insertedPriceColumns = settingsCard.querySelector(
    '[data-filter-id="price_columns"][data-cm-multiselect]'
  );
  const insertedRetail = insertedPriceColumns?.querySelector('input[value="d2-retail"]');
  const rowsBeforeSettingsClick = window.__requests.rows.length;
  const eventsBeforeSettingsClick = original.filterEvents;
  const pushesBeforeSettingsClick = original.pushCount;
  const requestsBeforeSettingsClick = window.__requests.facets.length;
  if (insertedRetail) insertedRetail.click();
  await wait(720);
  const afterInsertedSettingsControl = {
    insertedControlWasCreated: !!insertedPriceColumns && !!insertedRetail,
    insertRequestCount: requestsBeforeSettingsClick - requestsBeforeSettingsInsert,
    insertRowRequests: rowsBeforeSettingsClick - rowsBeforeSettingsInsert,
    insertAcceptedFilterEvents: eventsBeforeSettingsClick - eventsBeforeSettingsInsert,
    insertPushCount: pushesBeforeSettingsClick - pushesBeforeSettingsInsert,
    insertedControlStillLive: !!insertedPriceColumns &&
      settingsCard.querySelector('[data-filter-id="price_columns"][data-cm-multiselect]') ===
        insertedPriceColumns,
    retailUnchecked:
      insertedPriceColumns?.querySelector('input[value="d2-retail"]')?.checked === false,
    wholesaleChecked:
      insertedPriceColumns?.querySelector('input[value="d2-wholesale"]')?.checked === true,
    requestCount: window.__requests.facets.length - requestsBeforeSettingsClick,
    rowRequests: window.__requests.rows.length - rowsBeforeSettingsClick,
    acceptedFilterEvents: original.filterEvents - eventsBeforeSettingsClick,
    pushCount: original.pushCount - pushesBeforeSettingsClick,
    selectedPriceColumns: new URL(
      window.__requests.facets.at(-1) || '', window.location.origin
    ).searchParams.get('price_columns'),
  };

  const rowsBeforeGroupedChange = window.__requests.rows.length;
  const eventsBeforeGroupedChange = original.filterEvents;
  const pushesBeforeGroupedChange = original.pushCount;
  const requestsBeforeGroupedChange = window.__requests.facets.length;
  priceBasisSelect.value = 'd2-wholesale';
  priceBasisSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(220);
  const afterGroupedChange = {
    requestCount: window.__requests.facets.length - requestsBeforeGroupedChange,
    rowRequests: window.__requests.rows.length - rowsBeforeGroupedChange,
    acceptedFilterEvents: original.filterEvents - eventsBeforeGroupedChange,
    pushCount: original.pushCount - pushesBeforeGroupedChange,
    groupedChangeListeners,
    selectedPriceBasis: new URL(
      window.__requests.facets.at(-1) || '', window.location.origin
    ).searchParams.get('price_basis'),
  };

  sessionStorage.setItem('facet-success-state', JSON.stringify({
    afterLatest,
    afterBack,
    afterForward,
    afterReset,
    afterInsertedSettingsControl,
    afterGroupedChange,
    filterUrls: window.__requests.facets,
  }));
  window.__responses.d1 = '<html><body>Invalid facet response</body></html>';
  dealer.value = 'd1';
  dealer.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(160);
  document.getElementById('result').textContent = JSON.stringify({
    afterLatest,
    afterBack,
    afterForward,
    afterReset,
    afterInsertedSettingsControl,
    afterGroupedChange,
    afterFailure: {fullNavigationFallback: false},
    filterUrls: window.__requests.facets,
  });
});
</script>
"""


def test_in_place_facets_keep_workspace_and_refresh_latest_table_state(tmp_path: Path) -> None:
    """The server updates dependent facets without replacing the live workspace."""
    initial_filters = next(
        block for block in _spec(brand="carry-brand").blocks if isinstance(block, GridViewFilters)
    )
    assert initial_filters.facets and initial_filters.facets_refresh_mode == "in_place"
    chromium = require_chromium()
    markup = _markup(brand="carry-brand")
    response_markup = {
        "default": _markup(),
        "d1": _markup("d1", "carry-brand"),
        "d2": _markup("d2", "carry-brand"),
    }
    bundle_root = Path(__file__).resolve().parents[1] / "src/grid_view_spec/static/grid_view_spec"
    page = tmp_path / "facets-in-place.html"
    page.write_text(
        "<!doctype html><html><head><style>"
        ".cm-filter-drawer-choice-list label{display:block;height:22px}"
        "</style></head><body>"
        + markup
        + "<script>"
        + "window.__requests = {facets: [], rows: [], columns: []};"
        + "window.__grid = {columnDefs: []};"
        + "window.__responses = "
        + json.dumps(response_markup).replace("</script", "<\\/script")
        + ";"
        + r"""
document.querySelectorAll('select[data-cm-grouped-select]').forEach(select => {
  select.dataset.filterScope = 'server';
});
window.__groupedServerChangeListeners = 0;
const nativeSelectAddEventListener = HTMLSelectElement.prototype.addEventListener;
HTMLSelectElement.prototype.addEventListener = function(type, listener, options) {
  if (type === 'change' && this.matches(
    "select[data-filter-scope='server'][data-cm-grouped-select]"
  )) window.__groupedServerChangeListeners += 1;
  return nativeSelectAddEventListener.call(this, type, listener, options);
};
window.agGrid = {
  createGrid(_element, options) {
    const api = {
      addEventListener() {}, removeEventListener() {}, destroy() {},
      getFilterModel: () => null, setFilterModel() {},
      getColumnState: () => [], applyColumnState: () => true,
      getColumnDefs: () => window.__grid.columnDefs,
      getSelectedRows: () => [], forEachNode() {}, getDisplayedRowCount: () => 0,
      getGridOption: key => key === 'rowModelType' ? 'infinite' : undefined,
      setGridOption(key, value) {
        if (key === 'columnDefs') window.__grid.columnDefs = value;
      },
      showLoadingOverlay() {}, hideOverlay() {},
      purgeInfiniteCache() { requestRows(); },
    };
    window.__grid.options = options;
    const requestRows = () => options.datasource?.getRows({
      startRow: 0, endRow: 25, successCallback() {}, failCallback() {},
    });
    window.setTimeout(requestRows, 0);
    return api;
  },
};
const jsonResponse = value => ({ok: true, json: async () => value});
const htmlResponse = value => ({ok: true, text: async () => value});
window.fetch = async input => {
  const url = new URL(String(input), window.location.href);
  if (url.pathname.endsWith('/rows/')) {
    window.__requests.rows.push(url.search);
    return jsonResponse({data: [], lastRow: 0, totalCount: 0});
  }
  if (url.pathname.endsWith('/columns/')) {
    const dealer = url.searchParams.get('dealer') || '';
    window.__requests.columns.push(dealer);
    return jsonResponse({
      columns: dealer ? [{id: 'price_' + dealer, field: 'price_' + dealer, label: 'Price'}] : [],
    });
  }
  window.__requests.facets.push(url.search);
  const dealer = url.searchParams.get('dealer') || 'default';
  if (dealer === 'd1') await new Promise(resolve => setTimeout(resolve, 120));
  else await new Promise(resolve => setTimeout(resolve, 10));
  const responseDocument = new DOMParser().parseFromString(
    window.__responses[dealer], 'text/html'
  );
  responseDocument.querySelectorAll('[data-filter-param]').forEach(root => {
    const param = root.dataset.filterParam;
    if (!param || !url.searchParams.has(param)) return;
    const selectedValues = url.searchParams.getAll(param)
      .flatMap(value => value.split(','));
    root.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked = selectedValues.includes(input.value);
      input.toggleAttribute('checked', input.checked);
    });
    root.querySelectorAll('select').forEach(select => {
      Array.from(select.options).forEach(option => {
        option.selected = selectedValues.includes(option.value);
        option.toggleAttribute('selected', option.selected);
      });
    });
  });
  return htmlResponse(responseDocument.documentElement.outerHTML);
};
"""
        + "</script>"
        + f'<script src="{(bundle_root / "gridviewspec.js").as_uri()}"></script>'
        + f'<script src="{(bundle_root / "gridviewspec-ag-grid.js").as_uri()}"></script>'
        + f'<script src="{(bundle_root / "gridviewspec-filter-workspace.js").as_uri()}"></script>'
        + _SCENARIO
        + "</body></html>",
        encoding="utf-8",
    )
    result = run_headless_chromium(
        chromium,
        page,
        tmp_path,
        virtual_time_budget=5000,
        url_query="?search=initial&page=2&brand=carry-brand",
    )
    assert result.returncode == 0, result.stderr
    match = re.search(r'<pre id="result">(.*?)</pre>', result.stdout, re.S)
    assert match is not None, result.stdout
    state = json.loads(html.unescape(match.group(1)))
    assert "afterLatest" in state, state

    assert state["afterLatest"] == {
        "urlDealer": "d2",
        "selectedBrand": True,
        "stableNodes": True,
        "searchValues": True,
        "settingsNodes": True,
        "settingsSearchValue": True,
        "settingsFilterShape": True,
        "settingsWidgetInitialized": True,
        "scrollPreserved": True,
        "dependentOptions": True,
        "dependentCountsAndDisabled": True,
        "rowRequests": 1,
        "acceptedFilterEvents": 1,
        "pushCount": 2,
        "latestColumnQuery": "d2",
        "dynamicPriceColumn": True,
        "staleDealer": True,
    }
    assert state["afterBack"] == {
        "urlDealer": "d1",
        "selectedDealer": "d1",
        "selectedBrand": True,
        "pushCountUnchanged": True,
        "rowRequests": 1,
        "acceptedFilterEvents": 1,
        "latestColumnQuery": "d1",
    }
    assert state["afterForward"] == {
        "urlDealer": "d2",
        "selectedDealer": "d2",
        "selectedBrand": True,
        "pushCountUnchanged": True,
        "rowRequests": 1,
        "acceptedFilterEvents": 1,
        "latestColumnQuery": "d2",
    }
    assert state["afterReset"] == {
        "urlDealer": None,
        "selectedDealer": "",
        "selectedBrand": False,
        "defaultBrandOption": True,
        "rowRequests": 1,
        "acceptedFilterEvents": 1,
        "pushCount": 3,
    }
    assert state["afterInsertedSettingsControl"] == {
        "insertedControlWasCreated": True,
        "insertRequestCount": 1,
        "insertRowRequests": 1,
        "insertAcceptedFilterEvents": 1,
        "insertPushCount": 1,
        "insertedControlStillLive": True,
        "retailUnchecked": True,
        "wholesaleChecked": True,
        "requestCount": 1,
        "rowRequests": 1,
        "acceptedFilterEvents": 1,
        "pushCount": 1,
        "selectedPriceColumns": "d2-wholesale",
    }
    assert state["afterGroupedChange"] == {
        "requestCount": 1,
        "rowRequests": 1,
        "acceptedFilterEvents": 1,
        "pushCount": 1,
        "groupedChangeListeners": 1,
        "selectedPriceBasis": "d2-wholesale",
    }
    assert state["afterFailure"] == {
        "fullNavigationFallback": True,
        "url": state["afterFailure"]["requestUrl"],
        "requestUrl": state["afterFailure"]["requestUrl"],
        "dealer": "d1",
        "brandValues": ["carry-brand", "d2-brand", "d2-unavailable"],
    }
    assert state["afterFailure"]["url"].startswith("?search=initial&page=1&dealer=d1")
    assert len(state["filterUrls"]) == 8


def test_facet_params_endpoint_dedup_and_dynamic_cards(tmp_path: Path) -> None:
    """Verify facet_params, facets_endpoint, Enter+blur dedup, and dynamic card reconciliation."""
    chromium = require_chromium()
    base_filters = GridViewFilters(
        id="catalog_filters",
        target="catalog_grid",
        presentation="drawer",
        drawer_layout="workspace",
        facets=True,
        facets_refresh_mode="in_place",
        facet_params=("category_id",),
        facets_endpoint="/catalog/filters-fragment/",
        schema=(
            GridViewFilter(
                id="category_id",
                label="Category",
                param="category_id",
                type="select",
                options=(
                    GridViewFilterOption(value="", label="All"),
                    GridViewFilterOption(value="tents", label="Tents"),
                ),
            ),
            GridViewFilter(
                id="min_price",
                label="Minimum price",
                param="min_price",
                type="number",
            ),
        ),
        drawer_sections=(
            GridViewFilterDrawerSection(
                id="category",
                label="Category",
                filter_ids=("category_id",),
            ),
            GridViewFilterDrawerSection(
                id="price",
                label="Price",
                filter_ids=("min_price",),
            ),
        ),
    )
    table = GridViewTable(
        id="catalog_grid",
        backend="ag_grid",
        columns=(GridViewColumn(id="title", label="Title", field="title"),),
        datasource=GridViewDataSource(endpoint="/catalog/rows/"),
        settings=("drawer",),
        extra={"filtersSelector": '[data-cm-filter-drawer][data-target="catalog_grid"]'},
    )
    base_spec = GridViewSpec(
        id="catalog_scoped_spec",
        blocks=(base_filters, table),
        layout=GridViewLayout(
            root=GridViewArea(
                id="root",
                blocks=("catalog_filters", "catalog_grid"),
            )
        ),
    )
    scoped_filters = GridViewFilters(
        id="catalog_filters",
        target="catalog_grid",
        presentation="drawer",
        drawer_layout="workspace",
        facets=True,
        facets_refresh_mode="in_place",
        facet_params=("category_id",),
        facets_endpoint="/catalog/filters-fragment/",
        schema=(
            *base_filters.schema,
            GridViewFilter(
                id="color",
                label="Color",
                param="color",
                type="multiselect",
                options=(GridViewFilterOption(value="green", label="Green", count=3),),
            ),
        ),
        drawer_sections=(
            *base_filters.drawer_sections,
            GridViewFilterDrawerSection(
                id="attributes",
                label="Attributes",
                filter_ids=("color",),
            ),
        ),
    )
    scoped_spec = GridViewSpec(
        id="catalog_scoped_spec",
        blocks=(scoped_filters, table),
        layout=base_spec.layout,
    )

    host = InMemoryHost()
    initial_html = render_grid_view_spec(base_spec, (), host=host)
    ctx_scoped = build_render_context(scoped_spec, (), host=host)
    fragment_html = render_block_fragment(ctx_scoped, "catalog_filters", host=host, wrap=True)
    bundle_root = Path(__file__).resolve().parents[1] / "src/grid_view_spec/static/grid_view_spec"
    page = tmp_path / "scoped-facets.html"
    fragment_json = json.dumps(fragment_html).replace("</script", "<\\/script")
    page.write_text(
        "<!doctype html><html><body>"
        + initial_html
        + "<script>"
        + f"window.__fragmentHtml = {fragment_json};"
        + """
window.__requests = {facets: [], rows: [], fullPage: []};
window.agGrid = {
  createGrid(_el, options) {
    const requestRows = () => options.datasource?.getRows({
      startRow: 0, endRow: 25, successCallback() {}, failCallback() {},
    });
    window.setTimeout(requestRows, 0);
    return {
      addEventListener() {}, removeEventListener() {}, destroy() {},
      getFilterModel: () => null, setFilterModel() {},
      getColumnState: () => [], applyColumnState: () => true,
      getColumnDefs: () => options.columnDefs || [],
      getSelectedRows: () => [], forEachNode() {}, getDisplayedRowCount: () => 0,
      getGridOption: key => key === 'rowModelType' ? 'infinite' : undefined,
      setGridOption() {}, showLoadingOverlay() {}, hideOverlay() {},
      purgeInfiniteCache() { requestRows(); },
    };
  },
};
window.fetch = async input => {
  const url = new URL(String(input), window.location.href);
  if (url.pathname.endsWith('/rows/')) {
    window.__requests.rows.push(url.search);
    return {ok: true, json: async () => ({data: [], lastRow: 0, totalCount: 0})};
  }
  if (url.pathname.endsWith('/catalog/filters-fragment/')) {
    window.__requests.facets.push(url.pathname + url.search);
    return {ok: true, text: async () => window.__fragmentHtml};
  }
  window.__requests.fullPage.push(url.pathname + url.search);
  return {ok: false, text: async () => ''};
};
</script>
"""
        + f'<script src="{(bundle_root / "gridviewspec.js").as_uri()}"></script>'
        + f'<script src="{(bundle_root / "gridviewspec-ag-grid.js").as_uri()}"></script>'
        + f'<script src="{(bundle_root / "gridviewspec-filter-workspace.js").as_uri()}"></script>'
        + r"""
<pre id="result"></pre>
<script>
window.addEventListener("load", async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let unloaded = false;
  window.addEventListener("beforeunload", () => { unloaded = true; });
  GridView.bootScope(document);
  await wait(120);

  const initialRows = window.__requests.rows.length;
  const minPrice = document.querySelector('[data-filter-param="min_price"] input');
  minPrice.value = '150';
  minPrice.dispatchEvent(new Event('input', { bubbles: true }));
  minPrice.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  minPrice.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(80);
  const afterMinPrice = {
    rowsAdded: window.__requests.rows.length - initialRows,
    facetsCount: window.__requests.facets.length,
    fullPageCount: window.__requests.fullPage.length,
    urlMinPrice: new URL(location.href).searchParams.get('min_price'),
  };

  const rowsBeforeCategory = window.__requests.rows.length;
  const categorySelect = document.querySelector('select[name="category_id"]');
  const categoryCardBefore = document.querySelector('[data-cm-filter-card-id="category"]');
  categorySelect.value = 'tents';
  categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(120);
  const catSel = '[data-cm-filter-card-id="category"]';
  const attrSel = '[data-cm-filter-card-id="attributes"] [data-filter-param="color"]';
  const afterCategory = {
    rowsAdded: window.__requests.rows.length - rowsBeforeCategory,
    facetsRequests: [...window.__requests.facets],
    fullPageCount: window.__requests.fullPage.length,
    categoryCardPreserved: document.querySelector(catSel) === categoryCardBefore,
    attributesCardAdded: Boolean(document.querySelector(attrSel)),
    unloaded,
  };

  document.getElementById('result').textContent = JSON.stringify({ afterMinPrice, afterCategory });
});
</script>
</body></html>""",
        encoding="utf-8",
    )
    result = run_headless_chromium(
        chromium,
        page,
        tmp_path,
        virtual_time_budget=3000,
    )
    assert result.returncode == 0, result.stderr
    match = re.search(r'<pre id="result">(.*?)</pre>', result.stdout, re.S)
    assert match is not None, result.stdout
    state = json.loads(html.unescape(match.group(1)))
    assert state["afterMinPrice"] == {
        "rowsAdded": 1,
        "facetsCount": 0,
        "fullPageCount": 0,
        "urlMinPrice": "150",
    }
    assert state["afterCategory"]["rowsAdded"] == 1
    assert len(state["afterCategory"]["facetsRequests"]) == 1
    assert state["afterCategory"]["facetsRequests"][0].startswith("/catalog/filters-fragment/?")
    assert state["afterCategory"]["fullPageCount"] == 0
    assert state["afterCategory"]["categoryCardPreserved"] is True
    assert state["afterCategory"]["attributesCardAdded"] is True
    assert state["afterCategory"]["unloaded"] is False


def test_lifecycle_hardening_history_clear_all_search_and_polling(tmp_path: Path) -> None:
    """Verify preserved history state, display-safe clearAll, search coordination, and polling."""
    chromium = require_chromium()
    filters = GridViewFilters(
        id="life_filters",
        target="life_grid",
        presentation="drawer",
        drawer_layout="workspace",
        facets=True,
        facets_refresh_mode="in_place",
        schema=(
            GridViewFilter(
                id="brand",
                label="Brand",
                param="brand",
                type="multiselect",
                options=(
                    GridViewFilterOption(value="alpha", label="Alpha Brand", count=2),
                    GridViewFilterOption(value="beta", label="Beta Gear", count=1),
                ),
            ),
            GridViewFilter(
                id="wholesale_price_columns",
                label="Wholesale",
                param="wholesale_price_columns",
                type="grouped_select",
                options=(
                    GridViewFilterOption(
                        value="g1",
                        label="Prices",
                        children=(
                            GridViewFilterOption(value="col_a", label="Column A"),
                            GridViewFilterOption(value="col_b", label="Column B"),
                        ),
                    ),
                ),
            ),
        ),
        drawer_sections=(
            GridViewFilterDrawerSection(
                id="brands",
                label="Brands",
                filter_ids=("brand",),
                searchable=True,
            ),
            GridViewFilterDrawerSection(
                id="price_display",
                label="Price display",
                filter_ids=("wholesale_price_columns",),
                panel="settings",
            ),
        ),
    )
    table = GridViewTable(
        id="life_grid",
        backend="ag_grid",
        columns=(GridViewColumn(id="title", label="Title", field="title"),),
        datasource=GridViewDataSource(endpoint="/life/rows/"),
        settings=("drawer",),
        extra={"filtersSelector": '[data-cm-filter-drawer][data-target="life_grid"]'},
    )
    spec = GridViewSpec(
        id="life_spec",
        blocks=(filters, table),
        layout=GridViewLayout(root=GridViewArea(id="root", blocks=("life_filters", "life_grid"))),
    )
    rendered = render_grid_view_spec(spec, (), host=InMemoryHost())
    toolbar_html = (
        '<div data-cm-toolbar-search-root data-cm-search-scope-id="life_scope"'
        ' data-cm-table-grid-id="life_grid">'
        '<input data-cm-toolbar-search data-cm-search-backend="ag_grid" name="q" value="">'
        '<button type="button" data-cm-grid-action="clearAllFilters" data-cm-grid-id="life_grid">'
        "Clear</button></div>"
    )
    prefix, closing = rendered.rsplit("</div>", 1)
    rendered_with_toolbar = f"{prefix}{toolbar_html}</div>{closing}"
    rendered_json = json.dumps(rendered_with_toolbar).replace("</script", "<\\/script")
    bundle_root = Path(__file__).resolve().parents[1] / "src/grid_view_spec/static/grid_view_spec"
    page = tmp_path / "life-hardening.html"
    page.write_text(
        "<!doctype html><html><body>"
        + rendered_with_toolbar
        + "<script>"
        + f"window.__specMarkup = {rendered_json};"
        + """
window.__requests = {facets: [], rows: []};
window.__initCount = 0;
window.fetch = async input => {
  const url = new URL(String(input), window.location.href);
  if (url.pathname.endsWith('/rows/')) {
    window.__requests.rows.push(url.search);
    return {ok: true, json: async () => ({data: [], lastRow: 0, totalCount: 0})};
  }
  window.__requests.facets.push(url.search);
  const doc = new DOMParser().parseFromString(window.__specMarkup, 'text/html');
  const colParam = url.searchParams.get('wholesale_price_columns');
  if (colParam) {
    doc.querySelectorAll('select[name="wholesale_price_columns"] option').forEach(opt => {
      opt.selected = opt.value === colParam;
      opt.toggleAttribute('selected', opt.selected);
    });
  }
  return {ok: true, text: async () => doc.documentElement.outerHTML};
};
</script>
"""
        + f'<script src="{(bundle_root / "gridviewspec.js").as_uri()}"></script>'
        + f'<script src="{(bundle_root / "gridviewspec-ag-grid.js").as_uri()}"></script>'
        + f'<script src="{(bundle_root / "gridviewspec-filter-workspace.js").as_uri()}"></script>'
        + r"""
<pre id="result"></pre>
<script>
window.addEventListener("load", async () => {
  try {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  GridView.bootScope(document);
  // Simulate second HTMX spec boot before window.agGrid finishes loading.
  const cfg = document.querySelector('script[data-cm-ag-grid-spec]');
  if (cfg) GridView.bootScope(document);
  await wait(80);
  window.agGrid = {
    createGrid(_el, options) {
      window.__initCount += 1;
      const requestRows = () => options.datasource?.getRows({
        startRow: 0, endRow: 25, successCallback() {}, failCallback() {},
      });
      window.setTimeout(requestRows, 0);
      return {
        addEventListener() {}, removeEventListener() {}, destroy() {},
        getFilterModel: () => null, setFilterModel() {},
        getColumnState: () => [], applyColumnState: () => true,
        getColumnDefs: () => options.columnDefs || [],
        getSelectedRows: () => [], forEachNode() {}, getDisplayedRowCount: () => 0,
        getGridOption: key => key === 'rowModelType' ? 'infinite' : undefined,
        setGridOption() {}, showLoadingOverlay() {}, hideOverlay() {},
        purgeInfiniteCache() { requestRows(); },
      };
    },
  };
  await wait(120);
  const initCountAfterAsyncLoad = window.__initCount;

  // Test workspace search + card search coordination
  const wsSearch = document.querySelector('[data-cm-filter-workspace-search]');
  const cardSearch = document.querySelector('[data-cm-filter-card-search]');
  wsSearch.value = 'alpha';
  wsSearch.dispatchEvent(new Event('input', { bubbles: true }));
  cardSearch.value = 'brand';
  cardSearch.dispatchEvent(new Event('input', { bubbles: true }));
  cardSearch.value = '';
  cardSearch.dispatchEvent(new Event('input', { bubbles: true }));
  const alphaHiddenAfterCardClear = document.querySelector(
    'input[value="alpha"]'
  ).closest('[data-cm-filter-option]').hidden;
  const betaHiddenAfterCardClear = document.querySelector(
    'input[value="beta"]'
  ).closest('[data-cm-filter-option]').hidden;
  wsSearch.value = '';
  wsSearch.dispatchEvent(new Event('input', { bubbles: true }));

  // Test ag_grid toolbar search triggers facet refresh and syncs input on popstate
  const searchInput = document.querySelector('[data-cm-toolbar-search]');
  const beforeFacets = window.__requests.facets.length;
  searchInput.value = 'lamp';
  searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await wait(120);
  const facetsAfterSearch = window.__requests.facets.length - beforeFacets;
  const specIdInHistory = history.state && history.state.cmFilterSpecId;
  history.back();
  await wait(120);
  const searchAfterBack = searchInput.value;
  const urlHasQAfterBack = new URLSearchParams(window.location.search).has('q');

  // Test Clear all preserves settings, cancels pending multiselect timers, clears brand/search
  const settingsSelect = document.querySelector('select[name="wholesale_price_columns"]');
  settingsSelect.value = 'col_b';
  settingsSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(80);
  const alphaCb = document.querySelector('[data-filter-param="brand"] input[value="alpha"]');
  alphaCb.checked = true;
  alphaCb.dispatchEvent(new Event('change', { bubbles: true }));
  const beforeClearFacets = window.__requests.facets.length;
  const beforeClearRows = window.__requests.rows.length;
  document.querySelector('[data-cm-grid-action="clearAllFilters"]').click();
  await wait(750);
  const facetsAfterClear = window.__requests.facets.length - beforeClearFacets;
  const rowsAfterClear = window.__requests.rows.length - beforeClearRows;

  document.getElementById('result').textContent = JSON.stringify({
    initCountAfterAsyncLoad,
    alphaHiddenAfterCardClear,
    betaHiddenAfterCardClear,
    facetsAfterSearch,
    specIdInHistory,
    searchAfterBack,
    urlHasQAfterBack,
    facetsAfterClear,
    rowsAfterClear,
    searchAfterClear: searchInput.value,
    brandCheckedAfterClear: alphaCb.checked,
    displaySettingPreserved: settingsSelect.value === 'col_b',
  });
  } catch (err) {
    const msg = String(err && err.stack ? err.stack : err);
    document.getElementById('result').textContent = JSON.stringify({ error: msg });
  }
});
</script>
</body></html>""",
        encoding="utf-8",
    )
    result = run_headless_chromium(chromium, page, tmp_path, virtual_time_budget=5000)
    assert result.returncode == 0, result.stderr
    match = re.search(r'<pre id="result">(.*?)</pre>', result.stdout, re.S)
    assert match is not None, result.stdout
    state = json.loads(html.unescape(match.group(1)))
    assert state == {
        "initCountAfterAsyncLoad": 1,
        "alphaHiddenAfterCardClear": False,
        "betaHiddenAfterCardClear": True,
        "facetsAfterSearch": 1,
        "specIdInHistory": "life_spec",
        "searchAfterBack": "",
        "urlHasQAfterBack": False,
        "facetsAfterClear": 1,
        "rowsAfterClear": 1,
        "searchAfterClear": "",
        "brandCheckedAfterClear": False,
        "displaySettingPreserved": True,
    }
