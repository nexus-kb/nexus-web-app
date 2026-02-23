"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@/lib/ui/navigation";
import { AppShell } from "@/components/app-shell";
import { LeftRail } from "@/components/left-rail";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import type { ListSummary } from "@/lib/api/contracts";
import {
  applyVisualTheme,
  getStoredNavCollapsed,
  getStoredThemeMode,
  persistNavCollapsed,
  persistThemeMode,
  type ThemeMode,
} from "@/lib/ui/preferences";
import { useDesktopViewport } from "@/lib/ui/use-desktop-viewport";

interface PlaceholderWorkspaceProps {
  lists: ListSummary[];
  selectedListKey: string | null;
  title: string;
  description: string;
}

export function PlaceholderWorkspace({
  lists,
  selectedListKey,
  title,
  description,
}: PlaceholderWorkspaceProps) {
  const router = useRouter();
  const isDesktop = useDesktopViewport(true);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    typeof window === "undefined" ? "system" : getStoredThemeMode(),
  );
  const [navCollapsed, setNavCollapsed] = useState(() =>
    typeof window === "undefined" ? false : getStoredNavCollapsed(),
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    applyVisualTheme(themeMode);
  }, [themeMode]);

  const placeholderCenter = useMemo(
    () => (
      <section className="placeholder-pane">
        <p className="pane-kicker">Scaffolded</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
    ),
    [description, title],
  );

  const leftRail = (
    <LeftRail
      lists={lists}
      selectedListKey={selectedListKey}
      showListSelector
      collapsed={navCollapsed}
      themeMode={themeMode}
      onToggleCollapsed={() => {
        setNavCollapsed((prev) => {
          const next = !prev;
          persistNavCollapsed(next);
          return next;
        });
      }}
      onSelectList={(listKey) => router.push(`/${encodeURIComponent(listKey)}/threads`)}
      onThemeModeChange={(nextTheme) => {
        persistThemeMode(nextTheme);
        setThemeMode(nextTheme);
      }}
    />
  );

  const detailPane = (
    <section className="placeholder-pane is-subtle">
      <h2>Planned Surface</h2>
      <p>This route is scaffolded for upcoming redesign tickets.</p>
    </section>
  );

  if (isDesktop) {
    return (
      <AppShell
        navCollapsed={navCollapsed}
        centerWidth={420}
        leftRail={leftRail}
        centerPane={placeholderCenter}
        detailPane={detailPane}
        onCenterResizeStart={(event) => event.preventDefault()}
      />
    );
  }

  return (
    <MobileStackRouter
      showDetail={false}
      navOpen={mobileNavOpen}
      onOpenNav={() => setMobileNavOpen(true)}
      onCloseNav={() => setMobileNavOpen(false)}
      onBackToList={() => setMobileNavOpen(false)}
      leftRail={leftRail}
      listPane={placeholderCenter}
      detailPane={placeholderCenter}
    />
  );
}
