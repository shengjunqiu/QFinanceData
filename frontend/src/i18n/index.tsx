import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { AssetType, DataStatus, DataType, FetchJobItemStatus, FetchJobStatus, FetchJobType } from "../api/types";

export type Locale = "en" | "zh";

const LOCALE_STORAGE_KEY = "qfd.locale";

const en = {
  common: {
    add: "Add",
    adding: "Adding",
    all: "All",
    cancel: "Cancel",
    change: "Change",
    created: "Created",
    currency: "Currency",
    dataFreshnessByType: "Data freshness by type",
    enabled: "Enabled",
    error: "Error",
    exporting: "Exporting",
    exportCsv: "Export CSV",
    failed: "Failed",
    group: "Group",
    language: "Language",
    lastUpdate: "Last Update",
    loading: "Loading",
    never: "Never",
    polling: "Polling",
    refresh: "Refresh",
    refreshing: "Refreshing",
    remove: "Remove",
    reset: "Reset",
    save: "Save",
    searchTicker: "Search ticker",
    select: "Select",
    status: "Status",
    symbol: "Symbol",
    symbols: "Symbols",
    time: "Time",
    timeRange: "Time range",
    type: "Type",
    unknownRequestError: "The request could not be completed.",
    updatePrices: "Update Prices",
    updated: "Updated",
    dataTypeLabels: {
      prices: "Prices",
      metadata: "Metadata",
      fundamentals: "Fundamentals",
      actions: "Actions"
    },
    statusLabels: {
      fresh: "Fresh",
      stale: "Stale",
      missing: "Missing",
      failed: "Failed",
      partial: "Partial"
    },
    assetTypeLabels: {
      equity: "Equity",
      etf: "ETF",
      index: "Index"
    },
    jobTypeLabels: {
      prices: "Prices",
      fundamentals: "Fundamentals",
      actions: "Actions",
      metadata: "Metadata"
    },
    jobStatusLabels: {
      queued: "Queued",
      running: "Running",
      success: "Success",
      partial_success: "Partial",
      failed: "Failed",
      cancelled: "Cancelled",
      skipped: "Skipped"
    }
  },
  nav: {
    dashboard: "Dashboard",
    jobs: "Jobs",
    primaryNavigation: "Primary navigation",
    settings: "Settings",
    tagline: "Local market data",
    watchlist: "Watchlist"
  },
  dashboard: {
    dashboard: "Dashboard",
    dataFreshness: "Data Freshness",
    equalWeightReturn: "Equal weight return",
    fetchingDashboard: "Fetching symbols, prices, data status and recent jobs.",
    gainers: "Gainers",
    last: "Last",
    loadingDashboard: "Loading dashboard",
    losers: "Losers",
    manage: "Manage",
    marketOverview: "Market Overview",
    marketSummaryLabel: "Market summary",
    noFetchJobsDescription: "Start a job from the Jobs page to update prices.",
    noFetchJobsTitle: "No fetch jobs yet",
    noMovers: "No movers to show.",
    noSymbolsDescription: "Add a ticker in Watchlist to start building the dashboard.",
    noSymbolsTitle: "No symbols yet",
    noTrendDataDescription: "Run a price fetch job to populate watchlist history.",
    noTrendDataTitle: "No trend data",
    notUpdatedYet: "Not updated yet",
    openJobs: "Open Jobs",
    overviewFallbackError: "The overview data could not be loaded.",
    overviewUnavailable: "Dashboard unavailable",
    recentFetchJobs: "Recent Fetch Jobs",
    review: "Review",
    topMovers: "Top Movers",
    watchlistOverviewLabel: "Watchlist overview",
    watchlistTrend: "Watchlist Trend"
  },
  watchlist: {
    addTicker: "Add ticker",
    addTickerPlaceholder: "Add ticker...",
    alreadyInWatchlist: "is already in the watchlist.",
    emptyGroupDescription: "Add a ticker or switch to another group.",
    emptyGroupTitle: "No symbols in this group",
    enabledMessage: "enabled.",
    enterTicker: "Enter a ticker before adding it.",
    disabledMessage: "disabled.",
    exportEmpty: "No symbols are available to export for the current view.",
    exportedPrefix: "Exported",
    fetchingSymbols: "Fetching symbols from the local data store.",
    groupNameEmpty: "Group name cannot be empty.",
    headerEyebrow: "Symbol Management",
    loadingTitle: "Loading watchlist",
    managementLabel: "Watchlist management",
    movedTo: "moved to",
    pendingMetadata: "Pending metadata",
    removedSuffix: "removed from Watchlist. Historical data is not deleted.",
    selectAtLeastOne: "Select at least one ticker before starting an update.",
    selectVisibleSymbols: "Select visible symbols",
    shown: "shown",
    tickerAddedSuffix: "added. Run an update to fetch price data.",
    updateSelected: "Update Selected",
    queueing: "Queueing",
    queuedPricePrefix: "Queued price update for",
    selected: "selected",
    title: "Watchlist",
    unavailableTitle: "Watchlist unavailable",
    watchlistControls: "Watchlist controls",
    watchlistGroups: "Watchlist groups"
  },
  jobs: {
    active: "active",
    createFetchJobs: "Create fetch jobs",
    enabledSymbols: "enabled symbols",
    fetchOperations: "Fetch Operations",
    finishedMessage: "Fetch jobs finished. Dashboard and detail data refreshed.",
    history: "History",
    historyLabel: "Job history",
    jobDetail: "Job Detail",
    jobQueue: "Job Queue",
    jobStatusFilter: "Job status filter",
    loadingDescription: "Fetching recent fetch jobs and enabled symbols.",
    loadingTitle: "Loading jobs",
    noActiveDescription: "Start a fetch job to see progress.",
    noActiveTitle: "No active jobs",
    noEnabledTickerPrefix: "Add at least one enabled ticker before starting",
    noFailedItems: "No failed items to retry for this job.",
    noItemDescription: "This job has not produced item-level status yet.",
    noItemTitle: "No item detail",
    noJobSelectedDescription: "Start a price update to inspect item-level status.",
    noJobSelectedTitle: "No job selected",
    noJobsFoundDescription: "No fetch jobs match this status filter.",
    noJobsFoundTitle: "No jobs found",
    progress: "Progress",
    queueingActions: "Queueing Actions",
    queueingFundamentals: "Queueing Fundamentals",
    queueingPrices: "Queueing Prices",
    queuedUpdatePrefix: "Queued",
    retryFailed: "Retry Failed",
    retryUnavailablePrefix: "Retry is not available for",
    retryUnavailableSuffix: "jobs yet.",
    title: "Jobs",
    updateActions: "Update Actions",
    updateFundamentals: "Update Fundamentals",
    updatePrices: "Update Prices",
    unavailableTitle: "Jobs unavailable",
    waiting: "Waiting"
  },
  settings: {
    adjusted: "Adjusted",
    adjustedPrice: "Adjusted price",
    chartsAndFirstFetch: "Charts and first fetch",
    currentLocalState: "Current local state",
    dataStaleThreshold: "Data stale threshold",
    defaultDataView: "Default Data View",
    defaultPriceBasis: "Default price basis",
    defaultPriceBasisDescription: "Controls whether charts prefer adjusted or raw prices.",
    defaultTimeRange: "Default time range",
    defaultTimeRangeDescription: "Used by charts and price queries when no range is selected.",
    defaultUpdateStart: "Default update start",
    defaultUpdateStartDescription: "Used for the first historical price update.",
    displayAndFreshness: "Display and Freshness",
    downColor: "Down Color",
    green: "Green",
    localPreferences: "Local preferences",
    preferences: "Preferences",
    preview: "Preview",
    priceBasis: "Price Basis",
    range: "Range",
    raw: "Raw",
    rawOhlc: "Raw OHLC",
    red: "Red",
    savedAt: "Settings saved at",
    staleAfter: "Stale After",
    staleThresholdDescription: "A symbol is stale after this many trading days without fresh data.",
    startDate: "Start Date",
    title: "Settings",
    tradingDays: "trading days",
    upColor: "Up Color",
    upDownColorMode: "Up and down color mode",
    upDownColors: "Up / down colors",
    upDownColorsDescription: "Switch between US and A-share/HK-style market color conventions."
  },
  symbolDetail: {
    corporateActions: "Corporate Actions",
    dataStatus: "Data Status",
    dataThrough: "Data through",
    dividend: "Dividend",
    events: "events",
    eventsUnavailable: "Events unavailable",
    exportedPriceData: "price data exported.",
    exportPriceData: "Export",
    financialSummary: "Financial Summary",
    keyMetrics: "Key Metrics",
    latestPriceUpdateFailed: "Latest price update failed",
    loadingEvents: "Loading events",
    loadingEventsDescription: "Fetching dividends and split history.",
    loadingLatestPrice: "Loading latest price",
    loadingMetrics: "Loading metrics",
    loadingMetricsDescription: "Fetching local fundamentals snapshot.",
    loadingPriceData: "Loading price data",
    loadingPriceDataDescription: "Fetching local price bars for this range.",
    loadingSummary: "Loading summary",
    loadingSummaryDescription: "Fetching latest financial statement facts.",
    loadingSymbol: "Loading symbol",
    loadingSymbolDescription: "Fetching symbol profile and local price data.",
    metricsUnavailable: "Metrics unavailable",
    missingFields: "Missing fields",
    noEvents: "No events",
    noEventsDescription: "No dividends or splits are available in local data for this symbol.",
    noLocalData: "No local data",
    noPriceData: "No price data",
    noPriceDataDescription: "Run a price update to populate this chart.",
    noPriceDataForRange: "No price data is available for the selected range.",
    notFetched: "Not fetched",
    openWatchlist: "Open Watchlist",
    priceChart: "Price Chart",
    priceDataUnavailable: "Price data unavailable",
    queuedPriceRefresh: "Queued price refresh for",
    split: "Split",
    statusUnavailable: "Status unavailable",
    summaryUnavailable: "Summary unavailable",
    symbolNotFound: "Symbol not found",
    symbolNotFoundDescription: "The ticker is not in the watchlist yet.",
    symbolUnavailable: "Symbol unavailable",
    unnamedSymbol: "Unnamed symbol",
    unknownExchange: "Unknown exchange",
    volume: "Volume",
    metricLabels: {
      marketCap: "Market Cap",
      trailingPe: "Trailing PE",
      priceToBook: "Price / Book",
      dividendYield: "Dividend Yield",
      fiftyTwoWeekHigh: "52W High",
      fiftyTwoWeekLow: "52W Low",
      revenue: "Revenue",
      netIncome: "Net Income",
      freeCashFlow: "Free Cash Flow",
      debtRatio: "Debt Ratio"
    },
    fieldLabels: {
      market_cap: "Market Cap",
      trailing_pe: "Trailing PE",
      price_to_book: "Price / Book",
      dividend_yield: "Dividend Yield",
      fifty_two_week_high: "52W High",
      fifty_two_week_low: "52W Low",
      revenue: "Revenue",
      net_income: "Net Income",
      free_cash_flow: "Free Cash Flow",
      debt_ratio: "Debt Ratio"
    },
    chartSeries: {
      ohlc: "OHLC",
      adjClose: "Adj Close",
      equalWeightReturn: "Equal weight return"
    }
  }
};

