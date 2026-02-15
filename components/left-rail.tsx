"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Monitor,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  SquareLibrary,
  Sun,
  TriangleAlert,
} from "lucide-react";
import type { ListSummary } from "@/lib/api/contracts";
import type { ThemeMode } from "@/lib/ui/preferences";
import { formatCount } from "@/lib/ui/format";

interface LeftRailProps {
  lists: ListSummary[];
  selectedListKey: string;
  collapsed: boolean;
  themeMode: ThemeMode;
  onToggleCollapsed: () => void;
  onSelectList: (listKey: string) => void;
  onThemeModeChange: (mode: ThemeMode) => void;
}

export function LeftRail({
  lists,
  selectedListKey,
  collapsed,
  themeMode,
  onToggleCollapsed,
  onSelectList,
  onThemeModeChange,
}: LeftRailProps) {
  const pathname = usePathname();
  const threadsActive = pathname.startsWith("/lists/");
  const seriesActive = pathname.startsWith("/series");
  const searchActive = pathname.startsWith("/search");

  const ThemeIcon = themeMode === "system" ? Monitor : themeMode === "light" ? Sun : Moon;
  const nextThemeMode: ThemeMode = themeMode === "system" ? "light" : themeMode === "light" ? "dark" : "system";

  const toggleTheme = () => {
    onThemeModeChange(nextThemeMode);
  };

  return (
    <aside className={`left-rail ${collapsed ? "is-collapsed" : ""}`}>
      <header className="rail-header">
        {collapsed ? (
          <button
            type="button"
            className="rail-icon-button rail-logo-toggle"
            aria-label="Expand navigation"
            onClick={onToggleCollapsed}
            title="Expand navigation"
          >
            <SquareLibrary className="rail-logo-toggle-default" size={18} aria-hidden="true" />
            <PanelRightClose className="rail-logo-toggle-hover" size={18} aria-hidden="true" />
          </button>
        ) : (
          <>
            <span className="rail-brand-icon" aria-hidden="true">
              <SquareLibrary size={18} />
            </span>
            <span className="app-mark">NEXUS</span>
            <button
              type="button"
              className="rail-icon-button"
              aria-label="Collapse navigation"
              onClick={onToggleCollapsed}
              title="Collapse navigation"
            >
              <PanelRightOpen size={18} aria-hidden="true" />
            </button>
          </>
        )}
      </header>

      <div className="rail-body">
        <nav className="rail-section rail-nav" aria-label="Primary navigation">
          <Link
            className={`rail-link ${threadsActive ? "is-active" : ""}`}
            href={`/lists/${encodeURIComponent(selectedListKey)}/threads`}
            aria-current={threadsActive ? "page" : undefined}
          >
            {collapsed ? "T" : "Threads"}
          </Link>
          <Link className={`rail-link ${seriesActive ? "is-active" : ""}`} href="/series" aria-current={seriesActive ? "page" : undefined}>
            {collapsed ? "S" : "Series"}
          </Link>
          <Link className={`rail-link ${searchActive ? "is-active" : ""}`} href="/search" aria-current={searchActive ? "page" : undefined}>
            {collapsed ? "Q" : "Search"}
          </Link>
        </nav>

        {!collapsed && (
          <div className="rail-section rail-lists">
            <p className="rail-label">Lists</p>
            <ul className="list-nav">
              {lists.map((list) => (
                <li key={list.list_key}>
                  <button
                    type="button"
                    className={`list-nav-button ${list.list_key === selectedListKey ? "is-selected" : ""}`}
                    onClick={() => onSelectList(list.list_key)}
                  >
                    <span>{list.list_key}</span>
                    <span className="muted">{formatCount(list.thread_count_30d)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rail-alert-wrap" role="note" aria-label="Project status notice">
        <p className="rail-alert-card">
          This app is alpha quality at best. Send feedback, feature requests, and nitpicks to{" "}
          <a href="mailto:email@tansanrao.com">email@tansanrao.com</a>.
        </p>
        <span
          className="rail-alert-icon"
          title="Alpha build: send feedback to email@tansanrao.com"
          aria-label="Alpha build alert"
        >
          <TriangleAlert size={16} aria-hidden="true" />
        </span>
      </div>

      <footer className="rail-footer">
        <button
          type="button"
          className="rail-icon-button"
          aria-label={`Theme: ${themeMode}. Switch theme`}
          onClick={toggleTheme}
          title={`Theme is ${themeMode}`}
        >
          <ThemeIcon size={18} aria-hidden="true" />
        </button>
      </footer>
    </aside>
  );
}
