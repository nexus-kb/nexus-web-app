"use client";

import { useEffect, useState } from "react";
import { SeriesWorkspace } from "@/components/series-workspace";
import { ThreadsWorkspace } from "@/components/threads-workspace";
import { usePathname, useSearchParams } from "@/lib/ui/navigation";
import { parseWorkspaceRoute } from "@/lib/ui/routes";

function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  return <main className="workspace-frame">{children}</main>;
}

function WorkspaceLoadingScreen() {
  return (
    <WorkspaceFrame>
      <section className="workspace-loading-screen" aria-busy="true" aria-live="polite">
        <div className="workspace-loading-card">
          <p className="workspace-loading-kicker">Nexus KB</p>
          <h1>Loading workspace</h1>
          <p>Preparing mailing lists, navigation, and the active view.</p>
          <div className="workspace-loading-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>
    </WorkspaceFrame>
  );
}

export function NexusClientApp() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const overlay = document.getElementById("nexus-app-loading");
    let hideOverlayTimeout: number | null = null;
    const frame = window.requestAnimationFrame(() => {
      root.dataset.appReady = "true";
      setHydrated(true);
      hideOverlayTimeout = window.setTimeout(() => {
        overlay?.setAttribute("hidden", "");
      }, 220);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (hideOverlayTimeout != null) {
        window.clearTimeout(hideOverlayTimeout);
      }
    };
  }, []);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = parseWorkspaceRoute(pathname);

  if (!hydrated) {
    return <WorkspaceLoadingScreen />;
  }

  if (route.kind === "threads") {
    return (
      <ThreadsWorkspace
        listKey={route.listKey}
        selectedThreadId={route.threadId}
        initialMessage={searchParams.get("message") ?? undefined}
      />
    );
  }

  if (route.kind === "series") {
    return (
      <SeriesWorkspace
        selectedListKey={route.listKey}
        selectedSeriesId={route.seriesId}
      />
    );
  }

  return (
    <WorkspaceFrame>
      <section className="workspace-status is-error" role="alert">
        <p>{`Unknown route: ${route.pathname}`}</p>
        <a className="ds-btn ds-btn-ghost ds-btn-sm" href="/threads">
          Go to Threads
        </a>
      </section>
    </WorkspaceFrame>
  );
}