const zh: typeof en = {
  common: {
    add: "添加",
    adding: "添加中",
    all: "全部",
    cancel: "取消",
    change: "涨跌",
    created: "创建时间",
    currency: "币种",
    dataFreshnessByType: "按数据类型查看新鲜度",
    enabled: "启用",
    error: "错误",
    exporting: "导出中",
    exportCsv: "导出 CSV",
    failed: "失败",
    group: "分组",
    language: "语言",
    lastUpdate: "最近更新",
    loading: "加载中",
    never: "从未",
    polling: "轮询中",
    refresh: "刷新",
    refreshing: "刷新中",
    remove: "移除",
    reset: "重置",
    save: "保存",
    searchTicker: "搜索 ticker",
    select: "选择",
    status: "状态",
    symbol: "标的",
    symbols: "标的",
    time: "时间",
    timeRange: "时间范围",
    type: "类型",
    unknownRequestError: "请求未能完成。",
    updatePrices: "更新价格",
    updated: "更新于",
    dataTypeLabels: {
      prices: "价格",
      metadata: "基础信息",
      fundamentals: "基本面",
      actions: "公司行动"
    },
    statusLabels: {
      fresh: "新鲜",
      stale: "过期",
      missing: "缺失",
      failed: "失败",
      partial: "部分"
    },
    assetTypeLabels: {
      equity: "股票",
      etf: "ETF",
      index: "指数"
    },
    jobTypeLabels: {
      prices: "价格",
      fundamentals: "基本面",
      actions: "公司行动",
      metadata: "基础信息"
    },
    jobStatusLabels: {
      queued: "排队中",
      running: "运行中",
      success: "成功",
      partial_success: "部分成功",
      failed: "失败",
      cancelled: "已取消",
      skipped: "已跳过"
    }
  },
  nav: {
    dashboard: "首页",
    jobs: "任务",
    primaryNavigation: "主导航",
    settings: "设置",
    tagline: "本地市场数据",
    watchlist: "自选列表"
  },
  dashboard: {
    dashboard: "首页",
    dataFreshness: "数据新鲜度",
    equalWeightReturn: "等权收益",
    fetchingDashboard: "正在获取标的、价格、数据状态和最近任务。",
    gainers: "上涨",
    last: "最新价",
    loadingDashboard: "正在加载首页",
    losers: "下跌",
    manage: "管理",
    marketOverview: "市场概览",
    marketSummaryLabel: "市场摘要",
    noFetchJobsDescription: "从任务页启动更新任务后，这里会显示最近记录。",
    noFetchJobsTitle: "暂无抓取任务",
    noMovers: "暂无异动标的。",
    noSymbolsDescription: "请先在自选列表添加 ticker，然后开始构建首页。",
    noSymbolsTitle: "暂无自选标的",
    noTrendDataDescription: "运行价格抓取任务后即可生成自选趋势。",
    noTrendDataTitle: "暂无趋势数据",
    notUpdatedYet: "尚未更新",
    openJobs: "打开任务",
    overviewFallbackError: "首页数据无法加载。",
    overviewUnavailable: "首页不可用",
    recentFetchJobs: "最近抓取任务",
    review: "查看",
    topMovers: "涨跌幅排行",
    watchlistOverviewLabel: "自选列表概览",
    watchlistTrend: "自选趋势"
  },
  watchlist: {
    addTicker: "添加 ticker",
    addTickerPlaceholder: "添加 ticker...",
    alreadyInWatchlist: "已经在自选列表中。",
    emptyGroupDescription: "添加 ticker，或切换到其他分组。",
    emptyGroupTitle: "该分组暂无标的",
    enabledMessage: "已启用。",
    enterTicker: "添加前请输入 ticker。",
    disabledMessage: "已停用。",
    exportEmpty: "当前视图没有可导出的标的。",
    exportedPrefix: "已导出",
    fetchingSymbols: "正在从本地数据仓库获取标的。",
    groupNameEmpty: "分组名称不能为空。",
    headerEyebrow: "标的管理",
    loadingTitle: "正在加载自选列表",
    managementLabel: "自选列表管理",
    movedTo: "已移动到",
    pendingMetadata: "等待基础信息",
    removedSuffix: "已从自选列表移除。历史数据不会删除。",
    selectAtLeastOne: "请至少选择一个 ticker 再开始更新。",
    selectVisibleSymbols: "选择当前可见标的",
    shown: "显示",
    tickerAddedSuffix: "已添加。运行更新即可抓取价格数据。",
    updateSelected: "更新已选",
    queueing: "排队中",
    queuedPricePrefix: "已创建价格更新任务：",
    selected: "已选",
    title: "自选列表",
    unavailableTitle: "自选列表不可用",
    watchlistControls: "自选列表控制区",
    watchlistGroups: "自选列表分组"
  },
  jobs: {
    active: "活跃",
    createFetchJobs: "创建抓取任务",
    enabledSymbols: "个启用标的",
    fetchOperations: "抓取任务",
    finishedMessage: "抓取任务已完成，首页和详情数据已刷新。",
    history: "历史记录",
    historyLabel: "任务历史",
    jobDetail: "任务详情",
    jobQueue: "任务队列",
    jobStatusFilter: "任务状态筛选",
    loadingDescription: "正在获取最近抓取任务和启用标的。",
    loadingTitle: "正在加载任务",
    noActiveDescription: "启动抓取任务后，这里会显示进度。",
    noActiveTitle: "暂无活跃任务",
    noEnabledTickerPrefix: "启动更新前请至少添加一个启用的 ticker：",
    noFailedItems: "该任务没有可重试的失败项。",
    noItemDescription: "该任务尚未产生逐项状态。",
    noItemTitle: "暂无条目详情",
    noJobSelectedDescription: "启动价格更新后可查看逐项状态。",
    noJobSelectedTitle: "暂无选中任务",
    noJobsFoundDescription: "没有匹配当前状态筛选的抓取任务。",
    noJobsFoundTitle: "未找到任务",
    progress: "进度",
    queueingActions: "公司行动排队中",
    queueingFundamentals: "基本面排队中",
    queueingPrices: "价格排队中",
    queuedUpdatePrefix: "已创建",
    retryFailed: "重试失败项",
    retryUnavailablePrefix: "暂不支持重试",
    retryUnavailableSuffix: "任务。",
    title: "任务",
    updateActions: "更新公司行动",
    updateFundamentals: "更新基本面",
    updatePrices: "更新价格",
    unavailableTitle: "任务不可用",
    waiting: "等待中"
  },
  settings: {
    adjusted: "复权",
    adjustedPrice: "复权价格",
    chartsAndFirstFetch: "图表与首次抓取",
    currentLocalState: "当前本地状态",
    dataStaleThreshold: "数据过期阈值",
    defaultDataView: "默认数据视图",
    defaultPriceBasis: "默认价格口径",
    defaultPriceBasisDescription: "控制图表优先使用复权价还是原始价格。",
    defaultTimeRange: "默认时间范围",
    defaultTimeRangeDescription: "当未选择范围时，图表和价格查询会使用该设置。",
    defaultUpdateStart: "默认更新起始日",
    defaultUpdateStartDescription: "用于首次历史价格更新。",
    displayAndFreshness: "显示与新鲜度",
    downColor: "下跌颜色",
    green: "绿色",
    localPreferences: "本地偏好",
    preferences: "偏好",
    preview: "预览",
    priceBasis: "价格口径",
    range: "范围",
    raw: "原始",
    rawOhlc: "原始 OHLC",
    red: "红色",
    savedAt: "设置保存于",
    staleAfter: "过期时间",
    staleThresholdDescription: "如果标的连续这么多个交易日没有新数据，则视为过期。",
    startDate: "起始日期",
    title: "设置",
    tradingDays: "个交易日",
    upColor: "上涨颜色",
    upDownColorMode: "涨跌颜色模式",
    upDownColors: "涨跌颜色",
    upDownColorsDescription: "在美股与 A 股/港股市场颜色习惯之间切换。"
  },
  symbolDetail: {
    corporateActions: "公司行动",
    dataStatus: "数据状态",
    dataThrough: "数据截至",
    dividend: "分红",
    events: "个事件",
    eventsUnavailable: "事件不可用",
    exportedPriceData: "价格数据已导出。",
    exportPriceData: "导出",
    financialSummary: "财务摘要",
    keyMetrics: "关键指标",
    latestPriceUpdateFailed: "最近价格更新失败",
    loadingEvents: "正在加载事件",
    loadingEventsDescription: "正在获取分红和拆股历史。",
    loadingLatestPrice: "正在加载最新价格",
    loadingMetrics: "正在加载指标",
    loadingMetricsDescription: "正在获取本地基本面快照。",
    loadingPriceData: "正在加载价格数据",
    loadingPriceDataDescription: "正在获取当前范围的本地价格条。",
    loadingSummary: "正在加载摘要",
    loadingSummaryDescription: "正在获取最新财务报表事实。",
    loadingSymbol: "正在加载标的",
    loadingSymbolDescription: "正在获取标的资料和本地价格数据。",
    metricsUnavailable: "指标不可用",
    missingFields: "缺失字段",
    noEvents: "暂无事件",
    noEventsDescription: "本地数据中没有该标的的分红或拆股记录。",
    noLocalData: "暂无本地数据",
    noPriceData: "暂无价格数据",
    noPriceDataDescription: "运行价格更新后即可填充图表。",
    noPriceDataForRange: "当前选择范围没有可用价格数据。",
    notFetched: "尚未抓取",
    openWatchlist: "打开自选列表",
    priceChart: "价格图表",
    priceDataUnavailable: "价格数据不可用",
    queuedPriceRefresh: "已创建价格刷新任务：",
    split: "拆股",
    statusUnavailable: "状态不可用",
    summaryUnavailable: "摘要不可用",
    symbolNotFound: "未找到标的",
    symbolNotFoundDescription: "该 ticker 尚未加入自选列表。",
    symbolUnavailable: "标的不可用",
    unnamedSymbol: "未命名标的",
    unknownExchange: "未知交易所",
    volume: "成交量",
    metricLabels: {
      marketCap: "市值",
      trailingPe: "滚动市盈率",
      priceToBook: "市净率",
      dividendYield: "股息率",
      fiftyTwoWeekHigh: "52 周高点",
      fiftyTwoWeekLow: "52 周低点",
      revenue: "营收",
      netIncome: "净利润",
      freeCashFlow: "自由现金流",
      debtRatio: "负债比率"
    },
    fieldLabels: {
      market_cap: "市值",
      trailing_pe: "滚动市盈率",
      price_to_book: "市净率",
      dividend_yield: "股息率",
      fifty_two_week_high: "52 周高点",
      fifty_two_week_low: "52 周低点",
      revenue: "营收",
      net_income: "净利润",
      free_cash_flow: "自由现金流",
      debt_ratio: "负债比率"
    },
    chartSeries: {
      ohlc: "OHLC",
      adjClose: "复权收盘价",
      equalWeightReturn: "等权收益"
    }
  }
};

