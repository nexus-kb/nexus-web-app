"use client";

import { Minus, Plus } from "lucide-react";
import type { RefObject } from "react";
import { MessageDiffViewer } from "@/components/message-diff-viewer";
import type {
  MessageBodyResponse,
  ThreadDetailResponse,
  ThreadMessage,
} from "@/lib/api/contracts";
import { formatCount, formatRelativeTime } from "@/lib/ui/format";

interface ThreadDetailPaneProps {
  detail: ThreadDetailResponse | null;
  panelRef: RefObject<HTMLDivElement | null>;
  selectedMessageId: number | null;
  expandedMessageIds: Set<number>;
  expandedDiffMessageIds: Set<number>;
  messageBodies: Record<number, MessageBodyResponse | undefined>;
  loadingMessageIds: Set<number>;
  messageErrors: Record<number, string | undefined>;
  onToggleMessageCard: (message: ThreadMessage) => void;
  onToggleDiffCard: (message: ThreadMessage) => void;
  onCollapseAllCards: () => void;
  onExpandAllCards: () => void;
}

function stripQuotedPreview(text: string): string {
  return text.trim();
}

function findDiffStartIndex(text: string): number {
  const markers = [
    /^diff --git /m,
    /^Index: /m,
    /^--- a\/.+$/m,
    /^\+\+\+ b\/.+$/m,
    /^@@ .+ @@/m,
  ];

  let earliest = -1;
  for (const pattern of markers) {
    const match = pattern.exec(text);
    if (!match || match.index < 0) {
      continue;
    }
    if (earliest === -1 || match.index < earliest) {
      earliest = match.index;
    }
  }

  return earliest;
}

function stripDiffFromPreview(preview: string, diffText: string | null): string {
  if (!preview) {
    return preview;
  }

  const normalizedPreview = preview.replace(/\r\n/g, "\n");
  const normalizedDiff = diffText?.replace(/\r\n/g, "\n").trim() ?? "";

  if (normalizedDiff) {
    const withTrailing = normalizedPreview.indexOf(normalizedDiff);
    if (withTrailing >= 0) {
      return normalizedPreview.slice(0, withTrailing).trimEnd();
    }

    const withoutTrailing = normalizedPreview.indexOf(
      normalizedDiff.replace(/\n+$/g, ""),
    );
    if (withoutTrailing >= 0) {
      return normalizedPreview.slice(0, withoutTrailing).trimEnd();
    }
  }

  const markerIndex = findDiffStartIndex(normalizedPreview);
  if (markerIndex >= 0) {
    return normalizedPreview.slice(0, markerIndex).trimEnd();
  }

  return normalizedPreview.trimEnd();
}

