"use client";

import { useState, useEffect } from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  MessageSquare,
  FileCode,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmailMessage } from "@/components/email-message";
import { AggregatedPatchView } from "@/components/aggregated-patch-view";
import type { ThreadDetail as ThreadDetailType } from "@/lib/types";

type ViewMode = "conversation" | "patch";

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
  const { thread: threadMeta, emails } = thread ?? { thread: null, emails: [] };

  // View mode state: conversation (email list) or patch (aggregated diffs)
  const [viewMode, setViewMode] = useState<ViewMode>("conversation");

  // Track expanded state for each email
  const [expandedEmails, setExpandedEmails] = useState<Set<number>>(new Set());

  // Reset expanded state and view mode when thread changes
  // Use thread ID as dependency to avoid infinite loops
  // This is intentional: we want to reset state when switching threads
  const threadId = threadMeta?.id;
  useEffect(() => {
    if (threadId !== undefined) {
      const ids = emails.map((e) => e.id);
      setExpandedEmails(new Set(ids));
      setViewMode("conversation"); // Reset to conversation view on thread change
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Check if thread has any patches (to show/hide patch view toggle)
  const hasPatchData = emails.some(
    (email) => email.patchMetadata?.hasPatch && email.patchMetadata.regions.length > 0
  );

  const toggleEmail = (emailId: number) => {
    setExpandedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedEmails(new Set(emails.map((e) => e.id)));
  };

  const collapseAll = () => {
    setExpandedEmails(new Set());
  };

  const allExpanded = expandedEmails.size === emails.length;
  const allCollapsed = expandedEmails.size === 0;

  if (isLoading) {
    return <ThreadDetailSkeleton />;
  }

  if (!thread || !threadMeta) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Thread Header */}
      <div className="px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold leading-snug mb-1">
            {threadMeta.subject}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            {/* View Mode Toggle */}
            {hasPatchData && (
              <div className="flex items-center border border-border rounded-md mr-2">
                <Button
                  variant={viewMode === "conversation" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("conversation")}
                  className="h-7 px-2 text-xs rounded-r-none border-0"
                  title="Conversation view"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:ml-1">Messages</span>
                </Button>
                <Button
                  variant={viewMode === "patch" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("patch")}
                  className="h-7 px-2 text-xs rounded-l-none border-0"
                  title="Patch view"
                >
                  <FileCode className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:ml-1">Patches</span>
                </Button>
              </div>
            )}

            {/* Collapse/Expand All Buttons (only show in conversation view) */}
            {viewMode === "conversation" && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={collapseAll}
                  disabled={allCollapsed}
                  className="h-7 px-2 text-xs"
                  title="Collapse all"
                >
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:ml-1">Collapse</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={expandAll}
                  disabled={allExpanded}
                  className="h-7 px-2 text-xs"
                  title="Expand all"
                >
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:ml-1">Expand</span>
                </Button>
              </>
            )}
          </div>
        </div>
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

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {viewMode === "conversation" ? (
          /* Email List (Conversation View) */
          emails.map((email) => (
            <EmailMessage
              key={email.id}
              email={email}
              isExpanded={expandedEmails.has(email.id)}
              onToggle={() => toggleEmail(email.id)}
            />
          ))
        ) : (
          /* Aggregated Patches (Patch View) */
          <AggregatedPatchView emails={emails} />
        )}
      </div>
    </div>
  );
}
