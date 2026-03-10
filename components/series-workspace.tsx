"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Button,
  ListRow,
  MetadataPill,
  Select,
  usePreferences,
  useTheme,
} from "@nexus/design-system";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { AppShell } from "@/components/app-shell";
import { ButtonToggleGroup } from "@/components/button-toggle-group";
import { IntegratedSearchBar } from "@/components/integrated-search-bar";
import { LeftRail } from "@/components/left-rail";
import { MessageDiffViewer } from "@/components/message-diff-viewer";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import { PaneEmptyState } from "@/components/pane-empty-state";
import { WorkspacePane } from "@/components/workspace-pane";
import { queryKeys } from "@/lib/api/query-keys";
import {
  getListDetail,
  getLists,
  getMessageBody,
  getPatchItemFullDiff,
  getSearch,
  getSeries,
  getSeriesCompare,
  getSeriesDetail,
  getSeriesVersion,
} from "@/lib/api/server-client";
import type { IntegratedSearchRow } from "@/lib/api/server-data";
import type {
  MainlineCommitInfo,
  MessageBodyResponse,
  PageInfoResponse,
  SearchItem,
  SeriesCompareResponse,
  SeriesCompareFileRow,
  SeriesMergeSummary,
  SeriesListItem,
  SeriesVersionPatchItem,
  SeriesThreadRef,
  SeriesVersionSummary,
  SeriesVersionResponse,
} from "@/lib/api/contracts";
import {
  formatAbsoluteAdditionCount,
  formatAbsoluteDeletionCount,
  formatCount,
  formatDateTime,
  formatRelativeTime,
  formatSignedDelta,
} from "@/lib/ui/format";
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

type SeriesDetailMode = "patchset" | "diff" | "compare";
const KERNEL_MAINLINE_COMMIT_BASE_URL =
  "https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=";

function parseSeriesDetailMode(
  value: string | null,
  compareExpanded: boolean,
): SeriesDetailMode {
  if (value === "patchset" || value === "diff" || value === "compare") {
    return value;
  }
  return compareExpanded ? "compare" : "patchset";
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function normalizeCoverBody(body: MessageBodyResponse | null): string | null {
  const text = body?.body_text?.trim();
  if (!text) {
    return null;
  }
  return text;
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
  mergeSummary: SeriesMergeSummary | null;
  isSelected: boolean;
  onOpen: () => void;
}

function versionBadgeLabels(version: Pick<SeriesVersionSummary, "is_rfc" | "is_resend" | "is_partial_reroll">): string[] {
  const labels: string[] = [];
  if (version.is_resend) {
    labels.push("resend");
  }
  if (version.is_partial_reroll) {
    labels.push("partial reroll");
  }
  return labels;
}

function formatRevisionLabel(
  version: Pick<SeriesVersionSummary, "is_rfc" | "version_num">,
): string {
  if (version.is_rfc) {
    return version.version_num <= 1 ? "RFC" : `RFC v${version.version_num}`;
  }
  return `PATCH v${version.version_num}`;
}

function isHexCommitSha(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{12,64}$/i.test(value));
}

function toShortCommitSha(value: string): string {
  return value.slice(0, 12);
}

function normalizeMergeState(value: unknown): SeriesMergeSummary["state"] {
  if (
    value === "unknown" ||
    value === "unmerged" ||
    value === "partial" ||
    value === "merged"
  ) {
    return value;
  }
  return "unknown";
}

function normalizeNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return null;
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function metadataMergeSummary(metadata: Record<string, unknown>): SeriesMergeSummary | null {
  const nested = metadata.merge_summary;
  const record =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : ({
          state: metadata.merge_state ?? metadata.mainline_merge_state,
          merged_in_tag: metadata.merged_in_tag ?? metadata.mainline_merged_in_tag,
          merged_in_release:
            metadata.merged_in_release ?? metadata.mainline_merged_in_release,
          merged_version_id:
            metadata.merged_version_id ?? metadata.mainline_merged_version_id,
          merged_commit_id:
            metadata.merged_commit_id ??
            metadata.mainline_single_patch_commit_oid ??
            metadata.mainline_merged_commit_id,
          matched_patch_count:
            metadata.matched_patch_count ?? metadata.mainline_matched_patch_count,
          total_patch_count:
            metadata.total_patch_count ?? metadata.mainline_total_patch_count,
        } as Record<string, unknown>);

  const state = normalizeMergeState(record.state);
  const mergedInTag = normalizeNullableString(record.merged_in_tag);
  const mergedInRelease = normalizeNullableString(record.merged_in_release);
  const mergedVersionId = normalizeNullableNumber(record.merged_version_id);
  const mergedCommitId = normalizeNullableString(record.merged_commit_id);
  const matchedPatchCount = normalizeNullableNumber(record.matched_patch_count);
  const totalPatchCount = normalizeNullableNumber(record.total_patch_count);

  const hasData =
    state !== "unknown" ||
    mergedInTag != null ||
    mergedInRelease != null ||
    mergedVersionId != null ||
    mergedCommitId != null ||
    matchedPatchCount != null ||
    totalPatchCount != null;

  if (!hasData) {
    return null;
  }

  return {
    state,
    merged_in_tag: mergedInTag,
    merged_in_release: mergedInRelease,
    merged_version_id: mergedVersionId,
    merged_commit_id: mergedCommitId,
    matched_patch_count: matchedPatchCount,
    total_patch_count: totalPatchCount,
  };
}

