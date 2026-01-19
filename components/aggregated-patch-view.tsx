"use client";

import { useMemo } from "react";
import { FileCode } from "lucide-react";
import { FileDiffCard, extractRegion } from "@/components/patch-viewer";
import { mergePatches } from "@/lib/diff-merger";
import type { EmailHierarchy } from "@/lib/types";

interface AggregatedPatchViewProps {
  emails: EmailHierarchy[];
}

/**
 * Extract all diff content from emails and prepare for merging.
 */
function extractPatchesFromEmails(
  emails: EmailHierarchy[]
): { content: string; date: string }[] {
  const patches: { content: string; date: string }[] = [];

  // Sort emails by date (oldest first) to ensure proper merge order
  const sortedEmails = [...emails].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const email of sortedEmails) {
    const { body, patchMetadata, date } = email;

    if (!body || !patchMetadata?.hasPatch || !patchMetadata.regions.length) {
      continue;
    }

    // Extract diff regions from this email
    for (const region of patchMetadata.regions) {
      if (region.type === "diff" || region.type === "binary_patch") {
        const content = extractRegion(body, region);
        if (content.trim()) {
          patches.push({ content, date });
        }
      }
    }
  }

  return patches;
}

/**
 * Aggregated Patch View component that shows all diffs from a thread
 * merged and grouped by file path.
 */
export function AggregatedPatchView({ emails }: AggregatedPatchViewProps) {
  // Extract and merge all patches from emails
  const mergedFiles = useMemo(() => {
    const patches = extractPatchesFromEmails(emails);
    if (patches.length === 0) return [];

    const merged = mergePatches(patches);
    return Array.from(merged.values()).sort((a, b) =>
      a.path.localeCompare(b.path)
    );
  }, [emails]);

  if (mergedFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileCode className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm">No patches found in this thread</p>
      </div>
    );
  }

  // Calculate total files changed
  const totalFiles = mergedFiles.length;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="px-1 py-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{totalFiles}</span>{" "}
        {totalFiles === 1 ? "file" : "files"} changed in this patch series
      </div>

      {/* File list with diffs */}
      <div className="space-y-3">
        {mergedFiles.map((file) => (
          <FileDiffCard
            key={file.path}
            file={{ path: file.path, content: file.diffString }}
            defaultExpanded={mergedFiles.length <= 3}
          />
        ))}
      </div>
    </div>
  );
}
