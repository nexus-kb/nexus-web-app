import { afterEach, describe, expect, it, vi } from "vitest";

const nextHeadersMock = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({
  headers: nextHeadersMock,
}));

import {
  CONTENT_REVALIDATE_SECONDS,
  getSearch,
  getLists,
  getMessageBody,
  getPatchItemFiles,
  getThreadDetail,
} from "@/lib/api/server-client";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("server-client", () => {
  const originalBaseUrl = process.env.NEXUS_WEB_API_BASE_URL;

  afterEach(() => {
    vi.restoreAllMocks();
    nextHeadersMock.mockReset();
    if (originalBaseUrl == null) {
      delete process.env.NEXUS_WEB_API_BASE_URL;
      return;
    }
    process.env.NEXUS_WEB_API_BASE_URL = originalBaseUrl;
  });

  it("fails fast when required API base URL env is missing", async () => {
    delete process.env.NEXUS_WEB_API_BASE_URL;

    await expect(getLists({ page: 1, pageSize: 10 })).rejects.toThrow(
      /NEXUS_WEB_API_BASE_URL/i,
    );
  });

  it("normalizes mixed backend thread payload fields", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse({
        thread_id: 55,
        list_key: "lkml",
        subject: "Normalized",
        membership_hash: "abc",
        last_activity_at: "2026-02-13T00:00:00Z",
        messages: [
          {
            message_pk: 900,
            parent_message_id: null,
            depth: 0,
            sort_key: "1",
            from_name: "Author",
            from_email: "author@example.com",
            date_utc: "2026-02-13T00:00:00Z",
            subject_raw: "Subject",
            has_diff: true,
            patch_item_id: 77,
          },
        ],
      }),
    );

    const detail = await getThreadDetail("lkml", 55);

    expect(detail).toMatchObject({
      thread_id: 55,
      list_key: "lkml",
      subject: "Normalized",
      messages: [
        {
          message_id: 900,
          from: { name: "Author", email: "author@example.com" },
          subject: "Subject",
          patch_item_id: 77,
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/v1/lists/lkml/threads/55",
    );
  });

  it("normalizes patch item file payloads and enforces content cache profile", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse([
        {
          new_path: "mm/vmscan.c",
          old_path: "mm/vmscan.c",
          change_type: "M",
          is_binary: false,
          additions: 2,
          deletions: 1,
          hunk_count: 1,
          diff_start: 0,
          diff_end: 10,
        },
      ]),
    );

    const files = await getPatchItemFiles(77);
    expect(files.items[0]).toMatchObject({
      patch_item_id: 77,
      path: "mm/vmscan.c",
      hunks: 1,
      additions: 2,
      deletions: 1,
    });

    await getMessageBody({ messageId: 7002, includeDiff: true, stripQuotes: true });

    const secondCallOptions =
      fetchMock.mock.calls[1]?.[1] as (RequestInit & {
        next?: { revalidate?: number };
      }) | undefined;
    expect(secondCallOptions?.next?.revalidate).toBe(CONTENT_REVALIDATE_SECONDS);
  });

  it("serializes search query params and normalizes search response", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse({
        items: [
          {
            scope: "thread",
            id: 88,
            title: "mm: reclaim discussion",
            snippet: "memory reclaim thread",
            route: "/lists/lkml/threads/88",
            date_utc: "2026-02-14T10:00:00Z",
            list_keys: ["lkml"],
            has_diff: true,
            author_email: "dev@example.com",
            metadata: { list_key: "lkml" },
          },
        ],
        facets: { list_keys: { lkml: 1 } },
        highlights: { "88": { subject: "<em>reclaim</em>" } },
        next_cursor: "o20-habcd",
      }),
    );

    const response = await getSearch({
      q: "reclaim",
      scope: "thread",
      listKey: "lkml",
      hasDiff: true,
      sort: "date_desc",
      limit: 20,
      hybrid: true,
      semanticRatio: 0.4,
    });

    expect(response.items).toHaveLength(1);
    expect(response.items[0]).toMatchObject({
      scope: "thread",
      id: 88,
      route: "/lists/lkml/threads/88",
    });
    expect(response.next_cursor).toBe("o20-habcd");

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/api/v1/search");
    expect(url).toContain("q=reclaim");
    expect(url).toContain("scope=thread");
    expect(url).toContain("list_key=lkml");
    expect(url).toContain("has_diff=true");
    expect(url).toContain("sort=date_desc");
    expect(url).toContain("hybrid=true");
    expect(url).toContain("semantic_ratio=0.4");
  });

  it("forwards cloudflare ingress headers to upstream API calls", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";
    nextHeadersMock.mockResolvedValue(
      new Headers({
        "cf-connecting-ip": "203.0.113.45",
        "x-forwarded-for": "203.0.113.45, 198.51.100.7",
        "x-real-ip": "203.0.113.45",
        "cf-ray": "89abcdef1234-LAX",
      }),
    );

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse({ items: [], pagination: { page: 1, page_size: 10, total_items: 0 } }),
    );

    await getLists({ page: 1, pageSize: 10 });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = new Headers(requestInit?.headers);
    expect(headers.get("cf-connecting-ip")).toBe("203.0.113.45");
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.45, 198.51.100.7");
    expect(headers.get("x-real-ip")).toBe("203.0.113.45");
    expect(headers.get("cf-ray")).toBe("89abcdef1234-LAX");
  });

  it("derives x-forwarded-for when only cloudflare client IP is present", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";
    nextHeadersMock.mockResolvedValue(
      new Headers({
        "cf-connecting-ip": "203.0.113.77",
      }),
    );

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse({ items: [], pagination: { page: 1, page_size: 10, total_items: 0 } }),
    );

    await getLists({ page: 1, pageSize: 10 });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = new Headers(requestInit?.headers);
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.77");
    expect(headers.get("x-real-ip")).toBe("203.0.113.77");
  });
});
