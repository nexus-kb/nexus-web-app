import { SeriesWorkspace } from "@/components/series-workspace";
import { loadListCatalog, loadSeriesCenterData } from "@/lib/api/server-data";
import { parseIntegratedSearchParams } from "@/lib/ui/search-query";

export const dynamic = "force-dynamic";

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
  const integratedSearchQuery = parseIntegratedSearchParams(query, { list_key: "" });

  const { lists } = await loadListCatalog();
  const centerData = await loadSeriesCenterData(seriesPage, integratedSearchQuery);

  return (
    <SeriesWorkspace
      lists={lists}
      selectedListKey={lists[0]?.list_key ?? "lkml"}
      seriesItems={centerData.seriesItems}
      seriesPagination={centerData.seriesPagination}
      searchResults={centerData.searchResults}
      searchNextCursor={centerData.searchNextCursor}
      selectedSeriesId={null}
      seriesDetail={null}
      selectedVersion={null}
      compare={null}
    />
  );
}
