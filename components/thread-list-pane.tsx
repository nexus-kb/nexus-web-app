"use client";

import type { RefObject } from "react";
import type { PaginationResponse, ThreadListItem } from "@/lib/api/contracts";
import { formatRelativeTime } from "@/lib/ui/format";

interface ThreadListPaneProps {
  listKey: string;
  threads: ThreadListItem[];
  pagination: PaginationResponse;
  selectedThreadId: number | null;
  keyboardThreadId: number | null;
  panelRef: RefObject<HTMLDivElement | null>;
  onSelectThread: (threadId: number) => void;
  onOpenThread: (threadId: number) => void;
  onPageChange: (page: number) => void;
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

export function ThreadListPane({
  listKey,
  threads,
  pagination,
  selectedThreadId,
  keyboardThreadId,
  panelRef,
  onSelectThread,
  onOpenThread,
  onPageChange,
}: ThreadListPaneProps) {
  const totalPages = Math.max(1, pagination.total_pages);
  const pageButtons = buildPageNumbers(pagination.page, totalPages);

  return (
    <section className="thread-list-pane" aria-label="Thread list" ref={panelRef} tabIndex={-1}>
      <header className="pane-header">
        <div>
          <p className="pane-kicker">List</p>
          <h1>{listKey}</h1>
        </div>
        <p className="pane-meta">{pagination.total_items} threads</p>
      </header>

      <ul className="thread-list" role="listbox" aria-label="Threads">
        {threads.map((thread) => {
          const isSelected = thread.thread_id === selectedThreadId;
          const isKeyboard = thread.thread_id === keyboardThreadId;

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
                  <p className="thread-subject">{thread.subject}</p>
                  <p className="thread-snippet">
                    {thread.participants.map((p) => p.name ?? p.email).join(", ")}
                  </p>
                </div>
                <div className="thread-row-meta">
                  <span>{thread.message_count}</span>
                  <span>{formatRelativeTime(thread.last_activity_at)}</span>
                  {thread.has_diff ? <span className="badge">diff</span> : null}
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
    </section>
  );
}
