"use client";

import { SeriesWorkspace } from "@/components/series-workspace";
import { ThreadsWorkspace } from "@/components/threads-workspace";
import { usePathname, useSearchParams } from "@/lib/ui/navigation";
import { parseWorkspaceRoute } from "@/lib/ui/routes";

function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  return <main className="workspace-frame">{children}</main>;
}

export function NexusClientApp() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = parseWorkspaceRoute(pathname);

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
