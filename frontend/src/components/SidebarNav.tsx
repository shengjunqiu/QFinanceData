import { Link, NavLink } from "react-router-dom";

const navItems = [
  { label: "Dashboard", path: "/" },
  { label: "Watchlist", path: "/watchlist" },
  { label: "Jobs", path: "/jobs" },
  { label: "Settings", path: "/settings" }
];

export function SidebarNav() {
  return (
    <aside className="sidebar">
      <Link className="brand" to="/">
        <span className="brand-mark" aria-hidden="true">
          QF
        </span>
        <span>
          QFinanceData
          <small>Local market data</small>
        </span>
      </Link>
      <nav className="nav-list" aria-label="Primary navigation">
        {navItems.map((item) => (
          <NavLink
            className={({ isActive }) => (isActive ? "nav-link nav-link-active" : "nav-link")}
            end={item.path === "/"}
            key={item.path}
            to={item.path}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
