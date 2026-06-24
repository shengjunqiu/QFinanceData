import { useQuery } from "@tanstack/react-query";

import { apiRequest, type ApiRequestOptions } from "./client";
import type { LatestPrice, PriceBar, PriceInterval, PriceSeries, PriceSeriesStatus } from "./types";

type BackendPriceBar = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adj_close: number;
  volume: number;
};

type BackendPriceSeries = {
  symbol: string;
  interval: string;
  range: string;
  status: PriceSeriesStatus;
  bars: BackendPriceBar[];
};

type BackendLatestPrice = {
  symbol: string;
  interval: string;
  status: PriceSeriesStatus;
  latest_data_at: string | null;
  latest_price: number | null;
  change: number | null;
  change_percent: number | null;
  volume: number | null;
};

export type PriceSeriesParams = {
  interval?: PriceInterval;
  range?: string;
  start?: string | Date;
  end?: string | Date;
};

export type LatestPriceParams = {
  interval?: PriceInterval;
};

export const pricesQueryKeys = {
  all: ["prices"] as const,
  series: (symbol: string, params: PriceSeriesParams = {}) => ["prices", "series", symbol, params] as const,
  latest: (symbol: string, params: LatestPriceParams = {}) => ["prices", "latest", symbol, params] as const
};

export async function getPrices(
  symbol: string,
  params: PriceSeriesParams = {},
  options: Pick<ApiRequestOptions, "signal"> = {}
): Promise<PriceSeries> {
  const series = await apiRequest<BackendPriceSeries>(`/api/prices/${encodeURIComponent(symbol)}`, {
    ...options,
    query: {
      interval: params.interval,
      range: params.range,
      start: formatDateParam(params.start),
      end: formatDateParam(params.end)
    }
  });

  return mapPriceSeries(series);
}

export function usePriceSeriesQuery(symbol: string, params: PriceSeriesParams = {}) {
  return useQuery({
    enabled: Boolean(symbol),
    queryFn: ({ signal }) => getPrices(symbol, params, { signal }),
    queryKey: pricesQueryKeys.series(symbol, params)
  });
}

export async function getLatestPrice(
  symbol: string,
  params: LatestPriceParams = {},
  options: Pick<ApiRequestOptions, "signal"> = {}
): Promise<LatestPrice> {
  const latest = await apiRequest<BackendLatestPrice>(`/api/prices/${encodeURIComponent(symbol)}/latest`, {
    ...options,
    query: {
      interval: params.interval
    }
  });

  return mapLatestPrice(latest);
}

export function useLatestPriceQuery(symbol: string, params: LatestPriceParams = {}) {
  return useQuery({
    enabled: Boolean(symbol),
    queryFn: ({ signal }) => getLatestPrice(symbol, params, { signal }),
    queryKey: pricesQueryKeys.latest(symbol, params)
  });
}

export function mapPriceSeries(series: BackendPriceSeries): PriceSeries {
  const interval = normalizeInterval(series.interval);

  return {
    symbol: series.symbol,
    interval,
    range: series.range,
    status: series.status,
    bars: series.bars.map((bar) => mapPriceBar(bar, series.symbol, interval))
  };
}

export function mapLatestPrice(latest: BackendLatestPrice): LatestPrice {
  return {
    symbol: latest.symbol,
    interval: normalizeInterval(latest.interval),
    status: latest.status,
    latestDataAt: latest.latest_data_at,
    latestPrice: latest.latest_price,
    change: latest.change,
    changePct: latest.change_percent,
    volume: latest.volume
  };
}

function mapPriceBar(bar: BackendPriceBar, symbol: string, interval: PriceInterval): PriceBar {
  return {
    symbol,
    interval,
    timestamp: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    adjClose: bar.adj_close,
    volume: bar.volume
  };
}

function normalizeInterval(value: string): PriceInterval {
  return value as PriceInterval;
}

function formatDateParam(value: string | Date | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}
