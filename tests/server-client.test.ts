import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getLists,
  getMessageBody,
  getPatchItemFiles,
  getSearch,
  getSeries,
  getThreadDetail,
} from "@/lib/api/server-client";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("server-client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses same-origin /api/v1 paths in browser mode", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse({
        items: [],
        page_info: { limit: 10, next_cursor: null, prev_cursor: null, has_more: false },
      }),
    );

    await getLists({ limit: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/lists");
  });

  it("normalizes mixed backend thread payload fields", async () => {
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

  it("normalizes series list metadata fields with safe fallbacks", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse({
        items: [
          {
            series_id: 44,
            canonical_subject: "[PATCH v2] mm: tighten reclaim path",
            author_email: "maintainer@example.com",
            last_seen_at: "2026-02-15T12:00:00Z",
            latest_version_num: 2,
            is_rfc_latest: false,
          },
        ],
        page_info: { limit: 20, next_cursor: null, prev_cursor: null, has_more: false },
      }),
    );

    const response = await getSeries({ listKey: "lkml", limit: 20 });
    expect(response.items[0]).toMatchObject({
      series_id: 44,
      author_name: null,
      first_seen_at: "2026-02-15T12:00:00Z",
      latest_patchset_at: "2026-02-15T12:00:00Z",
    });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/api/v1/series");
    expect(url).toContain("list_key=lkml");
    expect(url).toContain("limit=20");
  });

  it("normalizes patch file payloads and body query params", async () => {
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

    const secondUrl = String(fetchMock.mock.calls[1]?.[0]);
    expect(secondUrl).toContain("/api/v1/messages/7002/body");
    expect(secondUrl).toContain("include_diff=true");
    expect(secondUrl).toContain("strip_quotes=true");
  });

  it("serializes search query params and keeps no-store profile", async () => {
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
        page_info: { limit: 20, next_cursor: "o20-habcd", prev_cursor: null, has_more: true },
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
    expect(response.page_info.next_cursor).toBe("o20-habcd");

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/api/v1/search");
    expect(url).toContain("q=reclaim");
    expect(url).toContain("scope=thread");
    expect(url).toContain("list_key=lkml");
    expect(url).toContain("has_diff=true");
    expect(url).toContain("sort=date_desc");
    expect(url).toContain("hybrid=true");
    expect(url).toContain("semantic_ratio=0.4");

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(options?.cache).toBe("no-store");
  });
});
