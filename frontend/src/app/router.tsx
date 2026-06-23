import { createBrowserRouter, Link, Outlet } from "react-router-dom";

const navItems = [
  { label: "Dashboard", path: "/" },
  { label: "Watchlist", path: "/watchlist" },
  { label: "Jobs", path: "/jobs" },
  { label: "Settings", path: "/settings" }
];

function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          QFinanceData
        </Link>
        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link className="nav-link" key={item.path} to={item.path}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <input className="symbol-search" aria-label="Search ticker" placeholder="Search ticker..." />
          <div className="range-control" aria-label="Time range">
            <button type="button">1D</button>
            <button type="button">1M</button>
            <button type="button">1Y</button>
            <button type="button">MAX</button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

function DashboardPage() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Market Overview</p>
          <h1>Dashboard</h1>
        </div>
        <span className="status-pill">Fresh</span>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Watchlist</h2>
          <p>AAPL 213.40 +1.21%</p>
          <p>MSFT 487.20 -0.40%</p>
        </section>
        <section className="panel panel-wide">
          <h2>Trend</h2>
          <div className="chart-placeholder" />
        </section>
        <section className="panel">
          <h2>Data Freshness</h2>
          <p>Fresh 21 · Stale 3 · Failed 1</p>
        </section>
        <section className="panel">
          <h2>Recent Jobs</h2>
          <p>prices · success</p>
        </section>
      </div>
    </section>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">QFinanceData</p>
          <h1>{title}</h1>
        </div>
      </div>
    </section>
  );
}

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
