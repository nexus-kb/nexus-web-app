import "server-only";
import { headers as nextHeaders } from "next/headers";

import type {
  GetListsParams,
  GetMessageBodyParams,
  GetPatchItemFileDiffParams,
  GetSeriesCompareParams,
  GetSeriesParams,
  GetSeriesVersionParams,
  GetSearchParams,
  GetThreadMessagesParams,
  GetThreadsParams,
} from "@/lib/api/adapter";
import type {
  ListCatalogResponse,
  ListDetailResponse,
  ListStatsResponse,
  MessageBodyResponse,
  MessageDetailResponse,
  PaginationResponse,
  PatchItemDetailResponse,
  PatchItemFile,
  PatchItemFileDiffResponse,
  PatchItemFilesResponse,
  PatchItemFullDiffResponse,
  SeriesCompareResponse,
  SeriesDetailResponse,
  SearchResponse,
  SeriesListResponse,
  SeriesVersionResponse,
  ThreadDetailResponse,
  ThreadMessage,
  ThreadMessagesResponse,
  ThreadListItem,
  ThreadListResponse,
  VersionResponse,
} from "@/lib/api/contracts";

export const METADATA_REVALIDATE_SECONDS = 300;
export const CONTENT_REVALIDATE_SECONDS = 86400;

type QueryValue = string | number | boolean | null | undefined;
type QueryInput = Record<string, QueryValue>;

export type ApiCacheProfile = "metadata" | "content" | "no-store";

interface FetchApiOptions {
  query?: QueryInput;
  cacheProfile?: ApiCacheProfile;
  init?: RequestInit;
}

const INGRESS_FORWARD_HEADER_NAMES = [
  "cf-connecting-ip",
  "cf-connecting-ipv6",
  "true-client-ip",
  "x-forwarded-for",
  "x-real-ip",
  "cf-ray",
  "cf-ipcountry",
] as const;

