"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LeftRail } from "@/components/left-rail";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import { ThreadDetailPane } from "@/components/thread-detail-pane";
import { ThreadListPane } from "@/components/thread-list-pane";
import {
  createNexusApiAdapter,
  resolveNexusApiClientRuntimeConfig,
  type NexusApiRuntimeConfig,
} from "@/lib/api";
import type {
  ListSummary,
  MessageBodyResponse,
  PaginationResponse,
  ThreadDetailResponse,
  ThreadListItem,
  ThreadMessage,
} from "@/lib/api/contracts";
import { mergeSearchParams } from "@/lib/ui/query-state";
import {
  applyDensityMode,
  applyVisualTheme,
  parseDensityMode,
  parseNavMode,
  parsePaneLayout,
  parseThemeMode,
  STORAGE_KEYS,
  type DensityMode,
  type ThemeMode,
} from "@/lib/ui/preferences";

interface ThreadsWorkspaceProps {
  lists: ListSummary[];
  listKey: string;
  threads: ThreadListItem[];
  threadsPagination: PaginationResponse;
  detail: ThreadDetailResponse | null;
  messagePagination: PaginationResponse | null;
  selectedThreadId: number | null;
  initialTheme: string | undefined;
  initialDensity: string | undefined;
  initialNav: string | undefined;
  initialMessage: string | undefined;
  apiConfig: NexusApiRuntimeConfig;
}

const MIN_CENTER = 340;
const MAX_CENTER = 780;

function getThreadPath(listKey: string, threadId: number): string {
  return `/lists/${encodeURIComponent(listKey)}/threads/${threadId}`;
}

function getThreadListPath(listKey: string): string {
  return `/lists/${encodeURIComponent(listKey)}/threads`;
}

