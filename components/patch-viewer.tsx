"use client";

import { useState, useMemo } from "react";
import { ChevronRight, FileCode, GitBranch } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PatchMetadata, PatchRegion } from "@/lib/types";

interface PatchViewerProps {
  body: string;
  patchMetadata: PatchMetadata;
}

export interface FileDiff {
  path: string;
  content: string;
}

interface ParsedRegion {
  type: PatchRegion["type"];
  content: string;
  files: FileDiff[];
}

/**
 * Represents a parsed diff line with line number information.
 */
interface DiffLine {
  type: "header" | "hunk" | "add" | "remove" | "context" | "meta";
  content: string;
  oldLineNum: number | null;
  newLineNum: number | null;
}

/**
 * Parse diff content into structured lines with line numbers.
 */
function parseDiffLines(content: string): DiffLine[] {
  const lines = content.split("\n");
  const result: DiffLine[] = [];

  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    // File header lines (diff --git, ---, +++)
    if (
      line.startsWith("diff --git") ||
      line.startsWith("index ") ||
      line.startsWith("---") ||
      line.startsWith("+++") ||
      line.startsWith("new file") ||
      line.startsWith("deleted file") ||
      line.startsWith("old mode") ||
      line.startsWith("new mode") ||
      line.startsWith("similarity index") ||
      line.startsWith("rename from") ||
      line.startsWith("rename to") ||
      line.startsWith("Binary files")
    ) {
      result.push({
        type: "header",
        content: line,
        oldLineNum: null,
        newLineNum: null,
      });
      continue;
    }

    // Hunk header (@@ -old,count +new,count @@)
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLineNum = parseInt(hunkMatch[1], 10);
      newLineNum = parseInt(hunkMatch[2], 10);
      result.push({
        type: "hunk",
        content: line,
        oldLineNum: null,
        newLineNum: null,
      });
      continue;
    }

    // Added line
    if (line.startsWith("+")) {
      result.push({
        type: "add",
        content: line,
        oldLineNum: null,
        newLineNum: newLineNum,
      });
      newLineNum++;
      continue;
    }

    // Removed line
    if (line.startsWith("-")) {
      result.push({
        type: "remove",
        content: line,
        oldLineNum: oldLineNum,
        newLineNum: null,
      });
      oldLineNum++;
      continue;
    }

    // Context line (starts with space) or empty line in diff
    if (line.startsWith(" ") || line === "") {
      result.push({
        type: "context",
        content: line,
        oldLineNum: line === "" ? null : oldLineNum,
        newLineNum: line === "" ? null : newLineNum,
      });
      if (line !== "") {
        oldLineNum++;
        newLineNum++;
      }
      continue;
    }

    // Other meta lines
    result.push({
      type: "meta",
      content: line,
      oldLineNum: null,
      newLineNum: null,
    });
  }

  return result;
}

/**
 * Parse a diff region to extract individual file diffs.
 */
export function parseFileDiffs(content: string): FileDiff[] {
  const files: FileDiff[] = [];
  
  // Split by "diff --git" markers
  const diffMarker = /^diff --git /m;
  const parts = content.split(diffMarker);
  
  for (let i = 1; i < parts.length; i++) {
    const part = "diff --git " + parts[i];
    
    // Extract file path from the diff header
    // Format: diff --git a/path/to/file b/path/to/file
    const headerMatch = part.match(/^diff --git a\/(.+?) b\/(.+?)$/m);
    const path = headerMatch ? headerMatch[2] : `file-${i}`;
    
    files.push({ path, content: part.trim() });
  }
  
  // If no file diffs found, treat the whole content as a single diff
  if (files.length === 0 && content.trim()) {
    files.push({ path: "patch", content: content.trim() });
  }
  
  return files;
}

/**
 * Extract a region from the body using line numbers.
 */
export function extractRegion(body: string, region: PatchRegion): string {
  const lines = body.split("\n");
  // startLine and endLine are 1-indexed
  const start = Math.max(0, region.startLine - 1);
  const end = Math.min(lines.length, region.endLine);
  return lines.slice(start, end).join("\n");
}

/**
 * Get the CSS class for a diff line based on its type.
 */
function getDiffLineClass(type: DiffLine["type"]): string {
  switch (type) {
    case "add":
      return "bg-green-500/15 text-green-400";
    case "remove":
      return "bg-red-500/15 text-red-400";
    case "hunk":
      return "bg-blue-500/10 text-blue-400";
    case "header":
    case "meta":
      return "text-gray-500";
    default:
      return "text-gray-300";
  }
}

/**
 * Component to render a single diff line with line numbers.
 */
