import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { PlaceholderPage } from "../features/placeholder/PlaceholderPage";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/symbols/:symbol", element: <PlaceholderPage title="Symbol Detail" /> },
      { path: "/watchlist", element: <PlaceholderPage title="Watchlist" /> },
      { path: "/jobs", element: <PlaceholderPage title="Jobs" /> },
      { path: "/settings", element: <PlaceholderPage title="Settings" /> }
    ]
  }
]);
