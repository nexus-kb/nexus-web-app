import { notFound } from "next/navigation";
import { SeriesWorkspace } from "@/components/series-workspace";
import type { GetSeriesCompareParams } from "@/lib/api/adapter";
import {
  getSeries,
  getSeriesCompare,
  getSeriesDetail,
  getSeriesVersion,
} from "@/lib/api/server-client";
import { loadListCatalog } from "@/lib/api/server-data";

export const dynamic = "force-dynamic";

interface SeriesDetailPageProps {
  params: Promise<{ seriesId: string }>;
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

function parseNumber(value: string | undefined): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function parseCompareMode(value: string | undefined): GetSeriesCompareParams["mode"] {
  if (value === "summary" || value === "per_patch" || value === "per_file") {
    return value;
  }
  return "summary";
}

export default async function SeriesDetailPage({ params, searchParams }: SeriesDetailPageProps) {
  const { seriesId } = await params;
  const parsedSeriesId = Number(seriesId);
  if (!Number.isFinite(parsedSeriesId)) {
    notFound();
  }

  const query = await searchParams;
  const seriesPage = parsePage(getParam(query, "series_page"), 1);

  const { lists } = await loadListCatalog();

  const [seriesList, seriesDetail] = await Promise.all([
    getSeries({ page: seriesPage, pageSize: 30, sort: "last_seen_desc" }),
    getSeriesDetail(parsedSeriesId).catch(() => null),
  ]);

  if (!seriesDetail) {
    notFound();
  }

  const selectedVersionId =
    parseNumber(getParam(query, "version")) ??
    seriesDetail.latest_version_id ??
    seriesDetail.versions[seriesDetail.versions.length - 1]?.series_version_id ??
    null;

  const selectedVersion = selectedVersionId
    ? await getSeriesVersion({
      seriesId: parsedSeriesId,
      seriesVersionId: selectedVersionId,
      assembled: true,
    })
    : null;

  const v1 = parseNumber(getParam(query, "v1"));
  const v2 = parseNumber(getParam(query, "v2"));
  const compareMode = parseCompareMode(getParam(query, "compare_mode"));

  const compare = v1 && v2
    ? await getSeriesCompare({
      seriesId: parsedSeriesId,
      v1,
      v2,
      mode: compareMode,
    })
    : null;

  return (
    <SeriesWorkspace
      lists={lists}
      selectedListKey={seriesDetail.lists[0] ?? lists[0]?.list_key ?? "lkml"}
      seriesItems={seriesList.items}
      seriesPagination={seriesList.pagination}
      selectedSeriesId={parsedSeriesId}
      seriesDetail={seriesDetail}
      selectedVersion={selectedVersion}
      compare={compare}
    />
  );
}
