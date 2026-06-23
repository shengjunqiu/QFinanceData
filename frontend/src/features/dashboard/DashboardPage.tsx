export function DashboardPage() {
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
