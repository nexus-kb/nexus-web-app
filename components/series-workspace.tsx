"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { IntegratedSearchBar } from "@/components/integrated-search-bar";
import { LeftRail } from "@/components/left-rail";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import type { IntegratedSearchRow } from "@/lib/api/server-data";
import type {
  ListSummary,
  PaginationResponse,
  SeriesCompareResponse,
  SeriesDetailResponse,
  SeriesListItem,
  SeriesVersionResponse,
} from "@/lib/api/contracts";
import { formatCount, formatDateTime, formatRelativeTime } from "@/lib/ui/format";
import { mergeSearchParams } from "@/lib/ui/query-state";
import {
  isSearchActive,
  readIntegratedSearchParams,
  toIntegratedSearchUpdates,
  type IntegratedSearchDefaults,
  type IntegratedSearchUpdates,
} from "@/lib/ui/search-query";
import {
  applyVisualTheme,
  persistNavCollapsed,
  persistThemeMode,
  type ThemeMode,
} from "@/lib/ui/preferences";
import { useDesktopViewport } from "@/lib/ui/use-desktop-viewport";

interface SeriesWorkspaceProps {
  lists: ListSummary[];
  selectedListKey: string;
  seriesItems: SeriesListItem[];
  seriesPagination: PaginationResponse;
  searchResults?: IntegratedSearchRow[];
  searchNextCursor?: string | null;
  selectedSeriesId: number | null;
  seriesDetail: SeriesDetailResponse | null;
  selectedVersion: SeriesVersionResponse | null;
  compare: SeriesCompareResponse | null;
}

const SEARCH_DEFAULTS: IntegratedSearchDefaults = { list_key: "" };

function normalizeRoutePath(route: string): string {
  return route.split("?")[0] ?? route;
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

export function SeriesWorkspace({
  lists,
  selectedListKey,
  seriesItems,
  seriesPagination,
  searchResults,
  searchNextCursor,
  selectedSeriesId,
  seriesDetail,
  selectedVersion,
  compare,
}: SeriesWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useDesktopViewport(true);
  const integratedSearchQuery = useMemo(
    () => readIntegratedSearchParams(searchParams, { list_key: "" }),
    [searchParams],
  );
  const integratedSearchMode = isSearchActive(integratedSearchQuery);
  const mappedSearchResults = searchResults ?? [];

  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
      router.push(
        buildPathWithQuery(`/series/${seriesId}`, {
          series_page: String(seriesPagination.page),
          version: null,
          v1: null,
          v2: null,
          compare_mode: null,
        }),
      );
      setMobileNavOpen(false);
    },
    [buildPathWithQuery, router, seriesPagination.page],
  );

  const onOpenSearchSeries = useCallback(
    (route: string) => {
      router.push(
        buildPathWithQuery(normalizeRoutePath(route), {
          series_page: null,
          version: null,
          v1: null,
          v2: null,
          compare_mode: null,
        }),
      );
      setMobileNavOpen(false);
    },
    [buildPathWithQuery, router],
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
          SEARCH_DEFAULTS,
        ),
      );
    },
    [integratedSearchQuery, onApplyIntegratedSearch],
  );

  const totalPages = Math.max(1, seriesPagination.total_pages);
  const pageButtons = buildPageNumbers(seriesPagination.page, totalPages);
  const selectedSeriesRoute = pathname;
  const sortIsDate =
    integratedSearchQuery.sort === "date_desc" || integratedSearchQuery.sort === "date_asc";
  const nextDateSort = integratedSearchQuery.sort === "date_desc" ? "date_asc" : "date_desc";
  const canToggleSortOrder = !integratedSearchMode || sortIsDate;
  const sortToggleLabel = nextDateSort === "date_desc" ? "Sort newest first" : "Sort oldest first";
  const versionOptions = seriesDetail?.versions ?? [];
  const mboxUrl =
    selectedSeriesId && selectedVersion
      ? `/api/series/${selectedSeriesId}/versions/${selectedVersion.series_version_id}/export/mbox?assembled=true&include_cover=false`
      : null;

  const centerPane = (
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
                  SEARCH_DEFAULTS,
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
          defaults={{ list_key: "" }}
          onApply={onApplyIntegratedSearch}
          onClear={onClearIntegratedSearch}
        />
      </header>

      {integratedSearchMode ? (
        <>
          <ul className="thread-list" role="listbox" aria-label="Series search results">
            {mappedSearchResults.length ? (
              mappedSearchResults.map((result) => {
                const isSelected =
                  normalizeRoutePath(result.route) === normalizeRoutePath(selectedSeriesRoute);

                return (
                  <li key={`series-search-${result.id}-${result.route}`}>
                    <button
                      type="button"
                      className={`thread-row series-row search-row ${isSelected ? "is-selected" : ""}`}
                      onClick={() => onOpenSearchSeries(result.route)}
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
                        <span className="thread-count-badge">
                          {result.has_diff ? "diff" : "mail"}
                        </span>
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
            {seriesItems.map((series) => (
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
                      latest: {formatRelativeTime(series.last_seen_at)} |{" "}
                      {series.is_rfc_latest ? "RFC" : "final"}
                    </p>
                  </div>
                  <div className="thread-row-badge">
                    <span className="thread-count-badge">v{series.latest_version_num}</span>
                  </div>
                </button>
              </li>
            ))}
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

  const detailPane = selectedSeriesId && seriesDetail ? (
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
            first seen: {formatDateTime(seriesDetail.first_seen_at)} | last seen:{" "}
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
            {mboxUrl ? (
              <a href={mboxUrl} target="_blank" rel="noreferrer" className="ghost-button">
                Export mbox
              </a>
            ) : null}
          </div>
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

          {compare ? (
            <div className="compare-block">
              <p className="muted">
                changed: {compare.summary.changed} | added: {compare.summary.added} | removed:{" "}
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
                  <a className="series-patch-row" href={`/diff/${patch.patch_item_id}`}>
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
      <div className="pane-empty">
        <p className="pane-kicker">Series</p>
        <h2>Select a series</h2>
        <p>
          Choose a series from the list to inspect versions, compare changes, and export
          mbox.
        </p>
      </div>
    </section>
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
          persistNavCollapsed(next);
          return next;
        });
      }}
      onSelectList={(listKey) => {
        router.push(`/lists/${encodeURIComponent(listKey)}/threads`);
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
      onBackToList={() =>
        router.push(
          buildPathWithQuery("/series", {
            version: null,
            v1: null,
            v2: null,
            compare_mode: null,
          }),
        )
      }
      leftRail={leftRail}
      listPane={centerPane}
      detailPane={detailPane}
    />
  );
}