const translations: Record<Locale, typeof en> = {
  en,
  zh
};

export type AppCopy = typeof en;
export type I18nContextValue = {
  copy: AppCopy;
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const value = useMemo(
    () => ({
      copy: translations[locale],
      locale,
      setLocale
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);

  if (!value) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }

  return value;
}

export function useOptionalI18n() {
  return useContext(I18nContext);
}

export function LanguageToggle() {
  const { copy, locale, setLocale } = useI18n();

  return (
    <div className="language-toggle" aria-label={copy.common.language}>
      <button
        aria-pressed={locale === "en"}
        className={locale === "en" ? "language-toggle-button language-toggle-button-active" : "language-toggle-button"}
        onClick={() => setLocale("en")}
        type="button"
      >
        EN
      </button>
      <button
        aria-pressed={locale === "zh"}
        className={locale === "zh" ? "language-toggle-button language-toggle-button-active" : "language-toggle-button"}
        onClick={() => setLocale("zh")}
        type="button"
      >
        中文
      </button>
    </div>
  );
}

export function formatAssetType(value: AssetType, copy: AppCopy) {
  return copy.common.assetTypeLabels[value];
}

export function formatDataType(value: DataType, copy: AppCopy) {
  return copy.common.dataTypeLabels[value];
}

export function formatJobType(type: FetchJobType, copy: AppCopy) {
  return copy.common.jobTypeLabels[type];
}

export function formatJobStatus(status: FetchJobStatus | FetchJobItemStatus, copy: AppCopy) {
  return copy.common.jobStatusLabels[status];
}

export function formatDateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

export function formatUpdatedAt(value: string, locale: Locale, copy: AppCopy) {
  return `${copy.common.updated} ${formatDateTime(value, locale)}`;
}

export function formatSymbolCount(value: number, locale: Locale) {
  return locale === "zh" ? `${value} 个标的` : `${value} symbol${value === 1 ? "" : "s"}`;
}

export function formatPercentComplete(value: number, locale: Locale) {
  return locale === "zh" ? `完成 ${value}%` : `${value}% complete`;
}

export function formatNumber(value: number | null, locale: Locale) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat(toIntlLocale(locale), { maximumFractionDigits: 2 }).format(value);
}

