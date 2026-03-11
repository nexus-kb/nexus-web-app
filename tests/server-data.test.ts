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

  it("uses search endpoint filters even when q is empty", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input), "http://localhost");

      if (url.pathname === "/api/v1/lists") {
        return jsonResponse({
          items: [{ list_key: "bpf" }],
          page_info: { limit: 200, next_cursor: null, prev_cursor: null, has_more: false },
        });
      }

      if (url.pathname === "/api/v1/search") {
        return jsonResponse({
          items: [
            {
              scope: "thread",
              id: 101,
              title: "filtered thread",
              route: "/threads/bpf/101",
              date_utc: "2026-02-10T10:00:00Z",
              list_keys: ["bpf"],
              author_email: "dev@example.com",
              has_diff: false,
              metadata: {},
            },
          ],
          facets: {},
          highlights: {},
          page_info: { limit: 20, next_cursor: null, prev_cursor: null, has_more: false },
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
      merged: "",
      sort: "relevance",
      hybrid: false,
      semantic_ratio: 0.35,
      cursor: "",
    });

    expect(data.searchResults).toHaveLength(1);
    expect(data.threads).toEqual([]);

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    const listsCall = urls.find((value) => value.includes("/api/v1/lists?"));
    expect(listsCall).toContain("view=compact");
    const searchCall = urls.find((value) => value.includes("/api/v1/search"));
    expect(searchCall).toBeTruthy();
    expect(searchCall).toContain("scope=thread");
    expect(searchCall).toContain("author=dev%40example.com");
    expect(searchCall).toContain("from=2026-02-01");
    expect(searchCall).toContain("to=2026-02-17");
    expect(searchCall).toContain("has_diff=false");
    expect(urls.some((value) => value.includes("/api/v1/lists/bpf/threads"))).toBe(false);
  });

  it("maps oldest-first thread sorting directly to backend search sorting", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input), "http://localhost");

      if (url.pathname === "/api/v1/lists") {
        return jsonResponse({
          items: [{ list_key: "bpf" }],
          page_info: { limit: 200, next_cursor: null, prev_cursor: null, has_more: false },
        });
      }

      if (url.pathname === "/api/v1/search") {
        return jsonResponse({
          items: [
            { scope: "thread", id: 10, title: "old-1", route: "/threads/bpf/10", date_utc: "2024-01-01T10:00:00Z", list_keys: ["bpf"], has_diff: false, author_email: null, metadata: {} },
            { scope: "thread", id: 11, title: "old-2", route: "/threads/bpf/11", date_utc: "2024-02-01T10:00:00Z", list_keys: ["bpf"], has_diff: false, author_email: null, metadata: {} },
          ],
          facets: {},
          highlights: {},
          page_info: { limit: 20, next_cursor: "cursor-2", prev_cursor: null, has_more: true },
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
      merged: "",
      sort: "date_asc",
      hybrid: false,
      semantic_ratio: 0.35,
      cursor: "",
    });

    expect(data.searchResults.map((item) => item.id)).toEqual([10, 11]);
    expect(data.searchNextCursor).toBe("cursor-2");
    expect(data.threads).toEqual([]);

    const searchUrls = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((value) => value.includes("/api/v1/search"));
    const listsCall = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .find((value) => value.includes("/api/v1/lists?"));
    expect(listsCall).toContain("view=compact");
    expect(searchUrls.length).toBe(1);
    expect(searchUrls[0]).toContain("scope=thread");
    expect(searchUrls[0]).toContain("q=*");
    expect(searchUrls[0]).toContain("sort=date_asc");
    expect(searchUrls[0]).toContain("limit=20");
    expect(searchUrls[0]).not.toContain("page=");
  });

  it("maps oldest-first series sorting directly to backend search sorting", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input), "http://localhost");

      if (url.pathname === "/api/v1/search") {
        return jsonResponse({
          items: [
            { scope: "series", id: 100, title: "old-1", route: "/series/bpf/100", date_utc: "2024-01-01T10:00:00Z", list_keys: ["bpf"], has_diff: false, author_email: "c@example.com", metadata: {} },
            { scope: "series", id: 101, title: "old-2", route: "/series/bpf/101", date_utc: "2024-02-01T10:00:00Z", list_keys: ["bpf"], has_diff: false, author_email: "b@example.com", metadata: {} },
          ],
          facets: {},
          highlights: {},
          page_info: { limit: 20, next_cursor: "series-cursor-2", prev_cursor: null, has_more: true },
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
      merged: "false",
      sort: "date_asc",
      hybrid: false,
      semantic_ratio: 0.35,
      cursor: "",
    });

    expect(data.searchResults.map((item) => item.id)).toEqual([100, 101]);
    expect(data.searchNextCursor).toBe("series-cursor-2");
    expect(data.seriesItems).toEqual([]);

    const searchUrls = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((value) => value.includes("/api/v1/search"));
    expect(searchUrls).toHaveLength(1);
    expect(searchUrls[0]).toContain("scope=series");
    expect(searchUrls[0]).toContain("q=*");
    expect(searchUrls[0]).toContain("sort=date_asc");
    expect(searchUrls[0]).toContain("merged=false");
    expect(searchUrls[0]).toContain("limit=20");
    expect(searchUrls[0]).not.toContain("page=");
  });

  it("passes merged filter through to series search requests", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input), "http://localhost");

      if (url.pathname === "/api/v1/search") {
        return jsonResponse({
          items: [],
          facets: {},
          highlights: {},
          page_info: { limit: 20, next_cursor: null, prev_cursor: null, has_more: false },
        });
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    });

    await loadSeriesCenterData(undefined, {
      q: "reclaim",
      list_key: "lkml",
      author: "",
      from: "",
      to: "",
      has_diff: "",
      merged: "true",
      sort: "relevance",
      hybrid: false,
      semantic_ratio: 0.35,
      cursor: "",
    });

    const searchUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(searchUrl).toContain("/api/v1/search");
    expect(searchUrl).toContain("scope=series");
    expect(searchUrl).toContain("merged=true");
  });
});
