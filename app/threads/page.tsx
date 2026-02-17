import { ThreadsWorkspace } from "@/components/threads-workspace";
import { loadListCatalog } from "@/lib/api/server-data";

export const dynamic = "force-dynamic";

interface ThreadsRootPageProps {
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

const EMPTY_THREADS_PAGINATION = {
  page: 1,
  page_size: 50,
  total_items: 0,
  total_pages: 1,
  has_prev: false,
  has_next: false,
};

export default async function ThreadsRootPage({ searchParams }: ThreadsRootPageProps) {
  const { lists } = await loadListCatalog();
  const query = await searchParams;

  return (
    <ThreadsWorkspace
      lists={lists}
      listKey={null}
      threads={[]}
      threadsPagination={EMPTY_THREADS_PAGINATION}
      detail={null}
      selectedThreadId={null}
      initialMessage={getParam(query, "message")}
    />
  );
}
