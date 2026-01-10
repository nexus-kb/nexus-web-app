import { createHighlighter, type Highlighter } from "shiki";

let highlighterInstance: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Get or create the shared shiki highlighter instance.
 * Uses a singleton pattern to avoid re-initializing on every call.
 */
export async function getHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) {
    return highlighterInstance;
  }

  if (highlighterPromise) {
    return highlighterPromise;
  }

  highlighterPromise = createHighlighter({
    themes: ["github-dark", "github-light"],
    langs: ["diff", "c", "cpp", "python", "rust", "go", "javascript", "typescript", "bash", "makefile"],
  });

  highlighterInstance = await highlighterPromise;
  return highlighterInstance;
}

/**
 * Highlight code with the given language.
 * Returns HTML string with syntax highlighting applied.
 */
export async function highlightCode(
  code: string,
  lang: string = "diff",
  theme: "github-dark" | "github-light" = "github-dark"
): Promise<string> {
  const highlighter = await getHighlighter();
  
  // Check if the language is supported, fallback to plaintext
  const supportedLang = highlighter.getLoadedLanguages().includes(lang) ? lang : "plaintext";
  
  return highlighter.codeToHtml(code, {
    lang: supportedLang,
    theme,
  });
}

/**
 * Guess the language from a file path.
 */
export function guessLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  
  const langMap: Record<string, string> = {
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    py: "python",
    rs: "rust",
    go: "go",
    js: "javascript",
    ts: "typescript",
    tsx: "typescript",
    jsx: "javascript",
    sh: "bash",
    bash: "bash",
    mk: "makefile",
    makefile: "makefile",
  };

  return langMap[ext || ""] || "plaintext";
}
