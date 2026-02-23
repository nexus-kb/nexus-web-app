"use client";

import type { RefObject } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { IntegratedSearchBar } from "@/components/integrated-search-bar";
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
import { isSearchActive, toIntegratedSearchUpdates } from "@/lib/ui/search-query";

interface ThreadListPaneProps {
  listKey: string;
  threads: ThreadListItem[];
  pageInfo: PageInfoResponse;
  isLoading: boolean;
  isFetching: boolean;
  errorMessage: string | null;
  searchQuery: IntegratedSearchQuery;
  searchDefaults: IntegratedSearchDefaults;
  searchResults: IntegratedSearchRow[];
  searchNextCursor: string | null;
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
  onBrowseNextPage: (cursor: string) => void;
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

export function ThreadListPane({
  listKey,
  threads,
  pageInfo,
  isLoading,
  isFetching,
  errorMessage,
  searchQuery,
  searchDefaults,
  searchResults,
  searchNextCursor,
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
  onBrowseNextPage,
}: ThreadListPaneProps) {
  const searchMode = isSearchActive(searchQuery);
  const sortIsDate = searchQuery.sort === "date_desc" || searchQuery.sort === "date_asc";
  const nextDateSort = searchQuery.sort === "date_desc" ? "date_asc" : "date_desc";
  const canToggleSortOrder = !searchMode || sortIsDate;
  const sortToggleLabel = nextDateSort === "date_desc" ? "Sort newest first" : "Sort oldest first";
  const displayedSearchResults = searchResults;

  return (
    <section className="thread-list-pane" aria-label="Thread list" ref={panelRef} tabIndex={-1}>
      <header className="pane-header pane-header-with-search">
        <div className="pane-header-meta-row">
          <div>
            <p className="pane-kicker">LIST</p>
            <p className="pane-subtitle">
              {searchMode
                ? `Search | ${formatCount(searchResults.length)} results`
                : `${listKey} | browse`}
            </p>
          </div>
          <button
            type="button"
            className={`pane-sort-button ${sortIsDate ? "is-active" : ""}`}
            onClick={() => {
              if (!canToggleSortOrder) {
                return;
              }
              onApplySearch(
                toIntegratedSearchUpdates(
                  {
                    ...searchQuery,
                    sort: nextDateSort,
                  },
                  searchDefaults,
                ),
              );
            }}
            aria-label={sortToggleLabel}
            title={sortToggleLabel}
            aria-pressed={sortIsDate}
            disabled={!canToggleSortOrder}
          >
            {sortIsDate ? (
              searchQuery.sort === "date_asc" ? (
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
          scope="thread"
          query={searchQuery}
          defaults={searchDefaults}
          onApply={onApplySearch}
          onClear={onClearSearch}
        />
        {isFetching ? <p className="pane-inline-status">Refreshing results…</p> : null}
      </header>

      {searchMode ? (
        <>
          <ul className="thread-list" role="listbox" aria-label="Search results">
            {errorMessage && !displayedSearchResults.length ? (
              <li className="pane-empty-list-row pane-empty-list-row-error">{errorMessage}</li>
            ) : isLoading && !displayedSearchResults.length ? (
              <li className="pane-empty-list-row">Loading search results…</li>
            ) : displayedSearchResults.length ? (
              displayedSearchResults.map((result) => {
                const routePath = normalizeRoute(result.route);
                const isSelected =
                  selectedSearchRoute != null &&
                  normalizeRoute(selectedSearchRoute) === routePath;
                const isKeyboard =
                  keyboardSearchRoute != null &&
                  normalizeRoute(keyboardSearchRoute) === routePath;

                return (
                  <li key={`search-${result.id}-${result.route}`}>
                    <button
                      type="button"
                      className={`thread-row search-row ${isSelected ? "is-selected" : ""} ${isKeyboard ? "is-keyboard" : ""}`}
                      onClick={() => onOpenSearchResult(result.route)}
                      onDoubleClick={() => onOpenSearchResult(result.route)}
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
          <footer className="pane-pagination" aria-label="Search pagination">
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
          <ul className="thread-list" role="listbox" aria-label="Threads">
            {errorMessage && !threads.length ? (
              <li className="pane-empty-list-row pane-empty-list-row-error">{errorMessage}</li>
            ) : isLoading && !threads.length ? (
              <li className="pane-empty-list-row">Loading threads…</li>
            ) : threads.map((thread) => {
              const isSelected = thread.thread_id === selectedThreadId;
              const isKeyboard = thread.thread_id === keyboardThreadId;
              const createdAt = thread.created_at ?? thread.last_activity_at;
              const starter = getThreadStarterLabel(thread);
              const starterEmail = getThreadStarterEmail(thread);

              return (
                <li key={thread.thread_id}>
                  <button
                    type="button"
                    className={`thread-row ${isSelected ? "is-selected" : ""} ${isKeyboard ? "is-keyboard" : ""}`}
                    onClick={() => onSelectThread(thread.thread_id)}
                    onDoubleClick={() => onOpenThread(thread.thread_id)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="thread-row-main">
                      <p className="thread-subject" title={thread.subject}>
                        {thread.subject}
                      </p>
                      <p className="thread-author" title={starter}>
                        {starterEmail ? (
                          <span
                            className="thread-author-filter"
                            onClick={(event) => {
                              event.stopPropagation();
                              onApplySearch(
                                toIntegratedSearchUpdates(
                                  {
                                    ...searchQuery,
                                    author: starterEmail,
                                  },
                                  searchDefaults,
                                ),
                              );
                            }}
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            {starter}
                          </span>
                        ) : (
                          starter
                        )}
                      </p>
                      <p className="thread-timestamps">
                        created: {formatDateTime(createdAt)} | updated:{" "}
                        {formatRelativeTime(thread.last_activity_at)}
                      </p>
                    </div>
                    <div className="thread-row-badge">
                      <span className="thread-count-badge">{formatCount(thread.message_count)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <footer className="pane-pagination" aria-label="Thread pagination">
            <div />
            <button
              type="button"
              className="ghost-button"
              onClick={() => pageInfo.next_cursor && onBrowseNextPage(pageInfo.next_cursor)}
              disabled={!pageInfo.next_cursor}
            >
              Next
            </button>
          </footer>
        </>
      )}
    </section>
  );
}
