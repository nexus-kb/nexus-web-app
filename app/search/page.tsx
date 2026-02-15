import { SearchWorkspace } from "@/components/search-workspace";
import type { SearchScope } from "@/lib/api/contracts";
import { getSearch } from "@/lib/api/server-client";
import { loadListCatalog } from "@/lib/api/server-data";

export const dynamic = "force-dynamic";

interface SearchPageProps {
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

function parseScope(raw: string | undefined): SearchScope {
  if (raw === "thread" || raw === "series" || raw === "patch_item") {
    return raw;
  }
  return "thread";
}

function parseHasDiff(raw: string | undefined): "" | "true" | "false" {
  if (raw === "true" || raw === "false") {
    return raw;
  }
  return "";
}

function parseHybrid(raw: string | undefined): boolean {
  return raw === "true" || raw === "1" || raw === "on";
}

function parseSemanticRatio(raw: string | undefined): number {
  const parsed = Number(raw ?? 0.35);
  if (!Number.isFinite(parsed)) {
    return 0.35;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > 1) {
    return 1;
  }
  return parsed;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const { lists } = await loadListCatalog();
  const scope = parseScope(getParam(params, "scope"));
  const q = getParam(params, "q") ?? "";
  const listKey = getParam(params, "list_key") ?? "";
  const author = getParam(params, "author") ?? "";
  const from = getParam(params, "from") ?? "";
  const to = getParam(params, "to") ?? "";
  const hasDiff = parseHasDiff(getParam(params, "has_diff"));
  const sort = getParam(params, "sort") === "date_desc" ? "date_desc" : "relevance";
  const cursor = getParam(params, "cursor");
  const hybrid = parseHybrid(getParam(params, "hybrid"));
  const semanticRatio = parseSemanticRatio(getParam(params, "semantic_ratio"));
  const hybridEnabled = hybrid && scope !== "patch_item";

  const results = q
    ? await getSearch({
        q,
        scope,
        listKey: listKey || undefined,
        author: author || undefined,
        from: from || undefined,
        to: to || undefined,
        hasDiff: hasDiff === "" ? undefined : hasDiff === "true",
        sort,
        cursor: cursor || undefined,
        limit: 20,
        hybrid: hybridEnabled,
        semanticRatio: hybridEnabled ? semanticRatio : undefined,
      })
    : { items: [], facets: {}, highlights: {}, next_cursor: null };

  return (
    <SearchWorkspace
      lists={lists}
      selectedListKey={listKey || lists[0]?.list_key || "lkml"}
      query={{
        q,
        scope,
        listKey,
        author,
        from,
        to,
        hasDiff,
        sort,
        hybrid: hybridEnabled,
        semanticRatio,
      }}
      results={results}
    />
  );
}
