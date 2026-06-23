import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { JobsPage } from "../features/jobs/JobsPage";
import { PlaceholderPage } from "../features/placeholder/PlaceholderPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { SymbolDetailPage } from "../features/symbol-detail/SymbolDetailPage";
import { WatchlistPage } from "../features/watchlist/WatchlistPage";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/symbols/:symbol", element: <SymbolDetailPage /> },
      { path: "/watchlist", element: <WatchlistPage /> },
      { path: "/jobs", element: <JobsPage /> },
      { path: "/settings", element: <SettingsPage /> }
    ]
  }
]);
