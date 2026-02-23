"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { IntegratedSearchBar } from "@/components/integrated-search-bar";
import { LeftRail } from "@/components/left-rail";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import { PaneEmptyState } from "@/components/pane-empty-state";
import { queryKeys } from "@/lib/api/query-keys";
import { getLists, getSearch, getSeries, getSeriesCompare, getSeriesDetail, getSeriesVersion } from "@/lib/api/server-client";
import type { IntegratedSearchRow } from "@/lib/api/server-data";
import type {
  PaginationResponse,
  SearchItem,
  SeriesCompareResponse,
  SeriesListItem,
  SeriesVersionResponse,
} from "@/lib/api/contracts";
import { formatCount, formatDateTime, formatRelativeTime } from "@/lib/ui/format";
import { mergeSearchParams } from "@/lib/ui/query-state";
import {
  isSearchActive,
  readIntegratedSearchParams,
  toIntegratedSearchUpdates,
  type IntegratedSearchUpdates,
} from "@/lib/ui/search-query";
import {
  applyVisualTheme,
  getStoredNavCollapsed,
  getStoredThemeMode,
  persistNavCollapsed,
  persistThemeMode,
  type ThemeMode,
} from "@/lib/ui/preferences";
import { useDesktopViewport } from "@/lib/ui/use-desktop-viewport";
import { usePathname, useRouter, useSearchParams } from "@/lib/ui/navigation";
import {
  getDiffPath,
  getSeriesDetailPath,
  getSeriesPath,
  normalizeRoutePath,
  parsePositiveInt,
  resolveSeriesSearchRoute,
} from "@/lib/ui/routes";

interface SeriesWorkspaceProps {
  selectedListKey: string | null;
  selectedSeriesId: number | null;
}

const EMPTY_SERIES_PAGINATION: PaginationResponse = {
  page: 1,
  page_size: 30,
  total_items: 0,
  total_pages: 1,
  has_prev: false,
  has_next: false,
};

