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
      const url = new URL(String(input));

      if (url.pathname === "/api/v1/lists") {
        return jsonResponse({
          items: [{ list_key: "bpf" }],
          pagination: { page: 1, page_size: 200, total_items: 1, total_pages: 1 },
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
          pagination: {
            page: 1,
            page_size: 50,
            total_items: 1,
            total_pages: 1,
            has_prev: false,
            has_next: false,
          },
        });
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    });

    const data = await loadWorkspaceData("bpf", undefined, 1, 50, {
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

  it("maps oldest-first thread sorting to reversed backend pagination", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/api/v1/lists") {
        return jsonResponse({
          items: [{ list_key: "bpf" }],
          pagination: { page: 1, page_size: 200, total_items: 1, total_pages: 1 },
        });
      }

      if (url.pathname === "/api/v1/lists/bpf/threads") {
        const page = Number(url.searchParams.get("page") ?? "1");
        if (page === 1) {
          return jsonResponse({
            items: [{ thread_id: 30, subject: "newest", root_message_id: 1, last_activity_at: "2026-02-17T10:00:00Z", message_count: 1, participants: [], has_diff: true }],
            pagination: { page: 1, page_size: 2, total_items: 6, total_pages: 3, has_prev: false, has_next: true },
          });
        }
        if (page === 3) {
          return jsonResponse({
            items: [
              { thread_id: 11, subject: "old-2", root_message_id: 2, last_activity_at: "2024-02-01T10:00:00Z", message_count: 1, participants: [], has_diff: false },
              { thread_id: 10, subject: "old-1", root_message_id: 3, last_activity_at: "2024-01-01T10:00:00Z", message_count: 1, participants: [], has_diff: false },
            ],
            pagination: { page: 3, page_size: 2, total_items: 6, total_pages: 3, has_prev: true, has_next: false },
          });
        }
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    });

    const data = await loadWorkspaceData("bpf", undefined, 1, 2, {
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
    expect(data.threadsPagination.page).toBe(1);
    expect(data.threadsPagination.total_pages).toBe(3);
    expect(data.threadsPagination.has_prev).toBe(false);
    expect(data.threadsPagination.has_next).toBe(true);

    const threadUrls = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((value) => value.includes("/api/v1/lists/bpf/threads"));
    expect(threadUrls.length).toBe(2);
    expect(threadUrls[0]).toContain("sort=date_desc");
    expect(threadUrls[0]).toContain("page=1");
    expect(threadUrls[1]).toContain("sort=date_desc");
    expect(threadUrls[1]).toContain("page=3");
  });

  it("maps oldest-first series sorting to reversed backend pagination", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/api/v1/series") {
        const page = Number(url.searchParams.get("page") ?? "1");
        if (page === 1) {
          return jsonResponse({
            items: [{ series_id: 300, canonical_subject: "newest", author_email: "a@example.com", last_seen_at: "2026-02-17T10:00:00Z", latest_version_num: 1, is_rfc_latest: false }],
            pagination: { page: 1, page_size: 30, total_items: 90, total_pages: 3, has_prev: false, has_next: true },
          });
        }
        if (page === 3) {
          return jsonResponse({
            items: [
              { series_id: 101, canonical_subject: "old-2", author_email: "b@example.com", last_seen_at: "2024-02-01T10:00:00Z", latest_version_num: 1, is_rfc_latest: false },
              { series_id: 100, canonical_subject: "old-1", author_email: "c@example.com", last_seen_at: "2024-01-01T10:00:00Z", latest_version_num: 1, is_rfc_latest: false },
            ],
            pagination: { page: 3, page_size: 30, total_items: 90, total_pages: 3, has_prev: true, has_next: false },
          });
        }
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    });

    const data = await loadSeriesCenterData(1, {
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
    expect(data.seriesPagination.page).toBe(1);
    expect(data.seriesPagination.total_pages).toBe(3);
    expect(data.seriesPagination.has_prev).toBe(false);
    expect(data.seriesPagination.has_next).toBe(true);
  });
});
