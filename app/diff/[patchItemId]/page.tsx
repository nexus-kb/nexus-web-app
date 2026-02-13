import { PlaceholderWorkspace } from "@/components/placeholder-workspace";
import { loadListCatalog } from "@/lib/api/server-data";

interface DiffPageProps {
  params: Promise<{ patchItemId: string }>;
}

export default async function DiffOnlyPage({ params }: DiffPageProps) {
  const { patchItemId } = await params;
  const { lists } = await loadListCatalog();

  return (
    <PlaceholderWorkspace
      lists={lists}
      selectedListKey={lists[0]?.list_key ?? "lkml"}
      title={`Diff View ${patchItemId}`}
      description="Diff-only file tree, per-file panel, and keyboard traversal are scaffolded for upcoming tickets."
    />
  );
}
