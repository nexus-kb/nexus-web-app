"use client";

import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const METADATA_QUERY_ROOTS = new Set([
  "lists",
  "listDetail",
  "threads",
  "threadDetail",
  "search",
  "series",
  "seriesDetail",
  "seriesVersion",
  "seriesCompare",
]);

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry(failureCount, error) {
          const message = error instanceof Error ? error.message : "";
          if (message.includes("HTTP 4")) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
  });
}

export function isMetadataQueryKey(queryKey: QueryKey): boolean {
  const root = queryKey[0];
  return typeof root === "string" && METADATA_QUERY_ROOTS.has(root);
}

export async function refetchActiveStaleMetadataQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.refetchQueries({
    type: "active",
    stale: true,
    predicate: (query) => isMetadataQueryKey(query.queryKey),
  });
}

export function installAppResumeRefresh(queryClient: QueryClient): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  let lastRefetchAt = 0;
  const dedupeWindowMs = 250;
  const onResume = () => {
    if (document.visibilityState === "hidden") {
      return;
    }

    const now = Date.now();
    if (now - lastRefetchAt < dedupeWindowMs) {
      return;
    }

    lastRefetchAt = now;
    void refetchActiveStaleMetadataQueries(queryClient);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      onResume();
    }
  };

  window.addEventListener("focus", onResume);
  window.addEventListener("pageshow", onResume);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    window.removeEventListener("focus", onResume);
    window.removeEventListener("pageshow", onResume);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => installAppResumeRefresh(queryClient), [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