export function ThreadDetailPane({
  detail,
  panelRef,
  selectedMessageId,
  expandedMessageIds,
  expandedDiffMessageIds,
  messageBodies,
  loadingMessageIds,
  messageErrors,
  onToggleMessageCard,
  onToggleDiffCard,
  onCollapseAllCards,
  onExpandAllCards,
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

  const hasMessages = detail.messages.length > 0;
  const messageCount = detail.messages.length;
  const isDarkTheme =
    typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark";

  return (
    <section className="thread-detail-pane" ref={panelRef} tabIndex={-1} aria-label="Thread detail">
      <header className="pane-header thread-detail-pane-header">
        <div className="thread-detail-header-top">
          <p className="pane-kicker">CONVERSATION</p>
          <div className="thread-detail-toolbar" aria-label="Diff controls">
            <button
              type="button"
              className="rail-icon-button"
              onClick={(event) => {
                event.stopPropagation();
                onCollapseAllCards();
              }}
              aria-label="Collapse all message cards and diff cards"
              title="Collapse all message cards and diff cards"
              disabled={!hasMessages}
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="rail-icon-button"
              onClick={(event) => {
                event.stopPropagation();
                onExpandAllCards();
              }}
              aria-label="Expand all message cards and diff cards"
              title="Expand all message cards and diff cards"
              disabled={!hasMessages}
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="thread-detail-header-bottom">
          <h2 className="thread-detail-header-subject" title={detail.subject}>
            {detail.subject}
          </h2>
          <span className="thread-detail-header-separator" aria-hidden="true">
            |
          </span>
          <p className="thread-detail-header-count">{formatCount(messageCount)} messages</p>
        </div>
      </header>

      <ul className="conversation-list">
        {detail.messages.map((message) => {
          const selected = selectedMessageId === message.message_id;
          const body = messageBodies[message.message_id];
          const previewSource = body?.body_text ?? message.body_text ?? message.snippet ?? "";
          const preview = stripDiffFromPreview(
            stripQuotedPreview(previewSource),
            body?.diff_text ?? null,
          );
          const messageExpanded = expandedMessageIds.has(message.message_id);
          const diffExpanded = expandedDiffMessageIds.has(message.message_id);
          const loading = loadingMessageIds.has(message.message_id);
          const error = messageErrors[message.message_id];
          const messageContentId = `message-card-${message.message_id}`;
          const diffContentId = `diff-card-${message.message_id}`;
          const showMessageError = Boolean(error && (!message.has_diff || !diffExpanded));

          return (
            <li key={message.message_id} className="conversation-item-wrapper">
              <article
                className={`conversation-item ${selected ? "is-selected" : ""} ${messageExpanded ? "is-expanded" : "is-collapsed"}`}
                style={{ marginLeft: `${message.depth * 14}px` }}
              >
                <button
                  type="button"
                  className="conversation-header-button"
                  onClick={() => onToggleMessageCard(message)}
                  aria-expanded={messageExpanded}
                  aria-controls={messageContentId}
                  aria-label={`Toggle message card: ${message.subject}`}
                >
                  <div className="conversation-header-main">
                    <p className="author-line">
                      {message.from.name ?? message.from.email}
                      <span className="author-email">&nbsp;&lt;{message.from.email}&gt;</span>
                    </p>
                    <p className="conversation-header-subject">{message.subject}</p>
                  </div>
                  <div className="conversation-meta">
                    <span>{message.date_utc ? formatRelativeTime(message.date_utc) : "unknown"}</span>
                  </div>
                </button>

                {messageExpanded ? (
                  <div id={messageContentId} className="conversation-content">
                    {loading && !diffExpanded ? <p className="muted">Loading message…</p> : null}
                    <p className="conversation-body-preview">{preview || "(no body text)"}</p>
                    {showMessageError ? <p className="error-text">{error}</p> : null}

                    {message.has_diff ? (
                      <section
                        className={`conversation-diff-card ${diffExpanded ? "is-expanded" : "is-collapsed"}`}
                        aria-label={`Diff card for message ${message.message_id}`}
                      >
                        <button
                          type="button"
                          className="conversation-diff-toggle"
                          onClick={() => onToggleDiffCard(message)}
                          aria-expanded={diffExpanded}
                          aria-controls={diffContentId}
                          aria-label={`Toggle diff card: ${message.subject}`}
                        >
                          <span>Diff</span>
                          <span className="conversation-diff-toggle-state">{diffExpanded ? "Collapse" : "Expand"}</span>
                        </button>

                        {diffExpanded ? (
                          <div id={diffContentId} className="conversation-diff-content">
                            {loading ? <p className="muted">Loading diff…</p> : null}
                            {!loading && error ? <p className="error-text">{error}</p> : null}
                            {!loading && !error && body?.diff_text ? (
                              <MessageDiffViewer
                                messageId={message.message_id}
                                diffText={body.diff_text}
                                isDarkTheme={isDarkTheme}
                              />
                            ) : null}
                            {!loading && !error && !body?.diff_text ? (
                              <p className="muted">No diff text available for this message.</p>
                            ) : null}
                          </div>
                        ) : null}
                      </section>
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
