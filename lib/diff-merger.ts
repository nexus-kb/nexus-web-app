import { parsePatch, type StructuredPatchHunk } from "diff";

export interface MergedFile {
  path: string;
  hunks: StructuredPatchHunk[];
  diffString: string;
}

interface PatchInput {
  content: string;
  date: string;
}

/**
 * Represents a hunk with tracking information for merging.
 */
interface TrackedHunk extends StructuredPatchHunk {
  sourceDate: string;
  originalOldStart: number;
  originalNewStart: number;
}

/**
 * Extract only the diff portions from content that might contain other text.
 * Looks for "diff --git" markers and extracts complete diff blocks.
 */
function extractDiffBlocks(content: string): string[] {
  const blocks: string[] = [];
  const lines = content.split("\n");

  let currentBlock: string[] = [];
  let inDiff = false;

  for (const line of lines) {
    // Start of a new diff block
    if (line.startsWith("diff --git ")) {
      // Save previous block if exists
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join("\n"));
      }
      currentBlock = [line];
      inDiff = true;
    } else if (inDiff) {
      // Check for end of diff (empty line followed by non-diff content, or signature)
      // Email signatures start with "-- " (dash dash space)
      if (line === "-- " || line === "--") {
        // End of diff, save block
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join("\n"));
          currentBlock = [];
        }
        inDiff = false;
      } else {
        currentBlock.push(line);
      }
    }
  }

  // Don't forget the last block
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join("\n"));
  }

  return blocks;
}

/**
 * Parse a unified diff string and extract file diffs.
 * Handles content that may contain non-diff text by extracting only valid diff blocks.
 */
function parseDiffContent(
  content: string
): { path: string; hunks: StructuredPatchHunk[] }[] {
  // First, extract only the diff blocks from the content
  const diffBlocks = extractDiffBlocks(content);

  const results: { path: string; hunks: StructuredPatchHunk[] }[] = [];

  for (const block of diffBlocks) {
    try {
      const parsed = parsePatch(block);

      for (const diff of parsed) {
        // Skip if no hunks (empty or invalid diff)
        if (!diff.hunks || diff.hunks.length === 0) {
          continue;
        }

        // Extract file path from newFileName (b/path/to/file) or oldFileName
        let path = diff.newFileName || diff.oldFileName || "unknown";
        // Remove a/ or b/ prefix if present
        if (path.startsWith("b/")) {
          path = path.slice(2);
        } else if (path.startsWith("a/")) {
          path = path.slice(2);
        }

        results.push({ path, hunks: diff.hunks });
      }
    } catch {
      // Skip blocks that fail to parse - they might not be valid diffs
      console.warn("Failed to parse diff block, skipping");
    }
  }

  return results;
}

/**
 * Check if two hunks overlap in the target (new) file.
 * Hunks overlap if their line ranges intersect.
 */
function hunksOverlap(
  hunk1: TrackedHunk,
  hunk2: TrackedHunk,
  offset: number
): boolean {
  const h1Start = hunk1.newStart;
  const h1End = hunk1.newStart + hunk1.newLines - 1;
  const h2Start = hunk2.newStart + offset;
  const h2End = h2Start + hunk2.newLines - 1;

  return h1Start <= h2End && h2Start <= h1End;
}

/**
 * Calculate the line delta (offset) introduced by a hunk.
 * Positive means lines were added, negative means lines were removed.
 */
function calculateHunkDelta(hunk: StructuredPatchHunk): number {
  return hunk.newLines - hunk.oldLines;
}

/**
 * Merge two overlapping hunks, with the later hunk taking precedence.
 * This is a simplified merge that concatenates changes.
 */
function mergeOverlappingHunks(
  earlier: TrackedHunk,
  later: TrackedHunk,
  offset: number
): TrackedHunk {
  // For overlapping hunks, we use the later hunk's changes for the overlapping region
  // This is a simplified approach - the later patch takes full precedence

  const adjustedLaterStart = later.newStart + offset;

  // If later hunk completely covers earlier, just use later with adjusted position
  if (
    adjustedLaterStart <= earlier.newStart &&
    adjustedLaterStart + later.newLines >= earlier.newStart + earlier.newLines
  ) {
    return {
      ...later,
      newStart: adjustedLaterStart,
      oldStart: later.oldStart,
      sourceDate: later.sourceDate,
      originalOldStart: later.originalOldStart,
      originalNewStart: later.originalNewStart,
    };
  }

  // For partial overlaps, we need to combine the hunks
  // Take non-overlapping part from earlier + all of later
  const mergedLines: string[] = [];

  // Calculate the overlap region
  const overlapStart = Math.max(earlier.newStart, adjustedLaterStart);
  const earlierEnd = earlier.newStart + earlier.newLines;
  const laterEnd = adjustedLaterStart + later.newLines;

  // Add lines from earlier that come before the overlap
  let lineNum = earlier.newStart;
  for (const line of earlier.lines) {
    if (lineNum < overlapStart) {
      mergedLines.push(line);
    }
    // Lines starting with '-' are removed, don't count them for position
    if (!line.startsWith("-")) {
      lineNum++;
    }
  }

  // Add all lines from later (it takes precedence in overlap)
  mergedLines.push(...later.lines);

  // Add lines from earlier that come after the overlap (if any)
  lineNum = earlier.newStart;
  for (const line of earlier.lines) {
    if (!line.startsWith("-")) {
      lineNum++;
    }
    if (lineNum > laterEnd && lineNum <= earlierEnd) {
      mergedLines.push(line);
    }
  }

  const newStart = Math.min(earlier.newStart, adjustedLaterStart);
  const newEnd = Math.max(earlierEnd, laterEnd);

  return {
    oldStart: earlier.oldStart,
    oldLines: earlier.oldLines + later.oldLines,
    newStart: newStart,
    newLines: newEnd - newStart,
    lines: mergedLines,
    sourceDate: later.sourceDate,
    originalOldStart: earlier.originalOldStart,
    originalNewStart: earlier.originalNewStart,
  };
}

