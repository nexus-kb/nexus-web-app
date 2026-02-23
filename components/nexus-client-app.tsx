"use client";

import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import { DiffWorkspace } from "@/components/diff-workspace";
import { SearchWorkspace } from "@/components/search-workspace";
import { SeriesWorkspace } from "@/components/series-workspace";
import { ThreadsWorkspace } from "@/components/threads-workspace";
import type { GetSeriesCompareParams } from "@/lib/api/adapter";
import type { SearchScope } from "@/lib/api/contracts";
import {
  getPatchItemDetail,
  getPatchItemFiles,
  getSearch,
  getSeriesCompare,
  getSeriesDetail,
  getSeriesVersion,
} from "@/lib/api/server-client";
import {
  loadListCatalog,
  loadSeriesCenterData,
  loadWorkspaceData,
} from "@/lib/api/server-data";
import { usePathname, useSearchParams } from "@/lib/ui/navigation";
import { parseIntegratedSearchParams } from "@/lib/ui/search-query";

type ThreadsProps = ComponentProps<typeof ThreadsWorkspace>;
type SeriesProps = ComponentProps<typeof SeriesWorkspace>;
type SearchProps = ComponentProps<typeof SearchWorkspace>;
type DiffProps = ComponentProps<typeof DiffWorkspace>;

type ViewState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "threads"; props: ThreadsProps }
  | { kind: "series"; props: SeriesProps }
  | { kind: "search"; props: SearchProps }
  | { kind: "diff"; props: DiffProps };

type AppRoute =
  | { kind: "threads"; listKey: string | null; threadId: number | null }
  | { kind: "series"; listKey: string | null; seriesId: number | null }
  | { kind: "search" }
  | { kind: "diff"; patchItemId: number | null }
  | { kind: "unknown" };

const EMPTY_THREADS_PAGINATION = {
  page: 1,
  page_size: 50,
  total_items: 0,
  total_pages: 1,
  has_prev: false,
  has_next: false,
};

