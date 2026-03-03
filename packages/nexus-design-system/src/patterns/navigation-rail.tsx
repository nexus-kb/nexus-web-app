"use client";

import {
  Monitor,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  SquareLibrary,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { IconButton } from "../primitives/icon-button";
import type { ThemeMode } from "../theme/theme-provider";
import { cn } from "../utils/cn";

export interface NavigationItem {
  id: string;
  label: string;
  shortLabel: string;
  href?: string;
  active?: boolean;
  onSelect: () => void;
}

export interface NavigationListItem {
  key: string;
  label: string;
  selected?: boolean;
  onSelect: () => void;
}

interface NavigationRailProps {
  brand?: string;
  collapsed: boolean;
  navItems: ReadonlyArray<NavigationItem>;
  showListSelector?: boolean;
  listItems?: ReadonlyArray<NavigationListItem>;
  themeMode: ThemeMode;
  onToggleCollapsed: () => void;
  onThemeModeChange: (mode: ThemeMode) => void;
  notice?: React.ReactNode;
  className?: string;
}

export function NavigationRail({
  brand = "NEXUS",
  collapsed,
  navItems,
  showListSelector = false,
  listItems = [],
  themeMode,
  onToggleCollapsed,
  onThemeModeChange,
  notice,
  className,
}: NavigationRailProps) {
  const ThemeIcon = themeMode === "system" ? Monitor : themeMode === "light" ? Sun : Moon;
  const nextThemeMode: ThemeMode =
    themeMode === "system" ? "light" : themeMode === "light" ? "dark" : "system";

  return (
    <aside className={cn("ds-nav-rail", collapsed && "is-collapsed", className)}>
      <header className="ds-nav-header">
        {collapsed ? (
          <IconButton
            className="ds-logo-toggle"
            aria-label="Expand navigation"
            onClick={onToggleCollapsed}
            title="Expand navigation"
          >
            <SquareLibrary className="ds-logo-toggle-default" size={18} aria-hidden="true" />
            <PanelRightClose className="ds-logo-toggle-hover" size={18} aria-hidden="true" />
          </IconButton>
        ) : (
          <>
            <span className="ds-nav-brand">{brand}</span>
            <IconButton
              aria-label="Collapse navigation"
              onClick={onToggleCollapsed}
              title="Collapse navigation"
            >
              <PanelRightOpen size={18} aria-hidden="true" />
            </IconButton>
          </>
        )}
      </header>

      <div className="ds-nav-body">
        <nav className="ds-nav-section" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={item.href ?? "#"}
              className={cn("ds-nav-link", item.active && "is-active")}
              onClick={(event) => {
                event.preventDefault();
                item.onSelect();
              }}
              aria-current={item.active ? "page" : undefined}
            >
              {collapsed ? item.shortLabel : item.label}
            </a>
          ))}
        </nav>

        {!collapsed && showListSelector && listItems.length ? (
          <div className="ds-nav-section ds-nav-lists">
            <p className="ds-nav-label">Lists</p>
            <ul className="ds-nav-list">
              {listItems.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    className={cn("ds-nav-list-button", item.selected && "is-selected")}
                    onClick={item.onSelect}
                  >
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {notice ? (
        <div className="ds-nav-notice-wrap" role="note" aria-label="Project status notice">
          {!collapsed ? (
            <p className="ds-nav-notice-card">{notice}</p>
          ) : (
            <span className="ds-nav-notice-icon" title="Alpha build notice" aria-label="Alpha build alert">
              <TriangleAlert size={16} aria-hidden="true" />
            </span>
          )}
        </div>
      ) : null}

      <footer className="ds-nav-footer">
        <IconButton
          aria-label={`Theme: ${themeMode}. Switch theme`}
          onClick={() => onThemeModeChange(nextThemeMode)}
          title={`Theme is ${themeMode}`}
        >
          <ThemeIcon size={18} aria-hidden="true" />
        </IconButton>
      </footer>
    </aside>
  );
}
