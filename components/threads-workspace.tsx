"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { LeftRail } from "@/components/left-rail";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import { PaneEmptyState } from "@/components/pane-empty-state";
import { ThreadDetailPane } from "@/components/thread-detail-pane";
import { ThreadListPane } from "@/components/thread-list-pane";
import { queryKeys } from "@/lib/api/query-keys";
import { getLists, getSearch, getThreadDetail, getThreads } from "@/lib/api/server-client";
import type { IntegratedSearchRow } from "@/lib/api/server-data";
import type {
  MessageBodyResponse,
  PaginationResponse,
  SearchItem,
  ThreadListResponse,
  ThreadMessage,
} from "@/lib/api/contracts";
import { mergeSearchParams } from "@/lib/ui/query-state";
import {
  isSearchActive,
  readIntegratedSearchParams,
  type IntegratedSearchQuery,
  type IntegratedSearchUpdates,
} from "@/lib/ui/search-query";
import {
  applyVisualTheme,
  getStoredNavCollapsed,
  getStoredThemeMode,
  parsePaneLayout,
  persistNavCollapsed,
  persistThemeMode,
  STORAGE_KEYS,
  type ThemeMode,
} from "@/lib/ui/preferences";
import { useDesktopViewport } from "@/lib/ui/use-desktop-viewport";
import { usePathname, useRouter, useSearchParams } from "@/lib/ui/navigation";
import {
  getThreadPath,
  getThreadsPath,
  normalizeRoutePath,
  parsePositiveInt,
  resolveThreadSearchRoute,
} from "@/lib/ui/routes";

interface ThreadsWorkspaceProps {
  listKey: string | null;
  selectedThreadId: number | null;
  initialMessage: string | undefined;
}

const MIN_CENTER = 340;
const MAX_CENTER = 780;
const EMPTY_THREADS_PAGINATION: PaginationResponse = {
  page: 1,
  page_size: 50,
  total_items: 0,
  total_pages: 1,
  has_prev: false,
  has_next: false,
};

