import { notFound } from "next/navigation";
import { ThreadsWorkspace } from "@/components/threads-workspace";
import { loadWorkspaceData } from "@/lib/api/server-data";

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

export default async function ThreadDetailPage({ params, searchParams }: ThreadDetailPageProps) {
  const { listKey, threadId } = await params;
  const parsedThreadId = Number(threadId);
  if (!Number.isFinite(parsedThreadId)) {
    notFound();
  }

  const query = await searchParams;
  const data = await loadWorkspaceData(listKey, parsedThreadId);

  return (
    <ThreadsWorkspace
      lists={data.lists}
      listKey={data.listKey}
      threads={data.threads}
      detail={data.detail}
      selectedThreadId={parsedThreadId}
      initialTheme={getParam(query, "theme")}
      initialDensity={getParam(query, "density")}
      initialNav={getParam(query, "nav")}
      initialMessage={getParam(query, "message")}
      apiConfig={data.config}
    />
  );
}
