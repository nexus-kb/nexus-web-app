import { getLists, getThreadDetail, getThreads } from "@/lib/api/server-client";

export async function loadWorkspaceData(
  listKey: string,
  threadId?: number,
  threadsPage = 1,
  threadsPageSize = 50,
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
        page: 1,
        page_size: threadsPageSize,
        total_items: 0,
        total_pages: 0,
        has_prev: false,
        has_next: false,
      },
      detail: null,
    };
  }

  const threadsPromise = getThreads({
    listKey: effectiveListKey,
    sort: "activity_desc",
    page: threadsPage,
    pageSize: threadsPageSize,
  });
  const detailPromise = threadId
    ? getThreadDetail(effectiveListKey, threadId)
    : Promise.resolve(null);
  const [threadsResponse, detail] = await Promise.all([threadsPromise, detailPromise]);

  return {
    lists,
    listCatalog,
    listKey: effectiveListKey,
    threads: threadsResponse.items,
    threadsPagination: threadsResponse.pagination,
    detail,
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
