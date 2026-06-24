import { useState } from "react";

import { useI18n } from "../i18n";

export function RefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { copy } = useI18n();

  function handleRefresh() {
    setIsRefreshing(true);
    window.setTimeout(() => setIsRefreshing(false), 500);
  }

  return (
    <button className="refresh-button" disabled={isRefreshing} onClick={handleRefresh} type="button">
      {isRefreshing ? copy.common.refreshing : copy.common.refresh}
    </button>
  );
}
