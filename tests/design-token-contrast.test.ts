import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const stylesPath = path.join(process.cwd(), "packages/nexus-design-system/src/styles.css");
const styles = fs.readFileSync(stylesPath, "utf8");

function readHexToken(name: string): string {
  const pattern = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`);
  const match = styles.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Token not found or not hex: ${name}`);
  }
  return match[1];
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const [nr, ng, nb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * nr + 0.7152 * ng + 0.0722 * nb;
}

function contrast(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("design token contrast", () => {
  it("keeps light and dark text tokens at AA contrast on primary surfaces", () => {
    const lightSurface = hexToRgb(readHexToken("color-ayu-light-surface-lift"));
    const darkSurface = hexToRgb(readHexToken("color-ayu-dark-surface-lift"));
    const lightPrimary = hexToRgb(readHexToken("color-ayu-light-text"));
    const darkPrimary = hexToRgb(readHexToken("color-ayu-dark-text"));
    const lightMuted = hexToRgb(readHexToken("color-ayu-light-muted"));
    const darkMuted = hexToRgb(readHexToken("color-ayu-dark-muted"));

    expect(contrast(lightPrimary, lightSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightMuted, lightSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkPrimary, darkSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkMuted, darkSurface)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("navigation and empty-state hierarchy", () => {
  it("uses primary text and active weight for primary navigation tabs", () => {
    const navLinkBlock = styles.match(/\.ds-nav-link\s*\{[\s\S]*?\n\}/)?.[0];
    const navLinkActiveBlock = styles.match(/\.ds-nav-link\.is-active\s*\{[\s\S]*?\n\}/)?.[0];

    expect(navLinkBlock).toContain("color: var(--ds-color-text-primary);");
    expect(navLinkBlock).toContain("font-weight: 500;");
    expect(navLinkBlock).toContain("border: 1px solid");
    expect(navLinkActiveBlock).toContain("font-weight: 600;");
  });

  it("renders empty-state title as primary text and description as muted text", () => {
    const emptyHeadingBlock = styles.match(/\.ds-empty-state h2\s*\{[\s\S]*?\n\}/)?.[0];
    const mutedParagraphBlock = styles.match(
      /\.ds-empty-state p\s*\{[\s\S]*?color:\s*var\(--ds-color-text-muted\);[\s\S]*?\n\}/,
    )?.[0];

    expect(emptyHeadingBlock).toContain("color: var(--ds-color-text-primary);");
    expect(emptyHeadingBlock).toContain("font-weight: 600;");
    expect(mutedParagraphBlock).toContain("color: var(--ds-color-text-muted);");
  });
});
