export type DiffLineKind = "meta" | "hunkHeader" | "add" | "del" | "ctx" | "note";
export type DiffChangeKind =
  | "added"
  | "deleted"
  | "modified"
  | "renamed"
  | "copied"
  | "binary";

export interface DiffLineEntry {
  kind: DiffLineKind;
  text: string;
  prefix: string;
  content: string;
  highlightIndex: number | null;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  isWhitespaceOnly: boolean;
}

export interface ParsedDiffSplitRow {
  kind: "context" | "changed" | "added" | "removed" | "note";
  left: DiffLineEntry | null;
  right: DiffLineEntry | null;
  note: DiffLineEntry | null;
  isWhitespaceOnly: boolean;
}

export interface ParsedDiffHunk {
  header: DiffLineEntry;
  lines: DiffLineEntry[];
  splitRows: ParsedDiffSplitRow[];
}

export interface ParsedDiffFile {
  fileId: string;
  oldPath: string | null;
  newPath: string | null;
  displayPath: string;
  rawSectionText: string;
  headerLines: DiffLineEntry[];
  hunks: ParsedDiffHunk[];
  trailingLines: DiffLineEntry[];
  highlightableLines: string[];
  additions: number;
  deletions: number;
  hunkCount: number;
  changeKind: DiffChangeKind;
}

interface HunkRange {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
}

const DIFF_GIT_HEADER = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function normalizeDiffText(diffText: string): string {
  return diffText.replace(/\r\n/g, "\n");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, "");
}

function createEntry(
  line: string,
  kind: DiffLineKind,
  highlightableLines: string[],
  oldLineNumber: number | null,
  newLineNumber: number | null,
): DiffLineEntry {
  if (kind === "add" || kind === "del" || kind === "ctx") {
    const content = line.slice(1);
    const highlightIndex = highlightableLines.length;
    highlightableLines.push(content);
    return {
      kind,
      text: line,
      prefix: line[0] ?? "",
      content,
      highlightIndex,
      oldLineNumber,
      newLineNumber,
      isWhitespaceOnly: false,
    };
  }

  return {
    kind,
    text: line,
    prefix: "",
    content: line,
    highlightIndex: null,
    oldLineNumber,
    newLineNumber,
    isWhitespaceOnly: false,
  };
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
    line.startsWith("rename to ") ||
    line.startsWith("copy from ") ||
    line.startsWith("copy to ") ||
    line.startsWith("Binary files ") ||
    line.startsWith("GIT binary patch")
  ) {
    return "meta";
  }

  return "note";
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

function detectChangeKind(lines: string[]): DiffChangeKind {
  if (lines.some((line) => line.startsWith("GIT binary patch") || line.startsWith("Binary files "))) {
    return "binary";
  }
  if (lines.some((line) => line.startsWith("rename from "))) {
    return "renamed";
  }
  if (lines.some((line) => line.startsWith("copy from "))) {
    return "copied";
  }
  if (lines.some((line) => line.startsWith("new file mode "))) {
    return "added";
  }
  if (lines.some((line) => line.startsWith("deleted file mode "))) {
    return "deleted";
  }
  return "modified";
}

function parseHunkHeader(line: string): HunkRange | null {
  const match = HUNK_HEADER.exec(line);
  if (!match) {
    return null;
  }

  return {
    oldStart: Number(match[1] ?? 0),
    oldCount: Number(match[2] ?? "1"),
    newStart: Number(match[3] ?? 0),
    newCount: Number(match[4] ?? "1"),
  };
}

function toSplitRows(lines: DiffLineEntry[]): ParsedDiffSplitRow[] {
  const splitRows: ParsedDiffSplitRow[] = [];
  let index = 0;

  while (index < lines.length) {
    const entry = lines[index];
    if (!entry) {
      break;
    }

    if (entry.kind === "ctx") {
      splitRows.push({
        kind: "context",
        left: entry,
        right: entry,
        note: null,
        isWhitespaceOnly: false,
      });
      index += 1;
      continue;
    }

    if (entry.kind === "note" || entry.kind === "meta" || entry.kind === "hunkHeader") {
      splitRows.push({
        kind: "note",
        left: null,
        right: null,
        note: entry,
        isWhitespaceOnly: false,
      });
      index += 1;
      continue;
    }

    const deleted: DiffLineEntry[] = [];
    const added: DiffLineEntry[] = [];

    while (lines[index]?.kind === "del") {
      deleted.push(lines[index]!);
      index += 1;
    }
    while (lines[index]?.kind === "add") {
      added.push(lines[index]!);
      index += 1;
    }

    if (!deleted.length && !added.length) {
      index += 1;
      continue;
    }

    const pairCount = Math.max(deleted.length, added.length);
    for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
      const left = deleted[pairIndex] ?? null;
      const right = added[pairIndex] ?? null;
      const isWhitespaceOnly =
        left != null &&
        right != null &&
        normalizeWhitespace(left.content) === normalizeWhitespace(right.content);

      if (left) {
        left.isWhitespaceOnly = isWhitespaceOnly;
      }
      if (right) {
        right.isWhitespaceOnly = isWhitespaceOnly;
      }

      splitRows.push({
        kind: left && right ? "changed" : left ? "removed" : "added",
        left,
        right,
        note: null,
        isWhitespaceOnly,
      });
    }
  }

  return splitRows;
}

