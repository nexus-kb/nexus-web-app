"use client";

import Link from "next/link";
import type { ListSummary } from "@/lib/api/contracts";
import type { DensityMode, ThemeMode } from "@/lib/ui/preferences";
import { formatCount } from "@/lib/ui/format";

interface LeftRailProps {
  lists: ListSummary[];
  selectedListKey: string;
  collapsed: boolean;
  themeMode: ThemeMode;
  densityMode: DensityMode;
  onToggleCollapsed: () => void;
  onSelectList: (listKey: string) => void;
  onThemeModeChange: (mode: ThemeMode) => void;
  onDensityModeChange: (mode: DensityMode) => void;
}

export function LeftRail({
  lists,
  selectedListKey,
  collapsed,
  themeMode,
  densityMode,
  onToggleCollapsed,
  onSelectList,
  onThemeModeChange,
  onDensityModeChange,
}: LeftRailProps) {
  return (
    <aside className={`left-rail ${collapsed ? "is-collapsed" : ""}`}>
      <div className="rail-header">
        <button
          type="button"
          className="icon-button"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? "»" : "«"}
        </button>
        {!collapsed && <span className="app-mark">Nexus KB</span>}
      </div>

      <nav className="rail-section" aria-label="Primary navigation">
        <Link className="rail-link is-active" href={`/lists/${encodeURIComponent(selectedListKey)}/threads`} aria-current="page">
          {collapsed ? "T" : "Threads"}
        </Link>
        <Link className="rail-link" href="/series">
          {collapsed ? "S" : "Series"}
        </Link>
        <Link className="rail-link" href="/diff/9001">
          {collapsed ? "D" : "Diff"}
        </Link>
        <Link className="rail-link" href="/search">
          {collapsed ? "Q" : "Search"}
        </Link>
      </nav>

      {!collapsed && (
        <div className="rail-section">
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

      {!collapsed && (
        <div className="rail-section rail-settings">
          <label className="rail-label" htmlFor="theme-mode">
            Theme
          </label>
          <select
            id="theme-mode"
            value={themeMode}
            onChange={(event) => onThemeModeChange(event.target.value as ThemeMode)}
            className="select-control"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>

          <label className="rail-label" htmlFor="density-mode">
            Density
          </label>
          <select
            id="density-mode"
            value={densityMode}
            onChange={(event) => onDensityModeChange(event.target.value as DensityMode)}
            className="select-control"
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
          </select>
        </div>
      )}
    </aside>
  );
}
