import { notFound } from "next/navigation";
import { DiffWorkspace } from "@/components/diff-workspace";
import {
  getPatchItemDetail,
  getPatchItemFiles,
  getSeriesDetail,
} from "@/lib/api/server-client";
import { loadListCatalog } from "@/lib/api/server-data";

export const dynamic = "force-dynamic";

interface DiffPageProps {
  params: Promise<{ patchItemId: string }>;
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

export default async function DiffOnlyPage({ params, searchParams }: DiffPageProps) {
  const { patchItemId } = await params;
  const parsedPatchItemId = Number(patchItemId);
  if (!Number.isFinite(parsedPatchItemId)) {
    notFound();
  }

  const query = await searchParams;
  const { lists } = await loadListCatalog();

  const patchItem = await getPatchItemDetail(parsedPatchItemId).catch(() => null);
  if (!patchItem) {
    notFound();
  }

  const [files, seriesDetail] = await Promise.all([
    getPatchItemFiles(parsedPatchItemId),
    getSeriesDetail(patchItem.series_id).catch(() => null),
  ]);

  return (
    <DiffWorkspace
      lists={lists}
      selectedListKey={seriesDetail?.lists[0] ?? lists[0]?.list_key ?? "lkml"}
      patchItem={patchItem}
      files={files.items}
      initialPath={getParam(query, "path")}
      initialView={getParam(query, "view")}
    />
  );
}
