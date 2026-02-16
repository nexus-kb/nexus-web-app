type HasDiffParam = "" | "true" | "false";
type SortParam = "relevance" | "date_desc" | "date_asc";

type SearchParamsRecord = Record<string, string | string[] | undefined>;

interface SearchParamsLike {
  get: (key: string) => string | null;
}

export interface IntegratedSearchDefaults {
  list_key: string;
  sort?: SortParam;
  semantic_ratio?: number;
}

export interface IntegratedSearchQuery {
  q: string;
  list_key: string;
  author: string;
  from: string;
  to: string;
  has_diff: HasDiffParam;
  sort: SortParam;
  hybrid: boolean;
  semantic_ratio: number;
  cursor: string;
}

export const INTEGRATED_SEARCH_PARAM_KEYS = [
  "q",
  "list_key",
  "author",
  "from",
  "to",
  "has_diff",
  "sort",
  "hybrid",
  "semantic_ratio",
  "cursor",
] as const;

type IntegratedSearchParamKey = (typeof INTEGRATED_SEARCH_PARAM_KEYS)[number];

export type IntegratedSearchUpdates = Record<IntegratedSearchParamKey, string | null>;

function getRecordParam(searchParams: SearchParamsRecord, key: string): string | undefined {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseHasDiff(raw: string | undefined): HasDiffParam {
  if (raw === "true" || raw === "false") {
    return raw;
  }
  return "";
}

function parseSort(raw: string | undefined): SortParam {
  if (raw === "date_desc" || raw === "date_asc") {
    return raw;
  }
  return "relevance";
}

function parseBoolean(raw: string | undefined): boolean {
  return raw === "true" || raw === "1" || raw === "on";
}

function parseSemanticRatio(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > 1) {
    return 1;
  }
  return parsed;
}

function emptyIntegratedSearchUpdates(): IntegratedSearchUpdates {
  return {
    q: null,
    list_key: null,
    author: null,
    from: null,
    to: null,
    has_diff: null,
    sort: null,
    hybrid: null,
    semantic_ratio: null,
    cursor: null,
  };
}

export function parseIntegratedSearchParams(
  searchParams: SearchParamsRecord,
  defaults: IntegratedSearchDefaults,
): IntegratedSearchQuery {
  const fallbackSemanticRatio = defaults.semantic_ratio ?? 0.35;

  return {
    q: (getRecordParam(searchParams, "q") ?? "").trim(),
    list_key: (getRecordParam(searchParams, "list_key") ?? defaults.list_key).trim(),
    author: (getRecordParam(searchParams, "author") ?? "").trim(),
    from: (getRecordParam(searchParams, "from") ?? "").trim(),
    to: (getRecordParam(searchParams, "to") ?? "").trim(),
    has_diff: parseHasDiff(getRecordParam(searchParams, "has_diff")),
    sort: parseSort(getRecordParam(searchParams, "sort") ?? defaults.sort),
    hybrid: parseBoolean(getRecordParam(searchParams, "hybrid")),
    semantic_ratio: parseSemanticRatio(
      getRecordParam(searchParams, "semantic_ratio"),
      fallbackSemanticRatio,
    ),
    cursor: (getRecordParam(searchParams, "cursor") ?? "").trim(),
  };
}

export function readIntegratedSearchParams(
  searchParams: SearchParamsLike,
  defaults: IntegratedSearchDefaults,
): IntegratedSearchQuery {
  const record: SearchParamsRecord = {};
  for (const key of INTEGRATED_SEARCH_PARAM_KEYS) {
    const value = searchParams.get(key);
    record[key] = value ?? undefined;
  }
  return parseIntegratedSearchParams(record, defaults);
}

export function buildIntegratedSearchUpdates(
  formData: FormData,
  defaults: IntegratedSearchDefaults,
): IntegratedSearchUpdates {
  const q = String(formData.get("q") ?? "").trim();
  if (!q) {
    return emptyIntegratedSearchUpdates();
  }

  const updates = emptyIntegratedSearchUpdates();
  const listKey = String(formData.get("list_key") ?? defaults.list_key).trim();
  const author = String(formData.get("author") ?? "").trim();
  const from = String(formData.get("from") ?? "").trim();
  const to = String(formData.get("to") ?? "").trim();
  const hasDiff = parseHasDiff(String(formData.get("has_diff") ?? ""));
  const sort = parseSort(String(formData.get("sort") ?? defaults.sort ?? "relevance"));
  const hybrid = parseBoolean(String(formData.get("hybrid") ?? ""));
  const semanticRatio = parseSemanticRatio(
    String(formData.get("semantic_ratio") ?? ""),
    defaults.semantic_ratio ?? 0.35,
  );

  updates.q = q;
  updates.list_key = listKey === defaults.list_key ? null : listKey || null;
  updates.author = author || null;
  updates.from = from || null;
  updates.to = to || null;
  updates.has_diff = hasDiff || null;
  updates.sort = sort === "relevance" ? null : sort;
  updates.hybrid = hybrid ? "true" : null;
  updates.semantic_ratio = hybrid ? String(semanticRatio) : null;

  return updates;
}

export function clearIntegratedSearchUpdates(): IntegratedSearchUpdates {
  return emptyIntegratedSearchUpdates();
}

export function isSearchActive(query: IntegratedSearchQuery): boolean {
  return query.q.trim().length > 0;
}
