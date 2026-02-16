"use client";

import type { RefObject } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { IntegratedSearchBar } from "@/components/integrated-search-bar";
import type {
  PaginationResponse,
  ThreadListItem,
} from "@/lib/api/contracts";
import type { IntegratedSearchRow } from "@/lib/api/server-data";
import { formatCount, formatDateTime, formatRelativeTime } from "@/lib/ui/format";
import type {
  IntegratedSearchDefaults,
  IntegratedSearchQuery,
  IntegratedSearchUpdates,
} from "@/lib/ui/search-query";
import { isSearchActive } from "@/lib/ui/search-query";

interface ThreadListPaneProps {
  listKey: string;
  threads: ThreadListItem[];
  pagination: PaginationResponse;
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
  onPageChange: (page: number) => void;
}

function getThreadStarterLabel(thread: ThreadListItem): string {
  return thread.starter?.name ??
    thread.starter?.email ??
    thread.participants[0]?.name ??
    thread.participants[0]?.email ??
    "unknown";
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

function normalizeRoute(route: string): string {
  return route.split("?")[0] ?? route;
}

function toDateTimestamp(value: string | null): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortSearchRows(
  rows: IntegratedSearchRow[],
  sort: IntegratedSearchQuery["sort"],
): IntegratedSearchRow[] {
  if (sort !== "date_desc" && sort !== "date_asc") {
    return rows;
  }

  const multiplier = sort === "date_desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const delta = toDateTimestamp(a.date_utc) - toDateTimestamp(b.date_utc);
    if (delta !== 0) {
      return delta * multiplier;
    }
    return a.id - b.id;
  });
}

function toSearchUpdates(
  query: IntegratedSearchQuery,
  defaults: IntegratedSearchDefaults,
): IntegratedSearchUpdates {
  return {
    q: query.q || null,
    list_key: query.list_key && query.list_key !== defaults.list_key ? query.list_key : null,
    author: query.author || null,
    from: query.from || null,
    to: query.to || null,
    has_diff: query.has_diff || null,
    sort: query.sort === "relevance" ? null : query.sort,
    hybrid: query.hybrid ? "true" : null,
    semantic_ratio: query.hybrid ? String(query.semantic_ratio) : null,
    cursor: null,
  };
}

export function ThreadListPane({
  listKey,
  threads,
  pagination,
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
  onPageChange,
}: ThreadListPaneProps) {
  const searchMode = isSearchActive(searchQuery);
  const totalPages = Math.max(1, pagination.total_pages);
  const pageButtons = buildPageNumbers(pagination.page, totalPages);
  const sortIsDate = searchQuery.sort === "date_desc" || searchQuery.sort === "date_asc";
  const nextDateSort = searchQuery.sort === "date_desc" ? "date_asc" : "date_desc";
  const sortToggleLabel = nextDateSort === "date_desc" ? "Sort newest first" : "Sort oldest first";
  const displayedSearchResults = sortSearchRows(searchResults, searchQuery.sort);

  return (
    <section className="thread-list-pane" aria-label="Thread list" ref={panelRef} tabIndex={-1}>
      <header className="pane-header pane-header-with-search">
        <div className="pane-header-meta-row">
          <div>
            <p className="pane-kicker">LIST</p>
            <p className="pane-subtitle">
              {searchMode
                ? `Search | ${formatCount(searchResults.length)} results`
                : `${listKey} | ${formatCount(pagination.total_items)} threads`}
            </p>
          </div>
          <button
            type="button"
            className={`pane-sort-button ${sortIsDate ? "is-active" : ""}`}
            onClick={() => {
              onApplySearch(
                toSearchUpdates(
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
          key={`thread-search-${JSON.stringify(searchQuery)}`}
          scope="thread"
          query={searchQuery}
          defaults={searchDefaults}
          onApply={onApplySearch}
          onClear={onClearSearch}
        />
      </header>

      {searchMode ? (
        <>
          <ul className="thread-list" role="listbox" aria-label="Search results">
            {displayedSearchResults.length ? (
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
            {threads.map((thread) => {
              const isSelected = thread.thread_id === selectedThreadId;
              const isKeyboard = thread.thread_id === keyboardThreadId;
              const createdAt = thread.created_at ?? thread.last_activity_at;
              const starter = getThreadStarterLabel(thread);

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
                        {starter}
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
            <button
              type="button"
              className="ghost-button"
              onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
              disabled={!pagination.has_prev}
            >
              Prev
            </button>
            <div className="page-number-group">
              {pageButtons.map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`page-number ${page === pagination.page ? "is-current" : ""}`}
                  onClick={() => onPageChange(page)}
                  aria-current={page === pagination.page ? "page" : undefined}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => onPageChange(Math.min(totalPages, pagination.page + 1))}
              disabled={!pagination.has_next}
            >
              Next
            </button>
          </footer>
        </>
      )}
    </section>
  );
}
