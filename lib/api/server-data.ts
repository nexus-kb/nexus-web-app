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
      listKey: searchQuery.list_key || undefined,
      author: searchQuery.author || undefined,
      from: searchQuery.from || undefined,
      to: searchQuery.to || undefined,
      hasDiff:
        searchQuery.has_diff === ""
          ? undefined
          : searchQuery.has_diff === "true",
      sort: searchQuery.sort,
      cursor: searchQuery.cursor || undefined,
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

  const threadsPromise = getThreads({
    listKey: effectiveListKey,
    sort: "activity_desc",
    page: threadsPage,
    pageSize: threadsPageSize,
  });
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
      listKey: searchQuery.list_key || undefined,
      author: searchQuery.author || undefined,
      from: searchQuery.from || undefined,
      to: searchQuery.to || undefined,
      hasDiff:
        searchQuery.has_diff === ""
          ? undefined
          : searchQuery.has_diff === "true",
      sort: searchQuery.sort,
      cursor: searchQuery.cursor || undefined,
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

  const seriesList = await getSeries({
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
