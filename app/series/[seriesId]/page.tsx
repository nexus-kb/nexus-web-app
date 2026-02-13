import { PlaceholderWorkspace } from "@/components/placeholder-workspace";
import { loadListCatalog } from "@/lib/api/server-data";

interface SeriesDetailPageProps {
  params: Promise<{ seriesId: string }>;
}

export default async function SeriesDetailPage({ params }: SeriesDetailPageProps) {
  const { seriesId } = await params;
  const { lists } = await loadListCatalog();

  return (
    <PlaceholderWorkspace
      lists={lists}
      selectedListKey={lists[0]?.list_key ?? "lkml"}
      title={`Series ${seriesId}`}
      description="Version pills, logical patch mapping, and compare views are scaffolded and ready for API wiring."
    />
  );
}
