"use client";

import type { RefObject } from "react";
import type {
  MessageBodyResponse,
  PaginationResponse,
  ThreadDetailResponse,
  ThreadMessage,
} from "@/lib/api/contracts";
import { formatRelativeTime } from "@/lib/ui/format";

interface ThreadDetailPaneProps {
  detail: ThreadDetailResponse | null;
  panelRef: RefObject<HTMLDivElement | null>;
  selectedMessageId: number | null;
  expandedDiffMessageIds: Set<number>;
  messageBodies: Record<number, MessageBodyResponse | undefined>;
  loadingMessageIds: Set<number>;
  messageErrors: Record<number, string | undefined>;
  messagePagination: PaginationResponse | null;
  onSelectMessage: (message: ThreadMessage) => void;
  onToggleDiff: (message: ThreadMessage) => void;
  onCollapseAllDiffs: () => void;
  onExpandAllDiffs: () => void;
  onMessagePageChange: (page: number) => void;
}

function stripQuotedPreview(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .trim();
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

export function ThreadDetailPane({
  detail,
  panelRef,
  selectedMessageId,
  expandedDiffMessageIds,
  messageBodies,
  loadingMessageIds,
  messageErrors,
  messagePagination,
  onSelectMessage,
  onToggleDiff,
  onCollapseAllDiffs,
  onExpandAllDiffs,
  onMessagePageChange,
}: ThreadDetailPaneProps) {
  if (!detail) {
    return (
      <section className="thread-detail-pane is-empty" ref={panelRef} tabIndex={-1}>
        <div className="pane-empty">
          <p className="pane-kicker">Detail</p>
          <h2>Select a thread</h2>
          <p>Choose a thread from the list to open the conversation view.</p>
        </div>
      </section>
    );
  }

  const totalPages = Math.max(1, messagePagination?.total_pages ?? 1);
  const pageButtons = buildPageNumbers(messagePagination?.page ?? 1, totalPages);
  const hasDiffMessages = detail.messages.some((message) => message.has_diff);

  return (
    <section className="thread-detail-pane" ref={panelRef} tabIndex={-1} aria-label="Thread detail">
      <header className="pane-header">
        <div>
          <p className="pane-kicker">Conversation</p>
          <h2>{detail.subject}</h2>
        </div>
        <div className="thread-detail-header-actions">
          <p className="pane-meta">{messagePagination?.total_items ?? detail.messages.length} messages</p>
          {hasDiffMessages ? (
            <div className="thread-detail-toolbar" aria-label="Diff controls">
              <button
                type="button"
                className="icon-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCollapseAllDiffs();
                }}
                aria-label="Collapse all message diffs"
                title="Collapse all message diffs"
              >
                ⊟
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onExpandAllDiffs();
                }}
                aria-label="Expand all message diffs"
                title="Expand all message diffs"
              >
                ⊞
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <ul className="conversation-list">
        {detail.messages.map((message) => {
          const selected = selectedMessageId === message.message_id;
          const body = messageBodies[message.message_id];
          const previewSource = body?.body_text ?? message.body_text ?? message.snippet ?? "";
          const preview = stripQuotedPreview(previewSource);
          const expanded = expandedDiffMessageIds.has(message.message_id);
          const loading = loadingMessageIds.has(message.message_id);
          const error = messageErrors[message.message_id];

          return (
            <li key={message.message_id} className="conversation-item-wrapper">
              <article
                className={`conversation-item ${selected ? "is-selected" : ""}`}
                style={{ marginLeft: `${message.depth * 14}px` }}
                onClick={() => onSelectMessage(message)}
              >
                <header className="conversation-header">
                  <div>
                    <p className="author-line">
                      {message.from.name ?? message.from.email}
                      <span className="author-email">&nbsp;&lt;{message.from.email}&gt;</span>
                    </p>
                    <p className="muted">{message.subject}</p>
                  </div>
                  <div className="conversation-meta">
                    <span>{message.date_utc ? formatRelativeTime(message.date_utc) : "unknown"}</span>
                    {message.patch_item_id ? (
                      <a
                        className="ghost-button"
                        href={`/diff/${message.patch_item_id}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        Full patch
                      </a>
                    ) : null}
                    {message.has_diff ? (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleDiff(message);
                        }}
                      >
                        {expanded ? "Hide diff" : "Show diff"}
                      </button>
                    ) : null}
                  </div>
                </header>

                <p className="conversation-body-preview">{preview || "(no body text)"}</p>

                {!message.has_diff && error ? <p className="error-text">{error}</p> : null}

                {expanded ? (
                  <div className="diff-container">
                    {loading ? <p className="muted">Loading diff…</p> : null}
                    {!loading && error ? <p className="error-text">{error}</p> : null}
                    {!loading && !error && body?.diff_text ? <pre className="diff-block">{body.diff_text}</pre> : null}
                    {!loading && !error && !body?.diff_text ? (
                      <p className="muted">No diff text available for this message.</p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ul>

      {messagePagination ? (
        <footer className="pane-pagination" aria-label="Message pagination">
          <button
            type="button"
            className="ghost-button"
            onClick={() => onMessagePageChange(Math.max(1, messagePagination.page - 1))}
            disabled={!messagePagination.has_prev}
          >
            Prev
          </button>
          <div className="page-number-group">
            {pageButtons.map((page) => (
              <button
                key={page}
                type="button"
                className={`page-number ${page === messagePagination.page ? "is-current" : ""}`}
                onClick={() => onMessagePageChange(page)}
                aria-current={page === messagePagination.page ? "page" : undefined}
              >
                {page}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => onMessagePageChange(Math.min(totalPages, messagePagination.page + 1))}
            disabled={!messagePagination.has_next}
          >
            Next
          </button>
        </footer>
      ) : null}
    </section>
  );
}
