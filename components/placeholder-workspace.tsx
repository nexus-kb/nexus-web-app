"use client";

import { useMemo, useState } from "react";
import { usePreferences, useTheme } from "@nexus/design-system";
import { useRouter } from "@/lib/ui/navigation";
import { AppShell } from "@/components/app-shell";
import { LeftRail } from "@/components/left-rail";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import type { ListSummary } from "@/lib/api/contracts";
import { getThreadsPath } from "@/lib/ui/routes";
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
  const isDesktop = useDesktopViewport();
  const { themeMode, setThemeMode } = useTheme();
  const { densityMode, navCollapsed, setDensityMode, setNavCollapsed } = usePreferences();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  const desktopLeftRail = (
    <LeftRail
      lists={lists}
      selectedListKey={selectedListKey}
      showListSelector
      collapsed={navCollapsed}
      themeMode={themeMode}
      densityMode={densityMode}
      onToggleCollapsed={() => {
        setNavCollapsed(!navCollapsed);
      }}
      onSelectList={(listKey) => router.push(getThreadsPath(listKey))}
      onThemeModeChange={(nextTheme) => {
        setThemeMode(nextTheme);
      }}
      onDensityModeChange={(nextMode) => {
        setDensityMode(nextMode);
      }}
    />
  );

  const mobileLeftRail = (
    <LeftRail
      lists={lists}
      selectedListKey={selectedListKey}
      showListSelector
      collapsed={false}
      themeMode={themeMode}
      densityMode={densityMode}
      onToggleCollapsed={() => {
        setMobileNavOpen(false);
      }}
      onSelectList={(listKey) => {
        router.push(getThreadsPath(listKey));
        setMobileNavOpen(false);
      }}
      onThemeModeChange={(nextTheme) => {
        setThemeMode(nextTheme);
      }}
      onDensityModeChange={(nextMode) => {
        setDensityMode(nextMode);
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
        leftRail={desktopLeftRail}
        centerPane={placeholderCenter}
        detailPane={detailPane}
        onCenterResizeStart={(event) => event.preventDefault()}
      />
    );
  }

  return (
    <MobileStackRouter
      title="Workspace"
      showDetail={false}
      navOpen={mobileNavOpen}
      onOpenNav={() => setMobileNavOpen(true)}
      onCloseNav={() => setMobileNavOpen(false)}
      onBackToList={() => setMobileNavOpen(false)}
      leftRail={mobileLeftRail}
      listPane={placeholderCenter}
      detailPane={placeholderCenter}
    />
  );
}
