"use client";

import type { RefObject } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge, Button, ListRow } from "@nexus/design-system";
import { IntegratedSearchBar } from "@/components/integrated-search-bar";
import { WorkspacePane } from "@/components/workspace-pane";
import type {
  PageInfoResponse,
  ThreadListItem,
} from "@/lib/api/contracts";
import type { IntegratedSearchRow } from "@/lib/api/server-data";
import { formatCount, formatDateTime, formatRelativeTime } from "@/lib/ui/format";
import type {
  IntegratedSearchDefaults,
  IntegratedSearchQuery,
  IntegratedSearchUpdates,
} from "@/lib/ui/search-query";
import { toIntegratedSearchUpdates } from "@/lib/ui/search-query";

type ThreadBrowseSort = "activity_desc" | "date_desc" | "date_asc";

interface ThreadListPaneProps {
  headerMeta: string;
  threads: ThreadListItem[];
  pageInfo: PageInfoResponse;
  isLoading: boolean;
  isFetching: boolean;
  errorMessage: string | null;
  searchMode: boolean;
  searchQuery: IntegratedSearchQuery;
  searchDefaults: IntegratedSearchDefaults;
  browseSort: ThreadBrowseSort;
  searchResults: IntegratedSearchRow[];
  searchNextCursor: string | null;
  resolveSearchRoute: (result: IntegratedSearchRow) => string;
  selectedSearchRoute: string | null;
  keyboardSearchRoute: string | null;
  selectedThreadId: number | null;
  keyboardThreadId: number | null;
  panelRef: RefObject<HTMLDivElement | null>;
  onApplySearch: (updates: IntegratedSearchUpdates) => void;
  onClearSearch: (updates: IntegratedSearchUpdates) => void;
  onOpenSearchResult: (route: string) => void;
  onSearchNextPage: (cursor: string) => void;
  onSelectThread: (threadId: number) => void;
  onOpenThread: (threadId: number) => void;
  onToggleBrowseSort: (nextSort: ThreadBrowseSort) => void;
  onBrowseNextPage: (cursor: string) => void;
}

interface ThreadRowViewModel {
  key: string;
  subject: string;
  starter: string;
  starterEmail: string;
  createdAt: string | null;
  updatedAt: string | null;
  messageCount: number;
  isSelected: boolean;
  isKeyboard: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

function getThreadStarterLabel(thread: ThreadListItem): string {
  return thread.starter?.name ??
    thread.starter?.email ??
    thread.participants[0]?.name ??
    thread.participants[0]?.email ??
    "unknown";
}

function getThreadStarterEmail(thread: ThreadListItem): string {
  return thread.starter?.email ?? thread.participants[0]?.email ?? "";
}

function normalizeRoute(route: string): string {
  return route.split("?")[0] ?? route;
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

function metadataCount(
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

function metadataParticipants(metadata: Record<string, unknown>): string[] {
  const value = metadata.participants;
  if (!Array.isArray(value)) {
    return [];
  }
  const participants: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed.length > 0) {
        participants.push(trimmed);
      }
      continue;
    }
    if (
      entry &&
      typeof entry === "object" &&
      "email" in entry
    ) {
      const candidateEmail = (entry as { email?: unknown }).email;
      if (typeof candidateEmail !== "string") {
        continue;
      }
      const trimmed = candidateEmail.trim();
      if (trimmed.length > 0) {
        participants.push(trimmed);
      }
    }
  }
  return participants;
}

function getSearchStarterEmail(result: IntegratedSearchRow): string {
  return (
    metadataString(result.metadata, "starter_email") ??
    result.author_email ??
    metadataParticipants(result.metadata)[0] ??
    ""
  );
}

function getSearchStarterLabel(result: IntegratedSearchRow): string {
  const starterName = metadataString(result.metadata, "starter_name");
  if (starterName) {
    return starterName;
  }
  const starterEmail = getSearchStarterEmail(result);
  if (starterEmail) {
    return starterEmail;
  }
  return "unknown";
}

function getSearchCreatedAt(result: IntegratedSearchRow): string | null {
  return (
    metadataString(result.metadata, "created_at") ??
    metadataString(result.metadata, "last_activity_at") ??
    result.date_utc
  );
}

function getSearchLastActivityAt(result: IntegratedSearchRow): string | null {
  return (
    metadataString(result.metadata, "last_activity_at") ??
    result.date_utc ??
    metadataString(result.metadata, "created_at")
  );
}

function getSearchMessageCount(result: IntegratedSearchRow): number {
  return metadataCount(result.metadata, "message_count") ?? 0;
}

