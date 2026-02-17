import { SeriesWorkspace } from "@/components/series-workspace";
import { loadListCatalog } from "@/lib/api/server-data";

export const dynamic = "force-dynamic";

export default async function SeriesIndexPage() {
  const { lists } = await loadListCatalog();

  const emptyPagination = {
    page: 1,
    page_size: 30,
    total_items: 0,
    total_pages: 1,
    has_prev: false,
    has_next: false,
  };

  return (
    <SeriesWorkspace
      lists={lists}
      selectedListKey={null}
      seriesItems={[]}
      seriesPagination={emptyPagination}
      selectedSeriesId={null}
      seriesDetail={null}
      selectedVersion={null}
      compare={null}
    />
  );
}