const EMPTY_SERIES_PAGINATION = {
  page: 1,
  page_size: 30,
  total_items: 0,
  total_pages: 1,
  has_prev: false,
  has_next: false,
};

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parsePage(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parseCompareMode(value: string | null): GetSeriesCompareParams["mode"] {
  if (value === "summary" || value === "per_patch" || value === "per_file") {
    return value;
  }
  return "summary";
}

function parseScope(value: string | null): SearchScope {
  if (value === "thread" || value === "series" || value === "patch_item") {
    return value;
  }
  return "thread";
}

function toSearchRecord(searchParams: URLSearchParams): Record<string, string | undefined> {
  const record: Record<string, string | undefined> = {};

  for (const [key, value] of searchParams.entries()) {
    if (!(key in record)) {
      record[key] = value;
    }
  }

  return record;
}

function parseRoute(pathname: string): AppRoute {
  const segments = pathname
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(decodeSegment);

  if (segments.length === 0) {
    return { kind: "threads", listKey: null, threadId: null };
  }

  if (segments[0] === "threads") {
    return { kind: "threads", listKey: null, threadId: null };
  }

  if (segments[0] === "series") {
    return { kind: "series", listKey: null, seriesId: null };
  }

  if (segments[0] === "search") {
    return { kind: "search" };
  }

  if (segments[0] === "diff") {
    if (segments.length === 2) {
      return { kind: "diff", patchItemId: parsePositiveInt(segments[1]) };
    }
    return { kind: "diff", patchItemId: null };
  }

  if (segments.length >= 2 && segments[1] === "threads") {
    const threadId = segments.length >= 3 ? parsePositiveInt(segments[2] ?? null) : null;
    return {
      kind: "threads",
      listKey: segments[0] ?? null,
      threadId,
    };
  }

  if (segments.length >= 2 && segments[1] === "series") {
    const seriesId = segments.length >= 3 ? parsePositiveInt(segments[2] ?? null) : null;
    return {
      kind: "series",
      listKey: segments[0] ?? null,
      seriesId,
    };
  }

  return { kind: "unknown" };
}

async function buildThreadsView(
  route: Extract<AppRoute, { kind: "threads" }>,
  searchParams: URLSearchParams,
): Promise<ViewState> {
  const queryRecord = toSearchRecord(searchParams);

  if (!route.listKey) {
    const { lists } = await loadListCatalog();
    return {
      kind: "threads",
      props: {
        lists,
        listKey: null,
        threads: [],
        threadsPagination: EMPTY_THREADS_PAGINATION,
        detail: null,
        selectedThreadId: null,
        initialMessage: searchParams.get("message") ?? undefined,
      },
    };
  }

  const integratedSearchQuery = parseIntegratedSearchParams(queryRecord, {
    list_key: route.listKey,
  });
  const threadsPage = parsePage(searchParams.get("threads_page"), 1);

  const data = await loadWorkspaceData(
    route.listKey,
    route.threadId ?? undefined,
    threadsPage,
    50,
    integratedSearchQuery,
  );

  if (!data.listKey) {
    return {
      kind: "error",
      message: `Unknown mailing list: ${route.listKey}`,
    };
  }

  return {
    kind: "threads",
    props: {
      lists: data.lists,
      listKey: data.listKey,
      threads: data.threads,
      threadsPagination: data.threadsPagination,
      searchResults: data.searchResults,
      searchNextCursor: data.searchNextCursor,
      detail: data.detail,
      selectedThreadId: route.threadId,
      initialMessage: searchParams.get("message") ?? undefined,
    },
  };
}

async function buildSeriesView(
  route: Extract<AppRoute, { kind: "series" }>,
  searchParams: URLSearchParams,
): Promise<ViewState> {
  const queryRecord = toSearchRecord(searchParams);

  if (!route.listKey) {
    const { lists } = await loadListCatalog();
    return {
      kind: "series",
      props: {
        lists,
        selectedListKey: null,
        seriesItems: [],
        seriesPagination: EMPTY_SERIES_PAGINATION,
        selectedSeriesId: null,
        seriesDetail: null,
        selectedVersion: null,
        compare: null,
      },
    };
  }

  const seriesPage = parsePage(searchParams.get("series_page"), 1);
  const integratedSearchQuery = parseIntegratedSearchParams(queryRecord, {
    list_key: route.listKey,
  });

  const { lists } = await loadListCatalog();
  if (!lists.some((list) => list.list_key === route.listKey)) {
    return {
      kind: "error",
      message: `Unknown mailing list: ${route.listKey}`,
    };
  }

  if (!route.seriesId) {
    const centerData = await loadSeriesCenterData(seriesPage, integratedSearchQuery);

    return {
      kind: "series",
      props: {
        lists,
        selectedListKey: route.listKey,
        seriesItems: centerData.seriesItems,
        seriesPagination: centerData.seriesPagination,
        searchResults: centerData.searchResults,
        searchNextCursor: centerData.searchNextCursor,
        selectedSeriesId: null,
        seriesDetail: null,
        selectedVersion: null,
        compare: null,
      },
    };
  }

  const [centerData, seriesDetail] = await Promise.all([
    loadSeriesCenterData(seriesPage, integratedSearchQuery),
    getSeriesDetail(route.seriesId).catch(() => null),
  ]);

  if (!seriesDetail || !seriesDetail.lists.includes(route.listKey)) {
    return {
      kind: "error",
      message: `Series ${route.seriesId} is not available on ${route.listKey}`,
    };
  }

  const selectedVersionId =
    parsePositiveInt(searchParams.get("version")) ??
    seriesDetail.latest_version_id ??
    seriesDetail.versions[seriesDetail.versions.length - 1]?.series_version_id ??
    null;

  const selectedVersion = selectedVersionId
    ? await getSeriesVersion({
      seriesId: route.seriesId,
      seriesVersionId: selectedVersionId,
      assembled: true,
    })
    : null;

  const v1 = parsePositiveInt(searchParams.get("v1"));
  const v2 = parsePositiveInt(searchParams.get("v2"));
  const compareMode = parseCompareMode(searchParams.get("compare_mode"));

  const compare = v1 && v2
    ? await getSeriesCompare({
      seriesId: route.seriesId,
      v1,
      v2,
      mode: compareMode,
    })
    : null;

  return {
    kind: "series",
    props: {
      lists,
      selectedListKey: route.listKey,
      seriesItems: centerData.seriesItems,
      seriesPagination: centerData.seriesPagination,
      searchResults: centerData.searchResults,
      searchNextCursor: centerData.searchNextCursor,
      selectedSeriesId: route.seriesId,
      seriesDetail,
      selectedVersion,
      compare,
    },
  };
}

async function buildSearchView(searchParams: URLSearchParams): Promise<ViewState> {
  const queryRecord = toSearchRecord(searchParams);
  const { lists } = await loadListCatalog();
  const scope = parseScope(searchParams.get("scope"));
  const query = parseIntegratedSearchParams(queryRecord, { list_key: "" });
  const hybridEnabled = query.hybrid && scope !== "patch_item";

  const results = query.q
    ? await getSearch({
      q: query.q,
      scope,
      listKey: query.list_key || undefined,
      author: query.author || undefined,
      from: query.from || undefined,
      to: query.to || undefined,
      hasDiff: query.has_diff === "" ? undefined : query.has_diff === "true",
      sort: query.sort,
      cursor: query.cursor || undefined,
      limit: 20,
      hybrid: hybridEnabled,
      semanticRatio: hybridEnabled ? query.semantic_ratio : undefined,
    })
    : { items: [], facets: {}, highlights: {}, next_cursor: null };

  return {
    kind: "search",
    props: {
      lists,
      query: {
        q: query.q,
        scope,
        listKey: query.list_key,
        author: query.author,
        from: query.from,
        to: query.to,
        hasDiff: query.has_diff,
        sort: query.sort,
        hybrid: hybridEnabled,
        semanticRatio: query.semantic_ratio,
      },
      results,
    },
  };
}

async function buildDiffView(
  route: Extract<AppRoute, { kind: "diff" }>,
  searchParams: URLSearchParams,
): Promise<ViewState> {
  if (!route.patchItemId) {
    return {
      kind: "error",
      message: "Invalid diff route. Expected /diff/{patchItemId}.",
    };
  }

  const { lists } = await loadListCatalog();

  const patchItem = await getPatchItemDetail(route.patchItemId).catch(() => null);
  if (!patchItem) {
    return {
      kind: "error",
      message: `Patch item ${route.patchItemId} was not found.`,
    };
  }

  const [files, seriesDetail] = await Promise.all([
    getPatchItemFiles(route.patchItemId),
    getSeriesDetail(patchItem.series_id).catch(() => null),
  ]);

  return {
    kind: "diff",
    props: {
      lists,
      selectedListKey: seriesDetail?.lists[0] ?? null,
      patchItem,
      files: files.items,
      initialPath: searchParams.get("path") ?? undefined,
      initialView: searchParams.get("view") ?? undefined,
    },
  };
}

async function buildViewState(pathname: string, searchParams: URLSearchParams): Promise<ViewState> {
  const route = parseRoute(pathname);

  if (route.kind === "threads") {
    return buildThreadsView(route, searchParams);
  }

  if (route.kind === "series") {
    return buildSeriesView(route, searchParams);
  }

  if (route.kind === "search") {
    return buildSearchView(searchParams);
  }

  if (route.kind === "diff") {
    return buildDiffView(route, searchParams);
  }

  return {
    kind: "error",
    message: `Unknown route: ${pathname}`,
  };
}

function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  return <main className="workspace-frame">{children}</main>;
}

