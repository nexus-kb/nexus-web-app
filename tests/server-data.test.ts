import { afterEach, describe, expect, it, vi } from "vitest";

const nextHeadersMock = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({
  headers: nextHeadersMock,
}));

import { loadSeriesCenterData, loadWorkspaceData } from "@/lib/api/server-data";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("server-data", () => {
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

  it("uses thread list endpoint filters even when q is empty", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input), "http://localhost");

      if (url.pathname === "/api/v1/lists") {
        return jsonResponse({
          items: [{ list_key: "bpf" }],
          page_info: { limit: 200, next_cursor: null, prev_cursor: null, has_more: false },
        });
      }

      if (url.pathname === "/api/v1/lists/bpf/threads") {
        return jsonResponse({
          items: [
            {
              thread_id: 101,
              subject: "filtered thread",
              root_message_id: 9001,
              created_at: "2026-02-10T10:00:00Z",
              last_activity_at: "2026-02-10T10:00:00Z",
              message_count: 1,
              participants: [{ name: null, email: "dev@example.com" }],
              starter: { name: null, email: "dev@example.com" },
              has_diff: false,
            },
          ],
          page_info: { limit: 50, next_cursor: null, prev_cursor: null, has_more: false },
        });
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    });

    const data = await loadWorkspaceData("bpf", undefined, undefined, 50, {
      q: "",
      list_key: "bpf",
      author: "dev@example.com",
      from: "2026-02-01",
      to: "2026-02-17",
      has_diff: "false",
      sort: "relevance",
      hybrid: false,
      semantic_ratio: 0.35,
      cursor: "",
    });

    expect(data.searchResults).toEqual([]);
    expect(data.threads).toHaveLength(1);

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    const threadCall = urls.find((value) => value.includes("/api/v1/lists/bpf/threads"));
    expect(threadCall).toBeTruthy();
    expect(threadCall).toContain("author=dev%40example.com");
    expect(threadCall).toContain("from=2026-02-01");
    expect(threadCall).toContain("to=2026-02-17");
    expect(threadCall).toContain("has_diff=false");
    expect(threadCall).toContain("sort=activity_desc");
    expect(urls.some((value) => value.includes("/api/v1/search"))).toBe(false);
  });

  it("maps oldest-first thread sorting directly to backend cursor sorting", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input), "http://localhost");

      if (url.pathname === "/api/v1/lists") {
        return jsonResponse({
          items: [{ list_key: "bpf" }],
          page_info: { limit: 200, next_cursor: null, prev_cursor: null, has_more: false },
        });
      }

      if (url.pathname === "/api/v1/lists/bpf/threads") {
        return jsonResponse({
          items: [
            { thread_id: 10, subject: "old-1", root_message_id: 3, last_activity_at: "2024-01-01T10:00:00Z", message_count: 1, participants: [], has_diff: false },
            { thread_id: 11, subject: "old-2", root_message_id: 2, last_activity_at: "2024-02-01T10:00:00Z", message_count: 1, participants: [], has_diff: false },
          ],
          page_info: { limit: 2, next_cursor: "cursor-2", prev_cursor: null, has_more: true },
        });
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    });

    const data = await loadWorkspaceData("bpf", undefined, undefined, 2, {
      q: "",
      list_key: "bpf",
      author: "",
      from: "",
      to: "",
      has_diff: "",
      sort: "date_asc",
      hybrid: false,
      semantic_ratio: 0.35,
      cursor: "",
    });

    expect(data.threads.map((item) => item.thread_id)).toEqual([10, 11]);
    expect(data.threadsPageInfo.limit).toBe(2);
    expect(data.threadsPageInfo.next_cursor).toBe("cursor-2");
    expect(data.threadsPageInfo.has_more).toBe(true);

    const threadUrls = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((value) => value.includes("/api/v1/lists/bpf/threads"));
    expect(threadUrls.length).toBe(1);
    expect(threadUrls[0]).toContain("sort=date_asc");
    expect(threadUrls[0]).toContain("limit=2");
    expect(threadUrls[0]).not.toContain("page=");
  });

  it("maps oldest-first series sorting directly to backend cursor sorting", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input), "http://localhost");

      if (url.pathname === "/api/v1/series") {
        return jsonResponse({
          items: [
            { series_id: 100, canonical_subject: "old-1", author_email: "c@example.com", last_seen_at: "2024-01-01T10:00:00Z", latest_version_num: 1, is_rfc_latest: false },
            { series_id: 101, canonical_subject: "old-2", author_email: "b@example.com", last_seen_at: "2024-02-01T10:00:00Z", latest_version_num: 1, is_rfc_latest: false },
          ],
          page_info: { limit: 30, next_cursor: "series-cursor-2", prev_cursor: null, has_more: true },
        });
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    });

    const data = await loadSeriesCenterData(undefined, {
      q: "",
      list_key: "",
      author: "",
      from: "",
      to: "",
      has_diff: "",
      sort: "date_asc",
      hybrid: false,
      semantic_ratio: 0.35,
      cursor: "",
    });

    expect(data.seriesItems.map((item) => item.series_id)).toEqual([100, 101]);
    expect(data.seriesPageInfo.limit).toBe(30);
    expect(data.seriesPageInfo.next_cursor).toBe("series-cursor-2");
    expect(data.seriesPageInfo.has_more).toBe(true);

    const seriesUrls = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((value) => value.includes("/api/v1/series"));
    expect(seriesUrls).toHaveLength(1);
    expect(seriesUrls[0]).toContain("sort=last_seen_asc");
    expect(seriesUrls[0]).toContain("limit=30");
    expect(seriesUrls[0]).not.toContain("page=");
  });
});
