"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button, usePreferences, useTheme } from "@nexus/design-system";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { IntegratedSearchBar } from "@/components/integrated-search-bar";
import { LeftRail } from "@/components/left-rail";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import { PaneEmptyState } from "@/components/pane-empty-state";
import { WorkspacePane } from "@/components/workspace-pane";
import { queryKeys } from "@/lib/api/query-keys";
import { getListDetail, getLists, getSearch, getSeries, getSeriesCompare, getSeriesDetail, getSeriesVersion } from "@/lib/api/server-client";
import type { IntegratedSearchRow } from "@/lib/api/server-data";
import type {
  PageInfoResponse,
  SearchItem,
  SeriesCompareResponse,
  SeriesListItem,
  SeriesThreadRef,
  SeriesVersionSummary,
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
import { useDesktopViewport } from "@/lib/ui/use-desktop-viewport";
import { usePathname, useRouter, useSearchParams } from "@/lib/ui/navigation";
import {
  getDiffPath,
  getSeriesDetailPath,
  getSeriesPath,
  getThreadMessagePath,
  normalizeRoutePath,
  parsePositiveInt,
  resolveSeriesSearchRoute,
} from "@/lib/ui/routes";

interface SeriesWorkspaceProps {
  selectedListKey: string | null;
  selectedSeriesId: number | null;
}

const EMPTY_SERIES_PAGE_INFO: PageInfoResponse = {
  limit: 30,
  next_cursor: null,
  prev_cursor: null,
  has_more: false,
};
const EMPTY_VERSION_OPTIONS: SeriesVersionSummary[] = [];

function parseCompareMode(value: string | null): "summary" | "per_patch" | "per_file" {
  if (value === "summary" || value === "per_patch" || value === "per_file") {
    return value;
  }
  return "summary";
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
    metadata: item.metadata,
  }));
}

function metadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function metadataNumber(
  metadata: Record<string, unknown>,
  key: string,
): number | null {
  const value = metadata[key];
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : null;
  if (raw == null || !Number.isFinite(raw)) {
    return null;
  }
  return Math.max(0, Math.trunc(raw));
}

function metadataBoolean(
  metadata: Record<string, unknown>,
  key: string,
): boolean | null {
  const value = metadata[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
  }
  return null;
}

interface SeriesRowViewModel {
  key: string;
  subject: string;
  authorEmail: string;
  lastSeenAt: string | null;
  isRfcLatest: boolean;
  latestVersionNum: number;
  isSelected: boolean;
  onOpen: () => void;
}

function versionBadgeLabels(version: Pick<SeriesVersionSummary, "is_rfc" | "is_resend" | "is_partial_reroll">): string[] {
  const labels: string[] = [];
  if (version.is_rfc) {
    labels.push("RFC");
  } else {
    labels.push("final");
  }
  if (version.is_resend) {
    labels.push("resend");
  }
  if (version.is_partial_reroll) {
    labels.push("partial reroll");
  }
  return labels;
}

function versionThreadLabel(threadRef: SeriesThreadRef): string {
  return `${threadRef.list_key} discussion`;
}

