export type DiffLineKind = "meta" | "hunkHeader" | "add" | "del" | "ctx" | "note";

export interface DiffLineEntry {
  kind: DiffLineKind;
  text: string;
  prefix: string;
  content: string;
  highlightIndex: number | null;
}

export interface ParsedDiffFile {
  fileId: string;
  oldPath: string | null;
  newPath: string | null;
  displayPath: string;
  rawSectionText: string;
  lineEntries: DiffLineEntry[];
  highlightableLines: string[];
}

const DIFF_GIT_HEADER = /^diff --git a\/(.+) b\/(.+)$/;

function normalizeDiffText(diffText: string): string {
  return diffText.replace(/\r\n/g, "\n");
}

function classifyLineKind(line: string): DiffLineKind {
  if (line.startsWith("@@ ")) {
    return "hunkHeader";
  }

  if (line.startsWith("+") && !line.startsWith("+++ ")) {
    return "add";
  }

  if (line.startsWith("-") && !line.startsWith("--- ")) {
    return "del";
  }

  if (line.startsWith(" ")) {
    return "ctx";
  }

  if (
    line.startsWith("diff --git ") ||
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ") ||
    line.startsWith("old mode ") ||
    line.startsWith("new mode ") ||
    line.startsWith("new file mode ") ||
    line.startsWith("deleted file mode ") ||
    line.startsWith("similarity index ") ||
    line.startsWith("rename from ") ||
    line.startsWith("rename to ")
  ) {
    return "meta";
  }

  return "note";
}

function toLineEntries(lines: string[]): {
  lineEntries: DiffLineEntry[];
  highlightableLines: string[];
} {
  const lineEntries: DiffLineEntry[] = [];
  const highlightableLines: string[] = [];

  for (const line of lines) {
    const kind = classifyLineKind(line);
    if (kind === "add" || kind === "del" || kind === "ctx") {
      const content = line.slice(1);
      const highlightIndex = highlightableLines.length;
      highlightableLines.push(content);
      lineEntries.push({
        kind,
        text: line,
        prefix: line[0] ?? "",
        content,
        highlightIndex,
      });
      continue;
    }

    lineEntries.push({
      kind,
      text: line,
      prefix: "",
      content: line,
      highlightIndex: null,
    });
  }

  return { lineEntries, highlightableLines };
}

function toParsedDiffFile(
  sectionLines: string[],
  sectionIndex: number,
  oldPath: string | null,
  newPath: string | null,
): ParsedDiffFile {
  const displayPath = newPath ?? oldPath ?? `section-${sectionIndex + 1}.diff`;
  const { lineEntries, highlightableLines } = toLineEntries(sectionLines);

  return {
    fileId: `${displayPath}:${sectionIndex}`,
    oldPath,
    newPath,
    displayPath,
    rawSectionText: sectionLines.join("\n"),
    lineEntries,
    highlightableLines,
  };
}

function parseSectionHeader(line: string): { oldPath: string | null; newPath: string | null } {
  const match = DIFF_GIT_HEADER.exec(line);
  if (!match) {
    return { oldPath: null, newPath: null };
  }

  return {
    oldPath: match[1] ?? null,
    newPath: match[2] ?? null,
  };
}

export function parseUnifiedDiffByFile(diffText: string): ParsedDiffFile[] {
  const normalized = normalizeDiffText(diffText).trimEnd();
  if (!normalized) {
    return [];
  }

  const lines = normalized.split("\n");
  const sectionStarts: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (DIFF_GIT_HEADER.test(lines[index] ?? "")) {
      sectionStarts.push(index);
    }
  }

  if (sectionStarts.length === 0) {
    return [toParsedDiffFile(lines, 0, null, null)];
  }

  const sections: ParsedDiffFile[] = [];
  for (let i = 0; i < sectionStarts.length; i += 1) {
    const start = sectionStarts[i] ?? 0;
    const end = sectionStarts[i + 1] ?? lines.length;
    const sectionLines = lines.slice(start, end);
    const header = parseSectionHeader(sectionLines[0] ?? "");
    sections.push(toParsedDiffFile(sectionLines, i, header.oldPath, header.newPath));
  }

  return sections;
}

export function inferShikiLanguage(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "text";
  }

  const normalized = trimmed.toLowerCase();
  const filename = normalized.split("/").at(-1) ?? normalized;

  if (filename === "makefile" || filename.endsWith(".mk")) {
    return "make";
  }

  if (filename.endsWith(".c") || filename.endsWith(".h")) {
    return "c";
  }

  if (
    filename.endsWith(".cc") ||
    filename.endsWith(".cpp") ||
    filename.endsWith(".cxx") ||
    filename.endsWith(".hh") ||
    filename.endsWith(".hpp") ||
    filename.endsWith(".hxx")
  ) {
    return "cpp";
  }

  if (filename.endsWith(".rs")) {
    return "rust";
  }

  if (filename.endsWith(".go")) {
    return "go";
  }

  if (filename.endsWith(".py")) {
    return "python";
  }

  if (filename.endsWith(".ts")) {
    return "typescript";
  }

  if (filename.endsWith(".tsx")) {
    return "tsx";
  }

  if (filename.endsWith(".js") || filename.endsWith(".mjs") || filename.endsWith(".cjs")) {
    return "javascript";
  }

  if (filename.endsWith(".jsx")) {
    return "jsx";
  }

  if (filename.endsWith(".json")) {
    return "json";
  }

  if (filename.endsWith(".toml")) {
    return "toml";
  }

  if (filename.endsWith(".yaml") || filename.endsWith(".yml")) {
    return "yaml";
  }

  if (filename.endsWith(".md")) {
    return "markdown";
  }

  if (filename.endsWith(".html") || filename.endsWith(".htm")) {
    return "html";
  }

  if (filename.endsWith(".css")) {
    return "css";
  }

  if (filename.endsWith(".scss")) {
    return "scss";
  }

  if (filename.endsWith(".less")) {
    return "less";
  }

  if (filename.endsWith(".xml")) {
    return "xml";
  }

  if (filename.endsWith(".sql")) {
    return "sql";
  }

  if (
    filename.endsWith(".sh") ||
    filename.endsWith(".bash") ||
    filename.endsWith(".zsh")
  ) {
    return "bash";
  }

  if (filename.endsWith(".ps1")) {
    return "powershell";
  }

  return "text";
}
