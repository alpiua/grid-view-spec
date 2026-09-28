import type { ChartBindDict, ChartRuntimeDict } from "../types/chart-bind";
import { num, uiLocale } from "./format";
import { i18n } from "./i18n";
import { resolveChartDataFromRuntime } from "./resolve-chart";
import type { ResolvedChartData } from "./resolve-chart";
import type { RowDict } from "./types";

const autoThemeCharts = new WeakMap<HTMLElement, { config: ChartRuntimeDict; rows: RowDict[] }>();
let autoThemeObserver: MutationObserver | null = null;

function currentChartTheme(theme: string | undefined): "dark" | "light" {
  if (theme === "light") return "light";
  if (theme === "auto" && typeof document !== "undefined") {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }
  return "dark";
}

function observeAutomaticChartThemes() {
  if (autoThemeObserver || typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  autoThemeObserver = new MutationObserver(() => {
    document.querySelectorAll<HTMLElement>("[data-cm-chart-root]").forEach((root) => {
      const entry = autoThemeCharts.get(root);
      if (!root._cmChartInstance || !entry) return;
      initChart(root, entry.config, entry.rows);
    });
  });
  autoThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

export function chartRowsHaveData(rows: RowDict[]) {
  if (!Array.isArray(rows) || !rows.length) return false;
  return rows.some(function (row) {
    if (!row || typeof row !== "object") return false;
    return Object.keys(row).some(function (key) {
      if (key === "name" || key === "label" || key === "color") return false;
      var n = num(row[key]);
      return n !== null && n !== 0;
    });
  });
}

export function setChartEmptyState(wrap: HTMLElement | null, isEmpty: boolean) {
  if (!wrap) return;
  var plates: HTMLElement[] | NodeListOf<HTMLElement> = wrap.querySelectorAll<HTMLElement>("[data-cm-chart-empty]");
  var roots: HTMLElement[] | NodeListOf<HTMLElement> = wrap.querySelectorAll<HTMLElement>("[data-cm-chart-root]");
  if (!plates.length && wrap.matches?.("[data-cm-chart-empty]")) {
    plates = [wrap];
  }
  if (!roots.length && wrap.matches?.("[data-cm-chart-root]")) {
    roots = [wrap];
  }
  plates.forEach((plate: HTMLElement) => {
    if (!plate.textContent.trim()) {
      plate.textContent = i18n.t("chart.empty", "Data not loaded");
    }
    plate.classList.toggle("is-hidden", !isEmpty);
    plate.hidden = !isEmpty;
    plate.style.display = isEmpty ? "" : "none";
  });
  roots.forEach((root: HTMLElement) => {
    root.classList.toggle("is-hidden", isEmpty);
    root.hidden = isEmpty;
    root.style.visibility = isEmpty ? "hidden" : "";
  });
  if (isEmpty) {
    const firstRoot = roots[0];
    var inst = wrap._cmChartInstance || (firstRoot && firstRoot._cmChartInstance);
    if (inst) {
      try {
        inst.dispose();
      } catch (e) {
        /* ignore */
      }
    }
    wrap._cmChartInstance = null;
    roots.forEach((root: HTMLElement) => {
      root._cmChartInstance = null;
    });
    delete wrap.dataset.cmChartReady;
  }
}

export { num, uiLocale } from "./format";
interface ChartTooltipParam {
  dataIndex?: number;
  name?: string;
}
export function packagesTooltip(params: ChartTooltipParam[], dataRows: RowDict[]): string {
  const pkg = dataRows[params[0]?.dataIndex ?? -1];
  if (!pkg || !params[0]) return params[0]?.name ?? "";
  const included = i18n.t("chart.packages.included", "Included");
  const rejected = i18n.t("chart.packages.rejected", "Rejected");
  const tariff = i18n.t("chart.packages.tariff", "Tariff");
  const lossLabel = i18n.t("chart.packages.loss", "Loss");
  let tip = "<b>" + params[0].name + "</b><br/>" + included + ": <span style=\"color:#4ade80;font-weight:700;\">" +
    (pkg.included ?? 0) + "</span><br/>" + rejected + ": <span style=\"color:#f87171;font-weight:700;\">" +
    (pkg.rejected ?? 0) + "</span><br/>" + tariff + ": " + (pkg.tariff_fmt ?? pkg.tariff ?? 0);
  const loss = num(pkg.rejected_tariff);
  if (loss !== null && loss > 0) {
    tip += "<br/>" + lossLabel + ": <span style=\"color:#f87171;font-weight:700;\">−" +
      (pkg.rejected_tariff_fmt ?? pkg.rejected_tariff) + "</span>";
  }
  return tip;
}

function buildPieOption(
  config: ChartRuntimeDict,
  resolved: ResolvedChartData,
  bind: ChartBindDict,
  chartType: string | undefined,
  isDark: boolean,
  isNarrow: boolean,
) {
  const data = resolved.slices.map((slice) => {
    const item: { name: string; value: number; itemStyle?: { color: string } } = {
      name: slice.label,
      value: slice.value,
    };
    if (slice.color) item.itemStyle = { color: slice.color };
    return item;
  });
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
  const overlay = resolved.overlay ?? config.overlay;
  const textColor = isDark ? "#cbd5e1" : "#475569";
  const mutedColor = isDark ? "#94a3b8" : "#64748b";
  const surfaceColor = isDark ? "#1e293b" : "#ffffff";
  const title = config.title
    ? { text: config.title, left: 12, top: 8, textStyle: { color: mutedColor, fontSize: 12, fontWeight: "600" } }
    : undefined;
  if (bind.pieVariant === "center-total") {
    const overlayColor = overlay
      ? (overlay.tone === "purple" ? "#9333ea" : overlay.tone === "red" ? "#ef4444" : overlay.tone === "green" ? "#10b981" : "#94a3b8")
      : (isDark ? "#e2e8f0" : "#1e293b");
    const centerValue = overlay ? overlay.value : String(total);
    const centerLabel = overlay ? overlay.title : "";
    return {
      backgroundColor: "transparent",
      title,
      tooltip: {
        trigger: "item",
        backgroundColor: isDark ? "rgba(30,41,59,.95)" : "rgba(255,255,255,.98)",
        borderColor: isDark ? "rgba(51,65,85,.6)" : "#cbd5e1",
        textStyle: { color: textColor, fontSize: 11 },
        confine: true,
        formatter: (params: { name: string; value: number; percent: number }) =>
          `${params.name}: ${params.value} (${params.percent.toFixed(1)}%)`,
      },
      graphic: [
        ...(centerLabel ? [{
          type: "text",
          left: "center",
          top: "42%",
          style: { text: centerLabel, fill: mutedColor, fontSize: 10, textAlign: "center" },
        }] : []),
        {
          type: "text",
          left: "center",
          top: centerLabel ? "50%" : "center",
          style: { text: centerValue, fill: overlayColor, fontSize: 19, fontWeight: "bold", textAlign: "center" },
        },
      ],
      series: [
        {
          type: "pie",
          radius: ["53%", "88%"],
          center: ["50%", "50%"],
          itemStyle: { borderColor: surfaceColor, borderWidth: 2 },
          data,
          label: {
            show: true,
            position: "inner",
            formatter: "{d}%",
            color: "#ffffff",
            fontSize: 11,
            fontWeight: "bold",
          },
          labelLine: { show: false },
          emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.3)" } },
          animationType: "scale",
          animationEasing: "elasticOut",
        },
      ],
    };
  }
  const pieSeries: {
    type: string;
    radius: string | string[];
    center: string[];
    avoidLabelOverlap: boolean;
    itemStyle: { borderRadius: number; borderColor: string; borderWidth: number };
    labelLine: { show: boolean };
    data: Array<{ name: string; value: number; itemStyle?: { color: string } }>;
    label?: {
      show: boolean;
      position: string;
      formatter: string | (() => string);
      fontSize: number;
      fontWeight: string;
      lineHeight: number;
      color: string;
    };
  } = {
    type: "pie",
    radius: chartType === "donut" ? ["48%", "70%"] : "65%",
    center: ["50%", "48%"],
    avoidLabelOverlap: true,
    itemStyle: { borderRadius: 4, borderColor: surfaceColor, borderWidth: 2 },
    labelLine: { show: !isNarrow },
    data,
    label: {
      show: !isNarrow,
      position: "outside",
      formatter: "{b}",
      fontSize: 11,
      fontWeight: "normal",
      lineHeight: 14,
      color: textColor,
    },
  };
  if (overlay) {
    const tone = overlay.tone === "green" ? "#10b981" : overlay.tone === "red" ? "#ef4444" : "#94a3b8";
    pieSeries.label = {
      show: true,
      position: "center",
      formatter: () => `${overlay.title}

${overlay.value}`,
      fontSize: 14,
      fontWeight: "bold",
      lineHeight: 18,
      color: tone,
    };
  }
  return {
    backgroundColor: "transparent",
    title,
    tooltip: {
      trigger: "item",
      formatter: "{b}: <b>{c}</b> ({d}%)",
      backgroundColor: isDark ? "rgba(30, 41, 59, 0.9)" : "rgba(255,255,255,.98)",
      borderColor: isDark ? "#475569" : "#cbd5e1",
      textStyle: { color: textColor },
    },
    legend: { bottom: "0%", left: "center", textStyle: { color: mutedColor, fontSize: 11 } },
    series: [pieSeries],
  };
}

function axisValueFormatter(
  format: string | undefined,
  symbol: string | undefined,
): (value: number) => string {
  const fmt = format ?? "number";
  const localized = (value: number) => value.toLocaleString("uk-UA");
  if (fmt === "percent") {
    return (value: number) => `${localized(value)}%`;
  }
  if (fmt === "symbol") {
    const tail = symbol ?? "";
    return (value: number) => `${localized(value)}${tail}`;
  }
  return localized;
}

function buildBarOptionFromResolved(
  config: ChartRuntimeDict,
  resolved: ResolvedChartData,
  bind: ChartBindDict,
  chartType: string | undefined,
  isDark: boolean,
  dataRows: RowDict[],
) {
  const seriesDefs = bind.series ?? [];
  const defaultType = chartType === "line" ? "line" : "bar";
  const horizontal = bind.orientation === "horizontal";
  const stacked = bind.stacked === true;
  const categories = resolved.categories;
  const title = config.title
    ? { text: config.title, left: 12, top: 8, textStyle: { color: isDark ? "#e2e8f0" : "#172033", fontSize: 12, fontWeight: "600" } }
    : undefined;
  const titleOffset = config.title ? 24 : 0;
  const valueAxisLabel = {
    formatter: axisValueFormatter(bind.yAxisFormat, bind.yAxisSymbol),
    color: isDark ? "#94a3b8" : "#64748b",
    fontSize: 10,
  };
  const series = resolved.series.map((point, idx) => {
    const seriesDef = seriesDefs[idx] ?? {};
    const type = seriesDef.seriesType ?? defaultType;
    const color = point.color ?? seriesDef.color;
    const payload: {
      name: string;
      type: string;
      data: number[];
      stack?: string;
      itemStyle?: { color?: string | null; borderRadius?: number | number[] };
      symbol?: string;
      symbolSize?: number;
      lineStyle?: { width: number; color?: string | null };
    } = {
      name: point.name,
      type,
      data: point.values,
    };
    if (stacked) payload.stack = "total";
    if (type === "bar") {
      const radius = horizontal ? [0, 3, 3, 0] : [2, 2, 0, 0];
      if (stacked && idx === resolved.series.length - 1) {
        payload.itemStyle = { color, borderRadius: radius };
      } else {
        payload.itemStyle = { color, borderRadius: stacked ? 0 : radius };
      }
    } else {
      payload.symbol = "circle";
      payload.symbolSize = 6;
      payload.lineStyle = { width: 2, color: color ?? "#3b82f6" };
      payload.itemStyle = { color: color ?? "#3b82f6" };
    }
    return payload;
  });
  const tooltip: {
    trigger: string;
    axisPointer: { type: string };
    formatter?: (params: ChartTooltipParam[]) => string;
  } = { trigger: "axis", axisPointer: { type: "shadow" } };
  if (bind.tooltipKind === "packages") {
    tooltip.formatter = (params) => packagesTooltip(params, dataRows);
  }
  if (horizontal) {
    return {
      backgroundColor: "transparent",
      title,
      tooltip,
      legend: { top: titleOffset, textStyle: { color: isDark ? "#94a3b8" : "#64748b", fontSize: 11 } },
      grid: { left: 10, right: 30, top: 30 + titleOffset, bottom: 5, containLabel: true },
      xAxis: {
        type: "value",
        axisLabel: valueAxisLabel,
        splitLine: { lineStyle: { color: isDark ? "#1e293b" : "#e2e8f0" } },
      },
      yAxis: {
        type: "category",
        data: categories,
        axisLabel: {
          color: isDark ? "#94a3b8" : "#64748b",
          fontSize: 10,
          width: 200,
          overflow: "truncate",
          ellipsis: "\u2026",
        },
        axisLine: { lineStyle: { color: isDark ? "#334155" : "#cbd5e1" } },
      },
      series,
    };
  }
  return {
    backgroundColor: "transparent",
    title,
    tooltip,
    legend: { top: 8 + titleOffset, textStyle: { color: isDark ? "#94a3b8" : "#64748b", fontSize: 11 } },
    grid: { left: "2%", right: "2%", top: 36 + titleOffset, bottom: "15%", containLabel: true },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: {
        rotate: 30,
        fontSize: 10,
        color: isDark ? "#94a3b8" : "#64748b",
        interval: 0,
        width: 90,
        overflow: "truncate",
      },
      axisLine: { lineStyle: { color: isDark ? "#334155" : "#cbd5e1" } },
    },
    yAxis: {
      type: "value",
      axisLabel: valueAxisLabel,
      splitLine: { lineStyle: { color: isDark ? "#1e293b" : "#e2e8f0" } },
    },
    series,
  };
}

