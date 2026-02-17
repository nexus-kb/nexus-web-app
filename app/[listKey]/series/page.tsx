import { notFound } from "next/navigation";
import { SeriesWorkspace } from "@/components/series-workspace";
import { getSeries } from "@/lib/api/server-client";
import { loadListCatalog } from "@/lib/api/server-data";

export const dynamic = "force-dynamic";

interface SeriesIndexPageProps {
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

function parsePage(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export default async function SeriesIndexPage({ params, searchParams }: SeriesIndexPageProps) {
  const { listKey } = await params;
  const query = await searchParams;
  const seriesPage = parsePage(getParam(query, "series_page"), 1);

  const { lists } = await loadListCatalog();
  if (!lists.some((list) => list.list_key === listKey)) {
    notFound();
  }

  const seriesList = await getSeries({
    listKey,
    page: seriesPage,
    pageSize: 30,
    sort: "last_seen_desc",
  });

  return (
    <SeriesWorkspace
      lists={lists}
      selectedListKey={listKey}
      seriesItems={seriesList.items}
      seriesPagination={seriesList.pagination}
      selectedSeriesId={null}
      seriesDetail={null}
      selectedVersion={null}
      compare={null}
    />
  );
}
