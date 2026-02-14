import { afterEach, describe, expect, it, vi } from "vitest";

const { highlightLinesMock } = vi.hoisted(() => ({
  highlightLinesMock: vi.fn(),
}));

vi.mock("@/lib/highlight/shiki", () => ({
  highlightLines: highlightLinesMock,
}));

import { POST } from "@/app/api/highlight/diff-file/route";

describe("POST /api/highlight/diff-file", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns highlighted token lines for a valid request", async () => {
    highlightLinesMock.mockResolvedValueOnce([[{ content: "return", color: "#fff" }]]);

    const response = await POST(
      new Request("http://localhost/api/highlight/diff-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: ["return 0;"],
          lang: "c",
          theme: "dark",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      lines: [[{ content: "return", color: "#fff" }]],
    });
    expect(highlightLinesMock).toHaveBeenCalledWith(["return 0;"], "c", "dark");
  });

  it("returns 400 for invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/highlight/diff-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: "not-an-array",
          lang: "c",
          theme: "dark",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(highlightLinesMock).not.toHaveBeenCalled();
  });

  it("passes unsupported languages through helper fallback behavior", async () => {
    highlightLinesMock.mockResolvedValueOnce([[{ content: "x" }]]);

    const response = await POST(
      new Request("http://localhost/api/highlight/diff-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: ["x"],
          lang: "not-a-real-lang",
          theme: "light",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(highlightLinesMock).toHaveBeenCalledWith(
      ["x"],
      "not-a-real-lang",
      "light",
    );
  });
});
