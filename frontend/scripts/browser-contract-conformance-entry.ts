import { bindDelegatedGridActions } from "../src/grid-view/actions";
import { initAllCharts } from "../src/grid-view/charts";
import { init } from "../src/grid-view/init";
import { createDomTableColumnAdapter } from "../src/column-settings/dom-table-adapter";

Object.assign(window, {
  GridViewSpecContract: {
    bindDelegatedGridActions,
    init,
    initAllCharts,
    createDomTableColumnAdapter,
  },
});