function getRequiredApiBaseUrl(): string {
  const raw = process.env.NEXUS_WEB_API_BASE_URL?.trim();
  if (!raw) {
    throw new Error("Missing required env var NEXUS_WEB_API_BASE_URL");
  }

  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function joinApiUrl(path: string): string {
  const baseUrl = getRequiredApiBaseUrl();
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${suffix}`;
}

function toQueryString(input?: QueryInput): string {
  if (!input) {
    return "";
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value == null || value === "") {
      continue;
    }
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

function withQuery(path: string, query?: QueryInput): string {
  return `${path}${toQueryString(query)}`;
}

async function readIncomingHeaders(): Promise<Headers | null> {
  try {
    const incoming = await nextHeaders();
    return new Headers(incoming);
  } catch {
    // Request-scoped headers are unavailable outside a live request context
    // (for example during isolated unit tests). In that case we simply skip
    // forwarding ingress headers.
    return null;
  }
}

function firstForwardedForValue(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const first = value
    .split(",")
    .map((segment) => segment.trim())
    .find((segment) => segment.length > 0);
  return first ?? null;
}

async function buildForwardedRequestHeaders(
  initHeaders: RequestInit["headers"],
): Promise<Headers> {
  const merged = new Headers(initHeaders);
  const incoming = await readIncomingHeaders();
  if (!incoming) {
    return merged;
  }

  for (const name of INGRESS_FORWARD_HEADER_NAMES) {
    const value = incoming.get(name);
    if (!value || merged.has(name)) {
      continue;
    }
    merged.set(name, value);
  }

  if (!merged.has("x-forwarded-for")) {
    const cfIp =
      merged.get("cf-connecting-ip") ??
      merged.get("true-client-ip") ??
      merged.get("cf-connecting-ipv6");
    if (cfIp) {
      merged.set("x-forwarded-for", cfIp);
    }
  }

  if (!merged.has("x-real-ip")) {
    const firstForwarded = firstForwardedForValue(merged.get("x-forwarded-for"));
    if (firstForwarded) {
      merged.set("x-real-ip", firstForwarded);
    }
  }

  return merged;
}

function getCacheConfig(cacheProfile: ApiCacheProfile): Pick<RequestInit, "cache"> & {
  next?: { revalidate: number };
} {
  if (cacheProfile === "no-store") {
    return { cache: "no-store", next: { revalidate: 0 } };
  }

  if (cacheProfile === "content") {
    return { next: { revalidate: CONTENT_REVALIDATE_SECONDS } };
  }

  return { next: { revalidate: METADATA_REVALIDATE_SECONDS } };
}

function normalizePagination(raw: unknown): PaginationResponse {
  const value = (raw as Partial<PaginationResponse> | null | undefined) ?? {};
  const page = Number(value.page ?? 1);
  const pageSize = Number(value.page_size ?? 50);
  const totalItems = Number(value.total_items ?? 0);
  const totalPages = Number(
    value.total_pages ??
      (totalItems > 0 ? Math.ceil(totalItems / Math.max(pageSize, 1)) : 0),
  );

  return {
    page: Number.isFinite(page) ? page : 1,
    page_size: Number.isFinite(pageSize) ? pageSize : 50,
    total_items: Number.isFinite(totalItems) ? totalItems : 0,
    total_pages: Number.isFinite(totalPages) ? totalPages : 0,
    has_prev: Boolean(value.has_prev),
    has_next: Boolean(value.has_next),
  };
}

function normalizeThreadParticipant(
  raw: Record<string, unknown>,
): ThreadListItem["participants"][number] {
  return {
    name:
      (raw.name as string | null | undefined) ??
      (raw.from_name as string | null | undefined) ??
      null,
    email: String(raw.email ?? raw.from_email ?? "unknown@example.invalid"),
  };
}

function normalizeThreadListItem(raw: Record<string, unknown>): ThreadListItem {
  const participants = (
    (raw.participants as Record<string, unknown>[] | undefined) ?? []
  ).map(normalizeThreadParticipant);
  const starterRaw = (raw.starter as Record<string, unknown> | undefined) ?? {};
  const starterEmail =
    (starterRaw.email as string | undefined) ??
    (starterRaw.from_email as string | undefined) ??
    (raw.starter_email as string | undefined);
  const starterName =
    (starterRaw.name as string | null | undefined) ??
    (starterRaw.from_name as string | null | undefined) ??
    (raw.starter_name as string | null | undefined) ??
    null;

  return {
    thread_id: Number(raw.thread_id ?? raw.id ?? 0),
    subject: String(raw.subject ?? raw.subject_norm ?? ""),
    root_message_id:
      raw.root_message_id != null
        ? Number(raw.root_message_id)
        : raw.root_message_pk != null
          ? Number(raw.root_message_pk)
          : null,
    created_at:
      (raw.created_at as string | undefined) ??
      (raw.start_date as string | undefined),
    last_activity_at: String(raw.last_activity_at ?? raw.last_date ?? ""),
    message_count: Number(raw.message_count ?? 0),
    participants,
    starter: starterEmail ? { name: starterName, email: starterEmail } : null,
    has_diff: Boolean(raw.has_diff),
  };
}

function normalizeThreadMessage(raw: Record<string, unknown>): ThreadMessage {
  const fromRaw = (raw.from as Record<string, unknown> | undefined) ?? {};

  return {
    message_id: Number(raw.message_id ?? raw.message_pk ?? 0),
    parent_message_id:
      raw.parent_message_id != null ? Number(raw.parent_message_id) : null,
    depth: Number(raw.depth ?? 0),
    sort_key: String(raw.sort_key ?? ""),
    from: {
      name:
        (fromRaw.name as string | null | undefined) ??
        (raw.from_name as string | null | undefined) ??
        null,
      email:
        (fromRaw.email as string | undefined) ??
        (raw.from_email as string | undefined) ??
        "unknown@example.invalid",
    },
    date_utc: (raw.date_utc as string | null | undefined) ?? null,
    subject: String(raw.subject ?? raw.subject_raw ?? ""),
    has_diff: Boolean(raw.has_diff),
    snippet: (raw.snippet as string | null | undefined) ?? null,
    body_text: (raw.body_text as string | null | undefined) ?? null,
    patch_item_id: raw.patch_item_id != null ? Number(raw.patch_item_id) : null,
  };
}

function normalizePatchItemFile(raw: Record<string, unknown>): PatchItemFile {
  return {
    patch_item_id: Number(raw.patch_item_id ?? 0),
    path: String(raw.path ?? raw.new_path ?? ""),
    old_path: (raw.old_path as string | null | undefined) ?? null,
    change_type: String(raw.change_type ?? "M") as PatchItemFile["change_type"],
    is_binary: Boolean(raw.is_binary),
    additions: Number(raw.additions ?? 0),
    deletions: Number(raw.deletions ?? 0),
    hunks: Number(raw.hunks ?? raw.hunk_count ?? 0),
    diff_start: Number(raw.diff_start ?? 0),
    diff_end: Number(raw.diff_end ?? 0),
  };
}

async function fetchJson<T>(path: string, options?: FetchApiOptions): Promise<T> {
  const url = joinApiUrl(withQuery(path, options?.query));
  const cacheConfig = getCacheConfig(options?.cacheProfile ?? "metadata");
  const headers = await buildForwardedRequestHeaders({
    Accept: "application/json",
    ...(options?.init?.headers ?? {}),
  });

  const response = await fetch(url, {
    ...cacheConfig,
    ...options?.init,
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
  }

  return (await response.json()) as T;
}

export async function fetchApiResponse(
  path: string,
  options?: FetchApiOptions,
): Promise<Response> {
  const url = joinApiUrl(withQuery(path, options?.query));
  const cacheConfig = getCacheConfig(options?.cacheProfile ?? "metadata");
  const headers = await buildForwardedRequestHeaders(options?.init?.headers);

  return fetch(url, {
    ...cacheConfig,
    ...options?.init,
    headers,
  });
}

export function buildMessageRawApiPath(messageId: number): string {
  return `/api/v1/messages/${messageId}/raw`;
}

export function buildSeriesExportMboxApiPath(
  seriesId: number,
  seriesVersionId: number,
  assembled = true,
  includeCover = false,
): string {
  return withQuery(
    `/api/v1/series/${seriesId}/versions/${seriesVersionId}/export/mbox`,
    {
      assembled,
      include_cover: includeCover,
    },
  );
}

export async function getLists(params?: GetListsParams): Promise<ListCatalogResponse> {
  const data = await fetchJson<unknown>("/api/v1/lists", {
    query: {
      page: params?.page ?? 1,
      page_size: params?.pageSize ?? 200,
    },
    cacheProfile: "metadata",
  });

  if (Array.isArray(data)) {
    return {
      items: data as ListCatalogResponse["items"],
      pagination: normalizePagination(undefined),
    };
  }

  const wrapped = data as {
    items?: ListCatalogResponse["items"];
    pagination?: unknown;
  };
  return {
    items: wrapped.items ?? [],
    pagination: normalizePagination(wrapped.pagination),
  };
}

export async function getListDetail(listKey: string): Promise<ListDetailResponse> {
  return fetchJson<ListDetailResponse>(
    `/api/v1/lists/${encodeURIComponent(listKey)}`,
    { cacheProfile: "metadata" },
  );
}

export async function getListStats(
  listKey: string,
  window = "30d",
): Promise<ListStatsResponse> {
  return fetchJson<ListStatsResponse>(
    `/api/v1/lists/${encodeURIComponent(listKey)}/stats`,
    {
      query: { window },
      cacheProfile: "metadata",
    },
  );
}

export async function getThreads(params: GetThreadsParams): Promise<ThreadListResponse> {
  const raw = await fetchJson<unknown>(
    `/api/v1/lists/${encodeURIComponent(params.listKey)}/threads`,
    {
      query: {
        sort: params.sort,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 50,
        from: params.from,
        to: params.to,
        author: params.author,
        has_diff: params.hasDiff,
      },
      cacheProfile: "metadata",
    },
  );

  if (Array.isArray(raw)) {
    return {
      items: raw.map((item) => normalizeThreadListItem(item as Record<string, unknown>)),
      pagination: normalizePagination(undefined),
    };
  }

  const data = raw as { items?: Record<string, unknown>[]; pagination?: unknown };
  return {
    items: (data.items ?? []).map(normalizeThreadListItem),
    pagination: normalizePagination(data.pagination),
  };
}

export async function getThreadDetail(
  listKey: string,
  threadId: number,
): Promise<ThreadDetailResponse> {
  const raw = await fetchJson<Record<string, unknown>>(
    `/api/v1/lists/${encodeURIComponent(listKey)}/threads/${threadId}`,
    { cacheProfile: "metadata" },
  );
  const rawMessages = (raw.messages as Record<string, unknown>[] | undefined) ?? [];

  return {
    thread_id: Number(raw.thread_id ?? threadId),
    list_key: String(raw.list_key ?? listKey),
    subject: String(raw.subject ?? ""),
    membership_hash: String(raw.membership_hash ?? ""),
    last_activity_at: String(raw.last_activity_at ?? ""),
    messages: rawMessages.map(normalizeThreadMessage),
  };
}

export async function getThreadMessages(
  params: GetThreadMessagesParams,
): Promise<ThreadMessagesResponse> {
  const raw = await fetchJson<Record<string, unknown>>(
    `/api/v1/lists/${encodeURIComponent(params.listKey)}/threads/${params.threadId}/messages`,
    {
      query: {
        view: params.view ?? "snippets",
        page: params.page ?? 1,
        page_size: params.pageSize ?? 50,
      },
      cacheProfile: "metadata",
    },
  );

  return {
    thread_id: Number(raw.thread_id ?? params.threadId),
    list_key: String(raw.list_key ?? params.listKey),
    view: String(raw.view ?? "snippets") === "full" ? "full" : "snippets",
    messages: ((raw.messages as Record<string, unknown>[] | undefined) ?? []).map(
      normalizeThreadMessage,
    ),
    pagination: normalizePagination(raw.pagination),
  };
}

export async function getMessageDetail(messageId: number): Promise<MessageDetailResponse> {
  const raw = await fetchJson<Record<string, unknown>>(`/api/v1/messages/${messageId}`, {
    cacheProfile: "metadata",
  });
  const fromRaw = (raw.from as Record<string, unknown> | undefined) ?? {};

  return {
    message_id: Number(raw.message_id ?? messageId),
    message_id_primary: String(raw.message_id_primary ?? ""),
    subject: String(raw.subject ?? ""),
    subject_norm: String(raw.subject_norm ?? ""),
    from: {
      name: (fromRaw.name as string | null | undefined) ?? null,
      email: String(fromRaw.email ?? "unknown@example.invalid"),
    },
    date_utc: (raw.date_utc as string | null | undefined) ?? null,
    to_raw: (raw.to_raw as string | null | undefined) ?? null,
    cc_raw: (raw.cc_raw as string | null | undefined) ?? null,
    references: (raw.references as string[] | undefined) ?? [],
    in_reply_to: (raw.in_reply_to as string[] | undefined) ?? [],
    has_diff: Boolean(raw.has_diff),
    has_attachments: Boolean(raw.has_attachments),
  };
}

export async function getMessageBody(
  params: GetMessageBodyParams,
): Promise<MessageBodyResponse> {
  const raw = await fetchJson<Record<string, unknown>>(
    `/api/v1/messages/${params.messageId}/body`,
    {
      query: {
        include_diff: params.includeDiff,
        strip_quotes: params.stripQuotes,
      },
      cacheProfile: "content",
    },
  );

  return {
    message_id: Number(raw.message_id ?? params.messageId),
    subject: String(raw.subject ?? ""),
    body_text: String(raw.body_text ?? ""),
    body_html: (raw.body_html as string | null | undefined) ?? null,
    diff_text: (raw.diff_text as string | null | undefined) ?? null,
    has_diff: Boolean(raw.has_diff),
    has_attachments: Boolean(raw.has_attachments),
    attachments: (raw.attachments as MessageBodyResponse["attachments"] | undefined) ?? [],
  };
}

export async function getPatchItemDetail(
  patchItemId: number,
): Promise<PatchItemDetailResponse> {
  const raw = await fetchJson<Record<string, unknown>>(
    `/api/v1/patch-items/${patchItemId}`,
    { cacheProfile: "metadata" },
  );

  return {
    patch_item_id: Number(raw.patch_item_id ?? patchItemId),
    series_id: Number(raw.series_id ?? raw.patch_series_id ?? 0),
    series_version_id: Number(raw.series_version_id ?? raw.patch_series_version_id ?? 0),
    ordinal: Number(raw.ordinal ?? 0),
    total: raw.total != null ? Number(raw.total) : null,
    item_type: String(raw.item_type ?? "patch"),
    subject: String(raw.subject ?? raw.subject_raw ?? ""),
    subject_norm: String(raw.subject_norm ?? ""),
    commit_subject: (raw.commit_subject as string | null | undefined) ?? null,
    commit_subject_norm: (raw.commit_subject_norm as string | null | undefined) ?? null,
    message_id: Number(raw.message_id ?? raw.message_pk ?? 0),
    message_id_primary: String(raw.message_id_primary ?? ""),
    patch_id_stable: (raw.patch_id_stable as string | null | undefined) ?? null,
    has_diff: Boolean(raw.has_diff),
    file_count: Number(raw.file_count ?? 0),
    additions: Number(raw.additions ?? 0),
    deletions: Number(raw.deletions ?? 0),
    hunks: Number(raw.hunks ?? raw.hunk_count ?? 0),
  };
}

export async function getPatchItemFiles(
  patchItemId: number,
): Promise<PatchItemFilesResponse> {
  const raw = await fetchJson<unknown>(`/api/v1/patch-items/${patchItemId}/files`, {
    cacheProfile: "content",
  });

  const rows = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : (((raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<
        string,
        unknown
      >[]);

  return {
    items: rows
      .map(normalizePatchItemFile)
      .map((file) => ({ ...file, patch_item_id: file.patch_item_id || patchItemId })),
  };
}

export async function getPatchItemFileDiff(
  params: GetPatchItemFileDiffParams,
): Promise<PatchItemFileDiffResponse> {
  const raw = await fetchJson<Record<string, unknown>>(
    `/api/v1/patch-items/${params.patchItemId}/files/${encodeURIComponent(params.path)}/diff`,
    { cacheProfile: "content" },
  );

  return {
    patch_item_id: Number(raw.patch_item_id ?? params.patchItemId),
    path: String(raw.path ?? params.path),
    diff_text: String(raw.diff_text ?? ""),
  };
}

export async function getPatchItemFullDiff(
  patchItemId: number,
): Promise<PatchItemFullDiffResponse> {
  const raw = await fetchJson<Record<string, unknown>>(
    `/api/v1/patch-items/${patchItemId}/diff`,
    { cacheProfile: "content" },
  );

  return {
    patch_item_id: Number(raw.patch_item_id ?? patchItemId),
    diff_text: String(raw.diff_text ?? ""),
  };
}

export async function getSeries(params?: GetSeriesParams): Promise<SeriesListResponse> {
  const raw = await fetchJson<SeriesListResponse>("/api/v1/series", {
    query: {
      list_key: params?.listKey,
      sort: params?.sort ?? "last_seen_desc",
      page: params?.page ?? 1,
      page_size: params?.pageSize ?? 50,
    },
    cacheProfile: "metadata",
  });

  return {
    items: (raw.items ?? []).map((item) => ({
      ...item,
      author_name: item.author_name ?? null,
      first_seen_at: item.first_seen_at ?? item.last_seen_at,
      latest_patchset_at: item.latest_patchset_at ?? item.last_seen_at,
    })),
    pagination: normalizePagination(raw.pagination),
  };
}

export async function getSeriesDetail(seriesId: number): Promise<SeriesDetailResponse> {
  return fetchJson<SeriesDetailResponse>(`/api/v1/series/${seriesId}`, {
    cacheProfile: "metadata",
  });
}

export async function getSeriesVersion(
  params: GetSeriesVersionParams,
): Promise<SeriesVersionResponse> {
  return fetchJson<SeriesVersionResponse>(
    `/api/v1/series/${params.seriesId}/versions/${params.seriesVersionId}`,
    {
      query: {
        assembled: params.assembled,
      },
      cacheProfile: "metadata",
    },
  );
}

export async function getSeriesCompare(
  params: GetSeriesCompareParams,
): Promise<SeriesCompareResponse> {
  return fetchJson<SeriesCompareResponse>(
    `/api/v1/series/${params.seriesId}/compare`,
    {
      query: {
        v1: params.v1,
        v2: params.v2,
        mode: params.mode,
      },
      cacheProfile: "metadata",
    },
  );
}

export async function getSearch(params: GetSearchParams): Promise<SearchResponse> {
  const normalizedSort =
    params.sort === "date_asc"
      ? "date_desc"
      : (params.sort ?? "relevance");

  const raw = await fetchJson<Record<string, unknown>>("/api/v1/search", {
    query: {
      q: params.q,
      scope: params.scope ?? "thread",
      list_key: params.listKey,
      author: params.author,
      from: params.from,
      to: params.to,
      has_diff: params.hasDiff,
      sort: normalizedSort,
      limit: params.limit ?? 20,
      cursor: params.cursor,
      hybrid: params.hybrid,
      semantic_ratio: params.semanticRatio,
    },
    cacheProfile: "no-store",
  });

  const items = ((raw.items as Record<string, unknown>[] | undefined) ?? []).map(
    (item) => ({
      scope: (item.scope as SearchResponse["items"][number]["scope"]) ?? "thread",
      id: Number(item.id ?? 0),
      title: String(item.title ?? ""),
      snippet: (item.snippet as string | null | undefined) ?? null,
      route: String(item.route ?? ""),
      date_utc: (item.date_utc as string | null | undefined) ?? null,
      list_keys: ((item.list_keys as string[] | undefined) ?? []).map(String),
      has_diff: Boolean(item.has_diff),
      author_email: (item.author_email as string | null | undefined) ?? null,
      metadata:
        (item.metadata as Record<string, unknown> | undefined) ?? {},
    }),
  );

  return {
    items,
    facets:
      (raw.facets as Record<string, Record<string, number>> | undefined) ?? {},
    highlights:
      (raw.highlights as Record<string, Record<string, unknown>> | undefined) ??
      {},
    next_cursor: (raw.next_cursor as string | null | undefined) ?? null,
  };
}

export async function getVersion(): Promise<VersionResponse> {
  return fetchJson<VersionResponse>("/api/v1/version", {
    cacheProfile: "metadata",
  });
}
