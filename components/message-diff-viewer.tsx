"use client";

import {
  Columns2,
  Equal,
  ListChevronsDownUp,
  ListChevronsUpDown,
} from "lucide-react";
import { Button, CodeBlock } from "@nexus/design-system";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ButtonToggleGroup } from "@/components/button-toggle-group";
import {
  inferShikiLanguage,
  parseUnifiedDiffByFile,
  type DiffLineEntry,
  type ParsedDiffFile,
} from "@/lib/diff/parse";
import { highlightLinesClient } from "@/lib/highlight/client-shiki";

interface MessageDiffViewerProps {
  messageId: number;
  diffText: string;
  isDarkTheme: boolean;
  initialViewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

type ViewMode = "unified" | "split" | "raw";
type ThemeMode = "light" | "dark";

interface HighlightToken {
  content: string;
  color?: string;
  fontStyle?: number;
}

type HighlightLineTokens = HighlightToken[];

type HighlightCacheByFileId = Record<
  string,
  {
    light?: HighlightLineTokens[];
    dark?: HighlightLineTokens[];
  }
>;

function toTokenStyle(fontStyle?: number): CSSProperties {
  if (fontStyle == null || fontStyle === 0) {
    return {};
  }

  return {
    fontStyle: fontStyle & 1 ? "italic" : undefined,
    fontWeight: fontStyle & 2 ? 600 : undefined,
    textDecoration: fontStyle & 4 ? "underline" : undefined,
  };
}

function formatChangeKind(file: ParsedDiffFile): string {
  switch (file.changeKind) {
    case "added":
      return "new file";
    case "deleted":
      return "deleted";
    case "renamed":
      return "renamed";
    case "copied":
      return "copied";
    case "binary":
      return "binary";
    default:
      return "modified";
  }
}

function renderLineText(
  entry: DiffLineEntry,
  tokenLine: HighlightLineTokens | undefined,
): React.ReactNode {
  if (entry.kind === "add" || entry.kind === "del" || entry.kind === "ctx") {
    return (
      <>
        <span className="message-diff-line-prefix" aria-hidden="true">
          {entry.prefix}
        </span>
        <span className="message-diff-line-content">
          {tokenLine?.length ? (
            tokenLine.map((token, index) => (
              <span
                key={index}
                className="message-diff-token"
                style={{
                  color: token.color,
                  ...toTokenStyle(token.fontStyle),
                }}
              >
                {token.content}
              </span>
            ))
          ) : (
            entry.content
          )}
        </span>
      </>
    );
  }

  return <span className="message-diff-line-content">{entry.text}</span>;
}

function getTokenLine(
  file: ParsedDiffFile,
  highlightedLines: HighlightLineTokens[] | undefined,
  entry: DiffLineEntry | null,
): HighlightLineTokens | undefined {
  if (!entry || entry.highlightIndex == null || !file.highlightableLines.length) {
    return undefined;
  }
  return highlightedLines?.[entry.highlightIndex];
}

function formatUnifiedLineNumber(entry: DiffLineEntry): string {
  if (entry.kind === "add") {
    return entry.newLineNumber != null ? String(entry.newLineNumber) : "";
  }
  if (entry.kind === "del") {
    return entry.oldLineNumber != null ? String(entry.oldLineNumber) : "";
  }

  return String(entry.newLineNumber ?? entry.oldLineNumber ?? "");
}

export function MessageDiffViewer({
  messageId,
  diffText,
  isDarkTheme,
  initialViewMode = "unified",
  onViewModeChange,
}: MessageDiffViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set());
  const [highlightCacheByFileId, setHighlightCacheByFileId] =
    useState<HighlightCacheByFileId>({});
  const [loadingFileIds, setLoadingFileIds] = useState<Set<string>>(new Set());
  const [errorByFileId, setErrorByFileId] = useState<Record<string, string | undefined>>({});
  const inFlightRequests = useRef<Map<string, AbortController>>(new Map());
  const theme: ThemeMode = isDarkTheme ? "dark" : "light";

  const { parsedFiles, parseError } = useMemo(() => {
    try {
      return {
        parsedFiles: parseUnifiedDiffByFile(diffText),
        parseError: null as string | null,
      };
    } catch (error) {
      return {
        parsedFiles: [] as ParsedDiffFile[],
        parseError:
          error instanceof Error ? error.message : "Failed to parse diff sections",
      };
    }
  }, [diffText]);