function DiffLineRow({ line }: { line: DiffLine }) {
  const lineClass = getDiffLineClass(line.type);

  return (
    <div className={`flex font-mono text-xs leading-5 ${lineClass}`}>
      {/* Old line number gutter */}
      <div className="w-12 shrink-0 text-right pr-2 select-none text-gray-600 bg-[#161b22] border-r border-[#30363d]">
        {line.oldLineNum ?? ""}
      </div>
      {/* New line number gutter */}
      <div className="w-12 shrink-0 text-right pr-2 select-none text-gray-600 bg-[#161b22] border-r border-[#30363d]">
        {line.newLineNum ?? ""}
      </div>
      {/* Line content */}
      <pre className="flex-1 pl-2 whitespace-pre overflow-x-visible">
        {line.content}
      </pre>
    </div>
  );
}

/**
 * Component to display a single file diff with line numbers.
 */
export function FileDiffCard({
  file,
  defaultExpanded = false,
}: {
  file: FileDiff;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Parse diff lines with line numbers
  const diffLines = useMemo(() => parseDiffLines(file.content), [file.content]);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="border border-border rounded-md overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center gap-2">
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                isExpanded ? "rotate-90" : ""
              }`}
            />
            <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-mono truncate">{file.path}</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="overflow-x-auto bg-[#0d1117]">
            <div className="min-w-fit">
              {diffLines.map((line, index) => (
                <DiffLineRow key={index} line={line} />
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * Component to display a diffstat region.
 */
function DiffstatCard({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="py-0 gap-0 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardHeader className="py-3 px-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
                <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Diffstat Summary</CardTitle>
              </div>
            </CardHeader>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            <pre className="p-4 text-xs font-mono whitespace-pre overflow-x-auto bg-muted/20">
              {content}
            </pre>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/**
 * Component to display a full diff region with per-file collapsibles.
 */
function DiffRegionCard({ region }: { region: ParsedRegion }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const fileCount = region.files.length;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="py-0 gap-0 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardHeader className="py-3 px-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
                <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  Patch: {fileCount} {fileCount === 1 ? "file" : "files"} changed
                </CardTitle>
              </div>
            </CardHeader>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-3 space-y-2">
            {region.files.map((file, index) => (
              <FileDiffCard key={`${file.path}-${index}`} file={file} />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/**
 * Main patch viewer component that renders patch regions from an email body.
 */
export function PatchViewer({ body, patchMetadata }: PatchViewerProps) {
  if (!patchMetadata.hasPatch || patchMetadata.regions.length === 0) {
    return null;
  }

  // Parse all regions
  const parsedRegions: ParsedRegion[] = patchMetadata.regions.map((region) => {
    const content = extractRegion(body, region);
    const files = region.type === "diff" ? parseFileDiffs(content) : [];
    return { type: region.type, content, files };
  });

  return (
    <div className="space-y-3 my-4">
      {parsedRegions.map((region, index) => {
        if (region.type === "diff_stat") {
          return <DiffstatCard key={`diffstat-${index}`} content={region.content} />;
        }
        if (region.type === "diff" || region.type === "binary_patch") {
          return <DiffRegionCard key={`diff-${index}`} region={region} />;
        }
        return null;
      })}
    </div>
  );
}

/**
 * Split the email body into text and patch sections.
 * Returns an array of sections with their type and content.
 */
export function splitBodyByRegions(
  body: string,
  regions: PatchRegion[]
): { type: "text" | "patch"; content: string; region?: PatchRegion }[] {
  if (regions.length === 0) {
    return [{ type: "text", content: body }];
  }

  const lines = body.split("\n");
  const sections: { type: "text" | "patch"; content: string; region?: PatchRegion }[] = [];
  
  // Sort regions by start line
  const sortedRegions = [...regions].sort((a, b) => a.startLine - b.startLine);
  
  let currentLine = 1;

  for (const region of sortedRegions) {
    // Add text before this region
    if (region.startLine > currentLine) {
      const textContent = lines.slice(currentLine - 1, region.startLine - 1).join("\n");
      if (textContent.trim()) {
        sections.push({ type: "text", content: textContent });
      }
    }

    // Add the patch region marker (we'll render the actual patch separately)
    sections.push({ type: "patch", content: "", region });

    currentLine = region.endLine + 1;
  }

  // Add any remaining text after the last region
  if (currentLine <= lines.length) {
    const textContent = lines.slice(currentLine - 1).join("\n");
    if (textContent.trim()) {
      sections.push({ type: "text", content: textContent });
    }
  }

  return sections;
}
