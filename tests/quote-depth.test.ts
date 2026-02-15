import {
  getQuotePaletteIndex,
  parseQuotedPreviewLines,
} from "@/lib/ui/quote-depth";

describe("quote depth parsing", () => {
  it("parses quoted depth markers at line start", () => {
    const parsed = parseQuotedPreviewLines(
      ["> first", ">> second", "> > > third", "   > fourth"].join("\n"),
    );

    expect(parsed.map((line) => line.quoteDepth)).toEqual([1, 2, 3, 1]);
    expect(parsed.map((line) => line.paletteIndex)).toEqual([0, 1, 2, 0]);
  });

  it("keeps non-leading angle brackets as non-quoted lines", () => {
    const parsed = parseQuotedPreviewLines("plain > symbol\nnot quoted");
    expect(parsed.map((line) => line.quoteDepth)).toEqual([0, 0]);
    expect(parsed.map((line) => line.paletteIndex)).toEqual([null, null]);
  });

  it("preserves empty lines and supports empty quoted lines", () => {
    const parsed = parseQuotedPreviewLines("line one\r\n\r\n>\r\nline two");
    expect(parsed).toHaveLength(4);
    expect(parsed[1]).toEqual({ text: "", quoteDepth: 0, paletteIndex: null });
    expect(parsed[2]).toEqual({ text: ">", quoteDepth: 1, paletteIndex: 0 });
  });

  it("cycles depth values beyond the palette size", () => {
    expect(getQuotePaletteIndex(1, 6)).toBe(0);
    expect(getQuotePaletteIndex(6, 6)).toBe(5);
    expect(getQuotePaletteIndex(7, 6)).toBe(0);
    expect(getQuotePaletteIndex(13, 6)).toBe(0);
  });

  it("returns null palette index for invalid depth inputs", () => {
    expect(getQuotePaletteIndex(0, 6)).toBeNull();
    expect(getQuotePaletteIndex(-1, 6)).toBeNull();
    expect(getQuotePaletteIndex(1, 0)).toBeNull();
  });
});
