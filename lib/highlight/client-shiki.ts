"use client";

import type { HighlighterCore } from "shiki";

type ThemeMode = "light" | "dark";

const PRELOAD_LANGUAGES = [
  "text",
  "diff",
  "make",
  "c",
  "cpp",
  "rust",
  "go",
  "python",
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "toml",
  "yaml",
  "markdown",
  "bash",
  "html",
  "css",
  "scss",
  "less",
  "xml",
  "sql",
  "powershell",
] as const;

const SHIKI_THEME_BY_MODE = {
  light: "ayu-light",
  dark: "ayu-dark",
} as const;

export interface ShikiToken {
  content: string;
  color?: string;
  fontStyle?: number;
}

export type ShikiLineTokens = ShikiToken[];

const loadedLanguages = new Set<string>(PRELOAD_LANGUAGES);
let highlighterPromise: Promise<HighlighterCore> | null = null;

async function createHighlighterInstance(): Promise<HighlighterCore> {
  const { createHighlighter } = await import("shiki");

  return createHighlighter({
    themes: [SHIKI_THEME_BY_MODE.light, SHIKI_THEME_BY_MODE.dark],
    langs: [...PRELOAD_LANGUAGES],
  });
}

async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterInstance();
  }

  return highlighterPromise;
}

async function resolveSupportedLanguage(
  highlighter: HighlighterCore,
  language: string,
): Promise<string> {
  const normalized = language.trim().toLowerCase() || "text";
  if (loadedLanguages.has(normalized)) {
    return normalized;
  }

  try {
    await highlighter.loadLanguage(
      normalized as Parameters<HighlighterCore["loadLanguage"]>[0],
    );
    loadedLanguages.add(normalized);
    return normalized;
  } catch {
    if (normalized !== "text") {
      return resolveSupportedLanguage(highlighter, "text");
    }
    return "text";
  }
}

export async function highlightLinesClient(
  lines: string[],
  language: string,
  theme: ThemeMode,
): Promise<ShikiLineTokens[]> {
  if (lines.length === 0) {
    return [];
  }

  const highlighter = await getHighlighter();
  const resolvedLanguage = await resolveSupportedLanguage(highlighter, language);
  const resolvedTheme = SHIKI_THEME_BY_MODE[theme];
  const content = lines.join("\n");

  const tokens = highlighter.codeToTokens(content, {
    lang: resolvedLanguage,
    theme: resolvedTheme,
  });

  return tokens.tokens.map((line) =>
    line.map((token) => ({
      content: token.content,
      color: token.color,
      fontStyle: token.fontStyle,
    })),
  );
}
