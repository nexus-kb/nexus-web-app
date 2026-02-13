"use client";

import type { RefObject } from "react";
import type {
  MessageBodyResponse,
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
  onSelectMessage: (message: ThreadMessage) => void;
  onToggleDiff: (message: ThreadMessage) => void;
}

function stripQuotedPreview(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .trim();
}

export function ThreadDetailPane({
  detail,
  panelRef,
  selectedMessageId,
  expandedDiffMessageIds,
  messageBodies,
  loadingMessageIds,
  messageErrors,
  onSelectMessage,
  onToggleDiff,
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

  return (
    <section className="thread-detail-pane" ref={panelRef} tabIndex={-1} aria-label="Thread detail">
      <header className="pane-header">
        <div>
          <p className="pane-kicker">Conversation</p>
          <h2>{detail.subject}</h2>
        </div>
        <p className="pane-meta">{detail.messages.length} messages</p>
      </header>

      <ul className="conversation-list">
        {detail.messages.map((message) => {
          const selected = selectedMessageId === message.message_id;
          const body = messageBodies[message.message_id];
          const preview = stripQuotedPreview(body?.body_text ?? message.snippet);
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

                {error ? <p className="error-text">{error}</p> : null}

                {expanded ? (
                  <div className="diff-container">
                    {loading ? <p className="muted">Loading diff…</p> : null}
                    {!loading && body?.diff_text ? <pre className="diff-block">{body.diff_text}</pre> : null}
                    {!loading && !body?.diff_text ? (
                      <p className="muted">No diff text available for this message.</p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
