"use client";

import {
  Braces,
  ListChevronsDownUp,
  ListChevronsUpDown,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
}

type ViewMode = "rich" | "raw";
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

export function MessageDiffViewer({
  messageId,
  diffText,
  isDarkTheme,
}: MessageDiffViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("rich");
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
          return next;
        }
        next.add(file.fileId);
        return next;
      });

      if (!isExpanded) {
        void loadHighlightForFile(file);
      }
    },
    [expandedFileIds, loadHighlightForFile],
  );

  const expandAllFiles = useCallback(() => {
    const nextFileIds = new Set(parsedFiles.map((file) => file.fileId));
    setExpandedFileIds(nextFileIds);
    for (const file of parsedFiles) {
      void loadHighlightForFile(file);
    }
  }, [loadHighlightForFile, parsedFiles]);

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
        <pre className="diff-block">{diffText}</pre>
      </div>
    );
  }

  return (
    <div className="message-diff-viewer">
      <header className="message-diff-viewer-header">
        <p className="message-diff-viewer-title">Diff</p>
        <div className="message-diff-viewer-toolbar">
          <button
            type="button"
            className={`rail-icon-button ${viewMode === "rich" ? "is-active" : ""}`}
            aria-label="Show rich diff view"
            title="Show rich diff view"
            onClick={() => setViewMode("rich")}
          >
            <Sparkles size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`rail-icon-button ${viewMode === "raw" ? "is-active" : ""}`}
            aria-label="Show raw diff view"
            title="Show raw diff view"
            onClick={() => setViewMode("raw")}
          >
            <Braces size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rail-icon-button"
            aria-label="Collapse all files in diff"
            title="Collapse all files in diff"
            onClick={collapseAllFiles}
            disabled={!parsedFiles.length}
          >
            <ListChevronsDownUp size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rail-icon-button"
            aria-label="Expand all files in diff"
            title="Expand all files in diff"
            onClick={expandAllFiles}
            disabled={!parsedFiles.length}
          >
            <ListChevronsUpDown size={14} aria-hidden="true" />
          </button>
        </div>
      </header>

      {viewMode === "raw" ? (
        <pre className="diff-block">{diffText}</pre>
      ) : (
        <ul className="message-diff-file-list">
          {parsedFiles.map((file) => {
            const isExpanded = expandedFileIds.has(file.fileId);
            const fileError = errorByFileId[file.fileId];
            const isLoading = loadingFileIds.has(file.fileId);
            const highlightedLines = highlightCacheByFileId[file.fileId]?.[theme];

            return (
              <li key={file.fileId} className="message-diff-file-item">
                <section
                  className={`message-diff-file-card ${isExpanded ? "is-expanded" : "is-collapsed"}`}
                >
                  <button
                    type="button"
                    className="message-diff-file-toggle"
                    onClick={() => toggleFile(file)}
                    aria-expanded={isExpanded}
                    aria-controls={`message-${messageId}-file-${file.fileId}`}
                    aria-label={`Toggle file diff card: ${file.displayPath}`}
                  >
                    <span className="message-diff-file-path">{file.displayPath}</span>
                    <span className="message-diff-file-state">
                      {isExpanded ? "Collapse" : "Expand"}
                    </span>
                  </button>

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

                      {fileError ? (
                        <pre className="diff-block">{file.rawSectionText}</pre>
                      ) : (
                        <pre className="message-diff-rich-block">
                          {file.lineEntries.map((lineEntry, lineIndex) => (
                            <span
                              key={lineIndex}
                              className={`message-diff-line message-diff-line-${lineEntry.kind}`}
                            >
                              {renderLineText(
                                lineEntry,
                                lineEntry.highlightIndex == null
                                  ? undefined
                                  : highlightedLines?.[lineEntry.highlightIndex],
                              )}
                            </span>
                          ))}
                        </pre>
                      )}
                    </div>
                  ) : null}
                </section>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
