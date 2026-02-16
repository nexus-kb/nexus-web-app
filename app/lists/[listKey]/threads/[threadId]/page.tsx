import { notFound } from "next/navigation";
import { ThreadsWorkspace } from "@/components/threads-workspace";
import { loadWorkspaceData } from "@/lib/api/server-data";
import { parseIntegratedSearchParams } from "@/lib/ui/search-query";

export const dynamic = "force-dynamic";

interface ThreadDetailPageProps {
  params: Promise<{ listKey: string; threadId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parsePage(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export default async function ThreadDetailPage({ params, searchParams }: ThreadDetailPageProps) {
  const { listKey, threadId } = await params;
  const parsedThreadId = Number(threadId);
  if (!Number.isFinite(parsedThreadId)) {
    notFound();
  }

  const query = await searchParams;
  const integratedSearchQuery = parseIntegratedSearchParams(query, { list_key: listKey });
  const threadsPage = parsePage(getParam(query, "threads_page"), 1);

  const data = await loadWorkspaceData(
    listKey,
    parsedThreadId,
    threadsPage,
    50,
    integratedSearchQuery,
  );

  return (
    <ThreadsWorkspace
      lists={data.lists}
      listKey={data.listKey}
      threads={data.threads}
      threadsPagination={data.threadsPagination}
      searchResults={data.searchResults}
      searchNextCursor={data.searchNextCursor}
      detail={data.detail}
      selectedThreadId={parsedThreadId}
      initialMessage={getParam(query, "message")}
    />
  );
}
