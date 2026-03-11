import type {
  PageInfoResponse,
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
import { getEffectiveSearchRequestQuery, isSearchActive } from "@/lib/ui/search-query";

export interface IntegratedSearchRow {
  id: number;
  route: string;
  title: string;
  snippet: string | null;
  date_utc: string | null;
  list_keys: string[];
  author_email: string | null;
  has_diff: boolean;
  metadata: Record<string, unknown>;
}

function createEmptyPageInfo(limit: number): PageInfoResponse {
  return {
    limit,
    next_cursor: null,
    prev_cursor: null,
    has_more: false,
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
    metadata: item.metadata,
  }));
}

function toHasDiffFilter(value: IntegratedSearchQuery["has_diff"]): boolean | undefined {
  if (value === "") {
    return undefined;
  }
  return value === "true";
}

function toMergedFilter(value: IntegratedSearchQuery["merged"]): boolean | undefined {
  if (value === "") {
    return undefined;
  }
  return value === "true";
}

function toOptionalParam(value: string): string | undefined {
  return value || undefined;
}

export async function loadWorkspaceData(
  listKey: string,
  threadId?: number,
  threadsCursor?: string,
  threadsLimit = 50,
  searchQuery?: IntegratedSearchQuery,
) {
  const listCatalog = await getLists({ limit: 200, view: "compact" });
  const lists = listCatalog.items;
  const hasSelectedList = lists.some((list) => list.list_key === listKey);
  const effectiveListKey = hasSelectedList ? listKey : null;

  if (!effectiveListKey) {
    return {
      lists,
      listCatalog,
      listKey: null,
      threads: [],
      threadsPageInfo: createEmptyPageInfo(threadsLimit),
      searchResults: [],
      searchNextCursor: null,
      detail: null,
    };
  }

  const scopedSearchQuery = searchQuery == null || searchQuery.merged === ""
    ? searchQuery
    : {
      ...searchQuery,
      merged: "" as const,
    };
  const isIntegratedSearchMode = scopedSearchQuery != null && isSearchActive(scopedSearchQuery);
  const detailPromise = threadId
    ? getThreadDetail(effectiveListKey, threadId)
    : Promise.resolve(null);

  if (isIntegratedSearchMode && scopedSearchQuery) {
    const searchRequestQ = getEffectiveSearchRequestQuery(scopedSearchQuery);
    const searchPromise = getSearch({
      q: searchRequestQ,
      scope: "thread",
      listKey: toOptionalParam(scopedSearchQuery.list_key),
      author: toOptionalParam(scopedSearchQuery.author),
      from: toOptionalParam(scopedSearchQuery.from),
      to: toOptionalParam(scopedSearchQuery.to),
      hasDiff: toHasDiffFilter(scopedSearchQuery.has_diff),
      sort: scopedSearchQuery.sort,
      cursor: toOptionalParam(scopedSearchQuery.cursor),
      limit: 20,
      hybrid: scopedSearchQuery.hybrid,
      semanticRatio: scopedSearchQuery.hybrid
        ? scopedSearchQuery.semantic_ratio
        : undefined,
    });

    const [searchResponse, detail] = await Promise.all([searchPromise, detailPromise]);

    return {
      lists,
      listCatalog,
      listKey: effectiveListKey,
      threads: [],
      threadsPageInfo: createEmptyPageInfo(threadsLimit),
      searchResults: mapIntegratedSearchRows(searchResponse.items),
      searchNextCursor: searchResponse.page_info.next_cursor,
      detail,
    };
  }
  const threadsPromise = getThreads({
    listKey: effectiveListKey,
    sort: "activity_desc",
    limit: threadsLimit,
    cursor: threadsCursor,
  });

  const [threadsResponse, detail] = await Promise.all([threadsPromise, detailPromise]);

  return {
    lists,
    listCatalog,
    listKey: effectiveListKey,
    threads: threadsResponse.items,
    threadsPageInfo: threadsResponse.page_info,
    searchResults: [],
    searchNextCursor: null,
    detail,
  };
}

export async function loadSeriesCenterData(
  seriesCursor?: string,
  searchQuery?: IntegratedSearchQuery,
) {
  const isIntegratedSearchMode = searchQuery != null && isSearchActive(searchQuery);

  if (isIntegratedSearchMode && searchQuery) {
    const searchRequestQ = getEffectiveSearchRequestQuery(searchQuery);
    const searchResponse = await getSearch({
      q: searchRequestQ,
      scope: "series",
      listKey: toOptionalParam(searchQuery.list_key),
      author: toOptionalParam(searchQuery.author),
      from: toOptionalParam(searchQuery.from),
      to: toOptionalParam(searchQuery.to),
      hasDiff: toHasDiffFilter(searchQuery.has_diff),
      merged: toMergedFilter(searchQuery.merged),
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
      seriesPageInfo: createEmptyPageInfo(30),
      searchResults: mapIntegratedSearchRows(searchResponse.items),
      searchNextCursor: searchResponse.page_info.next_cursor,
    };
  }

  const seriesList = await getSeries({
    listKey: toOptionalParam(searchQuery?.list_key ?? ""),
    limit: 30,
    cursor: seriesCursor,
    sort: "last_seen_desc",
  });

  return {
    seriesItems: seriesList.items,
    seriesPageInfo: seriesList.page_info,
    searchResults: [],
    searchNextCursor: null,
  };
}

export async function loadListCatalog() {
  const listCatalog = await getLists({ limit: 200, view: "compact" });

  return {
    lists: listCatalog.items,
    listCatalog,
  };
}
