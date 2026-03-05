"use client";

import {
  NavigationRail,
  type DensityMode,
  type NavigationItem,
  type NavigationListItem,
  type ThemeMode,
} from "@nexus/design-system";
import { useMemo } from "react";
import type { ListSummary } from "@/lib/api/contracts";
import { usePathname, useRouter } from "@/lib/ui/navigation";
import { getSeriesPath, getThreadsPath } from "@/lib/ui/routes";

interface LeftRailProps {
  lists: ListSummary[];
  selectedListKey: string | null;
  showListSelector: boolean;
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
  showListSelector,
  collapsed,
  themeMode,
  densityMode,
  onToggleCollapsed,
  onSelectList,
  onThemeModeChange,
  onDensityModeChange,
}: LeftRailProps) {
  const router = useRouter();
  const pathname = usePathname();
  const threadsActive = pathname === "/threads" || /^\/threads(?:\/|$)/.test(pathname);
  const seriesActive = pathname === "/series" || /^\/series(?:\/|$)/.test(pathname);
  const threadsHref = getThreadsPath(selectedListKey);
  const seriesHref = getSeriesPath(selectedListKey);

  const navItems = useMemo<NavigationItem[]>(
    () => [
      {
        id: "threads",
        label: "Threads",
        shortLabel: "T",
        href: threadsHref,
        active: threadsActive,
        onSelect: () => {
          router.push(threadsHref);
        },
      },
      {
        id: "series",
        label: "Series",
        shortLabel: "S",
        href: seriesHref,
        active: seriesActive,
        onSelect: () => {
          router.push(seriesHref);
        },
      },
    ],
    [router, seriesActive, seriesHref, threadsActive, threadsHref],
  );

  const listItems = useMemo<NavigationListItem[]>(
    () =>
      lists.map((list) => ({
        key: list.list_key,
        label: list.list_key,
        selected: list.list_key === selectedListKey,
        onSelect: () => onSelectList(list.list_key),
      })),
    [lists, onSelectList, selectedListKey],
  );

  return (
    <NavigationRail
      collapsed={collapsed}
      navItems={navItems}
      showListSelector={showListSelector}
      listItems={listItems}
      themeMode={themeMode}
      densityMode={densityMode}
      onToggleCollapsed={onToggleCollapsed}
      onThemeModeChange={onThemeModeChange}
      onDensityModeChange={onDensityModeChange}
    />
  );
}
