import { ThreadsWorkspace } from "@/components/threads-workspace";
import { loadWorkspaceData } from "@/lib/api/server-data";

interface ThreadsListPageProps {
  params: Promise<{ listKey: string }>;
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

export default async function ThreadsListPage({ params, searchParams }: ThreadsListPageProps) {
  const { listKey } = await params;
  const query = await searchParams;
  const data = await loadWorkspaceData(listKey);

  return (
    <ThreadsWorkspace
      lists={data.lists}
      listKey={data.listKey}
      threads={data.threads}
      detail={null}
      selectedThreadId={null}
      initialTheme={getParam(query, "theme")}
      initialDensity={getParam(query, "density")}
      initialNav={getParam(query, "nav")}
      initialMessage={getParam(query, "message")}
      apiConfig={data.config}
    />
  );
}
