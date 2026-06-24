import { useQuery } from "@tanstack/react-query";

import { apiRequest, type ApiRequestOptions } from "./client";
import type { CorporateAction } from "./types";

export type BackendCorporateAction = {
  symbol: string;
  action_type: "dividend" | "split";
  ex_date: string;
  value: number;
};

export const actionsQueryKeys = {
  all: ["actions"] as const,
  list: (symbol: string) => ["actions", "list", symbol] as const
};

export async function listCorporateActions(
  symbol: string,
  options: Pick<ApiRequestOptions, "signal"> = {}
): Promise<CorporateAction[]> {
  const actions = await apiRequest<BackendCorporateAction[]>(`/api/actions/${encodeURIComponent(symbol)}`, {
    ...options
  });

  return actions.map(mapCorporateAction);
}

export function useCorporateActionsQuery(symbol: string) {
  return useQuery({
    enabled: Boolean(symbol),
    queryFn: ({ signal }) => listCorporateActions(symbol, { signal }),
    queryKey: actionsQueryKeys.list(symbol)
  });
}

export function mapCorporateAction(action: BackendCorporateAction): CorporateAction {
  return {
    symbol: action.symbol,
    actionType: action.action_type,
    exDate: action.ex_date,
    value: action.value
  };
}