/**
 * Merge multiple hunks for a single file, handling overlaps and line number adjustments.
 */
function mergeFileHunks(trackedHunks: TrackedHunk[]): StructuredPatchHunk[] {
  if (trackedHunks.length === 0) return [];
  if (trackedHunks.length === 1) return [trackedHunks[0]];

  // Sort by date first (chronological), then by line number
  const sorted = [...trackedHunks].sort((a, b) => {
    const dateCompare =
      new Date(a.sourceDate).getTime() - new Date(b.sourceDate).getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.newStart - b.newStart;
  });

  const merged: TrackedHunk[] = [];
  let accumulatedOffset = 0;

  for (const hunk of sorted) {
    // Apply accumulated offset to this hunk's position
    const adjustedHunk: TrackedHunk = {
      ...hunk,
      newStart: hunk.newStart + accumulatedOffset,
    };

    // Check if this hunk overlaps with any existing merged hunk
    let wasOverlapped = false;
    for (let i = 0; i < merged.length; i++) {
      if (hunksOverlap(merged[i], hunk, accumulatedOffset)) {
        // Merge overlapping hunks
        merged[i] = mergeOverlappingHunks(merged[i], hunk, accumulatedOffset);
        wasOverlapped = true;
        break;
      }
    }

    if (!wasOverlapped) {
      merged.push(adjustedHunk);
    }

    // Update accumulated offset based on this hunk's line delta
    accumulatedOffset += calculateHunkDelta(hunk);
  }

  // Sort merged hunks by line number for final output
  merged.sort((a, b) => a.newStart - b.newStart);

  return merged;
}

/**
 * Convert a hunk back to unified diff format string.
 */
function hunkToString(hunk: StructuredPatchHunk): string {
  const lines: string[] = [];

  // Hunk header
  lines.push(
    `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
  );

  // Hunk content - lines already have prefixes (+, -, or space)
  for (const line of hunk.lines) {
    lines.push(line);
  }

  return lines.join("\n");
}

/**
 * Convert merged hunks to a complete unified diff string for a file.
 */
function hunksToUnifiedDiff(
  filePath: string,
  hunks: StructuredPatchHunk[]
): string {
  if (hunks.length === 0) return "";

  const lines: string[] = [];

  // File header
  lines.push(`diff --git a/${filePath} b/${filePath}`);
  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);

  // Add each hunk
  for (const hunk of hunks) {
    lines.push(hunkToString(hunk));
  }

  return lines.join("\n");
}

/**
 * Merge multiple patches from different emails into a single set of file diffs.
 * Patches are applied in chronological order, with later patches taking precedence
 * for overlapping changes.
 *
 * @param patches Array of patch inputs with content and date
 * @returns Map of file paths to merged file diffs
 */
export function mergePatches(patches: PatchInput[]): Map<string, MergedFile> {
  const result = new Map<string, MergedFile>();

  // Group all hunks by file path
  const fileHunks = new Map<string, TrackedHunk[]>();

  for (const patch of patches) {
    const fileDiffs = parseDiffContent(patch.content);

    for (const { path, hunks } of fileDiffs) {
      if (!fileHunks.has(path)) {
        fileHunks.set(path, []);
      }

      // Convert hunks to tracked hunks with source metadata
      const trackedHunks: TrackedHunk[] = hunks.map((hunk) => ({
        ...hunk,
        sourceDate: patch.date,
        originalOldStart: hunk.oldStart,
        originalNewStart: hunk.newStart,
      }));

      fileHunks.get(path)!.push(...trackedHunks);
    }
  }

  // Merge hunks for each file
  for (const [path, hunks] of fileHunks) {
    const mergedHunks = mergeFileHunks(hunks);
    const diffString = hunksToUnifiedDiff(path, mergedHunks);

    result.set(path, {
      path,
      hunks: mergedHunks,
      diffString,
    });
  }

  return result;
}

/**
 * Extract diff regions from an email body using patch metadata.
 * This is used to get the raw diff content from an email.
 */
export function extractDiffContent(
  body: string,
  regions: { startLine: number; endLine: number; type: string }[]
): string[] {
  const lines = body.split("\n");
  const diffs: string[] = [];

  for (const region of regions) {
    if (region.type === "diff" || region.type === "binary_patch") {
      const start = Math.max(0, region.startLine - 1);
      const end = Math.min(lines.length, region.endLine);
      diffs.push(lines.slice(start, end).join("\n"));
    }
  }

  return diffs;
}
