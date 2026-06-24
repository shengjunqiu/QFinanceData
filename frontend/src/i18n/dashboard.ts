import { useEffect, useState } from "react";

import type { DataStatus, DataType, FetchJob } from "../api/types";

export type DashboardLocale = "en" | "zh";

export type DashboardCopy = {
  dashboard: string;
  dataFreshness: string;
  equalWeightReturn: string;
  fetchingDashboard: string;
  gainers: string;
  language: string;
  last: string;
  loadingDashboard: string;
  losers: string;
  manage: string;
  marketOverview: string;
  marketSummaryLabel: string;
  noFetchJobsDescription: string;
  noFetchJobsTitle: string;
  noMovers: string;
  noSymbolsDescription: string;
  noSymbolsTitle: string;
  noTrendDataDescription: string;
  noTrendDataTitle: string;
  notUpdatedYet: string;
  openJobs: string;
  overviewUnavailable: string;
  recentFetchJobs: string;
  review: string;
  status: string;
  symbol: string;
  change: string;
  topMovers: string;
  watchlist: string;
  watchlistOverviewLabel: string;
  watchlistTrend: string;
  dataTypeLabels: Record<DataType, string>;
  jobTypeLabels: Record<FetchJob["type"], string>;
  statusLabels: Record<DataStatus, string>;
};

const DASHBOARD_LOCALE_STORAGE_KEY = "qfd.dashboard.locale";

const dashboardCopy = {
  en: {
    dashboard: "Dashboard",
    dataFreshness: "Data Freshness",
    equalWeightReturn: "Equal weight return",
    fetchingDashboard: "Fetching symbols, prices, data status and recent jobs.",
    gainers: "Gainers",
    language: "Language",
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
    overviewUnavailable: "Dashboard unavailable",
    recentFetchJobs: "Recent Fetch Jobs",
    review: "Review",
    status: "Status",
    symbol: "Symbol",
    change: "Change",
    topMovers: "Top Movers",
    watchlist: "Watchlist",
    watchlistOverviewLabel: "Watchlist overview",
    watchlistTrend: "Watchlist Trend",
    dataTypeLabels: {
      prices: "Prices",
      metadata: "Metadata",
      fundamentals: "Fundamentals",
      actions: "Actions"
    },
    jobTypeLabels: {
      prices: "prices",
      fundamentals: "fundamentals",
      actions: "actions",
      metadata: "metadata"
    },
    statusLabels: {
      fresh: "Fresh",
      stale: "Stale",
      missing: "Missing",
      failed: "Failed",
      partial: "Partial"
    }
  },
  zh: {
    dashboard: "首页",
    dataFreshness: "数据新鲜度",
    equalWeightReturn: "等权收益",
    fetchingDashboard: "正在获取标的、价格、数据状态和最近任务。",
    gainers: "上涨",
    language: "语言",
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
    overviewUnavailable: "首页不可用",
    recentFetchJobs: "最近抓取任务",
    review: "查看",
    status: "状态",
    symbol: "标的",
    change: "涨跌",
    topMovers: "涨跌幅排行",
    watchlist: "自选列表",
    watchlistOverviewLabel: "自选列表概览",
    watchlistTrend: "自选趋势",
    dataTypeLabels: {
      prices: "价格",
      metadata: "基础信息",
      fundamentals: "基本面",
      actions: "公司行动"
    },
    jobTypeLabels: {
      prices: "价格",
      fundamentals: "基本面",
      actions: "公司行动",
      metadata: "基础信息"
    },
    statusLabels: {
      fresh: "新鲜",
      stale: "过期",
      missing: "缺失",
      failed: "失败",
      partial: "部分"
    }
  }
} satisfies Record<DashboardLocale, DashboardCopy>;

export function useDashboardLocale() {
  const [locale, setLocale] = useState<DashboardLocale>(readStoredDashboardLocale);

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  return {
    copy: dashboardCopy[locale],
    locale,
    setLocale
  };
}

export function formatDashboardDataType(value: DataType, copy: DashboardCopy) {
  return copy.dataTypeLabels[value];
}

export function formatDashboardDateTime(value: string, locale: DashboardLocale) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

export function formatDashboardUpdatedAt(value: string, locale: DashboardLocale) {
  const dateTime = formatDashboardDateTime(value, locale);
  return locale === "zh" ? `更新于 ${dateTime}` : `Updated ${dateTime}`;
}

export function formatDashboardSymbolCount(value: number, locale: DashboardLocale) {
  return locale === "zh" ? `${value} 个标的` : `${value} symbols`;
}

function readStoredDashboardLocale(): DashboardLocale {
  if (typeof window === "undefined") {
    return "en";
  }

  const value = window.localStorage.getItem(DASHBOARD_LOCALE_STORAGE_KEY);
  return value === "zh" ? "zh" : "en";
}
