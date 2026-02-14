"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LeftRail } from "@/components/left-rail";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import type {
  ListSummary,
  PaginationResponse,
  SeriesCompareResponse,
  SeriesDetailResponse,
  SeriesListItem,
  SeriesVersionResponse,
} from "@/lib/api/contracts";
import { formatRelativeTime } from "@/lib/ui/format";
import { mergeSearchParams } from "@/lib/ui/query-state";
import {
  applyVisualTheme,
  parseNavMode,
  parseThemeMode,
  STORAGE_KEYS,
  type ThemeMode,
} from "@/lib/ui/preferences";
import { useDesktopViewport } from "@/lib/ui/use-desktop-viewport";

interface SeriesWorkspaceProps {
  lists: ListSummary[];
  selectedListKey: string;
  seriesItems: SeriesListItem[];
  seriesPagination: PaginationResponse;
  selectedSeriesId: number | null;
  seriesDetail: SeriesDetailResponse | null;
  selectedVersion: SeriesVersionResponse | null;
  compare: SeriesCompareResponse | null;
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
  selectedSeriesId,
  seriesDetail,
  selectedVersion,
  compare,
}: SeriesWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useDesktopViewport(true);

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

  const totalPages = Math.max(1, seriesPagination.total_pages);
  const pageButtons = buildPageNumbers(seriesPagination.page, totalPages);
  const versionOptions = seriesDetail?.versions ?? [];
  const mboxUrl =
    selectedSeriesId && selectedVersion
      ? `/api/series/${selectedSeriesId}/versions/${selectedVersion.series_version_id}/export/mbox?assembled=true&include_cover=false`
      : null;

  const centerPane = (
    <section className="thread-list-pane">
      <header className="pane-header">
        <div>
          <p className="pane-kicker">Series</p>
          <h1>Timeline</h1>
        </div>
        <p className="pane-meta">{seriesPagination.total_items} series</p>
      </header>

      <ul className="thread-list" role="listbox" aria-label="Series list">
        {seriesItems.map((series) => (
          <li key={series.series_id}>
            <button
              type="button"
              className={`thread-row ${series.series_id === selectedSeriesId ? "is-selected" : ""}`}
              onClick={() => onOpenSeries(series.series_id)}
              role="option"
              aria-selected={series.series_id === selectedSeriesId}
            >
              <div className="thread-row-main">
                <p className="thread-subject">{series.canonical_subject}</p>
                <p className="thread-snippet">{series.author_email}</p>
              </div>
              <div className="thread-row-meta">
                <span>v{series.latest_version_num}</span>
                <span>{formatRelativeTime(series.last_seen_at)}</span>
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
    </section>
  );

  const detailPane = selectedSeriesId && seriesDetail ? (
    <section className="thread-detail-pane">
      <header className="pane-header">
        <div>
          <p className="pane-kicker">Series Detail</p>
          <h2>{seriesDetail.canonical_subject}</h2>
        </div>
        <p className="pane-meta">{seriesDetail.author.email}</p>
      </header>

      <div className="series-detail-body">
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
              changed: {compare.summary.changed} | added: {compare.summary.added} | removed: {compare.summary.removed}
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

        {selectedVersion ? (
          <div className="series-version-patches">
            <p className="pane-kicker">Patch Items</p>
            <ul className="simple-list">
              {selectedVersion.patch_items.map((patch) => (
                <li key={patch.patch_item_id}>
                  <a href={`/diff/${patch.patch_item_id}`}>
                    [{patch.ordinal}] {patch.subject}
                  </a>
                </li>
              ))}
            </ul>
          </div>
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
          localStorage.setItem(STORAGE_KEYS.nav, next ? "collapsed" : "expanded");
          return next;
        });
      }}
      onSelectList={(listKey) => {
        router.push(`/lists/${encodeURIComponent(listKey)}/threads`);
        setMobileNavOpen(false);
      }}
      onThemeModeChange={(nextTheme) => {
        localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
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
      onBackToList={() => router.push("/series")}
      leftRail={leftRail}
      listPane={centerPane}
      detailPane={detailPane}
    />
  );
}
