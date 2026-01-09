"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { ThreadList } from "@/components/thread-list";
import { ThreadDetail } from "@/components/thread-detail";
import { getMailingLists, getThreads, getThread } from "@/lib/api";
import type {
  MailingList,
  ThreadWithStarter,
  ThreadDetail as ThreadDetailType,
} from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [mailingLists, setMailingLists] = useState<MailingList[]>([]);
  const [threads, setThreads] = useState<ThreadWithStarter[]>([]);
  const [threadDetail, setThreadDetail] = useState<ThreadDetailType | null>(
    null
  );

  // Loading states
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Selected items from URL
  const selectedSlug = searchParams.get("list");
  const selectedThreadId = searchParams.get("thread")
    ? parseInt(searchParams.get("thread")!, 10)
    : null;

  // Update URL params
  const updateParams = useCallback(
    (params: Record<string, string | null>) => {
      const current = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([key, value]) => {
        if (value === null) {
          current.delete(key);
        } else {
          current.set(key, value);
        }
      });
      router.push(`?${current.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Load mailing lists on mount
  useEffect(() => {
    async function loadMailingLists() {
      try {
        setIsLoadingLists(true);
        const lists = await getMailingLists();
        setMailingLists(lists);

        // Auto-select first list if none selected
        if (!selectedSlug && lists.length > 0) {
          updateParams({ list: lists[0].slug });
        }
      } catch (error) {
        console.error("Failed to load mailing lists:", error);
      } finally {
        setIsLoadingLists(false);
      }
    }
    loadMailingLists();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load threads when mailing list changes
  useEffect(() => {
    if (!selectedSlug) {
      setThreads([]);
      return;
    }

    async function loadThreads() {
      try {
        setIsLoadingThreads(true);
        setThreadDetail(null);
        const response = await getThreads(selectedSlug!);
        setThreads(response.data);

        // Clear thread selection when list changes
        if (selectedThreadId) {
          updateParams({ thread: null });
        }
      } catch (error) {
        console.error("Failed to load threads:", error);
        setThreads([]);
      } finally {
        setIsLoadingThreads(false);
      }
    }
    loadThreads();
  }, [selectedSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load thread detail when thread changes
  useEffect(() => {
    if (!selectedSlug || !selectedThreadId) {
      setThreadDetail(null);
      return;
    }

    async function loadThreadDetail() {
      try {
        setIsLoadingDetail(true);
        const response = await getThread(selectedSlug!, selectedThreadId!);
        setThreadDetail(response.data);
      } catch (error) {
        console.error("Failed to load thread detail:", error);
        setThreadDetail(null);
      } finally {
        setIsLoadingDetail(false);
      }
    }
    loadThreadDetail();
  }, [selectedSlug, selectedThreadId]);

  // Handlers
  const handleSelectList = (slug: string) => {
    updateParams({ list: slug, thread: null });
  };

  const handleSelectThread = (threadId: number) => {
    updateParams({ thread: threadId.toString() });
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Header
        mailingLists={mailingLists}
        selectedSlug={selectedSlug}
        onSelectList={handleSelectList}
        isLoading={isLoadingLists}
      />

      <div className="flex flex-1 min-h-0">
        {/* Thread List Panel */}
        <div className="w-80 lg:w-96 shrink-0 h-full">
          <ThreadList
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelectThread={handleSelectThread}
            isLoading={isLoadingThreads}
          />
        </div>

        {/* Thread Detail Panel */}
        <div className="flex-1 h-full min-w-0">
          <ThreadDetail thread={threadDetail} isLoading={isLoadingDetail} />
        </div>
      </div>
    </div>
  );
}
