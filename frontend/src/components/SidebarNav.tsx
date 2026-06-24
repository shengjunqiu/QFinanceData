import { Link, NavLink } from "react-router-dom";

import { useI18n } from "../i18n";

export function SidebarNav() {
  const { copy } = useI18n();
  const navItems = [
    { label: copy.nav.dashboard, path: "/" },
    { label: copy.nav.watchlist, path: "/watchlist" },
    { label: copy.nav.jobs, path: "/jobs" },
    { label: copy.nav.settings, path: "/settings" }
  ];

  return (
    <aside className="sidebar">
      <Link className="brand" to="/">
        <span className="brand-mark" aria-hidden="true">
          QF
        </span>
        <span>
          QFinanceData
          <small>{copy.nav.tagline}</small>
        </span>
      </Link>
      <nav className="nav-list" aria-label={copy.nav.primaryNavigation}>
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
