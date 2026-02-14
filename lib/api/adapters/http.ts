import type {
  GetListsParams,
  GetMessageBodyParams,
  GetPatchItemFileDiffParams,
  GetSeriesCompareParams,
  GetSeriesExportMboxParams,
  GetSeriesParams,
  GetSeriesVersionParams,
  GetThreadMessagesParams,
  GetThreadsParams,
  NexusApiAdapter,
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
  SeriesListResponse,
  SeriesVersionResponse,
  ThreadDetailResponse,
  ThreadMessage,
  ThreadMessagesResponse,
  ThreadListItem,
  ThreadListResponse,
  VersionResponse,
} from "@/lib/api/contracts";

function joinUrl(baseUrl: string, path: string): string {
  if (!baseUrl) {
    return path;
  }
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function normalizePagination(raw: unknown): PaginationResponse {
  const value = (raw as Partial<PaginationResponse> | null | undefined) ?? {};
  const page = Number(value.page ?? 1);
  const pageSize = Number(value.page_size ?? 50);
  const totalItems = Number(value.total_items ?? 0);
  const totalPages = Number(value.total_pages ?? (totalItems > 0 ? Math.ceil(totalItems / Math.max(pageSize, 1)) : 0));

  return {
    page: Number.isFinite(page) ? page : 1,
    page_size: Number.isFinite(pageSize) ? pageSize : 50,
    total_items: Number.isFinite(totalItems) ? totalItems : 0,
    total_pages: Number.isFinite(totalPages) ? totalPages : 0,
    has_prev: Boolean(value.has_prev),
    has_next: Boolean(value.has_next),
  };
}

function normalizeThreadParticipant(raw: Record<string, unknown>): ThreadListItem["participants"][number] {
  return {
    name: (raw.name as string | null | undefined) ?? (raw.from_name as string | null | undefined) ?? null,
    email: String(raw.email ?? raw.from_email ?? "unknown@example.invalid"),
  };
}

function normalizeThreadListItem(raw: Record<string, unknown>): ThreadListItem {
  const participants = ((raw.participants as Record<string, unknown>[] | undefined) ?? []).map(
    normalizeThreadParticipant,
  );
  const starterRaw = (raw.starter as Record<string, unknown> | undefined) ?? {};
  const starterEmail = (starterRaw.email as string | undefined) ??
    (starterRaw.from_email as string | undefined) ??
    (raw.starter_email as string | undefined);
  const starterName = (starterRaw.name as string | null | undefined) ??
    (starterRaw.from_name as string | null | undefined) ??
    (raw.starter_name as string | null | undefined) ??
    null;

  return {
    thread_id: Number(raw.thread_id ?? raw.id ?? 0),
    subject: String(raw.subject ?? raw.subject_norm ?? ""),
    root_message_id: raw.root_message_id != null
      ? Number(raw.root_message_id)
      : raw.root_message_pk != null
        ? Number(raw.root_message_pk)
        : null,
    created_at: (raw.created_at as string | undefined) ?? (raw.start_date as string | undefined),
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
    parent_message_id: raw.parent_message_id != null ? Number(raw.parent_message_id) : null,
    depth: Number(raw.depth ?? 0),
    sort_key: String(raw.sort_key ?? ""),
    from: {
      name: (fromRaw.name as string | null | undefined) ??
        (raw.from_name as string | null | undefined) ??
        null,
      email: (fromRaw.email as string | undefined) ??
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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
  }

  return (await response.json()) as T;
}

export class HttpNexusApiAdapter implements NexusApiAdapter {
  constructor(private readonly baseUrl: string) {}

  getMessageRawUrl(messageId: number): string {
    return joinUrl(this.baseUrl, `/api/v1/messages/${messageId}/raw`);
  }

  getSeriesExportMboxUrl(params: GetSeriesExportMboxParams): string {
    const search = new URLSearchParams();
    if (params.assembled != null) {
      search.set("assembled", String(params.assembled));
    }
    if (params.includeCover != null) {
      search.set("include_cover", String(params.includeCover));
    }

    const suffix = search.toString();
    const query = suffix ? `?${suffix}` : "";
    return joinUrl(
      this.baseUrl,
      `/api/v1/series/${params.seriesId}/versions/${params.seriesVersionId}/export/mbox${query}`,
    );
  }

  async getLists(params?: GetListsParams): Promise<ListCatalogResponse> {
    const search = new URLSearchParams();
    search.set("page", String(params?.page ?? 1));
    search.set("page_size", String(params?.pageSize ?? 200));

    const data = await fetchJson<unknown>(joinUrl(this.baseUrl, `/api/v1/lists?${search.toString()}`));

    if (Array.isArray(data)) {
      return {
        items: data as ListCatalogResponse["items"],
        pagination: normalizePagination(undefined),
      };
    }

    const wrapped = data as { items?: ListCatalogResponse["items"]; pagination?: unknown };
    return {
      items: wrapped.items ?? [],
      pagination: normalizePagination(wrapped.pagination),
    };
  }

  async getListDetail(listKey: string): Promise<ListDetailResponse> {
    const url = joinUrl(this.baseUrl, `/api/v1/lists/${encodeURIComponent(listKey)}`);
    return fetchJson<ListDetailResponse>(url);
  }

  async getListStats(listKey: string, window = "30d"): Promise<ListStatsResponse> {
    const search = new URLSearchParams();
    search.set("window", window);
    const url = joinUrl(this.baseUrl, `/api/v1/lists/${encodeURIComponent(listKey)}/stats?${search.toString()}`);
    return fetchJson<ListStatsResponse>(url);
  }

  async getThreads(params: GetThreadsParams): Promise<ThreadListResponse> {
    const search = new URLSearchParams();
    if (params.sort) {
      search.set("sort", params.sort);
    }
    search.set("page", String(params.page ?? 1));
    search.set("page_size", String(params.pageSize ?? 50));
    if (params.from) {
      search.set("from", params.from);
    }
    if (params.to) {
      search.set("to", params.to);
    }
    if (params.author) {
      search.set("author", params.author);
    }
    if (params.hasDiff != null) {
      search.set("has_diff", String(params.hasDiff));
    }

    const url = joinUrl(
      this.baseUrl,
      `/api/v1/lists/${encodeURIComponent(params.listKey)}/threads?${search.toString()}`,
    );
    const raw = await fetchJson<unknown>(url);
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

  async getThreadDetail(listKey: string, threadId: number): Promise<ThreadDetailResponse> {
    const url = joinUrl(this.baseUrl, `/api/v1/lists/${encodeURIComponent(listKey)}/threads/${threadId}`);
    const raw = await fetchJson<Record<string, unknown>>(url);
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

  async getThreadMessages(params: GetThreadMessagesParams): Promise<ThreadMessagesResponse> {
    const search = new URLSearchParams();
    search.set("view", params.view ?? "snippets");
    search.set("page", String(params.page ?? 1));
    search.set("page_size", String(params.pageSize ?? 50));

    const url = joinUrl(
      this.baseUrl,
      `/api/v1/lists/${encodeURIComponent(params.listKey)}/threads/${params.threadId}/messages?${search.toString()}`,
    );
    const raw = await fetchJson<Record<string, unknown>>(url);

    return {
      thread_id: Number(raw.thread_id ?? params.threadId),
      list_key: String(raw.list_key ?? params.listKey),
      view: (String(raw.view ?? "snippets") === "full" ? "full" : "snippets"),
      messages: ((raw.messages as Record<string, unknown>[] | undefined) ?? []).map(normalizeThreadMessage),
      pagination: normalizePagination(raw.pagination),
    };
  }

  async getMessageDetail(messageId: number): Promise<MessageDetailResponse> {
    const url = joinUrl(this.baseUrl, `/api/v1/messages/${messageId}`);
    const raw = await fetchJson<Record<string, unknown>>(url);
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

  async getMessageBody(params: GetMessageBodyParams): Promise<MessageBodyResponse> {
    const search = new URLSearchParams();
    if (params.includeDiff != null) {
      search.set("include_diff", String(params.includeDiff));
    }
    if (params.stripQuotes != null) {
      search.set("strip_quotes", String(params.stripQuotes));
    }

    const url = joinUrl(this.baseUrl, `/api/v1/messages/${params.messageId}/body?${search.toString()}`);
    const raw = await fetchJson<Record<string, unknown>>(url);

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

  async getPatchItemDetail(patchItemId: number): Promise<PatchItemDetailResponse> {
    const url = joinUrl(this.baseUrl, `/api/v1/patch-items/${patchItemId}`);
    const raw = await fetchJson<Record<string, unknown>>(url);

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

  async getPatchItemFiles(patchItemId: number): Promise<PatchItemFilesResponse> {
    const url = joinUrl(this.baseUrl, `/api/v1/patch-items/${patchItemId}/files`);
    const raw = await fetchJson<unknown>(url);

    const rows = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : (((raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<string, unknown>[]);

    return {
      items: rows.map(normalizePatchItemFile).map((file) => ({ ...file, patch_item_id: file.patch_item_id || patchItemId })),
    };
  }

  async getPatchItemFileDiff(params: GetPatchItemFileDiffParams): Promise<PatchItemFileDiffResponse> {
    const url = joinUrl(
      this.baseUrl,
      `/api/v1/patch-items/${params.patchItemId}/files/${encodeURIComponent(params.path)}/diff`,
    );
    const raw = await fetchJson<Record<string, unknown>>(url);

    return {
      patch_item_id: Number(raw.patch_item_id ?? params.patchItemId),
      path: String(raw.path ?? params.path),
      diff_text: String(raw.diff_text ?? ""),
    };
  }

  async getPatchItemFullDiff(patchItemId: number): Promise<PatchItemFullDiffResponse> {
    const url = joinUrl(this.baseUrl, `/api/v1/patch-items/${patchItemId}/diff`);
    const raw = await fetchJson<Record<string, unknown>>(url);

    return {
      patch_item_id: Number(raw.patch_item_id ?? patchItemId),
      diff_text: String(raw.diff_text ?? ""),
    };
  }

  async getSeries(params?: GetSeriesParams): Promise<SeriesListResponse> {
    const search = new URLSearchParams();
    if (params?.listKey) {
      search.set("list_key", params.listKey);
    }
    search.set("sort", params?.sort ?? "last_seen_desc");
    search.set("page", String(params?.page ?? 1));
    search.set("page_size", String(params?.pageSize ?? 50));

    const url = joinUrl(this.baseUrl, `/api/v1/series?${search.toString()}`);
    const raw = await fetchJson<SeriesListResponse>(url);

    return {
      items: raw.items ?? [],
      pagination: normalizePagination(raw.pagination),
    };
  }

  async getSeriesDetail(seriesId: number): Promise<SeriesDetailResponse> {
    const url = joinUrl(this.baseUrl, `/api/v1/series/${seriesId}`);
    return fetchJson<SeriesDetailResponse>(url);
  }

  async getSeriesVersion(params: GetSeriesVersionParams): Promise<SeriesVersionResponse> {
    const search = new URLSearchParams();
    if (params.assembled != null) {
      search.set("assembled", String(params.assembled));
    }

    const suffix = search.toString();
    const query = suffix ? `?${suffix}` : "";
    const url = joinUrl(
      this.baseUrl,
      `/api/v1/series/${params.seriesId}/versions/${params.seriesVersionId}${query}`,
    );
    return fetchJson<SeriesVersionResponse>(url);
  }

  async getSeriesCompare(params: GetSeriesCompareParams): Promise<SeriesCompareResponse> {
    const search = new URLSearchParams();
    search.set("v1", String(params.v1));
    search.set("v2", String(params.v2));
    if (params.mode) {
      search.set("mode", params.mode);
    }

    const url = joinUrl(this.baseUrl, `/api/v1/series/${params.seriesId}/compare?${search.toString()}`);
    return fetchJson<SeriesCompareResponse>(url);
  }

  async getVersion(): Promise<VersionResponse> {
    return fetchJson<VersionResponse>(joinUrl(this.baseUrl, "/api/v1/version"));
  }
}