export function SeriesWorkspace({ selectedListKey, selectedSeriesId }: SeriesWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useDesktopViewport();
  const { themeMode, setThemeMode } = useTheme();
  const { densityMode, navCollapsed, setDensityMode, setNavCollapsed } = usePreferences();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileVersionsOpen, setMobileVersionsOpen] = useState(false);

  const integratedSearchQuery = useMemo(
    () => readIntegratedSearchParams(searchParams, { list_key: selectedListKey ?? "" }),
    [searchParams, selectedListKey],
  );
  const integratedSearchMode = isSearchActive(integratedSearchQuery);

  const seriesCursor = searchParams.get("series_cursor") ?? "";
  const selectedVersionParam = parsePositiveInt(searchParams.get("version"));
  const v1 = parsePositiveInt(searchParams.get("v1"));
  const v2 = parsePositiveInt(searchParams.get("v2"));
  const compareMode = parseCompareMode(searchParams.get("compare_mode"));

  const listsQuery = useQuery({
    queryKey: queryKeys.lists(),
    queryFn: () => getLists({ limit: 200 }),
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
  const listDetailQuery = useQuery({
    queryKey: queryKeys.listDetail(selectedListKey ?? ""),
    enabled: canQueryListResources,
    staleTime: 5 * 60_000,
    queryFn: () => getListDetail(selectedListKey!),
  });

  const seriesBrowseQuery = useQuery({
    queryKey: queryKeys.series({
      listKey: selectedListKey ?? undefined,
      limit: 30,
      cursor: seriesCursor || undefined,
      sort: integratedSearchQuery.sort === "date_asc" ? "last_seen_asc" : "last_seen_desc",
    }),
    enabled: canQueryListResources && !integratedSearchMode,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const activeListKey = selectedListKey!;
      return getSeries({
        listKey: activeListKey,
        limit: 30,
        cursor: seriesCursor || undefined,
        sort: integratedSearchQuery.sort === "date_asc" ? "last_seen_asc" : "last_seen_desc",
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
  const versionOptions = seriesDetail?.versions ?? EMPTY_VERSION_OPTIONS;
  const descendingVersionOptions = useMemo(
    () =>
      [...versionOptions].sort((left, right) => {
        if (left.version_num !== right.version_num) {
          return right.version_num - left.version_num;
        }
        return right.series_version_id - left.series_version_id;
      }),
    [versionOptions],
  );
  const canCompareVersions = versionOptions.length > 1;

  const selectedVersionId =
    v2 ??
    selectedVersionParam ??
    seriesDetail?.latest_version_id ??
    seriesDetail?.versions[seriesDetail.versions.length - 1]?.series_version_id ??
    null;
  const selectedVersionSummary =
    descendingVersionOptions.find((version) => version.series_version_id === selectedVersionId) ??
    descendingVersionOptions[0] ??
    null;
  const selectedVersionSummaryId = selectedVersionSummary?.series_version_id ?? null;
  const selectedVersionIndex = versionOptions.findIndex(
    (version) => version.series_version_id === selectedVersionSummaryId,
  );
  const compareBaseVersion =
    selectedVersionIndex > 0 ? versionOptions[selectedVersionIndex - 1] ?? null : null;
  const compareExpanded = Boolean(v1 && v2);

  const seriesVersionQuery = useQuery({
    queryKey: queryKeys.seriesVersion({
      seriesId: selectedSeriesId ?? 0,
      seriesVersionId: selectedVersionSummaryId ?? 0,
      assembled: true,
    }),
    enabled:
      Boolean(selectedSeriesId && selectedVersionSummaryId) &&
      Boolean(seriesDetail) &&
      !seriesMembershipError,
    placeholderData: keepPreviousData,
    queryFn: () =>
      getSeriesVersion({
        seriesId: selectedSeriesId!,
        seriesVersionId: selectedVersionSummaryId!,
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
    enabled:
      canCompareVersions &&
      compareExpanded &&
      Boolean(selectedSeriesId && v1 && v2) &&
      Boolean(seriesDetail) &&
      !seriesMembershipError,
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
  const seriesPageInfo = seriesBrowseQuery.data?.page_info ?? EMPTY_SERIES_PAGE_INFO;
  const mappedSearchResults = useMemo(
    () => toIntegratedSearchRows(seriesSearchQuery.data?.items ?? []),
    [seriesSearchQuery.data?.items],
  );
  const searchNextCursor =
    seriesSearchQuery.data?.page_info?.next_cursor ??
    ((seriesSearchQuery.data as { next_cursor?: string | null } | undefined)?.next_cursor ?? null);
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

  const buildPathWithQuery = useCallback(
    (basePath: string, updates: Record<string, string | null>) => {
      const sanitized = new URLSearchParams(searchParams.toString());
      sanitized.delete("theme");
      sanitized.delete("nav");
      sanitized.delete("density");
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

  useEffect(() => {
    if (!selectedSeriesId || !seriesDetail) {
      return;
    }

    const hasStaleVersionParam =
      selectedVersionParam != null &&
      !versionOptions.some((version) => version.series_version_id === selectedVersionParam);
    if (hasStaleVersionParam) {
      updateQuery({ version: null });
      return;
    }

    const compareModeParam = searchParams.get("compare_mode");
    if (!canCompareVersions) {
      if (v1 == null && v2 == null && compareModeParam == null) {
        return;
      }

      updateQuery({
        v1: null,
        v2: null,
        compare_mode: null,
      });
      return;
    }

    if (!compareExpanded) {
      if (compareModeParam != null) {
        updateQuery({ compare_mode: null });
      }
      return;
    }

    if (selectedVersionSummaryId == null || v2 !== selectedVersionSummaryId || compareBaseVersion == null) {
      updateQuery({
        v1: null,
        v2: null,
        compare_mode: null,
      });
    }
  }, [
    canCompareVersions,
    compareBaseVersion,
    compareExpanded,
    searchParams,
    selectedSeriesId,
    seriesDetail,
    selectedVersionParam,
    selectedVersionSummaryId,
    updateQuery,
    v1,
    v2,
    versionOptions,
  ]);

  const onSeriesNextPage = useCallback(
    (cursor: string) => {
      updateQuery({ series_cursor: cursor });
    },
    [updateQuery],
  );

  function onOpenSeries(seriesId: number) {
    if (!selectedListKey) {
      return;
    }

    router.push(
      buildPathWithQuery(getSeriesDetailPath(selectedListKey, seriesId), {
        series_cursor: seriesCursor || null,
        version: null,
        v1: null,
        v2: null,
        compare_mode: null,
      }),
    );
    setMobileNavOpen(false);
  }

  const onOpenSearchSeries = useCallback(
    (resolvedRoute: string) => {
      router.push(
        buildPathWithQuery(normalizeRoutePath(resolvedRoute), {
          series_cursor: null,
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
        series_cursor: null,
      });
    },
    [updateQuery],
  );

  const onClearIntegratedSearch = useCallback(
    (updates: IntegratedSearchUpdates) => {
      updateQuery({
        ...updates,
        series_cursor: null,
      });
    },
    [updateQuery],
  );

  const onSearchNextPage = useCallback(
    (cursor: string) => {
      updateQuery({
        cursor,
        series_cursor: null,
      });
    },
    [updateQuery],
  );

  const openVersion = useCallback(
    (versionId: number) => {
      updateQuery({
        version: String(versionId),
        v1: null,
        v2: null,
        compare_mode: null,
      });
      setMobileVersionsOpen(false);
    },
    [updateQuery],
  );

  const openDiscussionThread = useCallback(
    (threadRef: SeriesThreadRef, coverMessageId: number | null) => {
      router.push(getThreadMessagePath(threadRef.list_key, threadRef.thread_id, coverMessageId));
      setMobileNavOpen(false);
    },
    [router],
  );

  function toggleCompare() {
    if (compareExpanded) {
      updateQuery({
        v1: null,
        v2: null,
        compare_mode: null,
      });
      return;
    }

    if (selectedVersionSummaryId == null || compareBaseVersion == null) {
      return;
    }

    updateQuery({
      version: String(selectedVersionSummaryId),
      v1: String(compareBaseVersion.series_version_id),
      v2: String(selectedVersionSummaryId),
      compare_mode: compareMode === "summary" ? "per_patch" : compareMode,
    });
  }

  function updateCompareMode(mode: "summary" | "per_patch" | "per_file") {
    if (!compareExpanded || v1 == null || v2 == null) {
      return;
    }

    updateQuery({ compare_mode: mode });
  }

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

  const selectedSeriesRoute = pathname;
  const sortIsDate = integratedSearchQuery.sort === "date_desc" || integratedSearchQuery.sort === "date_asc";
  const nextDateSort = integratedSearchQuery.sort === "date_desc" ? "date_asc" : "date_desc";
  const canToggleSortOrder = !integratedSearchMode || sortIsDate;
  const sortToggleLabel = nextDateSort === "date_desc" ? "Sort newest first" : "Sort oldest first";
  const centerRows: SeriesRowViewModel[] = integratedSearchMode
    ? mappedSearchResults.map((result) => {
      const resolvedRoute = resolveSeriesSearchRoute({
        route: result.route,
        fallbackListKey: selectedListKey,
        itemId: result.id,
        metadataListKey: result.list_keys[0] ?? null,
      });
      return {
        key: `series-search-${result.id}-${result.route}`,
        subject: result.title,
        authorEmail: result.author_email ?? metadataString(result.metadata, "author_email") ?? "",
        lastSeenAt: result.date_utc,
        isRfcLatest:
          metadataBoolean(result.metadata, "is_rfc_latest") ??
          metadataBoolean(result.metadata, "is_rfc") ??
          false,
        latestVersionNum: metadataNumber(result.metadata, "latest_version_num") ?? 1,
        isSelected: normalizeRoutePath(resolvedRoute) === normalizeRoutePath(selectedSeriesRoute),
        onOpen: () => onOpenSearchSeries(resolvedRoute),
      };
    })
    : seriesItems.map((series) => ({
      key: String(series.series_id),
      subject: series.canonical_subject,
      authorEmail: series.author_email,
      lastSeenAt: series.last_seen_at,
      isRfcLatest: series.is_rfc_latest,
      latestVersionNum: series.latest_version_num,
      isSelected: series.series_id === selectedSeriesId,
      onOpen: () => onOpenSeries(series.series_id),
    }));
  const centerListAriaLabel = integratedSearchMode ? "Series search results" : "Series list";
  const centerLoadingMessage = integratedSearchMode ? "Loading search results…" : "Loading series…";
  const centerEmptyMessage = integratedSearchMode ? "No search results." : "No series found.";
  const centerPaginationLabel = integratedSearchMode ? "Series search pagination" : "Series pagination";
  const centerNextCursor = integratedSearchMode ? searchNextCursor : seriesPageInfo.next_cursor;
  const centerNextLabel = integratedSearchMode ? "Next page" : "Next";
  const onCenterNextPage = integratedSearchMode ? onSearchNextPage : onSeriesNextPage;
  const centerPaneMeta = listDetailQuery.data
    ? `${selectedListKey} | ${formatCount(listDetailQuery.data.counts.patch_series)} total series`
    : listDetailQuery.isLoading || listDetailQuery.isFetching
      ? `${selectedListKey} | Loading total series…`
      : `${selectedListKey} | Total series unavailable`;
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
    <WorkspacePane
      sectionClassName="thread-list-pane"
      title="SERIES"
      meta={<p className="pane-meta">{centerPaneMeta}</p>}
      controls={(
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
              <ArrowUp size={18} aria-hidden="true" />
            ) : (
              <ArrowDown size={18} aria-hidden="true" />
            )
          ) : (
            <ArrowUpDown size={18} aria-hidden="true" />
          )}
        </button>
      )}
    >
      <div className="pane-search-section">
        <IntegratedSearchBar
          scope="series"
          query={integratedSearchQuery}
          defaults={{ list_key: selectedListKey ?? "" }}
          onApply={onApplyIntegratedSearch}
          onClear={onClearIntegratedSearch}
        />
        {centerFetching ? <p className="pane-inline-status">Refreshing results…</p> : null}
      </div>

      <ul className="thread-list" role="listbox" aria-label={centerListAriaLabel}>
        {centerError && !centerRows.length ? (
          <li className="pane-empty-list-row pane-empty-list-row-error">{centerError}</li>
        ) : centerLoading && !centerRows.length ? (
          <li className="pane-empty-list-row">{centerLoadingMessage}</li>
        ) : centerRows.length ? (
          centerRows.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                className={`thread-row series-row ${row.isSelected ? "is-selected" : ""}`}
                onClick={row.onOpen}
                role="option"
                aria-selected={row.isSelected}
              >
                <div className="thread-row-main">
                  <p className="thread-subject" title={row.subject}>
                    {row.subject}
                  </p>
                  <p className="thread-author" title={row.authorEmail || "unknown"}>
                    {row.authorEmail ? (
                      <span
                        className="thread-author-filter"
                        onClick={(event) => {
                          event.stopPropagation();
                          applyAuthorFilter(row.authorEmail);
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        {row.authorEmail}
                      </span>
                    ) : (
                      "unknown"
                    )}
                  </p>
                  <p className="thread-timestamps">
                    latest: {row.lastSeenAt ? (
                      <span title={formatDateTime(row.lastSeenAt)}>
                        {formatRelativeTime(row.lastSeenAt)}
                      </span>
                    ) : "unknown date"} |{" "}
                    {row.isRfcLatest ? "RFC" : "final"}
                  </p>
                </div>
                <div className="thread-row-badge">
                  <span className="thread-count-badge">v{row.latestVersionNum}</span>
                </div>
              </button>
            </li>
          ))
        ) : (
          <li className="pane-empty-list-row">{centerEmptyMessage}</li>
        )}
      </ul>

      <footer className="pane-pagination" aria-label={centerPaginationLabel}>
        <div />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => centerNextCursor && onCenterNextPage(centerNextCursor)}
          disabled={!centerNextCursor}
        >
          {centerNextLabel}
        </Button>
      </footer>
    </WorkspacePane>
  );

  const selectedVersionThreadRefs = selectedVersionSummary?.thread_refs ?? [];
  const selectedVersionFlags = selectedVersionSummary ? versionBadgeLabels(selectedVersionSummary) : [];
  const selectedVersionSubject = selectedVersion?.subject ?? seriesDetail?.canonical_subject ?? "";
  const mobileVersionToggleLabel = mobileVersionsOpen ? "Hide all revisions" : "Show all revisions";

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
    <WorkspacePane
      sectionClassName="thread-detail-pane"
      title="SERIES DETAIL"
      meta={<p className="thread-detail-header-count">{formatCount(seriesDetail.versions.length)} versions</p>}
      subtitle={seriesDetail.canonical_subject}
      subtitleTitle={seriesDetail.canonical_subject}
    >
      <div className="series-detail-redesign">
        <section className="series-overview-strip">
          <p className="series-meta-line">
            author: {seriesDetail.author.name ? `${seriesDetail.author.name} <${seriesDetail.author.email}>` : seriesDetail.author.email}
          </p>
          <p className="series-meta-line">
            first seen: {formatDateTime(seriesDetail.first_seen_at)} | last seen: {" "}
            <span title={formatDateTime(seriesDetail.last_seen_at)}>
              {formatRelativeTime(seriesDetail.last_seen_at)}
            </span>
          </p>
          <p className="series-meta-line">
            lists: {seriesDetail.lists.length ? seriesDetail.lists.join(", ") : "none"}
          </p>
        </section>

        <div className="series-focus-layout">
          <section className="series-revision-panel">
            <div className="series-revision-panel-header">
              <div>
                <p className="pane-kicker">REVISIONS</p>
                <p className="pane-meta">
                  {selectedVersionSummary ? `selected v${selectedVersionSummary.version_num}` : "No revision selected"}
                </p>
              </div>
              {!isDesktop ? (
                <button
                  type="button"
                  className="series-mobile-toggle"
                  onClick={() => setMobileVersionsOpen((open) => !open)}
                  aria-expanded={mobileVersionsOpen}
                  aria-label={mobileVersionToggleLabel}
                >
                  {mobileVersionsOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
                </button>
              ) : null}
            </div>

            {isDesktop || mobileVersionsOpen ? (
              <ol className="series-version-list">
                {descendingVersionOptions.map((version) => {
                  const labels = versionBadgeLabels(version);
                  const isSelected = version.series_version_id === selectedVersionSummaryId;
                  return (
                    <li
                      key={version.series_version_id}
                      className={`series-version-card ${isSelected ? "is-selected" : ""}`}
                    >
                      <button
                        type="button"
                        className="series-version-select"
                        onClick={() => openVersion(version.series_version_id)}
                        aria-pressed={isSelected}
                      >
                        <div className="series-version-select-header">
                          <div className="series-version-select-title">
                            <span className="series-version-pill">v{version.version_num}</span>
                            {seriesDetail.latest_version_id === version.series_version_id ? (
                              <span className="series-version-current">latest</span>
                            ) : null}
                          </div>
                          <span className="series-version-date" title={formatDateTime(version.sent_at)}>
                            {formatRelativeTime(version.sent_at)}
                          </span>
                        </div>
                        <p className="series-version-meta">
                          {formatCount(version.patch_count)} patches | {labels.join(" | ")}
                        </p>
                        <p className="series-version-meta">
                          {version.thread_refs.length
                            ? `${formatCount(version.thread_refs[0]?.message_count ?? 0)} msgs | active ${formatRelativeTime(version.thread_refs[0]!.last_activity_at)}`
                            : "No archived discussion"}
                        </p>
                      </button>
                      <div className="series-thread-link-row">
                        {version.thread_refs.length ? (
                          version.thread_refs.map((threadRef) => (
                            <Button
                              key={`${version.series_version_id}-${threadRef.list_key}-${threadRef.thread_id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => openDiscussionThread(threadRef, version.cover_message_id)}
                            >
                              {threadRef.list_key} · {formatCount(threadRef.message_count)} msgs
                            </Button>
                          ))
                        ) : (
                          <span className="series-thread-link-empty">No archived discussion</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <button
                type="button"
                className="series-version-collapsed"
                onClick={() => setMobileVersionsOpen(true)}
              >
                Browse all {formatCount(seriesDetail.versions.length)} revisions
              </button>
            )}
          </section>

          <section className="series-focus-panel">
            {selectedVersionSummary ? (
              <>
                <div className="series-focus-header">
                  <div className="series-focus-main">
                    <div className="series-focus-title-row">
                      <h3 className="series-focus-title">v{selectedVersionSummary.version_num}</h3>
                      {selectedVersionFlags.map((label) => (
                        <span key={label} className="series-focus-badge">
                          {label}
                        </span>
                      ))}
                    </div>
                    <p className="series-focus-subject" title={selectedVersionSubject}>
                      {selectedVersionSubject}
                    </p>
                    <p className="series-meta-line">
                      sent: {formatDateTime(selectedVersionSummary.sent_at)}
                    </p>
                  </div>
                  <div className="series-focus-actions">
                    {compareBaseVersion ? (
                      <Button variant="ghost" size="sm" onClick={toggleCompare}>
                        {compareExpanded ? "Hide compare" : `Compare to v${compareBaseVersion.version_num}`}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <section className="series-focus-section">
                  <div className="series-focus-section-header">
                    <p className="pane-kicker">DISCUSSION</p>
                  </div>
                  {selectedVersionThreadRefs.length ? (
                    <div className="series-focus-thread-list">
                      {selectedVersionThreadRefs.map((threadRef) => (
                        <button
                          key={`${selectedVersionSummary.series_version_id}-${threadRef.list_key}-${threadRef.thread_id}`}
                          type="button"
                          className="series-focus-thread-card"
                          onClick={() => openDiscussionThread(threadRef, selectedVersionSummary.cover_message_id)}
                        >
                          <span className="series-focus-thread-title">{versionThreadLabel(threadRef)}</span>
                          <span className="series-focus-thread-meta">
                            {formatCount(threadRef.message_count)} msgs | last activity {" "}
                            <span title={formatDateTime(threadRef.last_activity_at)}>
                              {formatRelativeTime(threadRef.last_activity_at)}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="series-thread-link-empty">No archived discussion link</p>
                  )}
                </section>

                {seriesVersionQuery.isFetching ? <p className="pane-inline-status">Refreshing revision…</p> : null}
                {seriesVersionQuery.error ? (
                  <p className="error-text">{toErrorMessage(seriesVersionQuery.error, "Failed to load selected revision")}</p>
                ) : null}

                {compareExpanded ? (
                  <section className="series-focus-section series-compare-drawer">
                    <div className="series-focus-section-header series-compare-header">
                      <div>
                        <p className="pane-kicker">REVISION DELTA</p>
                        <p className="pane-meta">
                          {compareBaseVersion ? `v${compareBaseVersion.version_num} -> v${selectedVersionSummary.version_num}` : "Revision compare"}
                        </p>
                      </div>
                      <div className="series-compare-mode-row" role="tablist" aria-label="Compare modes">
                        {(["summary", "per_patch", "per_file"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={`series-compare-mode ${compareMode === mode ? "is-active" : ""}`}
                            onClick={() => updateCompareMode(mode)}
                            role="tab"
                            aria-selected={compareMode === mode}
                          >
                            {mode === "summary" ? "Summary" : mode === "per_patch" ? "Patch changes" : "File churn"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {seriesCompareQuery.isLoading ? <p className="pane-inline-status">Loading compare data…</p> : null}
                    {seriesCompareQuery.error ? (
                      <p className="error-text">{toErrorMessage(seriesCompareQuery.error, "Failed to load compare data")}</p>
                    ) : null}

                    {compare ? (
                      <>
                        <div className="series-compare-summary">
                          <span className="series-focus-badge">changed {formatCount(compare.summary.changed)}</span>
                          <span className="series-focus-badge">added {formatCount(compare.summary.added)}</span>
                          <span className="series-focus-badge">removed {formatCount(compare.summary.removed)}</span>
                        </div>
                        {compare.mode === "summary" ? (
                          <p className="series-meta-line">
                            v{selectedVersionSummary.version_num} has {formatCount(compare.summary.changed)} changed patches,
                            {" "}{formatCount(compare.summary.added)} additions, and {formatCount(compare.summary.removed)} removals versus
                            {" "}v{compareBaseVersion?.version_num ?? "?"}.
                          </p>
                        ) : null}
                        {compare.patches ? (
                          <ul className="series-compare-list">
                            {compare.patches.map((patch) => (
                              <li key={`${patch.slot}-${patch.title_norm}`} className="series-compare-row">
                                <div className="series-compare-row-main">
                                  <p className="series-compare-row-title">
                                    <strong>{patch.status}</strong> slot {patch.slot}: {patch.title_norm}
                                  </p>
                                  <p className="series-compare-row-meta">
                                    {patch.v1_subject ?? "missing in baseline"} | {patch.v2_subject ?? "missing in selected revision"}
                                  </p>
                                </div>
                                <div className="series-compare-row-actions">
                                  {patch.v1_patch_item_id ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => router.push(getDiffPath(patch.v1_patch_item_id!))}
                                    >
                                      v1 diff
                                    </Button>
                                  ) : null}
                                  {patch.v2_patch_item_id ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => router.push(getDiffPath(patch.v2_patch_item_id!))}
                                    >
                                      v2 diff
                                    </Button>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {compare.files ? (
                          <ul className="series-compare-list">
                            {compare.files.map((file) => (
                              <li key={file.path} className="series-compare-row">
                                <div className="series-compare-row-main">
                                  <p className="series-compare-row-title">
                                    <strong>{file.status}</strong> {file.path}
                                  </p>
                                  <p className="series-compare-row-meta">
                                    +{file.additions_delta} / -{file.deletions_delta} | hunks {file.hunks_delta}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : null}
                  </section>
                ) : null}

                {selectedVersion ? (
                  <section className="series-focus-section">
                    <div className="series-focus-section-header">
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
                                {patch.item_type === "cover" ? "Cover letter" : `Patch ${patch.ordinal}`}{" "}
                                {patch.inherited_from_version_num != null ? (
                                  <span className="series-patch-inherited">inherited from v{patch.inherited_from_version_num}</span>
                                ) : null}
                              </p>
                              <p className="series-patch-subject" title={patch.subject}>
                                {patch.subject}
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
              </>
            ) : (
              <PaneEmptyState
                kicker="Series"
                title="No revision selected"
                description="Choose a revision to inspect its patchset and discussion thread."
              />
            )}
          </section>
        </div>
      </div>
    </WorkspacePane>
  ) : (
    <section className="thread-detail-pane is-empty">
      <PaneEmptyState
        kicker="Series"
        title="Select a series"
        description="Choose a series from the list to inspect revisions and jump into their discussions."
      />
    </section>
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
      onSelectList={(listKey) => {
        router.push(getSeriesPath(listKey));
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
        router.push(getSeriesPath(listKey));
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

  if (isDesktop) {
    return (
      <AppShell
        navCollapsed={navCollapsed}
        centerWidth={420}
        leftRail={desktopLeftRail}
        centerPane={centerPane}
        detailPane={detailPane}
        onCenterResizeStart={(event) => event.preventDefault()}
      />
    );
  }

  return (
    <MobileStackRouter
      title="Series"
      showDetail={Boolean(selectedSeriesId)}
      navOpen={mobileNavOpen}
      onOpenNav={() => setMobileNavOpen(true)}
      onCloseNav={() => setMobileNavOpen(false)}
      onBackToList={() => router.push(getSeriesPath(selectedListKey))}
      leftRail={mobileLeftRail}
      listPane={centerPane}
      detailPane={detailPane}
    />
  );
}
