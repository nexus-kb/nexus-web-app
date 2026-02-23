"use client";

import { DiffWorkspace } from "@/components/diff-workspace";
import { SearchWorkspace } from "@/components/search-workspace";
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

  if (route.kind === "search") {
    return <SearchWorkspace />;
  }

  if (route.kind === "diff") {
    if (!route.patchItemId) {
      return (
        <WorkspaceFrame>
          <section className="workspace-status is-error" role="alert">
            <p>Invalid diff route. Expected /diff/&#123;patchItemId&#125;.</p>
            <a className="ghost-button" href="/threads">
              Go to Threads
            </a>
          </section>
        </WorkspaceFrame>
      );
    }

    return (
      <DiffWorkspace
        patchItemId={route.patchItemId}
        initialPath={searchParams.get("path") ?? undefined}
        initialView={searchParams.get("view") ?? undefined}
      />
    );
  }

  return (
    <WorkspaceFrame>
      <section className="workspace-status is-error" role="alert">
        <p>{`Unknown route: ${route.pathname}`}</p>
        <a className="ghost-button" href="/threads">
          Go to Threads
        </a>
      </section>
    </WorkspaceFrame>
  );
}
