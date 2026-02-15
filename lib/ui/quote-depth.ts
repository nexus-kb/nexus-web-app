export interface QuotedPreviewLine {
  text: string;
  quoteDepth: number;
  paletteIndex: number | null;
}

export const QUOTE_DEPTH_PALETTE_SIZE = 6;

export function getQuotePaletteIndex(
  depth: number,
  paletteSize: number,
): number | null {
  if (!Number.isFinite(depth) || depth <= 0) {
    return null;
  }
  if (!Number.isFinite(paletteSize) || paletteSize <= 0) {
    return null;
  }

  return (Math.floor(depth) - 1) % Math.floor(paletteSize);
}

function getQuoteDepth(line: string): number {
  let idx = 0;
  while (idx < line.length) {
    const ch = line[idx];
    if (ch !== " " && ch !== "\t") {
      break;
    }
    idx += 1;
  }

  let depth = 0;
  while (idx < line.length && line[idx] === ">") {
    depth += 1;
    idx += 1;
    while (idx < line.length) {
      const ch = line[idx];
      if (ch !== " " && ch !== "\t") {
        break;
      }
      idx += 1;
    }
  }

  return depth;
}

export function parseQuotedPreviewLines(
  text: string,
  paletteSize: number = QUOTE_DEPTH_PALETTE_SIZE,
): QuotedPreviewLine[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  return lines.map((line) => {
    const quoteDepth = getQuoteDepth(line);
    return {
      text: line,
      quoteDepth,
      paletteIndex: getQuotePaletteIndex(quoteDepth, paletteSize),
    };
  });
}