function mergeStateLabel(summary: Pick<SeriesMergeSummary, "state"> | null): string {
  switch (summary?.state) {
    case "merged":
      return "Merged";
    case "partial":
      return "Partial";
    case "unmerged":
      return "Unmerged";
    default:
      return "Unknown";
  }
}

function mergeStateClassName(summary: Pick<SeriesMergeSummary, "state"> | null): string {
  return `is-${summary?.state ?? "unknown"}`;
}

function mergeTargetLabel(summary: SeriesMergeSummary | null): string | null {
  if (!summary) {
    return null;
  }
  if (summary.merged_in_release) {
    return `release ${summary.merged_in_release}`;
  }
  if (summary.merged_in_tag) {
    return `tag ${summary.merged_in_tag}`;
  }
  if (summary.state === "partial" && summary.matched_patch_count != null && summary.total_patch_count != null) {
    return `${summary.matched_patch_count}/${summary.total_patch_count} patches`;
  }
  if (summary.state === "unmerged") {
    return "not in mainline";
  }
  return null;
}

function mergeDetailText(summary: SeriesMergeSummary | null): string {
  const stateLabel = mergeStateLabel(summary);
  const targetLabel = mergeTargetLabel(summary);
  return targetLabel ? `${stateLabel} · ${targetLabel}` : stateLabel;
}

function renderCommitLink(
  commit: string | null | undefined,
  fallback?: string,
) {
  if (!commit) {
    return fallback ?? null;
  }

  return (
    <a
      className="series-commit-link"
      href={`${KERNEL_MAINLINE_COMMIT_BASE_URL}${commit}`}
      target="_blank"
      rel="noreferrer"
      title={commit}
    >
      {toShortCommitSha(commit)}
    </a>
  );
}

function renderMainlineCommitMeta(mainlineCommit: MainlineCommitInfo | null) {
  if (!mainlineCommit) {
    return null;
  }

  const segments = [
    renderCommitLink(mainlineCommit.commit_id),
    mainlineCommit.merged_in_release ? `release ${mainlineCommit.merged_in_release}` : null,
    mainlineCommit.merged_in_tag ? `tag ${mainlineCommit.merged_in_tag}` : null,
  ].filter(Boolean);

  return (
    <span className="series-mainline-meta">
      mainline {segments.map((segment, index) => (
        <span key={`${mainlineCommit.commit_id}-${index}`}>
          {index > 0 ? " · " : null}
          {segment}
        </span>
      ))}
    </span>
  );
}

function formatAbsoluteDiffSummary(additions: number, deletions: number, hunks: number): string {
  return `${formatAbsoluteAdditionCount(additions)} / ${formatAbsoluteDeletionCount(deletions)} · hunks ${hunks}`;
}

function formatCompareDeltaSummary(file: Pick<
  SeriesCompareFileRow,
  "additions_delta" | "deletions_delta" | "hunks_delta"
>): string {
  return `delta: adds ${formatSignedDelta(file.additions_delta)} · dels ${formatSignedDelta(file.deletions_delta)} · hunks ${formatSignedDelta(file.hunks_delta)}`;
}

function compareFileStatusRank(status: SeriesCompareFileRow["status"]): number {
  switch (status) {
    case "changed":
      return 0;
    case "added":
      return 1;
    case "removed":
      return 2;
    default:
      return 3;
  }
}

function BaseCommitLink({
  commit,
  fallback,
}: {
  commit: string | null | undefined;
  fallback: string;
}) {
  if (!commit) {
    return fallback;
  }

  if (!isHexCommitSha(commit)) {
    return commit;
  }

  return (
    <a
      className="series-commit-link"
      href={`${KERNEL_MAINLINE_COMMIT_BASE_URL}${commit}`}
      target="_blank"
      rel="noreferrer"
      title={commit}
    >
      {toShortCommitSha(commit)}
    </a>
  );
}

function useNearViewport(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  rootMargin = "900px 0px",
) {
  const [isNearViewport, setIsNearViewport] = useState(enabled);

  useEffect(() => {
    if (enabled) {
      return;
    }

    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      return;
    }

    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (cancelled) {
          return;
        }

        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(element);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [enabled, ref, rootMargin]);

  return enabled || typeof IntersectionObserver === "undefined" || isNearViewport;
}

