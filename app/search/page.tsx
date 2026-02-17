import { SearchWorkspace } from "@/components/search-workspace";
import type { SearchScope } from "@/lib/api/contracts";
import { getSearch } from "@/lib/api/server-client";
import { loadListCatalog } from "@/lib/api/server-data";
import { parseIntegratedSearchParams } from "@/lib/ui/search-query";

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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const { lists } = await loadListCatalog();
  const scope = parseScope(getParam(params, "scope"));
  const query = parseIntegratedSearchParams(params, { list_key: "" });
  const hybridEnabled = query.hybrid && scope !== "patch_item";

  const results = query.q
    ? await getSearch({
        q: query.q,
        scope,
        listKey: query.list_key || undefined,
        author: query.author || undefined,
        from: query.from || undefined,
        to: query.to || undefined,
        hasDiff: query.has_diff === "" ? undefined : query.has_diff === "true",
        sort: query.sort,
        cursor: query.cursor || undefined,
        limit: 20,
        hybrid: hybridEnabled,
        semanticRatio: hybridEnabled ? query.semantic_ratio : undefined,
      })
    : { items: [], facets: {}, highlights: {}, next_cursor: null };

  return (
    <SearchWorkspace
      lists={lists}
      query={{
        q: query.q,
        scope,
        listKey: query.list_key,
        author: query.author,
        from: query.from,
        to: query.to,
        hasDiff: query.has_diff,
        sort: query.sort,
        hybrid: hybridEnabled,
        semanticRatio: query.semantic_ratio,
      }}
      results={results}
    />
  );
}