export function formatPercent(value: number | null, locale: Locale) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat(toIntlLocale(locale), {
    maximumFractionDigits: 2,
    style: "percent"
  }).format(value);
}

export function formatCurrency(value: number | null, currency: string, locale: Locale) {
  if (value === null) {
    return "-";
  }

  if (!currency) {
    return new Intl.NumberFormat(toIntlLocale(locale), {
      maximumFractionDigits: value > 1000 ? 0 : 2
    }).format(value);
  }

  return new Intl.NumberFormat(toIntlLocale(locale), {
    currency,
    maximumFractionDigits: value > 1000 ? 0 : 2,
    style: "currency"
  }).format(value);
}

export function formatCompactCurrency(value: number | null, currency: string, locale: Locale) {
  if (value === null) {
    return "-";
  }

  if (!currency) {
    return new Intl.NumberFormat(toIntlLocale(locale), {
      maximumFractionDigits: 2,
      notation: "compact"
    }).format(value);
  }

  return new Intl.NumberFormat(toIntlLocale(locale), {
    currency,
    maximumFractionDigits: 2,
    notation: "compact",
    style: "currency"
  }).format(value);
}

export function formatFieldLabel(value: string, copy: AppCopy) {
  return copy.symbolDetail.fieldLabels[value as keyof AppCopy["symbolDetail"]["fieldLabels"]] ?? titleCase(value.replaceAll("_", " "));
}

export function titleCase(value: string) {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readStoredLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return value === "zh" ? "zh" : "en";
}

function toIntlLocale(locale: Locale) {
  return locale === "zh" ? "zh-CN" : "en-US";
}
