"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LeftRail } from "@/components/left-rail";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import type { ListSummary } from "@/lib/api/contracts";
import {
  applyVisualTheme,
  parseNavMode,
  parseThemeMode,
  STORAGE_KEYS,
  type ThemeMode,
} from "@/lib/ui/preferences";

interface PlaceholderWorkspaceProps {
  lists: ListSummary[];
  selectedListKey: string;
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
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "system";
    }
    return parseThemeMode(localStorage.getItem(STORAGE_KEYS.theme));
  });
  const [navCollapsed, setNavCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return parseNavMode(localStorage.getItem(STORAGE_KEYS.nav)) === "collapsed";
  });
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
        collapsed={navCollapsed}
        themeMode={themeMode}
        onToggleCollapsed={() => {
          setNavCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem(STORAGE_KEYS.nav, next ? "collapsed" : "expanded");
          return next;
        });
      }}
      onSelectList={(listKey) => router.push(`/lists/${encodeURIComponent(listKey)}/threads`)}
      onThemeModeChange={(nextTheme) => {
        localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
        setThemeMode(nextTheme);
      }}
    />
  );

  return (
    <>
      <AppShell
        navCollapsed={navCollapsed}
        centerWidth={420}
        leftRail={leftRail}
        centerPane={placeholderCenter}
        detailPane={
          <section className="placeholder-pane is-subtle">
            <h2>Planned Surface</h2>
            <p>This route is scaffolded for upcoming redesign tickets.</p>
          </section>
        }
        onCenterResizeStart={(event) => event.preventDefault()}
      />

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
    </>
  );
}
