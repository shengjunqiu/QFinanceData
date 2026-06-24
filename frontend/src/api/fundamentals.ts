import { useQuery } from "@tanstack/react-query";

import { apiRequest, type ApiRequestOptions } from "./client";
import type { DataStatus, FundamentalSnapshot } from "./types";

type BackendFundamentalMetrics = {
  market_cap: number | null;
  trailing_pe: number | null;
  price_to_book: number | null;
  dividend_yield: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
};

type BackendFinancialSummary = {
  revenue: number | null;
  net_income: number | null;
  free_cash_flow: number | null;
  debt_ratio: number | null;
};

export type BackendFundamentalSnapshot = {
  symbol: string;
  currency: string;
  metrics: BackendFundamentalMetrics;
  financial_summary: BackendFinancialSummary;
  missing_fields: string[];
  last_fetch_at: string | null;
  status: DataStatus;
};

export const fundamentalsQueryKeys = {
  all: ["fundamentals"] as const,
  detail: (symbol: string) => ["fundamentals", "detail", symbol] as const
};

export async function getFundamentals(
  symbol: string,
  options: Pick<ApiRequestOptions, "signal"> = {}
): Promise<FundamentalSnapshot> {
  const snapshot = await apiRequest<BackendFundamentalSnapshot>(`/api/fundamentals/${encodeURIComponent(symbol)}`, {
    ...options
  });

  return mapFundamentalSnapshot(snapshot);
}

export function useFundamentalsQuery(symbol: string) {
  return useQuery({
    enabled: Boolean(symbol),
    queryFn: ({ signal }) => getFundamentals(symbol, { signal }),
    queryKey: fundamentalsQueryKeys.detail(symbol)
  });
}

export function mapFundamentalSnapshot(snapshot: BackendFundamentalSnapshot): FundamentalSnapshot {
  return {
    symbol: snapshot.symbol,
    currency: snapshot.currency,
    metrics: {
      marketCap: snapshot.metrics.market_cap,
      trailingPe: snapshot.metrics.trailing_pe,
      priceToBook: snapshot.metrics.price_to_book,
      dividendYield: snapshot.metrics.dividend_yield,
      fiftyTwoWeekHigh: snapshot.metrics.fifty_two_week_high,
      fiftyTwoWeekLow: snapshot.metrics.fifty_two_week_low
    },
    financialSummary: {
      revenue: snapshot.financial_summary.revenue,
      netIncome: snapshot.financial_summary.net_income,
      freeCashFlow: snapshot.financial_summary.free_cash_flow,
      debtRatio: snapshot.financial_summary.debt_ratio
    },
    missingFields: snapshot.missing_fields,
    lastFetchAt: snapshot.last_fetch_at,
    status: snapshot.status
  };
}