function parsePage(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parseMessageParam(raw: string | undefined): number | null {
  return parsePositiveInt(raw ?? null);
}

function normalizeMessageBody(raw: unknown, messageId: number): MessageBodyResponse {
  const value = (raw as Record<string, unknown> | null) ?? {};
  return {
    message_id: Number(value.message_id ?? messageId),
    subject: String(value.subject ?? ""),
    body_text: String(value.body_text ?? ""),
    body_html: (value.body_html as string | null | undefined) ?? null,
    diff_text: (value.diff_text as string | null | undefined) ?? null,
    has_diff: Boolean(value.has_diff),
    has_attachments: Boolean(value.has_attachments),
    attachments:
      (value.attachments as MessageBodyResponse["attachments"] | undefined) ?? [],
  };
}

function toHasDiffFilter(value: IntegratedSearchQuery["has_diff"]): boolean | undefined {
  if (value === "") {
    return undefined;
  }
  return value === "true";
}

function toOptionalParam(value: string): string | undefined {
  return value || undefined;
}

function hasThreadListFilters(query: IntegratedSearchQuery): boolean {
  return Boolean(
    query.author ||
      query.from ||
      query.to ||
      query.has_diff ||
      query.sort === "date_desc" ||
      query.sort === "date_asc",
  );
}

async function getAscendingThreadsPage(
  listKey: string,
  displayPage: number,
  pageSize: number,
  searchQuery: IntegratedSearchQuery,
): Promise<ThreadListResponse> {
  const firstDescPage = await getThreads({
    listKey,
    sort: "date_desc",
    page: 1,
    pageSize,
    author: toOptionalParam(searchQuery.author),
    from: toOptionalParam(searchQuery.from),
    to: toOptionalParam(searchQuery.to),
    hasDiff: toHasDiffFilter(searchQuery.has_diff),
  });

  const totalPages = Math.max(1, firstDescPage.pagination.total_pages);
  const boundedDisplayPage = Math.min(Math.max(displayPage, 1), totalPages);
  const mirroredPage = totalPages - boundedDisplayPage + 1;
  const sourcePage =
    mirroredPage === 1
      ? firstDescPage
      : await getThreads({
          listKey,
          sort: "date_desc",
          page: mirroredPage,
          pageSize,
          author: toOptionalParam(searchQuery.author),
          from: toOptionalParam(searchQuery.from),
          to: toOptionalParam(searchQuery.to),
          hasDiff: toHasDiffFilter(searchQuery.has_diff),
        });

  return {
    items: [...sourcePage.items].reverse(),
    pagination: {
      ...sourcePage.pagination,
      page: boundedDisplayPage,
      has_prev: boundedDisplayPage > 1,
      has_next: boundedDisplayPage < totalPages,
    },
  };
}

function toIntegratedSearchRows(items: SearchItem[]): IntegratedSearchRow[] {
  return items.map((item) => ({
    id: item.id,
    route: item.route,
    title: item.title,
    snippet: item.snippet,
    date_utc: item.date_utc,
    list_keys: item.list_keys,
    author_email: item.author_email,
    has_diff: item.has_diff,
  }));
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

export function ThreadsWorkspace({
  listKey,
  selectedThreadId,
  initialMessage,
}: ThreadsWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useDesktopViewport(true);

  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [centerWidth, setCenterWidth] = useState(420);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const threadsPage = parsePage(searchParams.get("threads_page"), 1);
  const integratedSearchQuery = useMemo(
    () => readIntegratedSearchParams(searchParams, { list_key: listKey ?? "" }),
    [listKey, searchParams],
  );
  const integratedSearchMode = isSearchActive(integratedSearchQuery);

  const listsQuery = useQuery({
    queryKey: queryKeys.lists(),
    queryFn: () => getLists({ page: 1, pageSize: 200 }),
    staleTime: 5 * 60_000,
  });

  const lists = listsQuery.data?.items ?? [];
  const hasSelectedList = Boolean(listKey);
  const selectedListKnown = !listKey || lists.some((list) => list.list_key === listKey);
  const listValidationReady = !listKey || listsQuery.isSuccess;
  const canQueryListResources = Boolean(listKey) && (!listValidationReady || selectedListKnown);
  const listError =
    hasSelectedList && listValidationReady && !selectedListKnown
      ? `Unknown mailing list: ${listKey}`
      : null;

  const browseThreadsQuery = useQuery({
    queryKey: queryKeys.threads({
      listKey: listKey ?? "",
      page: threadsPage,
      pageSize: 50,
      sort:
        integratedSearchQuery.sort === "date_desc" || integratedSearchQuery.sort === "date_asc"
          ? "date_desc"
          : "activity_desc",
      from: integratedSearchQuery.from || undefined,
      to: integratedSearchQuery.to || undefined,
      author: integratedSearchQuery.author || undefined,
      hasDiff: toHasDiffFilter(integratedSearchQuery.has_diff),
    }),
    enabled: canQueryListResources && !integratedSearchMode,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const activeListKey = listKey!;
      const shouldUseFilteredThreadList = hasThreadListFilters(integratedSearchQuery);

      if (!shouldUseFilteredThreadList) {
        return getThreads({
          listKey: activeListKey,
          sort: "activity_desc",
          page: threadsPage,
          pageSize: 50,
        });
      }

      if (integratedSearchQuery.sort === "date_asc") {
        return getAscendingThreadsPage(activeListKey, threadsPage, 50, integratedSearchQuery);
      }

      return getThreads({
        listKey: activeListKey,
        sort: integratedSearchQuery.sort === "date_desc" ? "date_desc" : "activity_desc",
        page: threadsPage,
        pageSize: 50,
        author: toOptionalParam(integratedSearchQuery.author),
        from: toOptionalParam(integratedSearchQuery.from),
        to: toOptionalParam(integratedSearchQuery.to),
        hasDiff: toHasDiffFilter(integratedSearchQuery.has_diff),
      });
    },
  });

  const threadSearchQuery = useQuery({
    queryKey: queryKeys.search({
      q: integratedSearchQuery.q,
      scope: "thread",
      listKey: integratedSearchQuery.list_key || undefined,
      author: integratedSearchQuery.author || undefined,
      from: integratedSearchQuery.from || undefined,
      to: integratedSearchQuery.to || undefined,
      hasDiff: toHasDiffFilter(integratedSearchQuery.has_diff),
      sort: integratedSearchQuery.sort,
      cursor: integratedSearchQuery.cursor || undefined,
      limit: 20,
      hybrid: integratedSearchQuery.hybrid,
      semanticRatio: integratedSearchQuery.hybrid ? integratedSearchQuery.semantic_ratio : undefined,
    }),
    enabled: canQueryListResources && integratedSearchMode,
    placeholderData: keepPreviousData,
    queryFn: () =>
      getSearch({
        q: integratedSearchQuery.q,
        scope: "thread",
        listKey: integratedSearchQuery.list_key || undefined,
        author: integratedSearchQuery.author || undefined,
        from: integratedSearchQuery.from || undefined,
        to: integratedSearchQuery.to || undefined,
        hasDiff: toHasDiffFilter(integratedSearchQuery.has_diff),
        sort: integratedSearchQuery.sort,
        cursor: integratedSearchQuery.cursor || undefined,
        limit: 20,
        hybrid: integratedSearchQuery.hybrid,
        semanticRatio: integratedSearchQuery.hybrid ? integratedSearchQuery.semantic_ratio : undefined,
      }),
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.threadDetail({
      listKey: listKey ?? "",
      threadId: selectedThreadId ?? 0,
    }),
    enabled: canQueryListResources && Boolean(selectedThreadId),
    placeholderData: keepPreviousData,
    queryFn: () => getThreadDetail(listKey!, selectedThreadId!),
  });

  const threads = useMemo(() => browseThreadsQuery.data?.items ?? [], [browseThreadsQuery.data?.items]);
  const threadsPagination = browseThreadsQuery.data?.pagination ?? EMPTY_THREADS_PAGINATION;
  const mappedSearchResults = useMemo(
    () => toIntegratedSearchRows(threadSearchQuery.data?.items ?? []),
    [threadSearchQuery.data?.items],
  );
  const searchNextCursor = threadSearchQuery.data?.next_cursor ?? null;
  const detail = detailQuery.data ?? null;

  const centerError = listError ??
    (integratedSearchMode
      ? threadSearchQuery.error
        ? toErrorMessage(threadSearchQuery.error, "Failed to load search results")
        : null
      : browseThreadsQuery.error
        ? toErrorMessage(browseThreadsQuery.error, "Failed to load thread list")
        : null);

  const detailError =
    detailQuery.error && selectedThreadId
      ? toErrorMessage(detailQuery.error, "Failed to load thread detail")
      : null;

  const centerLoading =
    canQueryListResources &&
    (integratedSearchMode ? threadSearchQuery.isLoading : browseThreadsQuery.isLoading);
  const centerFetching =
    canQueryListResources &&
    (integratedSearchMode ? threadSearchQuery.isFetching : browseThreadsQuery.isFetching);

  const detailLoading = Boolean(selectedThreadId) && detailQuery.isLoading;
  const detailFetching = Boolean(selectedThreadId) && detailQuery.isFetching;

  const selectedThreadIndex = useMemo(
    () => threads.findIndex((thread) => thread.thread_id === selectedThreadId),
    [threads, selectedThreadId],
  );

  const selectedSearchRoute = useMemo(() => {
    if (listKey && selectedThreadId) {
      return getThreadPath(listKey, selectedThreadId);
    }
    return pathname;
  }, [listKey, pathname, selectedThreadId]);

  const selectedSearchIndex = useMemo(
    () =>
      mappedSearchResults.findIndex(
        (result) =>
          normalizeRoutePath(
            resolveThreadSearchRoute({
              route: result.route,
              fallbackListKey: listKey,
              itemId: result.id,
              metadataListKey: result.list_keys[0] ?? null,
            }),
          ) === normalizeRoutePath(selectedSearchRoute),
      ),
    [listKey, mappedSearchResults, selectedSearchRoute],
  );

  const initialMessageId = parseMessageParam(initialMessage);
  const [keyboardIndex, setKeyboardIndex] = useState(
    selectedThreadIndex >= 0 ? selectedThreadIndex : 0,
  );
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(initialMessageId);
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<number>>(
    initialMessageId ? new Set([initialMessageId]) : new Set(),
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
  const inFlightBodyRequests = useRef<
    Map<number, { includeDiff: boolean; controller: AbortController }>
  >(new Map());

  const abortAllInFlightBodyRequests = useCallback(() => {
    for (const { controller } of inFlightBodyRequests.current.values()) {
      controller.abort();
    }
    inFlightBodyRequests.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      abortAllInFlightBodyRequests();
    };
  }, [abortAllInFlightBodyRequests]);

  useEffect(() => {
    if (integratedSearchMode) {
      if (selectedSearchIndex >= 0) {
        setKeyboardIndex(selectedSearchIndex);
      }
      return;
    }

    if (selectedThreadIndex >= 0) {
      setKeyboardIndex(selectedThreadIndex);
    }
  }, [integratedSearchMode, selectedSearchIndex, selectedThreadIndex]);

  useEffect(() => {
    if (!detail || !activeThreadKey) {
      previousThreadKey.current = null;
      abortAllInFlightBodyRequests();
      setSelectedMessageId(null);
      setExpandedMessageIds(new Set());
      setExpandedDiffMessageIds(new Set());
      setMessageBodies({});
      setLoadingMessageIds(new Set());
      setMessageErrors({});
      return;
    }

    const requestedMessage =
      initialMessageId != null
        ? detail.messages.find((message) => message.message_id === initialMessageId) ?? null
        : null;

    if (previousThreadKey.current === activeThreadKey) {
      if (requestedMessage) {
        setSelectedMessageId(requestedMessage.message_id);
        setExpandedMessageIds((prev) => {
          if (prev.has(requestedMessage.message_id)) {
            return prev;
          }
          const next = new Set(prev);
          next.add(requestedMessage.message_id);
          return next;
        });
      }
      return;
    }

    abortAllInFlightBodyRequests();
    setSelectedMessageId(requestedMessage?.message_id ?? null);
    setExpandedMessageIds(requestedMessage ? new Set([requestedMessage.message_id]) : new Set());
    setExpandedDiffMessageIds(new Set());
    setMessageBodies({});
    setLoadingMessageIds(new Set());
    setMessageErrors({});
    previousThreadKey.current = activeThreadKey;
  }, [abortAllInFlightBodyRequests, activeThreadKey, detail, initialMessageId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setThemeMode(getStoredThemeMode());
    setNavCollapsed(getStoredNavCollapsed());
    setCenterWidth(parsePaneLayout(localStorage.getItem(STORAGE_KEYS.paneLayout)).centerWidth);
  }, []);

  useEffect(() => {
    applyVisualTheme(themeMode);
  }, [themeMode]);

  const buildPathWithQuery = useCallback(
    (basePath: string, updates: Record<string, string | null>) => {
      const sanitized = new URLSearchParams(searchParams.toString());
      sanitized.delete("theme");
      sanitized.delete("nav");
      const nextQuery = mergeSearchParams(sanitized, updates);
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

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeMode(nextTheme);
    persistThemeMode(nextTheme);
  }, []);

  const toggleCollapsedNav = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev;
      persistNavCollapsed(next);
      return next;
    });
  }, []);

  const selectList = useCallback(
    (nextListKey: string) => {
      router.push(
        buildPathWithQuery(getThreadsPath(nextListKey), {
          threads_page: "1",
          message: null,
        }),
      );
      setMobileNavOpen(false);
    },
    [buildPathWithQuery, router],
  );

  const openThread = useCallback(
    (threadId: number) => {
      if (!listKey) {
        return;
      }

      router.push(
        buildPathWithQuery(getThreadPath(listKey, threadId), {
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

  const openSearchResult = useCallback(
    (route: string) => {
      const resolvedRoute = resolveThreadSearchRoute({
        route,
        fallbackListKey: listKey,
      });
      router.push(
        buildPathWithQuery(normalizeRoutePath(resolvedRoute), {
          message: null,
        }),
      );
      setMobileNavOpen(false);
    },
    [buildPathWithQuery, listKey, router],
  );

  const applyIntegratedSearch = useCallback(
    (updates: IntegratedSearchUpdates) => {
      updateQuery({
        ...updates,
        threads_page: null,
        message: null,
      });
    },
    [updateQuery],
  );

  const clearIntegratedSearch = useCallback(
    (updates: IntegratedSearchUpdates) => {
      updateQuery({
        ...updates,
        threads_page: null,
        message: null,
      });
    },
    [updateQuery],
  );

  const loadNextSearchPage = useCallback(
    (cursor: string) => {
      updateQuery({
        cursor,
        threads_page: null,
        message: null,
      });
    },
    [updateQuery],
  );

  const loadMessageBody = useCallback(async (message: ThreadMessage, includeDiff: boolean) => {
    const messageId = message.message_id;
    const existing = inFlightBodyRequests.current.get(messageId);
    if (existing) {
      if (includeDiff && !existing.includeDiff) {
        existing.controller.abort();
        inFlightBodyRequests.current.delete(messageId);
      } else {
        return;
      }
    }

    const controller = new AbortController();
    inFlightBodyRequests.current.set(messageId, { includeDiff, controller });

    setLoadingMessageIds((prev) => new Set(prev).add(messageId));
    setMessageErrors((prev) => ({ ...prev, [messageId]: undefined }));

    try {
      const query = new URLSearchParams();
      query.set("include_diff", String(includeDiff));

      const response = await fetch(`/api/v1/messages/${messageId}/body?${query.toString()}`, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const raw = (await response.json()) as unknown;
      const body = normalizeMessageBody(raw, messageId);
      setMessageBodies((prev) => ({
        ...prev,
        [messageId]: includeDiff ? body : { ...body, diff_text: prev[messageId]?.diff_text ?? null },
      }));
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessageErrors((prev) => ({
          ...prev,
          [messageId]:
            error instanceof Error
              ? error.message
              : "Failed to load message body",
        }));
      }
    } finally {
      const latest = inFlightBodyRequests.current.get(messageId);
      if (latest?.controller === controller) {
        inFlightBodyRequests.current.delete(messageId);
      }

      setLoadingMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (!detail) {
      return;
    }

    for (const message of detail.messages) {
      if (!expandedMessageIds.has(message.message_id)) {
        continue;
      }
      if (loadingMessageIds.has(message.message_id)) {
        continue;
      }

      const cachedBody = messageBodies[message.message_id];
      if (expandedDiffMessageIds.has(message.message_id) && message.has_diff) {
        if (!cachedBody?.diff_text) {
          void loadMessageBody(message, true);
        }
        continue;
      }

      if (!cachedBody) {
        void loadMessageBody(message, false);
      }
    }
  }, [
    detail,
    expandedDiffMessageIds,
    expandedMessageIds,
    loadMessageBody,
    loadingMessageIds,
    messageBodies,
  ]);

  const toggleMessageCard = useCallback(
    (message: ThreadMessage) => {
      const nextSelectedMessageId = message.message_id;
      const isExpanded = expandedMessageIds.has(nextSelectedMessageId);

      setSelectedMessageId(nextSelectedMessageId);

      if (isExpanded) {
        setExpandedMessageIds((prev) => {
          const next = new Set(prev);
          next.delete(nextSelectedMessageId);
          return next;
        });
        setExpandedDiffMessageIds((prev) => {
          if (!prev.has(nextSelectedMessageId)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(nextSelectedMessageId);
          return next;
        });
        return;
      }

      setExpandedMessageIds((prev) => new Set(prev).add(nextSelectedMessageId));
      if (!messageBodies[nextSelectedMessageId]) {
        void loadMessageBody(message, false);
      }
    },
    [expandedMessageIds, loadMessageBody, messageBodies],
  );

  const toggleDiffCard = useCallback(
    (message: ThreadMessage) => {
      const targetMessageId = message.message_id;
      const isExpanded = expandedDiffMessageIds.has(targetMessageId);

      setSelectedMessageId(targetMessageId);
      setExpandedDiffMessageIds((prev) => {
        const next = new Set(prev);
        if (isExpanded) {
          next.delete(targetMessageId);
          return next;
        }
        next.add(targetMessageId);
        return next;
      });

      const body = messageBodies[targetMessageId];
      if (!isExpanded && (!body || !body.diff_text)) {
        void loadMessageBody(message, true);
      }
    },
    [expandedDiffMessageIds, loadMessageBody, messageBodies],
  );

  const cyclePaneFocus = useCallback(() => {
    const panes = [leftPaneRef.current, centerPaneRef.current, detailPaneRef.current].filter(Boolean);
    if (!panes.length) {
      return;
    }
    focusIndexRef.current = (focusIndexRef.current + 1) % panes.length;
    panes[focusIndexRef.current]?.focus();
  }, []);

  const collapseAllCards = useCallback(() => {
    setSelectedMessageId(null);
    setExpandedMessageIds(new Set());
    setExpandedDiffMessageIds(new Set());
  }, []);

  const expandAllCards = useCallback(() => {
    if (!detail) {
      return;
    }

    if (!detail.messages.length) {
      setSelectedMessageId(null);
      setExpandedMessageIds(new Set());
      setExpandedDiffMessageIds(new Set());
      return;
    }

    const visibleMessageIds = detail.messages.map((message) => message.message_id);
    const firstVisibleMessageId = visibleMessageIds[0] ?? null;

    setSelectedMessageId(firstVisibleMessageId);
    setExpandedMessageIds(new Set(visibleMessageIds));
    setExpandedDiffMessageIds(() => {
      const next = new Set<number>();
      detail.messages.forEach((message) => {
        if (message.has_diff) {
          next.add(message.message_id);
        }
      });
      return next;
    });

    for (const message of detail.messages) {
      const cachedBody = messageBodies[message.message_id];
      if (message.has_diff && !cachedBody?.diff_text) {
        void loadMessageBody(message, true);
        continue;
      }
      if (!cachedBody) {
        void loadMessageBody(message, false);
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
        collapseAllCards();
        return;
      }

      if (event.key === "]") {
        event.preventDefault();
        expandAllCards();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const itemCount = integratedSearchMode ? mappedSearchResults.length : threads.length;
        setKeyboardIndex((prev) => Math.min(prev + 1, Math.max(itemCount - 1, 0)));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setKeyboardIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (integratedSearchMode) {
          const searchTarget = mappedSearchResults[keyboardIndex];
          if (searchTarget) {
            openSearchResult(searchTarget.route);
          }
          return;
        }

        const threadTarget = threads[keyboardIndex];
        if (threadTarget) {
          openThread(threadTarget.thread_id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    collapseAllCards,
    cyclePaneFocus,
    expandAllCards,
    integratedSearchMode,
    keyboardIndex,
    mappedSearchResults,
    openSearchResult,
    openThread,
    threads,
    toggleCollapsedNav,
  ]);

  const onCenterResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
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

  const keyboardThreadId = integratedSearchMode ? null : threads[keyboardIndex]?.thread_id ?? null;
  const keyboardSearchRoute = integratedSearchMode ? mappedSearchResults[keyboardIndex]?.route ?? null : null;

  const leftRail = (
    <div ref={leftPaneRef} tabIndex={-1} className="left-pane-focus-target">
      <LeftRail
        lists={lists}
        selectedListKey={listKey}
        showListSelector
        collapsed={navCollapsed}
        themeMode={themeMode}
        onToggleCollapsed={toggleCollapsedNav}
        onSelectList={selectList}
        onThemeModeChange={setTheme}
      />
    </div>
  );

  const listPane = !hasSelectedList ? (
    <section className="thread-list-pane is-empty" ref={centerPaneRef} tabIndex={-1}>
      <PaneEmptyState
        kicker="Threads"
        title="Select a list"
        description="Pick a mailing list from the sidebar to browse thread conversations."
      />
    </section>
  ) : listError ? (
    <section className="thread-list-pane is-empty" ref={centerPaneRef} tabIndex={-1}>
      <PaneEmptyState
        kicker="Threads"
        title="Unknown list"
        description={listError}
      />
    </section>
  ) : (
    <ThreadListPane
      listKey={listKey!}
      threads={threads}
      pagination={threadsPagination}
      isLoading={centerLoading}
      isFetching={centerFetching}
      errorMessage={centerError}
      searchQuery={integratedSearchQuery}
      searchDefaults={{ list_key: listKey! }}
      searchResults={mappedSearchResults}
      searchNextCursor={searchNextCursor}
      selectedSearchRoute={selectedSearchRoute}
      keyboardSearchRoute={keyboardSearchRoute}
      selectedThreadId={selectedThreadId}
      keyboardThreadId={keyboardThreadId}
      panelRef={centerPaneRef}
      onApplySearch={applyIntegratedSearch}
      onClearSearch={clearIntegratedSearch}
      onOpenSearchResult={openSearchResult}
      onSearchNextPage={loadNextSearchPage}
      onSelectThread={selectThread}
      onOpenThread={openThread}
      onPageChange={changeThreadPage}
    />
  );

  const detailPane = !hasSelectedList ? (
    <section className="thread-detail-pane is-empty" ref={detailPaneRef} tabIndex={-1}>
      <PaneEmptyState
        kicker="Detail"
        title="Select a list"
        description="Choose a mailing list from the sidebar to load threads and message detail."
      />
    </section>
  ) : (
    <ThreadDetailPane
      detail={detail}
      isLoading={detailLoading}
      isFetching={detailFetching}
      errorMessage={detailError}
      panelRef={detailPaneRef}
      selectedMessageId={selectedMessageId}
      expandedMessageIds={expandedMessageIds}
      expandedDiffMessageIds={expandedDiffMessageIds}
      messageBodies={messageBodies}
      loadingMessageIds={loadingMessageIds}
      messageErrors={messageErrors}
      onToggleMessageCard={toggleMessageCard}
      onToggleDiffCard={toggleDiffCard}
      onCollapseAllCards={collapseAllCards}
      onExpandAllCards={expandAllCards}
    />
  );

  if (isDesktop) {
    return (
      <AppShell
        navCollapsed={navCollapsed}
        centerWidth={centerWidth}
        leftRail={leftRail}
        centerPane={listPane}
        detailPane={detailPane}
        onCenterResizeStart={onCenterResizeStart}
      />
    );
  }

  return (
    <MobileStackRouter
      showDetail={Boolean(selectedThreadId)}
      navOpen={mobileNavOpen}
      onOpenNav={() => setMobileNavOpen(true)}
      onCloseNav={() => setMobileNavOpen(false)}
      onBackToList={() => router.push(buildPathWithQuery(getThreadsPath(listKey), { message: null }))}
      leftRail={
        <LeftRail
          lists={lists}
          selectedListKey={listKey}
          showListSelector
          collapsed={false}
          themeMode={themeMode}
          onToggleCollapsed={() => {
            setMobileNavOpen(false);
          }}
          onSelectList={selectList}
          onThemeModeChange={setTheme}
        />
      }
      listPane={listPane}
      detailPane={detailPane}
    />
  );
}
