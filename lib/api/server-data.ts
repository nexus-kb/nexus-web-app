import type {
  PaginationResponse,
  SearchItem,
} from "@/lib/api/contracts";
import {
  getLists,
  getSearch,
  getSeries,
  getThreadDetail,
  getThreads,
} from "@/lib/api/server-client";
import type { IntegratedSearchQuery } from "@/lib/ui/search-query";
import { isSearchActive } from "@/lib/ui/search-query";

export interface IntegratedSearchRow {
  id: number;
  route: string;
  title: string;
  snippet: string | null;
  date_utc: string | null;
  list_keys: string[];
  author_email: string | null;
  has_diff: boolean;
}

function createEmptyPagination(pageSize: number): PaginationResponse {
  return {
    page: 1,
    page_size: pageSize,
    total_items: 0,
    total_pages: 0,
    has_prev: false,
    has_next: false,
  };
}

function mapIntegratedSearchRows(items: SearchItem[]): IntegratedSearchRow[] {
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
  // Empty q should still use list endpoint filters/sort in browse mode.
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
) {
  // Threads API currently exposes descending chronology only.
  // To render oldest-first pages, mirror the page index from the end and reverse items.
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

async function getAscendingSeriesPage(displayPage: number, pageSize: number) {
  // Series list has the same descending-only contract as threads.
  const firstDescPage = await getSeries({
    page: 1,
    pageSize,
    sort: "last_seen_desc",
  });

  const totalPages = Math.max(1, firstDescPage.pagination.total_pages);
  const boundedDisplayPage = Math.min(Math.max(displayPage, 1), totalPages);
  const mirroredPage = totalPages - boundedDisplayPage + 1;
  const sourcePage =
    mirroredPage === 1
      ? firstDescPage
      : await getSeries({
          page: mirroredPage,
          pageSize,
          sort: "last_seen_desc",
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

export async function loadWorkspaceData(
  listKey: string,
  threadId?: number,
  threadsPage = 1,
  threadsPageSize = 50,
  searchQuery?: IntegratedSearchQuery,
) {
  const listCatalog = await getLists({ page: 1, pageSize: 200 });
  const lists = listCatalog.items;
  const fallbackListKey = lists[0]?.list_key;
  const effectiveListKey = listKey || fallbackListKey;

  if (!effectiveListKey) {
    return {
      lists,
      listCatalog,
      listKey: "",
      threads: [],
      threadsPagination: {
        ...createEmptyPagination(threadsPageSize),
      },
      searchResults: [],
      searchNextCursor: null,
      detail: null,
    };
  }

  const isIntegratedSearchMode = searchQuery != null && isSearchActive(searchQuery);
  const detailPromise = threadId
    ? getThreadDetail(effectiveListKey, threadId)
    : Promise.resolve(null);

  if (isIntegratedSearchMode && searchQuery) {
    const searchPromise = getSearch({
      q: searchQuery.q,
      scope: "thread",
      listKey: toOptionalParam(searchQuery.list_key),
      author: toOptionalParam(searchQuery.author),
      from: toOptionalParam(searchQuery.from),
      to: toOptionalParam(searchQuery.to),
      hasDiff: toHasDiffFilter(searchQuery.has_diff),
      sort: searchQuery.sort,
      cursor: toOptionalParam(searchQuery.cursor),
      limit: 20,
      hybrid: searchQuery.hybrid,
      semanticRatio: searchQuery.hybrid
        ? searchQuery.semantic_ratio
        : undefined,
    });

    const [searchResponse, detail] = await Promise.all([searchPromise, detailPromise]);

    return {
      lists,
      listCatalog,
      listKey: effectiveListKey,
      threads: [],
      threadsPagination: createEmptyPagination(threadsPageSize),
      searchResults: mapIntegratedSearchRows(searchResponse.items),
      searchNextCursor: searchResponse.next_cursor,
      detail,
    };
  }

  const shouldUseFilteredThreadList = searchQuery != null && hasThreadListFilters(searchQuery);

  let threadsPromise: ReturnType<typeof getThreads> | ReturnType<typeof getAscendingThreadsPage>;
  if (!shouldUseFilteredThreadList || !searchQuery) {
    threadsPromise = getThreads({
      listKey: effectiveListKey,
      sort: "activity_desc",
      page: threadsPage,
      pageSize: threadsPageSize,
    });
  } else if (searchQuery.sort === "date_asc") {
    threadsPromise = getAscendingThreadsPage(
      effectiveListKey,
      threadsPage,
      threadsPageSize,
      searchQuery,
    );
  } else {
    threadsPromise = getThreads({
      listKey: effectiveListKey,
      sort: searchQuery.sort === "date_desc" ? "date_desc" : "activity_desc",
      page: threadsPage,
      pageSize: threadsPageSize,
      author: toOptionalParam(searchQuery.author),
      from: toOptionalParam(searchQuery.from),
      to: toOptionalParam(searchQuery.to),
      hasDiff: toHasDiffFilter(searchQuery.has_diff),
    });
  }

  const [threadsResponse, detail] = await Promise.all([threadsPromise, detailPromise]);

  return {
    lists,
    listCatalog,
    listKey: effectiveListKey,
    threads: threadsResponse.items,
    threadsPagination: threadsResponse.pagination,
    searchResults: [],
    searchNextCursor: null,
    detail,
  };
}

export async function loadSeriesCenterData(
  seriesPage: number,
  searchQuery?: IntegratedSearchQuery,
) {
  const isIntegratedSearchMode = searchQuery != null && isSearchActive(searchQuery);

  if (isIntegratedSearchMode && searchQuery) {
    const searchResponse = await getSearch({
      q: searchQuery.q,
      scope: "series",
      listKey: toOptionalParam(searchQuery.list_key),
      author: toOptionalParam(searchQuery.author),
      from: toOptionalParam(searchQuery.from),
      to: toOptionalParam(searchQuery.to),
      hasDiff: toHasDiffFilter(searchQuery.has_diff),
      sort: searchQuery.sort,
      cursor: toOptionalParam(searchQuery.cursor),
      limit: 20,
      hybrid: searchQuery.hybrid,
      semanticRatio: searchQuery.hybrid
        ? searchQuery.semantic_ratio
        : undefined,
    });

    return {
      seriesItems: [],
      seriesPagination: createEmptyPagination(30),
      searchResults: mapIntegratedSearchRows(searchResponse.items),
      searchNextCursor: searchResponse.next_cursor,
    };
  }

  const seriesList =
    searchQuery?.sort === "date_asc"
      ? await getAscendingSeriesPage(seriesPage, 30)
      : await getSeries({
          page: seriesPage,
          pageSize: 30,
          sort: "last_seen_desc",
        });

  return {
    seriesItems: seriesList.items,
    seriesPagination: seriesList.pagination,
    searchResults: [],
    searchNextCursor: null,
  };
}

export async function loadListCatalog() {
  const listCatalog = await getLists({ page: 1, pageSize: 200 });

  return {
    lists: listCatalog.items,
    listCatalog,
  };
}

export async function resolveDefaultThreadDestination() {
  const lists = (await getLists({ page: 1, pageSize: 200 })).items;
  const firstList = lists[0]?.list_key;

  if (!firstList) {
    return "/search";
  }

  const threads = await getThreads({
    listKey: firstList,
    sort: "activity_desc",
    page: 1,
    pageSize: 1,
  });
  const firstThread = threads.items[0]?.thread_id;

  if (!firstThread) {
    return `/lists/${encodeURIComponent(firstList)}/threads`;
  }

  return `/lists/${encodeURIComponent(firstList)}/threads/${firstThread}`;
}
