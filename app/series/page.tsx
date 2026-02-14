import { SeriesWorkspace } from "@/components/series-workspace";
import { createNexusApiAdapter } from "@/lib/api";
import { loadListCatalog } from "@/lib/api/server-data";

interface SeriesIndexPageProps {
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

export default async function SeriesIndexPage({ searchParams }: SeriesIndexPageProps) {
  const query = await searchParams;
  const seriesPage = parsePage(getParam(query, "series_page"), 1);

  const { config, lists } = await loadListCatalog();
  const adapter = createNexusApiAdapter(config);
  const seriesList = await adapter.getSeries({ page: seriesPage, pageSize: 30, sort: "last_seen_desc" });

  return (
    <SeriesWorkspace
      lists={lists}
      selectedListKey={lists[0]?.list_key ?? "lkml"}
      seriesItems={seriesList.items}
      seriesPagination={seriesList.pagination}
      selectedSeriesId={null}
      seriesDetail={null}
      selectedVersion={null}
      compare={null}
      apiConfig={config}
      initialTheme={getParam(query, "theme")}
      initialNav={getParam(query, "nav")}
    />
  );
}
