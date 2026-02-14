import { createNexusApiAdapter, resolveNexusApiRuntimeConfig } from "@/lib/api";

export async function loadWorkspaceData(
  listKey: string,
  threadId?: number,
  threadsPage = 1,
  threadsPageSize = 50,
  messagesPage = 1,
  messagesPageSize = 50,
) {
  const config = resolveNexusApiRuntimeConfig();
  const adapter = createNexusApiAdapter(config);

  const listCatalog = await adapter.getLists({ page: 1, pageSize: 200 });
  const lists = listCatalog.items;
  const fallbackListKey = lists[0]?.list_key;
  const effectiveListKey = listKey || fallbackListKey;

  if (!effectiveListKey) {
    return {
      config,
      lists,
      listCatalog,
      listKey: "",
      threads: [],
      threadsPagination: {
        page: 1,
        page_size: threadsPageSize,
        total_items: 0,
        total_pages: 0,
        has_prev: false,
        has_next: false,
      },
      detail: null,
      messagePagination: null,
    };
  }

  const threadsResponse = await adapter.getThreads({
    listKey: effectiveListKey,
    sort: "activity_desc",
    page: threadsPage,
    pageSize: threadsPageSize,
  });

  const detail = threadId ? await adapter.getThreadDetail(effectiveListKey, threadId) : null;
  const messagesResponse = threadId
    ? await adapter.getThreadMessages({
      listKey: effectiveListKey,
      threadId,
      view: "snippets",
      page: messagesPage,
      pageSize: messagesPageSize,
    })
    : null;

  return {
    config,
    lists,
    listCatalog,
    listKey: effectiveListKey,
    threads: threadsResponse.items,
    threadsPagination: threadsResponse.pagination,
    detail: detail && messagesResponse ? { ...detail, messages: messagesResponse.messages } : detail,
    messagePagination: messagesResponse?.pagination ?? null,
  };
}

export async function loadListCatalog() {
  const config = resolveNexusApiRuntimeConfig();
  const adapter = createNexusApiAdapter(config);
  const listCatalog = await adapter.getLists({ page: 1, pageSize: 200 });

  return {
    config,
    lists: listCatalog.items,
    listCatalog,
  };
}

export async function resolveDefaultThreadDestination() {
  const config = resolveNexusApiRuntimeConfig();
  const adapter = createNexusApiAdapter(config);
  const lists = (await adapter.getLists({ page: 1, pageSize: 200 })).items;
  const firstList = lists[0]?.list_key;

  if (!firstList) {
    return "/search";
  }

  const threads = await adapter.getThreads({ listKey: firstList, sort: "activity_desc", page: 1, pageSize: 1 });
  const firstThread = threads.items[0]?.thread_id;

  if (!firstThread) {
    return `/lists/${encodeURIComponent(firstList)}/threads`;
  }

  return `/lists/${encodeURIComponent(firstList)}/threads/${firstThread}`;
}
