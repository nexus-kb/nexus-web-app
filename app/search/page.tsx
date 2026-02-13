import { PlaceholderWorkspace } from "@/components/placeholder-workspace";
import { loadListCatalog } from "@/lib/api/server-data";

export default async function SearchPage() {
  const { lists } = await loadListCatalog();

  return (
    <PlaceholderWorkspace
      lists={lists}
      selectedListKey={lists[0]?.list_key ?? "lkml"}
      title="Search"
      description="Search scope tabs and hybrid controls are scaffolded pending Meilisearch endpoint completion."
    />
  );
}