export function ThreadsWorkspace({
  lists,
  listKey,
  threads,
  threadsPagination,
  detail,
  messagePagination,
  selectedThreadId,
  initialTheme,
  initialDensity,
  initialNav,
  initialMessage,
  apiConfig,
}: ThreadsWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const runtimeApiConfig = useMemo(() => resolveNexusApiClientRuntimeConfig(apiConfig), [apiConfig]);
  const adapter = useMemo(() => createNexusApiAdapter(runtimeApiConfig), [runtimeApiConfig]);

  const [themeMode, setThemeMode] = useState<ThemeMode>(parseThemeMode(initialTheme));
  const [densityMode, setDensityMode] = useState<DensityMode>(parseDensityMode(initialDensity));
  const [navCollapsed, setNavCollapsed] = useState(parseNavMode(initialNav) === "collapsed");
  const [centerWidth, setCenterWidth] = useState(420);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const selectedThreadIndex = useMemo(
    () => threads.findIndex((thread) => thread.thread_id === selectedThreadId),
    [threads, selectedThreadId],
  );

  const [keyboardIndex, setKeyboardIndex] = useState(selectedThreadIndex >= 0 ? selectedThreadIndex : 0);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(
    initialMessage ? Number(initialMessage) : detail?.messages[0]?.message_id ?? null,
  );
  const [expandedDiffMessageIds, setExpandedDiffMessageIds] = useState<Set<number>>(new Set());
  const [messageBodies, setMessageBodies] = useState<Record<number, MessageBodyResponse | undefined>>({});
  const [loadingMessageIds, setLoadingMessageIds] = useState<Set<number>>(new Set());
  const [messageErrors, setMessageErrors] = useState<Record<number, string | undefined>>({});

  const leftPaneRef = useRef<HTMLDivElement>(null);
  const centerPaneRef = useRef<HTMLDivElement>(null);
  const detailPaneRef = useRef<HTMLDivElement>(null);
  const focusIndexRef = useRef(0);
  const activeThreadKey = detail ? `${detail.list_key}:${detail.thread_id}` : null;
  const previousThreadKey = useRef<string | null>(null);

  useEffect(() => {
    if (selectedThreadIndex >= 0) {
      setKeyboardIndex(selectedThreadIndex);
    }
  }, [selectedThreadIndex]);

  useEffect(() => {
    if (!detail || !activeThreadKey) {
      return;
    }

    if (previousThreadKey.current === activeThreadKey) {
      if (initialMessage) {
        setSelectedMessageId(Number(initialMessage));
      }
      return;
    }

    const firstMessageId = detail.messages[0]?.message_id ?? null;
    setSelectedMessageId(initialMessage ? Number(initialMessage) : firstMessageId);
    setExpandedDiffMessageIds(new Set());
    setMessageBodies({});
    setLoadingMessageIds(new Set());
    setMessageErrors({});
    previousThreadKey.current = activeThreadKey;
  }, [activeThreadKey, detail, initialMessage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
    const savedDensity = localStorage.getItem(STORAGE_KEYS.density);
    const savedNav = localStorage.getItem(STORAGE_KEYS.nav);
    const savedLayout = parsePaneLayout(localStorage.getItem(STORAGE_KEYS.paneLayout));

    if (!initialTheme && savedTheme) {
      setThemeMode(parseThemeMode(savedTheme));
    }
    if (!initialDensity && savedDensity) {
      setDensityMode(parseDensityMode(savedDensity));
    }
    if (!initialNav && savedNav) {
      setNavCollapsed(parseNavMode(savedNav) === "collapsed");
    }

    setCenterWidth(savedLayout.centerWidth);
  }, [initialDensity, initialNav, initialTheme]);

  useEffect(() => {
    applyVisualTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    applyDensityMode(densityMode);
  }, [densityMode]);

  const buildPathWithQuery = useCallback(
    (basePath: string, updates: Record<string, string | null>) => {
      const nextQuery = mergeSearchParams(new URLSearchParams(searchParams.toString()), updates);
      return `${basePath}${nextQuery}`;
    },
    [searchParams],
  );

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      router.replace(buildPathWithQuery(pathname, updates), { scroll: false });
    },
    [buildPathWithQuery, pathname, router],
  );

  const persistLayout = useCallback((nextCenterWidth: number) => {
    if (typeof window === "undefined") {
      return;
    }
    localStorage.setItem(STORAGE_KEYS.paneLayout, JSON.stringify({ centerWidth: nextCenterWidth }));
  }, []);

  const setTheme = useCallback(
    (nextTheme: ThemeMode) => {
      setThemeMode(nextTheme);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
      }
      updateQuery({ theme: nextTheme });
    },
    [updateQuery],
  );

  const setDensity = useCallback(
    (nextDensity: DensityMode) => {
      setDensityMode(nextDensity);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.density, nextDensity);
      }
      updateQuery({ density: nextDensity });
    },
    [updateQuery],
  );

  const toggleCollapsedNav = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.nav, next ? "collapsed" : "expanded");
      }
      updateQuery({ nav: next ? "collapsed" : "expanded" });
      return next;
    });
  }, [updateQuery]);

  const selectList = useCallback(
    (nextListKey: string) => {
      router.push(
        buildPathWithQuery(getThreadListPath(nextListKey), {
          threads_page: "1",
          messages_page: "1",
          message: null,
        }),
      );
      setMobileNavOpen(false);
    },
    [buildPathWithQuery, router],
  );

  const openThread = useCallback(
    (threadId: number) => {
      router.push(
        buildPathWithQuery(getThreadPath(listKey, threadId), {
          messages_page: "1",
          message: null,
        }),
      );
      setMobileNavOpen(false);
    },
    [buildPathWithQuery, listKey, router],
  );

  const selectThread = useCallback(
    (threadId: number) => {
      const idx = threads.findIndex((thread) => thread.thread_id === threadId);
      if (idx >= 0) {
        setKeyboardIndex(idx);
      }
      openThread(threadId);
    },
    [openThread, threads],
  );

  const changeThreadPage = useCallback(
    (page: number) => {
      updateQuery({ threads_page: String(page), message: null });
    },
    [updateQuery],
  );

  const changeMessagePage = useCallback(
    (page: number) => {
      updateQuery({ messages_page: String(page), message: null });
    },
    [updateQuery],
  );

  const loadMessageBody = useCallback(
    async (message: ThreadMessage, includeDiff: boolean) => {
      setLoadingMessageIds((prev) => new Set(prev).add(message.message_id));
      setMessageErrors((prev) => ({ ...prev, [message.message_id]: undefined }));

      try {
        const body = await adapter.getMessageBody({
          messageId: message.message_id,
          includeDiff,
          stripQuotes: true,
        });
        setMessageBodies((prev) => ({
          ...prev,
          [message.message_id]: includeDiff ? body : { ...body, diff_text: prev[message.message_id]?.diff_text ?? null },
        }));
      } catch (error) {
        setMessageErrors((prev) => ({
          ...prev,
          [message.message_id]: error instanceof Error ? error.message : "Failed to load message body",
        }));
      } finally {
        setLoadingMessageIds((prev) => {
          const next = new Set(prev);
          next.delete(message.message_id);
          return next;
        });
      }
    },
    [adapter],
  );

  const selectMessage = useCallback(
    (message: ThreadMessage) => {
      setSelectedMessageId(message.message_id);
      updateQuery({ message: String(message.message_id) });
      if (!messageBodies[message.message_id]) {
        void loadMessageBody(message, false);
      }
    },
    [loadMessageBody, messageBodies, updateQuery],
  );

  const toggleMessageDiff = useCallback(
    (message: ThreadMessage) => {
      setExpandedDiffMessageIds((prev) => {
        const next = new Set(prev);
        if (next.has(message.message_id)) {
          next.delete(message.message_id);
          return next;
        }
        next.add(message.message_id);
        return next;
      });

      const body = messageBodies[message.message_id];
      if (!body || !body.diff_text) {
        void loadMessageBody(message, true);
      }
    },
    [loadMessageBody, messageBodies],
  );

  const cyclePaneFocus = useCallback(() => {
    const panes = [leftPaneRef.current, centerPaneRef.current, detailPaneRef.current].filter(Boolean);
    if (!panes.length) {
      return;
    }
    focusIndexRef.current = (focusIndexRef.current + 1) % panes.length;
    panes[focusIndexRef.current]?.focus();
  }, []);

  const collapseAllDiffs = useCallback(() => {
    setExpandedDiffMessageIds(new Set());
  }, []);

  const expandOneDiff = useCallback(() => {
    if (!detail) {
      return;
    }

    const preferred =
      detail.messages.find((message) => message.message_id === selectedMessageId && message.has_diff) ??
      detail.messages.find((message) => message.has_diff);

    if (!preferred) {
      return;
    }

    setExpandedDiffMessageIds((prev) => new Set(prev).add(preferred.message_id));
    if (!messageBodies[preferred.message_id]?.diff_text) {
      void loadMessageBody(preferred, true);
    }
  }, [detail, loadMessageBody, messageBodies, selectedMessageId]);

  const expandAllDiffs = useCallback(() => {
    if (!detail) {
      return;
    }

    const diffMessages = detail.messages.filter((message) => message.has_diff);
    if (diffMessages.length === 0) {
      return;
    }

    setExpandedDiffMessageIds((prev) => {
      const next = new Set(prev);
      diffMessages.forEach((message) => {
        next.add(message.message_id);
      });
      return next;
    });

    for (const message of diffMessages) {
      if (!messageBodies[message.message_id]?.diff_text) {
        void loadMessageBody(message, true);
      }
    }
  }, [detail, loadMessageBody, messageBodies]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || event.target.isContentEditable) {
          return;
        }
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleCollapsedNav();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        cyclePaneFocus();
        return;
      }

      if (event.key === "[") {
        event.preventDefault();
        collapseAllDiffs();
        return;
      }

      if (event.key === "]") {
        event.preventDefault();
        expandOneDiff();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setKeyboardIndex((prev) => Math.min(prev + 1, Math.max(threads.length - 1, 0)));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setKeyboardIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        const target = threads[keyboardIndex];
        if (target) {
          event.preventDefault();
          openThread(target.thread_id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    collapseAllDiffs,
    cyclePaneFocus,
    expandOneDiff,
    keyboardIndex,
    openThread,
    threads,
    toggleCollapsedNav,
  ]);

  const onCenterResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = centerWidth;
      let latestWidth = startWidth;

      const onMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.max(MIN_CENTER, Math.min(MAX_CENTER, startWidth + delta));
        latestWidth = nextWidth;
        setCenterWidth(nextWidth);
      };

      const onUp = () => {
        persistLayout(latestWidth);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [centerWidth, persistLayout],
  );

  useEffect(() => {
    persistLayout(centerWidth);
  }, [centerWidth, persistLayout]);

  const keyboardThreadId = threads[keyboardIndex]?.thread_id ?? null;

  const leftRail = (
    <div ref={leftPaneRef} tabIndex={-1} className="left-pane-focus-target">
      <LeftRail
        lists={lists}
        selectedListKey={listKey}
        collapsed={navCollapsed}
        themeMode={themeMode}
        densityMode={densityMode}
        onToggleCollapsed={toggleCollapsedNav}
        onSelectList={selectList}
        onThemeModeChange={setTheme}
        onDensityModeChange={setDensity}
      />
    </div>
  );

  const listPane = (
    <ThreadListPane
      listKey={listKey}
      threads={threads}
      pagination={threadsPagination}
      selectedThreadId={selectedThreadId}
      keyboardThreadId={keyboardThreadId}
      panelRef={centerPaneRef}
      onSelectThread={selectThread}
      onOpenThread={openThread}
      onPageChange={changeThreadPage}
    />
  );

  const detailPane = (
      <ThreadDetailPane
      detail={detail}
      panelRef={detailPaneRef}
      selectedMessageId={selectedMessageId}
      expandedDiffMessageIds={expandedDiffMessageIds}
      messageBodies={messageBodies}
      loadingMessageIds={loadingMessageIds}
      messageErrors={messageErrors}
      messagePagination={messagePagination}
      onSelectMessage={selectMessage}
      onToggleDiff={toggleMessageDiff}
      onCollapseAllDiffs={collapseAllDiffs}
      onExpandAllDiffs={expandAllDiffs}
      onMessagePageChange={changeMessagePage}
    />
  );

  return (
    <>
      <AppShell
        navCollapsed={navCollapsed}
        centerWidth={centerWidth}
        leftRail={leftRail}
        centerPane={listPane}
        detailPane={detailPane}
        onCenterResizeStart={onCenterResizeStart}
      />

      <MobileStackRouter
        showDetail={Boolean(selectedThreadId)}
        navOpen={mobileNavOpen}
        onOpenNav={() => setMobileNavOpen(true)}
        onCloseNav={() => setMobileNavOpen(false)}
        onBackToList={() => router.push(buildPathWithQuery(getThreadListPath(listKey), { message: null }))}
        leftRail={
          <LeftRail
            lists={lists}
            selectedListKey={listKey}
            collapsed={false}
            themeMode={themeMode}
            densityMode={densityMode}
            onToggleCollapsed={() => {
              setMobileNavOpen(false);
            }}
            onSelectList={selectList}
            onThemeModeChange={setTheme}
            onDensityModeChange={setDensity}
          />
        }
        listPane={listPane}
        detailPane={detailPane}
      />
    </>
  );
}
