"use client";

import type { RefObject } from "react";
import type { ThreadListItem } from "@/lib/api/contracts";
import { formatRelativeTime } from "@/lib/ui/format";

interface ThreadListPaneProps {
  listKey: string;
  threads: ThreadListItem[];
  selectedThreadId: number | null;
  keyboardThreadId: number | null;
  panelRef: RefObject<HTMLDivElement | null>;
  onSelectThread: (threadId: number) => void;
  onOpenThread: (threadId: number) => void;
}

export function ThreadListPane({
  listKey,
  threads,
  selectedThreadId,
  keyboardThreadId,
  panelRef,
  onSelectThread,
  onOpenThread,
}: ThreadListPaneProps) {
  return (
    <section className="thread-list-pane" aria-label="Thread list" ref={panelRef} tabIndex={-1}>
      <header className="pane-header">
        <div>
          <p className="pane-kicker">List</p>
          <h1>{listKey}</h1>
        </div>
        <p className="pane-meta">{threads.length} threads</p>
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
    </section>
  );
}
