import { describe, expect, it } from "vitest";
import {
  buildIntegratedSearchUpdates,
  isSearchActive,
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
        sort: "date_asc",
        hybrid: "on",
        semantic_ratio: "1.4",
      },
      { list_key: "lkml" },
    );

    expect(parsed.has_diff).toBe("");
    expect(parsed.sort).toBe("date_asc");
    expect(parsed.hybrid).toBe(true);
    expect(parsed.semantic_ratio).toBe(1);

    const fromClient = readIntegratedSearchParams(
      new URLSearchParams("q=reclaim&hybrid=true&semantic_ratio=-2"),
      { list_key: "lkml" },
    );
    expect(fromClient.semantic_ratio).toBe(0);
  });

  it("treats non-empty q as the only search activation signal", () => {
    const inactive = parseIntegratedSearchParams(
      { q: "   ", author: "dev@example.com" },
      { list_key: "lkml" },
    );
    const active = parseIntegratedSearchParams({ q: "memcg" }, { list_key: "lkml" });

    expect(isSearchActive(inactive)).toBe(false);
    expect(isSearchActive(active)).toBe(true);
  });

  it("builds URL updates with cursor reset and clear behavior", () => {
    const formData = new FormData();
    formData.set("q", "swap");
    formData.set("list_key", "lkml");
    formData.set("author", "dev@example.com");
    formData.set("hybrid", "on");
    formData.set("semantic_ratio", "0.4");

    const updates = buildIntegratedSearchUpdates(formData, { list_key: "lkml" });
    expect(updates.q).toBe("swap");
    expect(updates.list_key).toBeNull();
    expect(updates.author).toBe("dev@example.com");
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
});