export function NexusClientApp() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [viewState, setViewState] = useState<ViewState>({ kind: "loading" });

  const currentQuery = useMemo(() => new URLSearchParams(searchKey), [searchKey]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setViewState({ kind: "loading" });

      try {
        const nextViewState = await buildViewState(pathname, currentQuery);
        if (!cancelled) {
          setViewState(nextViewState);
        }
      } catch (error) {
        if (!cancelled) {
          setViewState({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load workspace data",
          });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentQuery, pathname]);

  if (viewState.kind === "loading") {
    return (
      <WorkspaceFrame>
        <section className="workspace-status" role="status" aria-live="polite">
          Loading workspace…
        </section>
      </WorkspaceFrame>
    );
  }

  if (viewState.kind === "error") {
    return (
      <WorkspaceFrame>
        <section className="workspace-status is-error" role="alert">
          <p>{viewState.message}</p>
          <a className="ghost-button" href="/threads">
            Go to Threads
          </a>
        </section>
      </WorkspaceFrame>
    );
  }

  if (viewState.kind === "threads") {
    return <ThreadsWorkspace {...viewState.props} />;
  }

  if (viewState.kind === "series") {
    return <SeriesWorkspace {...viewState.props} />;
  }

  if (viewState.kind === "search") {
    return <SearchWorkspace {...viewState.props} />;
  }

  return <DiffWorkspace {...viewState.props} />;
}