export function buildEchartsOption(config: ChartRuntimeDict, rows: RowDict[], isNarrow = false) {
  const bind = config.bind ?? {};
  const chartType = config.chartType;
  const theme = currentChartTheme(config.echartsTheme);
  const isDark = theme === "dark";
  const resolved = resolveChartDataFromRuntime(config, rows);

  if (chartType === "pie" || chartType === "donut") {
    return buildPieOption(config, resolved, bind, chartType, isDark, isNarrow);
  }
  return buildBarOptionFromResolved(config, resolved, bind, chartType, isDark, rows);
}

export function initChart(root: Element, config: ChartRuntimeDict, rows: RowDict[]) {
  if (!root) return null;
  var wrap = root.closest<HTMLElement>("[data-cm-chart-config], .cm-chart-wrap") || root.parentElement;
  var rowList = Array.isArray(rows) ? rows : [];
  if (!chartRowsHaveData(rowList)) {
    setChartEmptyState(wrap, true);
    return null;
  }
  setChartEmptyState(wrap, false);
  if (typeof window.echarts === "undefined") return null;
  const chartRoot = root as HTMLElement;
  if (chartRoot._cmChartInstance) {
    try {
      chartRoot._cmChartInstance.dispose();
    } catch {
    }
    chartRoot._cmChartInstance = null;
  }
  const theme = currentChartTheme(config.echartsTheme);
  chartRoot._cmChartInstance = null;
  const isNarrow = chartRoot.clientWidth < 420;
  const initTheme = config.echartsTheme === "auto"
    ? (theme === "dark" ? "dark" : undefined)
    : (config.echartsTheme ?? "dark");
  const chart = window.echarts.init(root, initTheme);
  chart.setOption(buildEchartsOption(config, rowList, isNarrow), true);
  chartRoot._cmChartInstance = chart;
  if (config.echartsTheme === "auto") {
    autoThemeCharts.set(chartRoot, { config, rows: rowList });
    observeAutomaticChartThemes();
  } else {
    autoThemeCharts.delete(chartRoot);
  }
  if (wrap) wrap._cmChartInstance = chart;
  return chart;
}
export function refreshChartWrap(wrap: Element, config: ChartRuntimeDict, rows: RowDict[]) {
  if (!wrap) return null;
  if (!(wrap instanceof HTMLElement)) return null;
  const chartRoot = wrap.querySelector("[data-cm-chart-root]") ?? wrap;
  const rowList = Array.isArray(rows) ? rows : [];
  wrap.dataset.cmChartRows = JSON.stringify(rowList);
  if (!chartRowsHaveData(rowList)) {
    setChartEmptyState(wrap, true);
    return null;
  }
  const runtimeConfig = Object.assign({}, config, {
    bind: Object.assign({}, config.bind || {}, { rows: rowList }),
  });
  const instance = initChart(chartRoot, runtimeConfig, rowList);
  if (!instance) return null;
  wrap.dataset.cmChartReady = "1";
  wrap._cmChartInstance = instance;
  return instance;
}
export function initAllCharts(scope?: Document | Element) {
  const root = scope ?? document;
  root.querySelectorAll<HTMLElement>("[data-cm-chart-config]").forEach((node) => {
    if (node.dataset.cmChartInteractive) return;
    if (node.dataset.cmChartReady && node._cmChartInstance) {
      node._cmChartInstance?.resize();
      return;
    }
    if (node.dataset.cmChartReady) return;
    const config = JSON.parse(node.dataset.cmChartConfig ?? "{}");
    if (config.dataSource === "grid_filtered") return;
    const rows = node.hasAttribute("data-cm-chart-rows")
      ? JSON.parse(node.dataset.cmChartRows ?? "[]")
      : (config.bind?.rows ?? []);
    const chartRoot = node.querySelector("[data-cm-chart-root]") ?? node;
    const instance = initChart(chartRoot, config, rows);
    if (!instance) return;
    node.dataset.cmChartReady = "1";
    node._cmChartInstance = instance;
    if (typeof ResizeObserver !== "undefined") {
      let narrow = (chartRoot as HTMLElement).clientWidth < 420;
      const ro = new ResizeObserver(() => {
        const activeInstance = (chartRoot as HTMLElement)._cmChartInstance;
        activeInstance?.resize();
        const nextNarrow = (chartRoot as HTMLElement).clientWidth < 420;
        if (nextNarrow !== narrow) {
          narrow = nextNarrow;
          activeInstance?.setOption(buildEchartsOption(config, rows, narrow), true);
        }
      });
      ro.observe(chartRoot);
    }
    if (!window.__cmChartResizeAttached) {
      window.__cmChartResizeAttached = true;
      window.addEventListener("resize", () => {
        document.querySelectorAll("[data-cm-chart-ready='1']").forEach((el) => {
          el._cmChartInstance?.resize();
        });
      });
    }
  });
}
export const Charts = {
  buildEchartsOption,
  initChart,
  refreshChartWrap,
  initAllCharts,
  resolveChartData: resolveChartDataFromRuntime,
};