function parsePage(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parseCompareMode(value: string | null): "summary" | "per_patch" | "per_file" {
  if (value === "summary" || value === "per_patch" || value === "per_file") {
    return value;
  }
  return "summary";
}

function buildPageNumbers(current: number, total: number): number[] {
  if (total <= 1) {
    return [1];
  }

  const windowSize = 7;
  const start = Math.max(1, current - Math.floor(windowSize / 2));
  const end = Math.min(total, start + windowSize - 1);
  const adjustedStart = Math.max(1, end - windowSize + 1);

  const pages: number[] = [];
  for (let page = adjustedStart; page <= end; page += 1) {
    pages.push(page);
  }
  return pages;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function toIntegratedSearchRows(items: SearchItem[]): IntegratedSearchRow[] {
  return items.map((item) => ({
    id: item.id,
    route: item.route,
    title: item.title,
    snippet: item.snippet,
    date_utc: item.date_utc,
    list_keys: item.list_keys,
    author_email: item.author_email,
    has_diff: item.has_diff,
  }));
}

async function getAscendingSeriesPage(listKey: string, displayPage: number, pageSize: number) {
  const firstDescPage = await getSeries({
    listKey,
    page: 1,
    pageSize,
    sort: "last_seen_desc",
  });

  const totalPages = Math.max(1, firstDescPage.pagination.total_pages);
  const boundedDisplayPage = Math.min(Math.max(displayPage, 1), totalPages);
  const mirroredPage = totalPages - boundedDisplayPage + 1;
  const sourcePage =
    mirroredPage === 1
      ? firstDescPage
      : await getSeries({
          listKey,
          page: mirroredPage,
          pageSize,
          sort: "last_seen_desc",
        });

  return {
    items: [...sourcePage.items].reverse(),
    pagination: {
      ...sourcePage.pagination,
      page: boundedDisplayPage,
      has_prev: boundedDisplayPage > 1,
      has_next: boundedDisplayPage < totalPages,
    },
  };
}

export function SeriesWorkspace({ selectedListKey, selectedSeriesId }: SeriesWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useDesktopViewport(true);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());
  const [navCollapsed, setNavCollapsed] = useState(() => getStoredNavCollapsed());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const integratedSearchQuery = useMemo(
    () => readIntegratedSearchParams(searchParams, { list_key: selectedListKey ?? "" }),
    [searchParams, selectedListKey],
  );
  const integratedSearchMode = isSearchActive(integratedSearchQuery);

  const seriesPage = parsePage(searchParams.get("series_page"), 1);
  const selectedVersionParam = parsePositiveInt(searchParams.get("version"));
  const v1 = parsePositiveInt(searchParams.get("v1"));
  const v2 = parsePositiveInt(searchParams.get("v2"));
  const compareMode = parseCompareMode(searchParams.get("compare_mode"));

  const listsQuery = useQuery({
    queryKey: queryKeys.lists(),
    queryFn: () => getLists({ page: 1, pageSize: 200 }),
    staleTime: 5 * 60_000,
  });

  const lists = listsQuery.data?.items ?? [];
  const hasSelectedList = Boolean(selectedListKey);
  const selectedListKnown = !selectedListKey || lists.some((list) => list.list_key === selectedListKey);
  const listValidationReady = !selectedListKey || listsQuery.isSuccess;
  const canQueryListResources = Boolean(selectedListKey) && (!listValidationReady || selectedListKnown);
  const listError =
    hasSelectedList && listValidationReady && !selectedListKnown
      ? `Unknown mailing list: ${selectedListKey}`
      : null;

  const seriesBrowseQuery = useQuery({
    queryKey: queryKeys.series({
      listKey: selectedListKey ?? undefined,
      page: seriesPage,
      pageSize: 30,
      sort: "last_seen_desc",
    }),
    enabled: canQueryListResources && !integratedSearchMode,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const activeListKey = selectedListKey!;
      if (integratedSearchQuery.sort === "date_asc") {
        return getAscendingSeriesPage(activeListKey, seriesPage, 30);
      }

      return getSeries({
        listKey: activeListKey,
        page: seriesPage,
        pageSize: 30,
        sort: "last_seen_desc",
      });
    },
  });

  const seriesSearchQuery = useQuery({
    queryKey: queryKeys.search({
      q: integratedSearchQuery.q,
      scope: "series",
      listKey: integratedSearchQuery.list_key || undefined,
      author: integratedSearchQuery.author || undefined,
      from: integratedSearchQuery.from || undefined,
      to: integratedSearchQuery.to || undefined,
      hasDiff: integratedSearchQuery.has_diff === "" ? undefined : integratedSearchQuery.has_diff === "true",
      sort: integratedSearchQuery.sort,
      cursor: integratedSearchQuery.cursor || undefined,
      limit: 20,
      hybrid: integratedSearchQuery.hybrid,
      semanticRatio: integratedSearchQuery.hybrid ? integratedSearchQuery.semantic_ratio : undefined,
    }),
    enabled: canQueryListResources && integratedSearchMode,
    placeholderData: keepPreviousData,
    queryFn: () =>
      getSearch({
        q: integratedSearchQuery.q,
        scope: "series",
        listKey: integratedSearchQuery.list_key || undefined,
        author: integratedSearchQuery.author || undefined,
        from: integratedSearchQuery.from || undefined,
        to: integratedSearchQuery.to || undefined,
        hasDiff: integratedSearchQuery.has_diff === "" ? undefined : integratedSearchQuery.has_diff === "true",
        sort: integratedSearchQuery.sort,
        cursor: integratedSearchQuery.cursor || undefined,
        limit: 20,
        hybrid: integratedSearchQuery.hybrid,
        semanticRatio: integratedSearchQuery.hybrid ? integratedSearchQuery.semantic_ratio : undefined,
      }),
  });

  const seriesDetailQuery = useQuery({
    queryKey: queryKeys.seriesDetail(selectedSeriesId ?? 0),
    enabled: canQueryListResources && Boolean(selectedSeriesId),
    placeholderData: keepPreviousData,
    queryFn: () => getSeriesDetail(selectedSeriesId!),
  });

  const seriesDetail = seriesDetailQuery.data ?? null;
  const seriesMembershipError =
    seriesDetail && selectedListKey && !seriesDetail.lists.includes(selectedListKey)
      ? `Series ${seriesDetail.series_id} is not available on ${selectedListKey}`
      : null;

  const selectedVersionId =
    selectedVersionParam ??
    seriesDetail?.latest_version_id ??
    seriesDetail?.versions[seriesDetail.versions.length - 1]?.series_version_id ??
    null;

  const seriesVersionQuery = useQuery({
    queryKey: queryKeys.seriesVersion({
      seriesId: selectedSeriesId ?? 0,
      seriesVersionId: selectedVersionId ?? 0,
      assembled: true,
    }),
    enabled:
      Boolean(selectedSeriesId && selectedVersionId) &&
      Boolean(seriesDetail) &&
      !seriesMembershipError,
    placeholderData: keepPreviousData,
    queryFn: () =>
      getSeriesVersion({
        seriesId: selectedSeriesId!,
        seriesVersionId: selectedVersionId!,
        assembled: true,
      }),
  });

  const seriesCompareQuery = useQuery({
    queryKey: queryKeys.seriesCompare({
      seriesId: selectedSeriesId ?? 0,
      v1: v1 ?? 0,
      v2: v2 ?? 0,
      mode: compareMode,
    }),
    enabled: Boolean(selectedSeriesId && v1 && v2) && Boolean(seriesDetail) && !seriesMembershipError,
    placeholderData: keepPreviousData,
    queryFn: () =>
      getSeriesCompare({
        seriesId: selectedSeriesId!,
        v1: v1!,
        v2: v2!,
        mode: compareMode,
      }),
  });

  const seriesItems: SeriesListItem[] = seriesBrowseQuery.data?.items ?? [];
  const seriesPagination = seriesBrowseQuery.data?.pagination ?? EMPTY_SERIES_PAGINATION;
  const mappedSearchResults = useMemo(
    () => toIntegratedSearchRows(seriesSearchQuery.data?.items ?? []),
    [seriesSearchQuery.data?.items],
  );
  const searchNextCursor = seriesSearchQuery.data?.next_cursor ?? null;
  const selectedVersion: SeriesVersionResponse | null = seriesVersionQuery.data ?? null;
  const compare: SeriesCompareResponse | null = seriesCompareQuery.data ?? null;

  const centerError = listError ??
    (integratedSearchMode
      ? seriesSearchQuery.error
        ? toErrorMessage(seriesSearchQuery.error, "Failed to load series search results")
        : null
      : seriesBrowseQuery.error
        ? toErrorMessage(seriesBrowseQuery.error, "Failed to load series list")
        : null);

  const detailError =
    listError ??
    seriesMembershipError ??
    (seriesDetailQuery.error
      ? toErrorMessage(seriesDetailQuery.error, "Failed to load series detail")
      : null);

  const centerLoading =
    canQueryListResources && (integratedSearchMode ? seriesSearchQuery.isLoading : seriesBrowseQuery.isLoading);
  const centerFetching =
    canQueryListResources && (integratedSearchMode ? seriesSearchQuery.isFetching : seriesBrowseQuery.isFetching);

  useEffect(() => {
    applyVisualTheme(themeMode);
  }, [themeMode]);

  const buildPathWithQuery = useCallback(
    (basePath: string, updates: Record<string, string | null>) => {
      const sanitized = new URLSearchParams(searchParams.toString());
      sanitized.delete("theme");
      sanitized.delete("nav");
      const nextQuery = mergeSearchParams(sanitized, updates);
      return `${basePath}${nextQuery}`;
    },
    [searchParams],
  );

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      router.replace(buildPathWithQuery(pathname, updates), { scroll: false });
    },
    [buildPathWithQuery, pathname, router],
  );

  const onSeriesPageChange = useCallback(
    (page: number) => {
      updateQuery({ series_page: String(page) });
    },
    [updateQuery],
  );

  const onOpenSeries = useCallback(
    (seriesId: number) => {
      if (!selectedListKey) {
        return;
      }

      router.push(
        buildPathWithQuery(getSeriesDetailPath(selectedListKey, seriesId), {
          series_page: String(seriesPagination.page),
          version: null,
          v1: null,
          v2: null,
          compare_mode: null,
        }),
      );
      setMobileNavOpen(false);
    },
    [buildPathWithQuery, router, selectedListKey, seriesPagination.page],
  );

  const onOpenSearchSeries = useCallback(
    (route: string) => {
      const resolvedRoute = resolveSeriesSearchRoute({
        route,
        fallbackListKey: selectedListKey,
      });

      router.push(
        buildPathWithQuery(normalizeRoutePath(resolvedRoute), {
          series_page: null,
          version: null,
          v1: null,
          v2: null,
          compare_mode: null,
        }),
      );
      setMobileNavOpen(false);
    },
    [buildPathWithQuery, router, selectedListKey],
  );

  const onApplyIntegratedSearch = useCallback(
    (updates: IntegratedSearchUpdates) => {
      updateQuery({
        ...updates,
        series_page: null,
      });
    },
    [updateQuery],
  );

  const onClearIntegratedSearch = useCallback(
    (updates: IntegratedSearchUpdates) => {
      updateQuery({
        ...updates,
        series_page: null,
      });
    },
    [updateQuery],
  );

  const onSearchNextPage = useCallback(
    (cursor: string) => {
      updateQuery({
        cursor,
        series_page: null,
      });
    },
    [updateQuery],
  );

  const applyAuthorFilter = useCallback(
    (authorEmail: string) => {
      onApplyIntegratedSearch(
        toIntegratedSearchUpdates(
          {
            ...integratedSearchQuery,
            author: authorEmail,
          },
          { list_key: selectedListKey ?? "" },
        ),
      );
    },
    [integratedSearchQuery, onApplyIntegratedSearch, selectedListKey],
  );

  const totalPages = Math.max(1, seriesPagination.total_pages);
  const pageButtons = buildPageNumbers(seriesPagination.page, totalPages);
  const selectedSeriesRoute = pathname;
  const sortIsDate = integratedSearchQuery.sort === "date_desc" || integratedSearchQuery.sort === "date_asc";
  const nextDateSort = integratedSearchQuery.sort === "date_desc" ? "date_asc" : "date_desc";
  const canToggleSortOrder = !integratedSearchMode || sortIsDate;
  const sortToggleLabel = nextDateSort === "date_desc" ? "Sort newest first" : "Sort oldest first";
  const versionOptions = seriesDetail?.versions ?? [];

  const centerPane = !hasSelectedList ? (
    <section className="thread-list-pane is-empty">
      <PaneEmptyState
        kicker="Series"
        title="Select a list"
        description="Pick a mailing list from the sidebar to browse patch series."
      />
    </section>
  ) : listError ? (
    <section className="thread-list-pane is-empty">
      <PaneEmptyState
        kicker="Series"
        title="Unknown list"
        description={listError}
      />
    </section>
  ) : (
    <section className="thread-list-pane">
      <header className="pane-header pane-header-with-search">
        <div className="pane-header-meta-row">
          <div>
            <p className="pane-kicker">SERIES</p>
            <p className="pane-subtitle">
              {integratedSearchMode
                ? `Search | ${formatCount(mappedSearchResults.length)} results`
                : `TIMELINE | ${formatCount(seriesPagination.total_items)} series`}
            </p>
          </div>
          <button
            type="button"
            className={`pane-sort-button ${sortIsDate ? "is-active" : ""}`}
            onClick={() => {
              if (!canToggleSortOrder) {
                return;
              }
              onApplyIntegratedSearch(
                toIntegratedSearchUpdates(
                  {
                    ...integratedSearchQuery,
                    sort: nextDateSort,
                  },
                  { list_key: selectedListKey ?? "" },
                ),
              );
            }}
            aria-label={sortToggleLabel}
            title={sortToggleLabel}
            aria-pressed={sortIsDate}
            disabled={!canToggleSortOrder}
          >
            {sortIsDate ? (
              integratedSearchQuery.sort === "date_asc" ? (
                <ArrowUp size={14} aria-hidden="true" />
              ) : (
                <ArrowDown size={14} aria-hidden="true" />
              )
            ) : (
              <ArrowUpDown size={14} aria-hidden="true" />
            )}
          </button>
        </div>
        <IntegratedSearchBar
          scope="series"
          query={integratedSearchQuery}
          defaults={{ list_key: selectedListKey ?? "" }}
          onApply={onApplyIntegratedSearch}
          onClear={onClearIntegratedSearch}
        />
        {centerFetching ? <p className="pane-inline-status">Refreshing results…</p> : null}
      </header>

      {integratedSearchMode ? (
        <>
          <ul className="thread-list" role="listbox" aria-label="Series search results">
            {centerError && !mappedSearchResults.length ? (
              <li className="pane-empty-list-row pane-empty-list-row-error">{centerError}</li>
            ) : centerLoading && !mappedSearchResults.length ? (
              <li className="pane-empty-list-row">Loading search results…</li>
            ) : mappedSearchResults.length ? (
              mappedSearchResults.map((result) => {
                const resolvedRoute = resolveSeriesSearchRoute({
                  route: result.route,
                  fallbackListKey: selectedListKey,
                  itemId: result.id,
                  metadataListKey: result.list_keys[0] ?? null,
                });
                const isSelected =
                  normalizeRoutePath(resolvedRoute) === normalizeRoutePath(selectedSeriesRoute);

                return (
                  <li key={`series-search-${result.id}-${result.route}`}>
                    <button
                      type="button"
                      className={`thread-row series-row search-row ${isSelected ? "is-selected" : ""}`}
                      onClick={() => onOpenSearchSeries(resolvedRoute)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="thread-row-main">
                        <p className="thread-subject" title={result.title}>
                          {result.title}
                        </p>
                        {result.snippet ? (
                          <p className="thread-snippet" title={result.snippet}>
                            {result.snippet}
                          </p>
                        ) : null}
                        <p className="thread-timestamps">
                          {result.date_utc ? formatDateTime(result.date_utc) : "unknown date"}
                          {result.author_email ? ` | ${result.author_email}` : ""}
                          {result.list_keys.length ? ` | ${result.list_keys.join(", ")}` : ""}
                        </p>
                      </div>
                      <div className="thread-row-badge">
                        <span className="thread-count-badge">{result.has_diff ? "diff" : "mail"}</span>
                      </div>
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="pane-empty-list-row">No search results.</li>
            )}
          </ul>

          <footer className="pane-pagination" aria-label="Series search pagination">
            <div />
            <button
              type="button"
              className="ghost-button"
              onClick={() => searchNextCursor && onSearchNextPage(searchNextCursor)}
              disabled={!searchNextCursor}
            >
              Next page
            </button>
          </footer>
        </>
      ) : (
        <>
          <ul className="thread-list" role="listbox" aria-label="Series list">
            {centerError && !seriesItems.length ? (
              <li className="pane-empty-list-row pane-empty-list-row-error">{centerError}</li>
            ) : centerLoading && !seriesItems.length ? (
              <li className="pane-empty-list-row">Loading series…</li>
            ) : seriesItems.length ? (
              seriesItems.map((series) => (
                <li key={series.series_id}>
                  <button
                    type="button"
                    className={`thread-row series-row ${series.series_id === selectedSeriesId ? "is-selected" : ""}`}
                    onClick={() => onOpenSeries(series.series_id)}
                    role="option"
                    aria-selected={series.series_id === selectedSeriesId}
                  >
                    <div className="thread-row-main">
                      <p className="thread-subject" title={series.canonical_subject}>
                        {series.canonical_subject}
                      </p>
                      <p className="thread-author" title={series.author_email}>
                        <span
                          className="thread-author-filter"
                          onClick={(event) => {
                            event.stopPropagation();
                            applyAuthorFilter(series.author_email);
                          }}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          {series.author_email}
                        </span>
                      </p>
                      <p className="thread-timestamps">
                        latest: {formatRelativeTime(series.last_seen_at)} | {series.is_rfc_latest ? "RFC" : "final"}
                      </p>
                    </div>
                    <div className="thread-row-badge">
                      <span className="thread-count-badge">v{series.latest_version_num}</span>
                    </div>
                  </button>
                </li>
              ))
            ) : (
              <li className="pane-empty-list-row">No series found.</li>
            )}
          </ul>

          <footer className="pane-pagination" aria-label="Series pagination">
            <button
              type="button"
              className="ghost-button"
              onClick={() => onSeriesPageChange(Math.max(1, seriesPagination.page - 1))}
              disabled={!seriesPagination.has_prev}
            >
              Prev
            </button>
            <div className="page-number-group">
              {pageButtons.map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`page-number ${page === seriesPagination.page ? "is-current" : ""}`}
                  onClick={() => onSeriesPageChange(page)}
                  aria-current={page === seriesPagination.page ? "page" : undefined}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => onSeriesPageChange(Math.min(totalPages, seriesPagination.page + 1))}
              disabled={!seriesPagination.has_next}
            >
              Next
            </button>
          </footer>
        </>
      )}
    </section>
  );

  const detailPane = !hasSelectedList ? (
    <section className="thread-detail-pane is-empty">
      <PaneEmptyState
        kicker="Series"
        title="Select a list"
        description="Choose a mailing list from the sidebar to view series detail."
      />
    </section>
  ) : selectedSeriesId && !seriesDetail && seriesDetailQuery.isLoading ? (
    <section className="thread-detail-pane is-empty">
      <PaneEmptyState
        kicker="Series"
        title="Loading series"
        description="Fetching series metadata and versions for the selected item."
      />
    </section>
  ) : detailError ? (
    <section className="thread-detail-pane is-empty">
      <PaneEmptyState
        kicker="Series"
        title="Failed to load series"
        description={detailError}
      />
    </section>
  ) : selectedSeriesId && seriesDetail ? (
    <section className="thread-detail-pane">
      <header className="pane-header series-detail-pane-header">
        <div className="series-detail-header-top">
          <p className="pane-kicker">SERIES DETAIL</p>
          <p className="pane-meta">
            <button
              type="button"
              className="thread-author-badge series-detail-author-badge"
              onClick={() => applyAuthorFilter(seriesDetail.author.email)}
            >
              {seriesDetail.author.email}
            </button>
          </p>
        </div>
        <div className="series-detail-header-bottom">
          <h2 className="series-detail-header-subject" title={seriesDetail.canonical_subject}>
            {seriesDetail.canonical_subject}
          </h2>
          <span className="series-detail-header-separator" aria-hidden="true">
            |
          </span>
          <p className="series-detail-header-count">
            {formatCount(seriesDetail.versions.length)} versions
          </p>
        </div>
      </header>

      <div className="series-detail-body">
        <section className="series-card">
          <div className="series-card-header">
            <p className="pane-kicker">SERIES META</p>
          </div>
          <p className="series-meta-line">
            first seen: {formatDateTime(seriesDetail.first_seen_at)} | last seen: {" "}
            {formatRelativeTime(seriesDetail.last_seen_at)}
          </p>
          <p className="series-meta-line">
            lists: {seriesDetail.lists.length ? seriesDetail.lists.join(", ") : "none"}
          </p>
        </section>

        <section className="series-card">
          <div className="series-card-header">
            <p className="pane-kicker">VERSION</p>
          </div>
          <div className="inline-controls">
            <label>
              Version
              <select
                className="select-control"
                value={selectedVersion?.series_version_id ?? ""}
                onChange={(event) => updateQuery({ version: event.target.value || null })}
              >
                {versionOptions.map((version) => (
                  <option key={version.series_version_id} value={version.series_version_id}>
                    v{version.version_num} ({version.is_rfc ? "RFC" : "final"})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {seriesVersionQuery.isFetching ? <p className="pane-inline-status">Refreshing version…</p> : null}
          {seriesVersionQuery.error ? (
            <p className="error-text">{toErrorMessage(seriesVersionQuery.error, "Failed to load version")}</p>
          ) : null}
        </section>

        <section className="series-card">
          <div className="series-card-header">
            <p className="pane-kicker">COMPARE</p>
          </div>
          <div className="inline-controls">
            <label>
              Compare v1
              <select
                className="select-control"
                value={searchParams.get("v1") ?? ""}
                onChange={(event) => updateQuery({ v1: event.target.value || null })}
              >
                <option value="">None</option>
                {versionOptions.map((version) => (
                  <option key={`v1-${version.series_version_id}`} value={version.series_version_id}>
                    v{version.version_num}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Compare v2
              <select
                className="select-control"
                value={searchParams.get("v2") ?? ""}
                onChange={(event) => updateQuery({ v2: event.target.value || null })}
              >
                <option value="">None</option>
                {versionOptions.map((version) => (
                  <option key={`v2-${version.series_version_id}`} value={version.series_version_id}>
                    v{version.version_num}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mode
              <select
                className="select-control"
                value={searchParams.get("compare_mode") ?? "summary"}
                onChange={(event) => updateQuery({ compare_mode: event.target.value })}
              >
                <option value="summary">summary</option>
                <option value="per_patch">per_patch</option>
                <option value="per_file">per_file</option>
              </select>
            </label>
          </div>

          {seriesCompareQuery.isLoading ? <p className="pane-inline-status">Loading compare data…</p> : null}
          {seriesCompareQuery.error ? (
            <p className="error-text">{toErrorMessage(seriesCompareQuery.error, "Failed to load compare data")}</p>
          ) : null}

          {compare ? (
            <div className="compare-block">
              <p className="muted">
                changed: {compare.summary.changed} | added: {compare.summary.added} | removed: {" "}
                {compare.summary.removed}
              </p>
              {compare.patches ? (
                <ul className="simple-list">
                  {compare.patches.map((patch) => (
                    <li key={`${patch.slot}-${patch.title_norm}`}>
                      <strong>{patch.status}</strong> slot {patch.slot}: {patch.title_norm}
                    </li>
                  ))}
                </ul>
              ) : null}
              {compare.files ? (
                <ul className="simple-list">
                  {compare.files.map((file) => (
                    <li key={file.path}>
                      <strong>{file.status}</strong> {file.path} (+{file.additions_delta} / -{file.deletions_delta})
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        {selectedVersion ? (
          <section className="series-card">
            <div className="series-card-header">
              <p className="pane-kicker">PATCH ITEMS</p>
              <p className="pane-meta">{formatCount(selectedVersion.patch_items.length)} items</p>
            </div>
            <ul className="series-patch-list">
              {selectedVersion.patch_items.map((patch) => (
                <li key={patch.patch_item_id}>
                  <a
                    className="series-patch-row"
                    href={getDiffPath(patch.patch_item_id)}
                    onClick={(event) => {
                      event.preventDefault();
                      router.push(getDiffPath(patch.patch_item_id));
                    }}
                  >
                    <div className="thread-row-main">
                      <p className="thread-subject" title={patch.subject}>
                        [{patch.ordinal}] {patch.subject}
                      </p>
                      <p className="thread-timestamps">
                        +{patch.additions} / -{patch.deletions} | hunks: {patch.hunks}
                      </p>
                    </div>
                    <div className="thread-row-badge">
                      <span className="thread-count-badge">
                        {patch.total ? `${patch.ordinal}/${patch.total}` : String(patch.ordinal)}
                      </span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </section>
  ) : (
    <section className="thread-detail-pane is-empty">
      <PaneEmptyState
        kicker="Series"
        title="Select a series"
        description="Choose a series from the list to inspect versions and compare changes."
      />
    </section>
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
      onSelectList={(listKey) => {
        router.push(getSeriesPath(listKey));
        setMobileNavOpen(false);
      }}
      onThemeModeChange={(nextTheme) => {
        persistThemeMode(nextTheme);
        setThemeMode(nextTheme);
      }}
    />
  );

  if (isDesktop) {
    return (
      <AppShell
        navCollapsed={navCollapsed}
        centerWidth={420}
        leftRail={leftRail}
        centerPane={centerPane}
        detailPane={detailPane}
        onCenterResizeStart={(event) => event.preventDefault()}
      />
    );
  }

  return (
    <MobileStackRouter
      showDetail={Boolean(selectedSeriesId)}
      navOpen={mobileNavOpen}
      onOpenNav={() => setMobileNavOpen(true)}
      onCloseNav={() => setMobileNavOpen(false)}
      onBackToList={() => router.push(getSeriesPath(selectedListKey))}
      leftRail={leftRail}
      listPane={centerPane}
      detailPane={detailPane}
    />
  );
}