  useEffect(
    () => () => {
      for (const request of inFlightRequests.current.values()) {
        request.abort();
      }
      inFlightRequests.current.clear();
    },
    [],
  );

  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  const loadHighlightForFile = useCallback(
    async (file: ParsedDiffFile) => {
      if (!file.highlightableLines.length) {
        setHighlightCacheByFileId((prev) => ({
          ...prev,
          [file.fileId]: {
            ...prev[file.fileId],
            [theme]: [],
          },
        }));
        return;
      }

      if (highlightCacheByFileId[file.fileId]?.[theme]) {
        return;
      }

      const requestKey = `${file.fileId}:${theme}`;
      if (inFlightRequests.current.has(requestKey)) {
        return;
      }

      const controller = new AbortController();
      inFlightRequests.current.set(requestKey, controller);
      setLoadingFileIds((prev) => new Set(prev).add(file.fileId));
      setErrorByFileId((prev) => ({ ...prev, [file.fileId]: undefined }));

      try {
        const tokenLines = await highlightLinesClient(
          file.highlightableLines,
          inferShikiLanguage(file.displayPath),
          theme,
        );
        if (controller.signal.aborted) {
          return;
        }

        setHighlightCacheByFileId((prev) => ({
          ...prev,
          [file.fileId]: {
            ...prev[file.fileId],
            [theme]: tokenLines,
          },
        }));
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorByFileId((prev) => ({
            ...prev,
            [file.fileId]:
              error instanceof Error
                ? error.message
                : "Failed to highlight file diff",
          }));
        }
      } finally {
        inFlightRequests.current.delete(requestKey);
        setLoadingFileIds((prev) => {
          const next = new Set(prev);
          next.delete(file.fileId);
          return next;
        });
      }
    },
    [highlightCacheByFileId, theme],
  );

  const toggleFile = useCallback(
    (file: ParsedDiffFile) => {
      const isExpanded = expandedFileIds.has(file.fileId);
      setExpandedFileIds((prev) => {
        const next = new Set(prev);
        if (isExpanded) {
          next.delete(file.fileId);
        } else {
          next.add(file.fileId);
        }
        return next;
      });

      if (!isExpanded && viewMode !== "raw") {
        void loadHighlightForFile(file);
      }
    },
    [expandedFileIds, loadHighlightForFile, viewMode],
  );

  const expandAllFiles = useCallback(() => {
    const nextFileIds = new Set(parsedFiles.map((file) => file.fileId));
    setExpandedFileIds(nextFileIds);
    if (viewMode !== "raw") {
      for (const file of parsedFiles) {
        void loadHighlightForFile(file);
      }
    }
  }, [loadHighlightForFile, parsedFiles, viewMode]);

  const collapseAllFiles = useCallback(() => {
    setExpandedFileIds(new Set());
  }, []);

  if (!diffText.trim()) {
    return <p className="muted">No diff text available for this message.</p>;
  }

  if (parseError) {
    return (
      <div className="message-diff-viewer">
        <p className="error-text">{parseError}</p>
        <CodeBlock className="diff-block">{diffText}</CodeBlock>
      </div>
    );
  }

  return (
    <div className="message-diff-viewer">
      <header className="message-diff-viewer-header">
        <div className="message-diff-viewer-heading">
          <p className="message-diff-viewer-title">Diff</p>
          <p className="message-diff-viewer-meta">
            {parsedFiles.length} files
          </p>
        </div>
        <div className="message-diff-viewer-toolbar">
          <ButtonToggleGroup
            label={`Diff view mode ${messageId}`}
            value={viewMode}
            onChange={(next) => {
              setViewMode(next);
              onViewModeChange?.(next);
            }}
            options={[
              { value: "unified", label: "Unified" },
              { value: "split", label: "Split" },
              { value: "raw", label: "Raw" },
            ]}
            className="message-diff-view-mode"
          />
          <div className="message-diff-toolbar-actions">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Collapse all files in diff"
              title="Collapse all files in diff"
              onClick={collapseAllFiles}
              disabled={!parsedFiles.length}
            >
              <ListChevronsDownUp size={18} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Expand all files in diff"
              title="Expand all files in diff"
              onClick={expandAllFiles}
              disabled={!parsedFiles.length}
            >
              <ListChevronsUpDown size={18} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <ul className="message-diff-file-list">
        {parsedFiles.map((file) => {
          const isExpanded = expandedFileIds.has(file.fileId);
          const fileError = errorByFileId[file.fileId];
          const isLoading = loadingFileIds.has(file.fileId);
          const highlightedLines = highlightCacheByFileId[file.fileId]?.[theme];

          return (
            <li key={file.fileId} className="message-diff-file-item">
              <article
                className={`message-diff-file-card ${isExpanded ? "is-expanded" : "is-collapsed"}`}
              >
                <header className="message-diff-file-header">
                  <button
                    type="button"
                    className="message-diff-file-toggle"
                    onClick={() => toggleFile(file)}
                    aria-expanded={isExpanded}
                    aria-controls={`message-${messageId}-file-${file.fileId}`}
                    aria-label={`Toggle file diff card: ${file.displayPath}`}
                  >
                    <div className="message-diff-file-title-block">
                      <span className="message-diff-file-path">{file.displayPath}</span>
                      <span className="message-diff-file-summary">
                        {formatChangeKind(file)} · hunks {file.hunkCount} · +{file.additions} / -{file.deletions}
                      </span>
                    </div>
                    <span className="message-diff-file-state">{isExpanded ? "Collapse" : "Expand"}</span>
                  </button>
                </header>

                {isExpanded ? (
                  <div
                    id={`message-${messageId}-file-${file.fileId}`}
                    className="message-diff-file-content"
                  >
                    {isLoading ? <p className="muted">Highlighting…</p> : null}
                    {fileError ? (
                      <p className="error-text">
                        Highlight unavailable, showing raw file diff: {fileError}
                      </p>
                    ) : null}

                    {viewMode === "raw" || fileError ? (
                      <CodeBlock className="diff-block">{file.rawSectionText}</CodeBlock>
                    ) : (
                      <div className="message-diff-surface">
                        {file.headerLines.length ? (
                          <div className="message-diff-meta-block">
                            {file.headerLines.map((line, index) => (
                              <p key={`${file.fileId}-meta-${index}`} className="message-diff-meta-line">
                                {line.text}
                              </p>
                            ))}
                          </div>
                        ) : null}

                        {file.hunks.map((hunk, hunkIndex) => {
                          return (
                            <section key={`${file.fileId}-hunk-${hunkIndex}`} className="message-diff-hunk">
                              <div className="message-diff-hunk-header">
                                <span>{hunk.header.text}</span>
                                <span className="message-diff-hunk-mode">
                                  {viewMode === "unified" ? (
                                    <Equal size={14} aria-hidden="true" />
                                  ) : (
                                    <Columns2 size={14} aria-hidden="true" />
                                  )}
                                  {viewMode}
                                </span>
                              </div>

                              {viewMode === "unified" ? (
                                <div className="message-diff-unified-block">
                                  {hunk.lines.map((lineEntry, lineIndex) => (
                                    <div
                                      key={`${file.fileId}-u-${hunkIndex}-${lineIndex}`}
                                      className={`message-diff-unified-row message-diff-unified-row-${lineEntry.kind}`}
                                    >
                                      <span className="message-diff-line-number" aria-hidden="true">
                                        {formatUnifiedLineNumber(lineEntry)}
                                      </span>
                                      <span className={`message-diff-line message-diff-line-${lineEntry.kind}`}>
                                        {renderLineText(
                                          lineEntry,
                                          getTokenLine(file, highlightedLines, lineEntry),
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="message-diff-split-block">
                                  {hunk.splitRows.map((row, rowIndex) => (
                                    <div
                                      key={`${file.fileId}-s-${hunkIndex}-${rowIndex}`}
                                      className={`message-diff-split-row message-diff-split-row-${row.kind}`}
                                    >
                                      {row.note ? (
                                        <div className="message-diff-split-note">
                                          <span className="message-diff-line message-diff-line-note">
                                            {renderLineText(row.note, undefined)}
                                          </span>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="message-diff-split-cell">
                                            <span className="message-diff-line-number" aria-hidden="true">
                                              {row.left?.oldLineNumber ?? ""}
                                            </span>
                                            <span className={`message-diff-line ${row.left ? `message-diff-line-${row.left.kind}` : "message-diff-line-empty"}`}>
                                              {row.left
                                                ? renderLineText(
                                                    row.left,
                                                    getTokenLine(file, highlightedLines, row.left),
                                                  )
                                                : null}
                                            </span>
                                          </div>
                                          <div className="message-diff-split-cell">
                                            <span className="message-diff-line-number" aria-hidden="true">
                                              {row.right?.newLineNumber ?? ""}
                                            </span>
                                            <span className={`message-diff-line ${row.right ? `message-diff-line-${row.right.kind}` : "message-diff-line-empty"}`}>
                                              {row.right
                                                ? renderLineText(
                                                    row.right,
                                                    getTokenLine(file, highlightedLines, row.right),
                                                  )
                                                : null}
                                            </span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </section>
                          );
                        })}

                        {file.trailingLines.length ? (
                          <div className="message-diff-meta-block">
                            {file.trailingLines.map((line, index) => (
                              <p key={`${file.fileId}-trailing-${index}`} className="message-diff-meta-line">
                                {line.text}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
