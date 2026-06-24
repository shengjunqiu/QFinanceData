import { Outlet } from "react-router-dom";

import { LanguageToggle } from "../i18n";
import { RefreshButton } from "./RefreshButton";
import { SidebarNav } from "./SidebarNav";
import { SymbolSearch } from "./SymbolSearch";
import { TimeRangeControl } from "./TimeRangeControl";

export function AppShell() {
  return (
    <div className="app-shell">
      <SidebarNav />
      <main className="workspace">
        <header className="topbar">
          <SymbolSearch />
          <div className="topbar-actions">
            <LanguageToggle />
            <TimeRangeControl />
            <RefreshButton />
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
