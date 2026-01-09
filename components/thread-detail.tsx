"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmailMessage } from "@/components/email-message";
import type { ThreadDetail as ThreadDetailType } from "@/lib/types";

interface ThreadDetailProps {
  thread: ThreadDetailType | null;
  isLoading?: boolean;
}

function ThreadDetailSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 py-3 border-b border-border bg-card">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="flex-1 p-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col h-full items-center justify-center bg-background text-muted-foreground">
      <svg
        className="h-12 w-12 mb-3 opacity-50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
      <p className="text-sm">Select a thread to view its contents</p>
    </div>
  );
}

export function ThreadDetail({ thread, isLoading }: ThreadDetailProps) {
  if (isLoading) {
    return <ThreadDetailSkeleton />;
  }

  if (!thread) {
    return <EmptyState />;
  }

  const { thread: threadMeta, emails } = thread;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Thread Header */}
      <div className="px-4 py-3 border-b border-border bg-card shrink-0">
        <h2 className="text-base font-semibold leading-snug mb-1">
          {threadMeta.subject}
        </h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
            {emails.length} {emails.length === 1 ? "message" : "messages"}
          </Badge>
          <span>
            {new Date(threadMeta.start_date).toLocaleDateString()} -{" "}
            {new Date(threadMeta.last_date).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Email List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {emails.map((email) => (
          <EmailMessage key={email.id} email={email} />
        ))}
      </div>
    </div>
  );
}