function toParsedDiffFile(
  sectionLines: string[],
  sectionIndex: number,
  oldPath: string | null,
  newPath: string | null,
): ParsedDiffFile {
  const displayPath = newPath ?? oldPath ?? `section-${sectionIndex + 1}.diff`;
  const highlightableLines: string[] = [];
  const headerLines: DiffLineEntry[] = [];
  const hunks: ParsedDiffHunk[] = [];
  const trailingLines: DiffLineEntry[] = [];
  const rawSectionText = sectionLines.join("\n");
  const changeKind = detectChangeKind(sectionLines);

  let cursor = 0;
  while (cursor < sectionLines.length && !sectionLines[cursor]?.startsWith("@@ ")) {
    const line = sectionLines[cursor] ?? "";
    headerLines.push(createEntry(line, classifyLineKind(line), highlightableLines, null, null));
    cursor += 1;
  }

  while (cursor < sectionLines.length) {
    const hunkHeaderLine = sectionLines[cursor] ?? "";
    if (!hunkHeaderLine.startsWith("@@ ")) {
      trailingLines.push(
        createEntry(hunkHeaderLine, classifyLineKind(hunkHeaderLine), highlightableLines, null, null),
      );
      cursor += 1;
      continue;
    }

    const range = parseHunkHeader(hunkHeaderLine);
    const headerEntry = createEntry(
      hunkHeaderLine,
      "hunkHeader",
      highlightableLines,
      range?.oldStart ?? null,
      range?.newStart ?? null,
    );
    cursor += 1;

    let oldLineNumber = range?.oldStart ?? 0;
    let newLineNumber = range?.newStart ?? 0;
    const lines: DiffLineEntry[] = [];

    while (cursor < sectionLines.length) {
      const line = sectionLines[cursor] ?? "";
      if (line.startsWith("@@ ")) {
        break;
      }

      const kind = classifyLineKind(line);
      if (kind === "meta" && line.startsWith("diff --git ")) {
        break;
      }

      let entryOldLine: number | null = null;
      let entryNewLine: number | null = null;
      if (kind === "ctx") {
        entryOldLine = oldLineNumber;
        entryNewLine = newLineNumber;
        oldLineNumber += 1;
        newLineNumber += 1;
      } else if (kind === "del") {
        entryOldLine = oldLineNumber;
        oldLineNumber += 1;
      } else if (kind === "add") {
        entryNewLine = newLineNumber;
        newLineNumber += 1;
      }

      lines.push(createEntry(line, kind, highlightableLines, entryOldLine, entryNewLine));
      cursor += 1;
    }

    hunks.push({
      header: headerEntry,
      lines,
      splitRows: toSplitRows(lines),
    });
  }

  const additions = hunks.reduce(
    (total, hunk) => total + hunk.lines.filter((line) => line.kind === "add").length,
    0,
  );
  const deletions = hunks.reduce(
    (total, hunk) => total + hunk.lines.filter((line) => line.kind === "del").length,
    0,
  );

  return {
    fileId: `${displayPath}:${sectionIndex}`,
    oldPath,
    newPath,
    displayPath,
    rawSectionText,
    headerLines,
    hunks,
    trailingLines,
    highlightableLines,
    additions,
    deletions,
    hunkCount: hunks.length,
    changeKind,
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
  for (let index = 0; index < sectionStarts.length; index += 1) {
    const start = sectionStarts[index] ?? 0;
    const end = sectionStarts[index + 1] ?? lines.length;
    const sectionLines = lines.slice(start, end);
    const header = parseSectionHeader(sectionLines[0] ?? "");
    sections.push(toParsedDiffFile(sectionLines, index, header.oldPath, header.newPath));
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
