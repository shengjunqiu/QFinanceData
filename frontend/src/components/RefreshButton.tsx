import { useState } from "react";

export function RefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  function handleRefresh() {
    setIsRefreshing(true);
    window.setTimeout(() => setIsRefreshing(false), 500);
  }

  return (
    <button className="refresh-button" disabled={isRefreshing} onClick={handleRefresh} type="button">
      {isRefreshing ? "Refreshing" : "Refresh"}
    </button>
  );
}
