import { describe, expect, it } from "vitest";
import {
  parseWorkspaceRoute,
  resolveSeriesSearchRoute,
  resolveThreadSearchRoute,
} from "@/lib/ui/routes";

describe("route search resolvers", () => {
  it("normalizes legacy thread search routes from /lists/{list}/threads/{id}", () => {
    const resolved = resolveThreadSearchRoute({
      route: "/lists/lkml/threads/647435",
      fallbackListKey: "lkml",
    });

    expect(resolved).toBe("/threads/lkml/647435");
  });

  it("normalizes legacy thread list route from /lists/{list}/threads", () => {
    const resolved = resolveThreadSearchRoute({
      route: "/lists/lkml/threads",
      fallbackListKey: "lkml",
    });

    expect(resolved).toBe("/threads/lkml");
  });

  it("normalizes /series/{id} search route with workspace fallback list", () => {
    const resolved = resolveSeriesSearchRoute({
      route: "/series/149190",
      fallbackListKey: "lkml",
    });

    expect(resolved).toBe("/series/lkml/149190");
  });

  it("normalizes legacy series search routes from /lists/{list}/series/{id}", () => {
    const resolved = resolveSeriesSearchRoute({
      route: "/lists/lkml/series/149190",
      fallbackListKey: "lkml",
    });

    expect(resolved).toBe("/series/lkml/149190");
  });
});

describe("workspace route parsing", () => {
  it("treats /search as unknown after advanced-search removal", () => {
    expect(parseWorkspaceRoute("/search")).toEqual({
      kind: "unknown",
      pathname: "/search",
    });
  });

  it("treats /diff routes as unknown after standalone diff removal", () => {
    expect(parseWorkspaceRoute("/diff/55142")).toEqual({
      kind: "unknown",
      pathname: "/diff/55142",
    });
  });
});
