import { highlightLines, type HighlightThemeMode } from "@/lib/highlight/shiki";

export const runtime = "nodejs";

const MAX_LINES = 12000;
const MAX_TOTAL_CHARS = 1_200_000;

interface HighlightRequestPayload {
  lines?: unknown;
  lang?: unknown;
  theme?: unknown;
}

function isTheme(value: unknown): value is HighlightThemeMode {
  return value === "light" || value === "dark";
}

function toValidatedPayload(raw: unknown): {
  lines: string[];
  lang: string;
  theme: HighlightThemeMode;
} | null {
  const payload = (raw as HighlightRequestPayload | null) ?? {};

  if (!Array.isArray(payload.lines)) {
    return null;
  }

  if (typeof payload.lang !== "string" || !isTheme(payload.theme)) {
    return null;
  }

  if (payload.lines.some((line) => typeof line !== "string")) {
    return null;
  }

  const lines = payload.lines as string[];
  if (lines.length > MAX_LINES) {
    return null;
  }

  const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return null;
  }

  return {
    lines,
    lang: payload.lang,
    theme: payload.theme,
  };
}

export async function POST(request: Request): Promise<Response> {
  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const payload = toValidatedPayload(parsedBody);
  if (!payload) {
    return Response.json(
      {
        error:
          "Invalid payload. Expected { lines: string[], lang: string, theme: 'light' | 'dark' } within size limits.",
      },
      { status: 400 },
    );
  }

  try {
    const lines = await highlightLines(payload.lines, payload.lang, payload.theme);
    return Response.json({ lines });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to highlight diff file content",
      },
      { status: 500 },
    );
  }
}
