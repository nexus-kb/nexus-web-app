"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { ThreadWithStarter } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ThreadListProps {
  threads: ThreadWithStarter[];
  selectedThreadId: number | null;
  onSelectThread: (threadId: number) => void;
  isLoading?: boolean;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else if (diffDays < 365) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

function ThreadSkeleton() {
  return (
    <div className="px-3 py-2 border-b border-border">
      <Skeleton className="h-4 w-3/4 mb-1.5" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function ThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
  isLoading,
}: ThreadListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-card border-r border-border">
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Threads
          </span>
        </div>
        <div className="flex-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <ThreadSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col h-full bg-card border-r border-border">
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Threads
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No threads found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Threads
        </span>
        <span className="text-xs text-muted-foreground">{threads.length}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {threads.map((thread) => (
          <button
            key={thread.id}
            onClick={() => onSelectThread(thread.id)}
            className={cn(
              "w-full text-left px-3 py-2 border-b border-border transition-colors",
              "hover:bg-accent/50 focus:outline-none focus:bg-accent/50",
              selectedThreadId === thread.id && "bg-accent"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium leading-snug line-clamp-2 flex-1">
                {thread.subject}
              </h3>
              {thread.message_count && thread.message_count > 1 && (
                <Badge
                  variant="secondary"
                  className="shrink-0 text-[10px] h-4 px-1.5"
                >
                  {thread.message_count}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <span className="truncate max-w-[140px]">
                {thread.starter_name || thread.starter_email.split("@")[0]}
              </span>
              <span className="text-border">·</span>
              <span className="shrink-0">{formatDate(thread.last_date)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
