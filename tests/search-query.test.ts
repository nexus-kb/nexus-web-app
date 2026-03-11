import { describe, expect, it } from "vitest";
import {
  buildIntegratedSearchUpdates,
  getDateSortToggleLabel,
  getEffectiveSearchRequestQuery,
  getNextDateSort,
  isSearchActive,
  isDateSortedSearch,
  parseIntegratedSearchParams,
  readIntegratedSearchParams,
} from "@/lib/ui/search-query";

describe("search-query", () => {
  it("applies contextual list defaults per surface", () => {
    const threadsQuery = parseIntegratedSearchParams({}, { list_key: "lkml" });
    const seriesQuery = parseIntegratedSearchParams({}, { list_key: "" });

    expect(threadsQuery.list_key).toBe("lkml");
    expect(seriesQuery.list_key).toBe("");
  });

  it("normalizes booleans and numeric bounds", () => {
    const parsed = parseIntegratedSearchParams(
      {
        q: "reclaim",
        has_diff: "maybe",
        merged: "yes",
        sort: "date_asc",
        hybrid: "on",
        semantic_ratio: "1.4",
      },
      { list_key: "lkml" },
    );

    expect(parsed.has_diff).toBe("");
    expect(parsed.merged).toBe("");
    expect(parsed.sort).toBe("date_desc");
    expect(parsed.hybrid).toBe(true);
    expect(parsed.semantic_ratio).toBe(1);

    const fromClient = readIntegratedSearchParams(
      new URLSearchParams("q=reclaim&hybrid=true&semantic_ratio=-2"),
      { list_key: "lkml" },
    );
    expect(fromClient.semantic_ratio).toBe(0);
  });

  it("treats any non-default criteria except cursor as an active search", () => {
    const authorOnly = parseIntegratedSearchParams(
      { q: "   ", author: "dev@example.com" },
      { list_key: "lkml" },
    );
    const sortOnly = parseIntegratedSearchParams(
      { sort: "date_desc" },
      { list_key: "lkml" },
    );
    const mergedOnly = parseIntegratedSearchParams(
      { merged: "true" },
      { list_key: "lkml" },
    );
    const cursorOnly = parseIntegratedSearchParams(
      { cursor: "o20-next" },
      { list_key: "lkml" },
    );

    expect(isSearchActive(authorOnly)).toBe(true);
    expect(isSearchActive(sortOnly)).toBe(true);
    expect(isSearchActive(mergedOnly)).toBe(true);
    expect(isSearchActive(cursorOnly)).toBe(false);
  });

  it("computes date sort toggle transitions from any sort state", () => {
    expect(isDateSortedSearch("relevance")).toBe(false);
    expect(isDateSortedSearch("date_desc")).toBe(true);

    expect(getNextDateSort("relevance")).toBe("date_desc");
    expect(getNextDateSort("date_desc")).toBe("relevance");

    expect(getDateSortToggleLabel("relevance")).toBe("Sort newest first");
    expect(getDateSortToggleLabel("date_desc")).toBe("Clear date sorting");
  });

  it("builds URL updates with cursor reset and clear behavior", () => {
    const formData = new FormData();
    formData.set("q", "swap");
    formData.set("list_key", "lkml");
    formData.set("author", "dev@example.com");
    formData.set("merged", "true");
    formData.set("hybrid", "on");
    formData.set("semantic_ratio", "0.4");

    const updates = buildIntegratedSearchUpdates(formData, { list_key: "lkml" });
    expect(updates.q).toBe("swap");
    expect(updates.list_key).toBeNull();
    expect(updates.author).toBe("dev@example.com");
    expect(updates.merged).toBe("true");
    expect(updates.hybrid).toBe("true");
    expect(updates.semantic_ratio).toBe("0.4");
    expect(updates.cursor).toBeNull();

    const filterOnly = new FormData();
    filterOnly.set("author", "dev@example.com");
    filterOnly.set("sort", "date_desc");
    const filterOnlyUpdates = buildIntegratedSearchUpdates(filterOnly, { list_key: "lkml" });
    expect(filterOnlyUpdates.q).toBeNull();
    expect(filterOnlyUpdates.author).toBe("dev@example.com");
    expect(filterOnlyUpdates.sort).toBe("date_desc");

    const empty = new FormData();
    const clearUpdates = buildIntegratedSearchUpdates(empty, { list_key: "lkml" });
    expect(Object.values(clearUpdates).every((value) => value === null)).toBe(true);
  });

  it("uses a wildcard request query for filter-only search states", () => {
    const filterOnly = parseIntegratedSearchParams(
      { author: "dev@example.com", sort: "date_desc" },
      { list_key: "lkml" },
    );
    const textQuery = parseIntegratedSearchParams(
      { q: "reclaim", author: "dev@example.com" },
      { list_key: "lkml" },
    );

    expect(getEffectiveSearchRequestQuery(filterOnly)).toBe("*");
    expect(getEffectiveSearchRequestQuery(textQuery)).toBe("reclaim");
  });
});
