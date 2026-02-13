import { PlaceholderWorkspace } from "@/components/placeholder-workspace";
import { loadListCatalog } from "@/lib/api/server-data";

export default async function SeriesIndexPage() {
  const { lists } = await loadListCatalog();

  return (
    <PlaceholderWorkspace
      lists={lists}
      selectedListKey={lists[0]?.list_key ?? "lkml"}
      title="Series Timeline"
      description="Timeline navigation and version comparison UI will land after threads-core stabilization."
    />
  );
}
