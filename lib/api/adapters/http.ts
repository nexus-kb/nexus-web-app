import type {
  GetMessageBodyParams,
  GetPatchItemFileDiffParams,
  GetThreadsParams,
  NexusApiAdapter,
} from "@/lib/api/adapter";
import type {
  ListSummary,
  MessageBodyResponse,
  PatchItemDiffResponse,
  PatchItemFile,
  PatchItemFilesResponse,
  ThreadDetailResponse,
  ThreadMessage,
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

function normalizeThreadMessage(raw: Record<string, unknown>): ThreadMessage {
  const fromRaw = (raw.from as Record<string, unknown> | undefined) ?? {};
  const fromName = (fromRaw.name as string | null | undefined) ??
    (raw.from_name as string | null | undefined) ??
    null;
  const fromEmail = (fromRaw.email as string | undefined) ??
    (raw.from_email as string | undefined) ??
    "unknown@example.invalid";

  return {
    message_id: Number(raw.message_id ?? raw.message_pk ?? 0),
    parent_message_id: raw.parent_message_id != null ? Number(raw.parent_message_id) : null,
    depth: Number(raw.depth ?? 0),
    sort_key: String(raw.sort_key ?? ""),
    from: {
      name: fromName,
      email: fromEmail,
    },
    date_utc: (raw.date_utc as string | null | undefined) ?? null,
    subject: String(raw.subject ?? raw.subject_raw ?? ""),
    has_diff: Boolean(raw.has_diff),
    snippet: String(raw.snippet ?? ""),
    patch_item_id: raw.patch_item_id != null ? Number(raw.patch_item_id) : null,
  };
}

function normalizePatchItemFile(raw: Record<string, unknown>): PatchItemFile {
  return {
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

export class HttpNexusApiAdapter implements NexusApiAdapter {
  constructor(private readonly baseUrl: string) {}

  async getLists(): Promise<ListSummary[]> {
    const data = await fetchJson<unknown>(joinUrl(this.baseUrl, "/api/v1/lists"));

    if (Array.isArray(data)) {
      return data as ListSummary[];
    }

    const wrapped = data as { items?: ListSummary[] };
    return wrapped.items ?? [];
  }

  async getThreads(params: GetThreadsParams): Promise<ThreadListResponse> {
    const search = new URLSearchParams();
    if (params.sort) {
      search.set("sort", params.sort);
    }
    if (params.limit) {
      search.set("limit", String(params.limit));
    }
    if (params.cursor) {
      search.set("cursor", params.cursor);
    }
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
    const data = await fetchJson<ThreadListResponse>(url);

    return {
      items: (data.items ?? []).map((item) => ({
        ...item,
        has_diff: item.has_diff ?? false,
      })),
      next_cursor: data.next_cursor ?? null,
    };
  }

  async getThreadDetail(listKey: string, threadId: number): Promise<ThreadDetailResponse> {
    const url = joinUrl(
      this.baseUrl,
      `/api/v1/lists/${encodeURIComponent(listKey)}/threads/${threadId}`,
    );
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

  async getMessageBody(params: GetMessageBodyParams): Promise<MessageBodyResponse> {
    const search = new URLSearchParams();
    if (params.includeDiff != null) {
      search.set("include_diff", String(params.includeDiff));
    }
    if (params.stripQuotes != null) {
      search.set("strip_quotes", String(params.stripQuotes));
    }

    const url = joinUrl(
      this.baseUrl,
      `/api/v1/messages/${params.messageId}/body?${search.toString()}`,
    );
    const raw = await fetchJson<Record<string, unknown>>(url);

    return {
      message_id: Number(raw.message_id ?? params.messageId),
      body_text: String(raw.body_text ?? ""),
      body_html: (raw.body_html as string | null | undefined) ?? null,
      diff_text: (raw.diff_text as string | null | undefined) ?? null,
      attachments: (raw.attachments as MessageBodyResponse["attachments"] | undefined) ?? [],
    };
  }

  async getPatchItemFiles(patchItemId: number): Promise<PatchItemFilesResponse> {
    const url = joinUrl(this.baseUrl, `/api/v1/patch-items/${patchItemId}/files`);
    const raw = await fetchJson<unknown>(url);

    const rows = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : (((raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<string, unknown>[]);

    return {
      items: rows.map(normalizePatchItemFile),
    };
  }

  async getPatchItemFileDiff(params: GetPatchItemFileDiffParams): Promise<PatchItemDiffResponse> {
    const url = joinUrl(
      this.baseUrl,
      `/api/v1/patch-items/${params.patchItemId}/files/${encodeURIComponent(params.path)}/diff`,
    );
    const raw = await fetchJson<Record<string, unknown>>(url);

    return {
      path: String(raw.path ?? params.path),
      diff_text: String(raw.diff_text ?? ""),
    };
  }

  async getVersion(): Promise<VersionResponse> {
    return fetchJson<VersionResponse>(joinUrl(this.baseUrl, "/api/v1/version"));
  }
}