function SeriesPatchDiffSection({
  patch,
  isDarkTheme,
  priority,
}: {
  patch: SeriesVersionPatchItem;
  isDarkTheme: boolean;
  priority: boolean;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const sectionId = useId();
  const shouldLoadDiff = useNearViewport(sectionRef, priority);
  const diffQuery = useQuery({
    queryKey: queryKeys.patchItemDiff(patch.patch_item_id),
    enabled: patch.has_diff && shouldLoadDiff,
    staleTime: 5 * 60_000,
    queryFn: () => getPatchItemFullDiff(patch.patch_item_id),
  });

  return (
    <section
      ref={sectionRef}
      id={`patch-${patch.patch_item_id}`}
      data-section-id={sectionId}
      className="series-diff-section"
    >
      <header className="series-diff-section-header">
        <div className="series-diff-section-main">
          <div className="series-patch-card-title-row">
            <p
              className="series-cover-title"
              title={patch.commit_subject ?? patch.subject}
            >
              {patch.commit_subject ?? patch.subject}
            </p>
            <span className="thread-count-badge">
              {patch.total ? `${patch.ordinal}/${patch.total}` : String(patch.ordinal)}
            </span>
          </div>
          <p className="series-cover-meta">
            {formatAbsoluteDiffSummary(patch.additions, patch.deletions, patch.hunks)}
            {patch.inherited_from_version_num != null ? (
              <span className="series-patch-inherited">
                inherited from v{patch.inherited_from_version_num}
              </span>
            ) : null}
          </p>
          {renderMainlineCommitMeta(patch.mainline_commit)}
        </div>
      </header>

      {!patch.has_diff ? (
        <p className="series-diff-empty">
          No diff payload is available for this patch.
        </p>
      ) : diffQuery.isLoading ? (
        <p className="pane-inline-status">Loading patch diff…</p>
      ) : diffQuery.error ? (
        <p className="error-text">
          {toErrorMessage(diffQuery.error, "Failed to load patch diff")}
        </p>
      ) : diffQuery.data?.diff_text ? (
        <MessageDiffViewer
          messageId={patch.message_id}
          diffText={diffQuery.data.diff_text}
          isDarkTheme={isDarkTheme}
        />
      ) : (
        <p className="series-diff-empty">
          No diff payload is available for this patch.
        </p>
      )}
    </section>
  );
}

export function SeriesWorkspace({ selectedListKey, selectedSeriesId }: SeriesWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useDesktopViewport();
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const { navCollapsed, setNavCollapsed } = usePreferences();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const revisionPanelId = useId();
  const selectedRevisionTabRef = useRef<HTMLButtonElement | null>(null);
  const revisionTabRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const handledDiffScrollPatchIdRef = useRef<number | null>(null);

  const integratedSearchQuery = useMemo(
    () => readIntegratedSearchParams(searchParams, { list_key: selectedListKey ?? "" }),
    [searchParams, selectedListKey],
  );
  const integratedSearchMode = isSearchActive(integratedSearchQuery);

  const seriesCursor = searchParams.get("series_cursor") ?? "";
  const selectedVersionParam = parsePositiveInt(searchParams.get("version"));
  const detailModeParam = searchParams.get("mode");
  const v1 = parsePositiveInt(searchParams.get("v1"));
  const v2 = parsePositiveInt(searchParams.get("v2"));
  const legacyPatchParam = searchParams.get("patch");
  const legacyPathParam = searchParams.get("path");
  const legacyDiffScopeParam = searchParams.get("view");
  const diffViewParam = searchParams.get("diff_view");
  const legacyCompareModeParam = searchParams.get("compare_mode");
  const [pendingDiffScrollPatchId, setPendingDiffScrollPatchId] = useState<number | null>(null);

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
      merged:
        integratedSearchQuery.merged === ""
          ? undefined
          : integratedSearchQuery.merged === "true",
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
        merged:
          integratedSearchQuery.merged === ""
            ? undefined
            : integratedSearchQuery.merged === "true",
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
      merged: integratedSearchQuery.merged === "" ? undefined : integratedSearchQuery.merged === "true",
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
        merged:
          integratedSearchQuery.merged === ""
            ? undefined
            : integratedSearchQuery.merged === "true",
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
  const compareBaselineOptions =
    selectedVersionIndex > 0 ? versionOptions.slice(0, selectedVersionIndex) : EMPTY_VERSION_OPTIONS;
  const selectedCompareBaseline =
    compareBaselineOptions.find((version) => version.series_version_id === v1) ??
    compareBaseVersion;
  const compareExpanded = Boolean(v1 && v2);
  const detailMode = parseSeriesDetailMode(detailModeParam, compareExpanded);

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
      mode: "per_file",
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
        mode: "per_file",
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
  const revisionPatchItems = useMemo(
    () =>
      (selectedVersion?.patch_items ?? []).filter(
        (patch) => patch.item_type !== "cover",
      ),
    [selectedVersion?.patch_items],
  );

  const coverBodyQuery = useQuery({
    queryKey: queryKeys.messageBody({
      messageId: selectedVersion?.cover_message_id ?? 0,
      includeDiff: false,
    }),
    enabled: detailMode === "patchset" && Boolean(selectedVersion?.cover_message_id),
    queryFn: () =>
      getMessageBody({
        messageId: selectedVersion!.cover_message_id!,
        includeDiff: false,
        stripQuotes: true,
      }),
  });

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
      updateQuery({
        version: null,
        patch: null,
        path: null,
        view: null,
        diff_view: null,
        compare_mode: null,
      });
      return;
    }

    if (detailMode === "compare" && canCompareVersions && !compareExpanded) {
      if (selectedVersionSummaryId == null || compareBaseVersion == null) {
        updateQuery({ mode: "patchset" });
        return;
      }

      updateQuery({
        mode: "compare",
        version: String(selectedVersionSummaryId),
        v1: String(compareBaseVersion.series_version_id),
        v2: String(selectedVersionSummaryId),
        patch: null,
        path: null,
        view: null,
        diff_view: null,
        compare_mode: null,
      });
      return;
    }

    if (!canCompareVersions) {
      if (v1 == null && v2 == null && legacyCompareModeParam == null && detailMode !== "compare") {
        return;
      }

      updateQuery({
        mode: detailMode === "compare" ? "patchset" : null,
        v1: null,
        v2: null,
        diff_view: null,
        compare_mode: null,
      });
      return;
    }

    if (!compareExpanded) {
      if (legacyCompareModeParam != null || diffViewParam != null) {
        updateQuery({ compare_mode: null, diff_view: null });
      }
      return;
    }

    if (
      selectedVersionSummaryId == null ||
      v2 !== selectedVersionSummaryId ||
      selectedCompareBaseline == null
    ) {
      updateQuery({
        v1: null,
        v2: null,
        diff_view: null,
        compare_mode: null,
        mode: detailMode === "compare" ? "patchset" : null,
      });
      return;
    }

    if (legacyCompareModeParam != null || diffViewParam != null) {
      updateQuery({ compare_mode: null, diff_view: null });
    }
  }, [
    canCompareVersions,
    compareBaseVersion,
    compareExpanded,
    detailMode,
    diffViewParam,
    legacyCompareModeParam,
    selectedSeriesId,
    seriesDetail,
    selectedCompareBaseline,
    selectedVersionParam,
    selectedVersionSummaryId,
    updateQuery,
    v1,
    v2,
    versionOptions,
  ]);

  useEffect(() => {
    if (detailMode !== "diff" || !selectedVersion) {
      if (
        legacyPatchParam != null ||
        legacyPathParam != null ||
        legacyDiffScopeParam != null ||
        diffViewParam != null
      ) {
        updateQuery({ patch: null, path: null, view: null, diff_view: null });
      }
      return;
    }

    if (!revisionPatchItems.length) {
      updateQuery({ patch: null, path: null, view: null, diff_view: null, mode: "patchset" });
      return;
    }

    if (
      legacyPatchParam != null ||
      legacyPathParam != null ||
      legacyDiffScopeParam != null ||
      diffViewParam != null
    ) {
      updateQuery({ patch: null, path: null, view: null, diff_view: null });
    }
  }, [
    detailMode,
    diffViewParam,
    legacyDiffScopeParam,
    legacyPatchParam,
    legacyPathParam,
    revisionPatchItems.length,
    selectedVersion,
    updateQuery,
  ]);

  useEffect(() => {
    if (detailMode !== "diff") {
      handledDiffScrollPatchIdRef.current = null;
      return;
    }

    if (
      pendingDiffScrollPatchId == null ||
      handledDiffScrollPatchIdRef.current === pendingDiffScrollPatchId
    ) {
      return;
    }

    const section = document.getElementById(`patch-${pendingDiffScrollPatchId}`);
    if (!section) {
      return;
    }

    section.scrollIntoView({ block: "start" });
    handledDiffScrollPatchIdRef.current = pendingDiffScrollPatchId;
  }, [detailMode, pendingDiffScrollPatchId, revisionPatchItems.length]);

  useEffect(() => {
    const tab = selectedRevisionTabRef.current;
    if (!tab) {
      return;
    }

    tab.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedVersionSummaryId]);

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
        mode: null,
        version: null,
        patch: null,
        path: null,
        view: null,
        diff_view: null,
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
          mode: null,
          version: null,
          patch: null,
          path: null,
          view: null,
          diff_view: null,
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

  function openVersion(versionId: number) {
    const versionIndex = versionOptions.findIndex(
      (version) => version.series_version_id === versionId,
    );
    const previousVersion =
      versionIndex > 0 ? versionOptions[versionIndex - 1] ?? null : null;

    updateQuery({
      mode:
        detailMode === "compare" && previousVersion ? "compare" : "patchset",
      version: String(versionId),
      patch: null,
      path: null,
      view: null,
      diff_view: null,
      v1:
        detailMode === "compare" && previousVersion
          ? String(previousVersion.series_version_id)
          : null,
      v2:
        detailMode === "compare" && previousVersion ? String(versionId) : null,
      compare_mode: null,
    });
  }

  function openVersionAtIndex(index: number) {
    const targetVersion = descendingVersionOptions[index];
    if (!targetVersion) {
      return;
    }

    openVersion(targetVersion.series_version_id);
    revisionTabRefs.current[targetVersion.series_version_id]?.focus();
  }

  function onRevisionTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "ArrowLeft") {
      if (index <= 0) {
        return;
      }
      event.preventDefault();
      openVersionAtIndex(index - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      if (index >= descendingVersionOptions.length - 1) {
        return;
      }
      event.preventDefault();
      openVersionAtIndex(index + 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      openVersionAtIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      openVersionAtIndex(descendingVersionOptions.length - 1);
    }
  }

  const openDiscussionThread = useCallback(
    (threadRef: SeriesThreadRef, coverMessageId: number | null) => {
      router.push(getThreadMessagePath(threadRef.list_key, threadRef.thread_id, coverMessageId));
      setMobileNavOpen(false);
    },
    [router],
  );

  function openDetailMode(mode: SeriesDetailMode) {
    if (mode === "compare") {
      if (selectedVersionSummaryId == null || compareBaseVersion == null) {
        return;
      }

      updateQuery({
        mode: "compare",
        version: String(selectedVersionSummaryId),
        patch: null,
        path: null,
        view: null,
        diff_view: null,
        v1: String((selectedCompareBaseline ?? compareBaseVersion).series_version_id),
        v2: String(selectedVersionSummaryId),
        compare_mode: null,
      });
      return;
    }

    if (mode === "diff") {
      if (!selectedVersionSummaryId || !selectedVersion) {
        return;
      }

      updateQuery({
        mode: "diff",
        version: String(selectedVersionSummaryId),
        patch: null,
        path: null,
        view: null,
        diff_view: null,
        v1: null,
        v2: null,
        compare_mode: null,
      });
      return;
    }

    updateQuery({
      mode: "patchset",
      diff_view: null,
      v1: null,
      v2: null,
      compare_mode: null,
    });
  }

  function updateCompareBaseline(versionId: number) {
    if (!compareExpanded || v2 == null) {
      return;
    }

    updateQuery({ v1: String(versionId), compare_mode: null });
  }

  function openPatchDiff(patchItemId: number) {
    setPendingDiffScrollPatchId(patchItemId);
    updateQuery({
      mode: "diff",
      version: selectedVersionSummaryId ? String(selectedVersionSummaryId) : null,
      patch: null,
      path: null,
      view: null,
      diff_view: null,
      v1: null,
      v2: null,
      compare_mode: null,
    });
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
        mergeSummary: metadataMergeSummary(result.metadata),
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
      mergeSummary: series.merge_summary,
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
              <ListRow
                heading={
                  <span className="thread-subject" title={row.subject}>
                    {row.subject}
                  </span>
                }
                subtitle={
                  <span className="thread-author" title={row.authorEmail || "unknown"}>
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
                  </span>
                }
                meta={
                  <span className="thread-timestamps">
                    latest: {row.lastSeenAt ? (
                      <span title={formatDateTime(row.lastSeenAt)}>
                        {formatRelativeTime(row.lastSeenAt)}
                      </span>
                    ) : "unknown date"}
                    {row.mergeSummary ? <> · {mergeDetailText(row.mergeSummary)}</> : null}
                  </span>
                }
                badge={
                  <span className="series-row-badges">
                    <MetadataPill>v{row.latestVersionNum}</MetadataPill>
                    {row.mergeSummary ? (
                      <MetadataPill
                        className={`series-merge-pill ${mergeStateClassName(row.mergeSummary)}`}
                      >
                        {mergeStateLabel(row.mergeSummary)}
                      </MetadataPill>
                    ) : null}
                  </span>
                }
                selected={row.isSelected}
                onClick={row.onOpen}
                role="option"
                aria-selected={row.isSelected}
              />
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
  const selectedRevisionLabel = selectedVersionSummary
    ? formatRevisionLabel(selectedVersionSummary)
    : "";
  const selectedRevisionTabId = selectedVersionSummaryId != null
    ? `${revisionPanelId}-tab-${selectedVersionSummaryId}`
    : undefined;
  const selectedVersionSubject =
    selectedVersion?.subject_norm ??
    selectedVersion?.subject ??
    seriesDetail?.canonical_subject ??
    "";
  const selectedVersionBaseCommit =
    selectedVersion?.base_commit ?? selectedVersionSummary?.base_commit ?? null;
  const seriesMergeSummary = seriesDetail?.merge_summary ?? null;
  const selectedVersionMergeSummary =
    selectedVersion?.merge_summary ?? selectedVersionSummary?.merge_summary ?? null;
  const compareBaseline = selectedCompareBaseline ?? compareBaseVersion;
  const coverBodyText = normalizeCoverBody(coverBodyQuery.data ?? null);
  const selectedPatchsetItems = selectedVersion?.patch_items ?? [];
  const coverItem =
    selectedPatchsetItems.find((patch) => patch.item_type === "cover") ?? null;
  const patchRows = selectedPatchsetItems.filter((patch) => patch.item_type !== "cover");
  const primaryDiscussionThreadRef =
    selectedVersionThreadRefs.find((threadRef) => threadRef.list_key === selectedListKey) ??
    selectedVersionThreadRefs[0] ??
    null;
  const orderedDiscussionThreadRefs = [...selectedVersionThreadRefs].sort((left, right) => {
    const leftSelected = left.list_key === selectedListKey;
    const rightSelected = right.list_key === selectedListKey;
    if (leftSelected !== rightSelected) {
      return leftSelected ? -1 : 1;
    }
    return left.list_key.localeCompare(right.list_key);
  });
  const coverDisplaySubject = coverItem?.subject_norm ?? coverItem?.subject ?? "";
  const showCoverSubject =
    coverDisplaySubject.trim().length > 0 &&
    coverDisplaySubject.trim() !== selectedVersionSubject.trim();
  const showSelectedVersionSubject =
    selectedVersionSubject.trim().length > 0 &&
    selectedVersionSubject.trim() !== (seriesDetail?.canonical_subject ?? "").trim();
  const selectedRevisionMeta = selectedVersionSummary
    ? [
      `sent ${formatDateTime(selectedVersionSummary.sent_at)}`,
      mergeDetailText(selectedVersionMergeSummary),
      ...selectedVersionFlags,
    ].join(" · ")
    : "";
  const compareVisibleFiles = useMemo(
    () =>
      [...(compare?.files ?? [])]
        .filter((file) => file.status !== "unchanged")
        .sort((left, right) => {
          const statusDelta =
            compareFileStatusRank(left.status) - compareFileStatusRank(right.status);
          if (statusDelta !== 0) {
            return statusDelta;
          }
          return left.path.localeCompare(right.path);
        }),
    [compare?.files],
  );
  const hiddenCompareFileCount = Math.max(
    0,
    (compare?.files?.length ?? 0) - compareVisibleFiles.length,
  );
  const compareFileSummary = useMemo(
    () => ({
      changed: compareVisibleFiles.filter((file) => file.status === "changed").length,
      added: compareVisibleFiles.filter((file) => file.status === "added").length,
      removed: compareVisibleFiles.filter((file) => file.status === "removed").length,
    }),
    [compareVisibleFiles],
  );
  const detailModeOptions = [
    { value: "patchset" as const, label: "Patchset" },
    { value: "diff" as const, label: "Diff" },
    { value: "compare" as const, label: "Compare" },
  ].filter((option) => {
    if (option.value === "diff") {
      return revisionPatchItems.length > 0;
    }
    if (option.value === "compare") {
      return canCompareVersions;
    }
    return true;
  });

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
      bodyClassName="series-detail-pane-body"
      title="SERIES DETAIL"
      meta={<p className="thread-detail-header-count">{formatCount(seriesDetail.versions.length)} versions</p>}
      subtitle={seriesDetail.canonical_subject}
      subtitleTitle={seriesDetail.canonical_subject}
    >
      <div className="series-review-shell">
        {selectedVersionSummary ? (
          <>
            <div className="series-review-facts">
              <div className="series-fact-card">
                <p className="series-fact-label">Author</p>
                <p className="series-fact-value">
                  {seriesDetail.author.name
                    ? `${seriesDetail.author.name} <${seriesDetail.author.email}>`
                    : seriesDetail.author.email}
                </p>
              </div>
              <div className="series-fact-card">
                <p className="series-fact-label">Activity</p>
                <p className="series-fact-value">
                  {formatDateTime(seriesDetail.first_seen_at)} {"->"}{" "}
                  <span title={formatDateTime(seriesDetail.last_seen_at)}>
                    {formatRelativeTime(seriesDetail.last_seen_at)}
                  </span>
                </p>
              </div>
              <div className="series-fact-card">
                <p className="series-fact-label">Lists</p>
                <p className="series-fact-value">
                  {seriesDetail.lists.length ? seriesDetail.lists.join(", ") : "none"}
                </p>
              </div>
              <div className="series-fact-card">
                <p className="series-fact-label">Base Commit</p>
                <p className="series-fact-value">
                  <BaseCommitLink
                    commit={selectedVersionBaseCommit}
                    fallback="Not detected"
                  />
                </p>
              </div>
              <div className="series-fact-card">
                <p className="series-fact-label">Mainline</p>
                <p className="series-fact-value">{mergeStateLabel(seriesMergeSummary)}</p>
                {mergeTargetLabel(seriesMergeSummary) ? (
                  <p className="series-fact-subvalue">{mergeTargetLabel(seriesMergeSummary)}</p>
                ) : null}
                {seriesMergeSummary?.merged_commit_id ? (
                  <p className="series-fact-subvalue">
                    commit {renderCommitLink(seriesMergeSummary.merged_commit_id)}
                  </p>
                ) : null}
              </div>
            </div>

            <section
              className="series-review-main"
              id={`${revisionPanelId}-panel`}
              role="tabpanel"
              aria-labelledby={selectedRevisionTabId}
            >
              <div className="series-revision-tabbar">
                <div
                  className="series-revision-tablist"
                  role="tablist"
                  aria-label="Series revisions"
                  aria-orientation="horizontal"
                >
                  {descendingVersionOptions.map((version, index) => {
                    const isSelected = version.series_version_id === selectedVersionSummaryId;
                    const label = formatRevisionLabel(version);
                    return (
                      <button
                        key={version.series_version_id}
                        ref={(node) => {
                          revisionTabRefs.current[version.series_version_id] = node;
                          if (isSelected) {
                            selectedRevisionTabRef.current = node;
                          }
                        }}
                        type="button"
                        id={`${revisionPanelId}-tab-${version.series_version_id}`}
                        role="tab"
                        className={`series-revision-tab ${isSelected ? "is-selected" : ""}`}
                        onClick={() => openVersion(version.series_version_id)}
                        onKeyDown={(event) => onRevisionTabKeyDown(event, index)}
                        aria-selected={isSelected}
                        aria-controls={`${revisionPanelId}-panel`}
                        tabIndex={isSelected ? 0 : -1}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="series-review-main-content">
                <div className="series-current-header">
                  <div className="series-focus-main">
                    <h3 className="series-focus-title">{selectedRevisionLabel}</h3>
                    {showSelectedVersionSubject ? (
                      <p className="series-focus-subject" title={selectedVersionSubject}>
                        {selectedVersionSubject}
                      </p>
                    ) : null}
                    <p className="series-meta-line">{selectedRevisionMeta}</p>
                    <div className="series-row-badges">
                      <MetadataPill
                        className={`series-merge-pill ${mergeStateClassName(selectedVersionMergeSummary)}`}
                      >
                        {mergeStateLabel(selectedVersionMergeSummary)}
                      </MetadataPill>
                      {selectedVersionMergeSummary?.merged_in_release ? (
                        <MetadataPill variant="muted">
                          {selectedVersionMergeSummary.merged_in_release}
                        </MetadataPill>
                      ) : null}
                    </div>
                  </div>
                  <div className="series-current-actions">
                    {orderedDiscussionThreadRefs.length > 1 ? (
                      <div
                        className="series-discussion-actions"
                        role="group"
                        aria-label="Discussion threads"
                      >
                        {orderedDiscussionThreadRefs.map((threadRef) => (
                          <Button
                            key={`${threadRef.list_key}-${threadRef.thread_id}`}
                            variant="ghost"
                            size="sm"
                            className="series-discussion-chip"
                            title={`Open discussion on ${threadRef.list_key}`}
                            onClick={() =>
                              openDiscussionThread(
                                threadRef,
                                selectedVersionSummary.cover_message_id,
                              )
                            }
                          >
                            {threadRef.list_key}
                          </Button>
                        ))}
                      </div>
                    ) : primaryDiscussionThreadRef ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="series-discussion-chip"
                        title={`Open discussion on ${primaryDiscussionThreadRef.list_key}`}
                        onClick={() =>
                          openDiscussionThread(
                            primaryDiscussionThreadRef,
                            selectedVersionSummary.cover_message_id,
                          )
                        }
                      >
                        Discussion
                      </Button>
                    ) : null}
                    <ButtonToggleGroup
                      label="Series detail mode"
                      value={detailMode}
                      onChange={openDetailMode}
                      options={detailModeOptions}
                      className="series-mode-toggle"
                    />
                  </div>
                </div>

                {seriesVersionQuery.isFetching ? <p className="pane-inline-status">Refreshing revision…</p> : null}
                {seriesVersionQuery.error ? (
                  <p className="error-text">{toErrorMessage(seriesVersionQuery.error, "Failed to load selected revision")}</p>
                ) : null}

                {detailMode === "patchset" ? (
                  <div className="series-mode-panel">
                    <section className="series-review-section">
                      <div className="series-review-section-header">
                        <div>
                          <p className="pane-kicker">COVER LETTER</p>
                          <p className="pane-meta">
                            {coverItem ? "pinned first for series context" : "inferred from patch-only series"}
                          </p>
                        </div>
                        {coverItem ? (
                          <span className="series-focus-badge">
                            {coverItem.total ? `0/${coverItem.total}` : "cover"}
                          </span>
                        ) : null}
                      </div>
                      {coverItem ? (
                        <article className="series-cover-card">
                          {showCoverSubject ? (
                            <p className="series-cover-title" title={coverDisplaySubject}>
                              {coverDisplaySubject}
                            </p>
                          ) : null}
                          <p className="series-cover-meta">
                            {selectedVersionBaseCommit ? (
                              <>
                                base{" "}
                                <BaseCommitLink
                                  commit={selectedVersionBaseCommit}
                                  fallback="base commit not detected"
                                />
                              </>
                            ) : (
                              "base commit not detected"
                            )}
                          </p>
                          {coverBodyQuery.isLoading ? (
                            <p className="pane-inline-status">Loading cover letter…</p>
                          ) : coverBodyText ? (
                            <pre className="series-cover-preview">{coverBodyText}</pre>
                          ) : (
                            <p className="series-cover-empty">No cover letter available.</p>
                          )}
                        </article>
                      ) : (
                        <p className="series-cover-empty">
                          No cover letter was detected for this revision. Review starts from patch 1.
                        </p>
                      )}
                    </section>

                    <section className="series-review-section">
                      <div className="series-review-section-header">
                        <div>
                          <p className="pane-kicker">PATCH ITEMS</p>
                          <p className="pane-meta">
                            cover letter first, then ordered patch exploration.
                          </p>
                        </div>
                        <p className="pane-meta">{formatCount(selectedPatchsetItems.length)} items</p>
                      </div>
                      <ul className="series-patch-list">
                        {patchRows.map((patch) => (
                          <li key={patch.patch_item_id}>
                            {patch.has_diff ? (
                              <button
                                type="button"
                                className="series-patch-row"
                                onClick={() => openPatchDiff(patch.patch_item_id)}
                              >
                                <div className="series-patch-card-main">
                                  <div className="series-patch-card-title-row">
                                    <p
                                      className="thread-subject"
                                      title={patch.commit_subject ?? patch.subject}
                                    >
                                      {patch.commit_subject ?? patch.subject}
                                    </p>
                                    <span className="thread-count-badge">
                                      {patch.total ? `${patch.ordinal}/${patch.total}` : String(patch.ordinal)}
                                    </span>
                                  </div>
                                  <p className="thread-timestamps">
                                    {formatAbsoluteDiffSummary(
                                      patch.additions,
                                      patch.deletions,
                                      patch.hunks,
                                    )}
                                    {patch.inherited_from_version_num != null ? (
                                      <span className="series-patch-inherited">
                                        inherited from v{patch.inherited_from_version_num}
                                      </span>
                                    ) : null}
                                  </p>
                                  {renderMainlineCommitMeta(patch.mainline_commit)}
                                </div>
                                <span className="series-patch-row-affordance">Diff</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="series-patch-row"
                                onClick={() => openPatchDiff(patch.patch_item_id)}
                              >
                                <div className="series-patch-card-main">
                                  <div className="series-patch-card-title-row">
                                    <p
                                      className="thread-subject"
                                      title={patch.commit_subject ?? patch.subject}
                                    >
                                      {patch.commit_subject ?? patch.subject}
                                    </p>
                                    <span className="thread-count-badge">
                                      {patch.total ? `${patch.ordinal}/${patch.total}` : String(patch.ordinal)}
                                    </span>
                                  </div>
                                  <p className="thread-timestamps">
                                    {formatAbsoluteDiffSummary(
                                      patch.additions,
                                      patch.deletions,
                                      patch.hunks,
                                    )}
                                  </p>
                                  {renderMainlineCommitMeta(patch.mainline_commit)}
                                </div>
                                <span className="series-patch-row-affordance">Diff</span>
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                ) : detailMode === "diff" ? (
                  <div className="series-mode-panel">
                    <section className="series-review-section">
                      <div className="series-review-section-header series-diff-toolbar">
                        <div>
                          <p className="pane-kicker">PATCH DIFF</p>
                          <p className="pane-meta">
                            patches 1 through {revisionPatchItems.length}, stacked for scrolling
                          </p>
                        </div>
                        <p className="pane-meta">{formatCount(revisionPatchItems.length)} patches</p>
                      </div>

                      {revisionPatchItems.length ? (
                        <div className="series-diff-stack">
                          {revisionPatchItems.map((patch, index) => (
                            <SeriesPatchDiffSection
                              key={patch.patch_item_id}
                              patch={patch}
                              isDarkTheme={resolvedTheme === "dark"}
                              priority={
                                index < 2 ||
                                pendingDiffScrollPatchId === patch.patch_item_id
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <PaneEmptyState
                          kicker="Diff"
                          title="No patch items"
                          description="This revision does not expose any patch items to inspect."
                        />
                      )}
                    </section>
                  </div>
                ) : (
                  <div className="series-mode-panel">
                    <section className="series-review-section">
                      <div className="series-review-section-header series-compare-header">
                        <div>
                          <p className="pane-kicker">REVISION COMPARE</p>
                          <p className="pane-meta">
                            {compareBaseline
                              ? `v${compareBaseline.version_num} -> v${selectedVersionSummary.version_num}`
                              : "Select an earlier baseline"}
                          </p>
                        </div>
                        <div className="series-compare-control-group">
                          {compareBaselineOptions.length ? (
                            <label className="series-inline-field">
                              <span>Baseline</span>
                              <Select
                                value={compareBaseline?.series_version_id ?? ""}
                                onChange={(event) => updateCompareBaseline(Number(event.target.value))}
                              >
                                {compareBaselineOptions.map((version) => (
                                  <option key={version.series_version_id} value={version.series_version_id}>
                                    v{version.version_num}
                                  </option>
                                ))}
                              </Select>
                            </label>
                          ) : null}
                        </div>
                      </div>

                      {seriesCompareQuery.isLoading ? <p className="pane-inline-status">Loading compare data…</p> : null}
                      {seriesCompareQuery.error ? (
                        <p className="error-text">{toErrorMessage(seriesCompareQuery.error, "Failed to load compare data")}</p>
                      ) : null}

                    {compare ? (
                      <>
                          <div className="series-compare-summary">
                            <span className="series-focus-badge">changed {formatCount(compareFileSummary.changed)}</span>
                            <span className="series-focus-badge">added {formatCount(compareFileSummary.added)}</span>
                            <span className="series-focus-badge">removed {formatCount(compareFileSummary.removed)}</span>
                          </div>
                          <p className="series-meta-line">
                            file-level compare for v{compareBaseline?.version_num ?? "?"} {"->"} v{selectedVersionSummary.version_num}
                          </p>
                          {compareBaseline?.base_commit || selectedVersionBaseCommit ? (
                            <p className="series-meta-line">
                              base commit:{" "}
                              <BaseCommitLink
                                commit={compareBaseline?.base_commit ?? null}
                                fallback="unknown"
                              />{" "}
                              {"->"}{" "}
                              <BaseCommitLink
                                commit={selectedVersionBaseCommit}
                                fallback="unknown"
                              />
                            </p>
                          ) : null}
                          {hiddenCompareFileCount > 0 ? (
                            <p className="series-compare-empty-note">
                              {formatCount(hiddenCompareFileCount)} unchanged files omitted.
                            </p>
                          ) : null}

                          {compareVisibleFiles.length ? (
                            <ul className="series-compare-list">
                              {compareVisibleFiles.map((file) => (
                                <li key={file.path} className="series-compare-row">
                                  <div className="series-compare-row-main">
                                    <p className="series-compare-row-title">
                                      <span className={`series-compare-status is-${file.status}`}>
                                        {file.status}
                                      </span>
                                      <span>{file.path}</span>
                                    </p>
                                    <p className="series-compare-row-meta">
                                      {formatCompareDeltaSummary(file)}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="series-compare-empty-note">
                              No changed files between these revisions.
                            </p>
                          )}
                        </>
                      ) : null}
                    </section>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <PaneEmptyState
            kicker="Series"
            title="No revision selected"
            description="Choose a revision to inspect its lineage, cover letter, and patchset."
          />
        )}
      </div>
    </WorkspacePane>
  ) : (
    <section className="thread-detail-pane is-empty">
      <PaneEmptyState
        kicker="Series"
        title="Select a series"
        description="Choose a series from the list to inspect lineage, cover letter, and patch history."
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
    />
  );

  const mobileLeftRail = (
    <LeftRail
      lists={lists}
      selectedListKey={selectedListKey}
      showListSelector
      collapsed={false}
      themeMode={themeMode}
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
