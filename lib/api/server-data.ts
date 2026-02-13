import { createNexusApiAdapter, resolveNexusApiRuntimeConfig } from "@/lib/api";

export async function loadWorkspaceData(listKey: string, threadId?: number) {
  const config = resolveNexusApiRuntimeConfig();
  const adapter = createNexusApiAdapter(config);

  const lists = await adapter.getLists();
  const fallbackListKey = lists[0]?.list_key;
  const effectiveListKey = listKey || fallbackListKey;

  if (!effectiveListKey) {
    return {
      config,
      lists,
      listKey: "",
      threads: [],
      detail: null,
    };
  }

  const threadsResponse = await adapter.getThreads({ listKey: effectiveListKey, sort: "activity_desc", limit: 200 });
  const detail = threadId ? await adapter.getThreadDetail(effectiveListKey, threadId) : null;

  return {
    config,
    lists,
    listKey: effectiveListKey,
    threads: threadsResponse.items,
    detail,
  };
}

export async function loadListCatalog() {
  const config = resolveNexusApiRuntimeConfig();
  const adapter = createNexusApiAdapter(config);
  const lists = await adapter.getLists();

  return {
    config,
    lists,
  };
}

export async function resolveDefaultThreadDestination() {
  const config = resolveNexusApiRuntimeConfig();
  const adapter = createNexusApiAdapter(config);
  const lists = await adapter.getLists();
  const firstList = lists[0]?.list_key;

  if (!firstList) {
    return "/search";
  }

  const threads = await adapter.getThreads({ listKey: firstList, sort: "activity_desc", limit: 1 });
  const firstThread = threads.items[0]?.thread_id;

  if (!firstThread) {
    return `/lists/${encodeURIComponent(firstList)}/threads`;
  }

  return `/lists/${encodeURIComponent(firstList)}/threads/${firstThread}`;
}