export function ThreadListPane({
  headerMeta,
  threads,
  pageInfo,
  isLoading,
  isFetching,
  errorMessage,
  searchMode,
  searchQuery,
  searchDefaults,
  browseSort,
  searchResults,
  searchNextCursor,
  resolveSearchRoute,
  selectedSearchRoute,
  keyboardSearchRoute,
  selectedThreadId,
  keyboardThreadId,
  panelRef,
  onApplySearch,
  onClearSearch,
  onOpenSearchResult,
  onSearchNextPage,
  onSelectThread,
  onOpenThread,
  onToggleBrowseSort,
  onBrowseNextPage,
}: ThreadListPaneProps) {
  const sortIsDate = browseSort === "date_desc" || browseSort === "date_asc";
  const nextBrowseSort =
    browseSort === "date_desc" ? "date_asc" : "date_desc";
  const sortToggleLabel = searchMode
    ? "Sorting disabled while search filters are active"
    : nextBrowseSort === "date_desc"
      ? "Sort newest first"
      : "Sort oldest first";
  const rows: ThreadRowViewModel[] = searchMode
    ? searchResults.map((result) => {
      const resolvedRoute = resolveSearchRoute(result);
      const routePath = normalizeRoute(resolvedRoute);
      return {
        key: `search-${result.id}-${result.route}`,
        subject: result.title,
        starter: getSearchStarterLabel(result),
        starterEmail: getSearchStarterEmail(result),
        createdAt: getSearchCreatedAt(result),
        updatedAt: getSearchLastActivityAt(result),
        messageCount: getSearchMessageCount(result),
        isSelected:
          selectedSearchRoute != null && normalizeRoute(selectedSearchRoute) === routePath,
        isKeyboard:
          keyboardSearchRoute != null && normalizeRoute(keyboardSearchRoute) === routePath,
        onSelect: () => onOpenSearchResult(resolvedRoute),
        onOpen: () => onOpenSearchResult(resolvedRoute),
      };
    })
    : threads.map((thread) => {
      const createdAt = thread.created_at ?? thread.last_activity_at;
      return {
        key: String(thread.thread_id),
        subject: thread.subject,
        starter: getThreadStarterLabel(thread),
        starterEmail: getThreadStarterEmail(thread),
        createdAt,
        updatedAt: thread.last_activity_at,
        messageCount: thread.message_count,
        isSelected: thread.thread_id === selectedThreadId,
        isKeyboard: thread.thread_id === keyboardThreadId,
        onSelect: () => onSelectThread(thread.thread_id),
        onOpen: () => onOpenThread(thread.thread_id),
      };
    });
  const listAriaLabel = searchMode ? "Search results" : "Threads";
  const loadingMessage = searchMode ? "Loading search results…" : "Loading threads…";
  const emptyMessage = searchMode ? "No search results." : null;
  const paginationLabel = searchMode ? "Search pagination" : "Thread pagination";
  const nextCursor = searchMode ? searchNextCursor : pageInfo.next_cursor;
  const nextLabel = searchMode ? "Next page" : "Next";
  const onNextPage = searchMode ? onSearchNextPage : onBrowseNextPage;
  return (
    <WorkspacePane
      sectionClassName="thread-list-pane"
      ariaLabel="Thread list"
      panelRef={panelRef}
      title="THREADS"
      meta={<p className="pane-meta">{headerMeta}</p>}
      controls={(
        <button
          type="button"
          className={`pane-sort-button ${sortIsDate ? "is-active" : ""}`}
          onClick={() => {
            if (searchMode) {
              return;
            }
            onToggleBrowseSort(nextBrowseSort);
          }}
          aria-label={sortToggleLabel}
          title={sortToggleLabel}
          aria-pressed={sortIsDate}
          disabled={searchMode}
        >
          {sortIsDate ? (
            browseSort === "date_asc" ? (
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
          scope="thread"
          query={searchQuery}
          defaults={searchDefaults}
          onApply={onApplySearch}
          onClear={onClearSearch}
        />
        {isFetching ? <p className="pane-inline-status">Refreshing results…</p> : null}
      </div>

      <ul className="thread-list" role="listbox" aria-label={listAriaLabel}>
        {errorMessage && !rows.length ? (
          <li className="pane-empty-list-row pane-empty-list-row-error">{errorMessage}</li>
        ) : isLoading && !rows.length ? (
          <li className="pane-empty-list-row">{loadingMessage}</li>
        ) : rows.length ? (
          rows.map((row) => (
            <li key={row.key}>
              <ListRow
                heading={
                  <span className="thread-subject" title={row.subject}>
                    {row.subject}
                  </span>
                }
                subtitle={
                  <span className="thread-author" title={row.starter}>
                    {row.starterEmail ? (
                      <span
                        className="thread-author-filter"
                        onClick={(event) => {
                          event.stopPropagation();
                          onApplySearch(
                            toIntegratedSearchUpdates(
                              {
                                ...searchQuery,
                                author: row.starterEmail,
                              },
                              searchDefaults,
                            ),
                          );
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        {row.starter}
                      </span>
                    ) : (
                      row.starter
                    )}
                  </span>
                }
                meta={
                  <span className="thread-timestamps">
                    created: {row.createdAt ? formatDateTime(row.createdAt) : "unknown date"} | updated:{" "}
                    {row.updatedAt ? (
                      <span title={formatDateTime(row.updatedAt)}>
                        {formatRelativeTime(row.updatedAt)}
                      </span>
                    ) : "unknown date"}
                  </span>
                }
                badge={<Badge>{formatCount(row.messageCount)}</Badge>}
                selected={row.isSelected}
                keyboardActive={row.isKeyboard}
                onClick={row.onSelect}
                onDoubleClick={row.onOpen}
                role="option"
                aria-selected={row.isSelected}
              />
            </li>
          ))
        ) : emptyMessage ? (
          <li className="pane-empty-list-row">{emptyMessage}</li>
        ) : null}
      </ul>

      <footer className="pane-pagination" aria-label={paginationLabel}>
        <div />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => nextCursor && onNextPage(nextCursor)}
          disabled={!nextCursor}
        >
          {nextLabel}
        </Button>
      </footer>
    </WorkspacePane>
  );
}
