import { describe, expect, it } from "vitest";

import { highlightLines } from "@/lib/highlight/shiki";

describe("highlightLines", () => {
  it("returns token lines for known languages", async () => {
    const lines = await highlightLines(["return 0;"], "c", "light");
    expect(lines).toHaveLength(1);
    expect(lines[0]?.length).toBeGreaterThan(0);
  });

  it("falls back to text when language loading fails", async () => {
    await expect(
      highlightLines(["plain text"], "definitely-not-a-language", "dark"),
    ).resolves.toEqual(expect.any(Array));
  });
});
