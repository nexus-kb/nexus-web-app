import { describe, expect, it } from "vitest";

import { highlightLinesClient } from "@/lib/highlight/client-shiki";

describe("highlightLinesClient", () => {
  it("returns token lines for known languages", async () => {
    const lines = await highlightLinesClient(["return 0;"], "c", "light");
    expect(lines).toHaveLength(1);
    expect(lines[0]?.length).toBeGreaterThan(0);
  });

  it("falls back to text when language loading fails", async () => {
    await expect(
      highlightLinesClient(["plain text"], "definitely-not-a-language", "dark"),
    ).resolves.toEqual(expect.any(Array));
  });
});
