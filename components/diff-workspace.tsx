"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LeftRail } from "@/components/left-rail";
import { MessageDiffViewer } from "@/components/message-diff-viewer";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import { PaneEmptyState } from "@/components/pane-empty-state";
import { queryKeys } from "@/lib/api/query-keys";
import {
  getLists,
  getPatchItemDetail,
  getPatchItemFileDiff,
  getPatchItemFiles,
  getPatchItemFullDiff,
  getSeriesDetail,
} from "@/lib/api/server-client";
import { mergeSearchParams } from "@/lib/ui/query-state";
import { usePathname, useRouter, useSearchParams } from "@/lib/ui/navigation";
import {
  applyVisualTheme,
  getStoredNavCollapsed,
  getStoredThemeMode,
  persistNavCollapsed,
  persistThemeMode,
  type ThemeMode,
} from "@/lib/ui/preferences";
import { getThreadsPath } from "@/lib/ui/routes";
import { useDesktopViewport } from "@/lib/ui/use-desktop-viewport";

interface DiffWorkspaceProps {
  patchItemId: number;
  initialPath: string | undefined;
  initialView: string | undefined;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

export function DiffWorkspace({ patchItemId, initialPath, initialView }: DiffWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useDesktopViewport(true);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    typeof window === "undefined" ? "system" : getStoredThemeMode(),
  );
  const [navCollapsed, setNavCollapsed] = useState(() =>
    typeof window === "undefined" ? false : getStoredNavCollapsed(),
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [selectedPath, setSelectedPath] = useState<string | null>(initialPath ?? null);
  const [viewMode, setViewMode] = useState<"file" | "full">(
    initialView === "full" ? "full" : "file",
  );

  useEffect(() => {
    applyVisualTheme(themeMode);
  }, [themeMode]);

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const sanitized = new URLSearchParams(searchParams.toString());
      sanitized.delete("theme");
      sanitized.delete("nav");
      const nextQuery = mergeSearchParams(sanitized, updates);
      router.replace(`${pathname}${nextQuery}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const listsQuery = useQuery({
    queryKey: queryKeys.lists(),
    queryFn: () => getLists({ page: 1, pageSize: 200 }),
    staleTime: 5 * 60_000,
  });

  const patchItemQuery = useQuery({
    queryKey: queryKeys.patchItemDetail(patchItemId),
    queryFn: () => getPatchItemDetail(patchItemId),
    placeholderData: keepPreviousData,
  });

  const filesQuery = useQuery({
    queryKey: queryKeys.patchItemFiles(patchItemId),
    queryFn: () => getPatchItemFiles(patchItemId),
    placeholderData: keepPreviousData,
  });

  const selectedSeriesId = patchItemQuery.data?.series_id ?? null;
  const seriesDetailQuery = useQuery({
    queryKey: queryKeys.seriesDetail(selectedSeriesId ?? 0),
    enabled: Boolean(selectedSeriesId),
    queryFn: () => getSeriesDetail(selectedSeriesId!),
    placeholderData: keepPreviousData,
  });

  const fullDiffQuery = useQuery({
    queryKey: queryKeys.patchItemDiff(patchItemId),
    enabled: viewMode === "full",
    queryFn: () => getPatchItemFullDiff(patchItemId),
    placeholderData: keepPreviousData,
  });

  const lists = useMemo(() => listsQuery.data?.items ?? [], [listsQuery.data?.items]);
  const patchItem = patchItemQuery.data;
  const files = useMemo(() => filesQuery.data?.items ?? [], [filesQuery.data?.items]);
  const selectedListKey = seriesDetailQuery.data?.lists[0] ?? null;

  const resolvedSelectedPath =
    viewMode === "file" && files.length > 0 && (!selectedPath || !files.some((file) => file.path === selectedPath))
      ? files[0]?.path ?? null
      : selectedPath;

  const fileDiffQuery = useQuery({
    queryKey: queryKeys.patchItemFileDiff({ patchItemId, path: resolvedSelectedPath ?? "" }),
    enabled: viewMode === "file" && Boolean(resolvedSelectedPath),
    queryFn: () => getPatchItemFileDiff({ patchItemId, path: resolvedSelectedPath! }),
    placeholderData: keepPreviousData,
  });

  const fullDiff = fullDiffQuery.data?.diff_text ?? null;
  const selectedFileDiff = fileDiffQuery.data?.diff_text ?? null;

  const centerLoading = patchItemQuery.isLoading || filesQuery.isLoading;
  const centerError = patchItemQuery.error
    ? toErrorMessage(patchItemQuery.error, "Failed to load patch item")
    : filesQuery.error
      ? toErrorMessage(filesQuery.error, "Failed to load patch files")
      : null;

  const detailLoading =
    viewMode === "full" ? fullDiffQuery.isLoading : Boolean(resolvedSelectedPath) && fileDiffQuery.isLoading;
  const detailError =
    viewMode === "full"
      ? fullDiffQuery.error
        ? toErrorMessage(fullDiffQuery.error, "Failed to load full diff")
        : null
      : fileDiffQuery.error
        ? toErrorMessage(fileDiffQuery.error, "Failed to load file diff")
        : null;

  const isDarkTheme =
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";

  const leftRail = useMemo(
    () => (
      <LeftRail
        lists={lists}
        selectedListKey={selectedListKey}
        showListSelector
        collapsed={navCollapsed}
        themeMode={themeMode}
        onToggleCollapsed={() => {
          setNavCollapsed((prev) => {
            const next = !prev;
            persistNavCollapsed(next);
            return next;
          });
        }}
        onSelectList={(listKey) => {
          router.push(getThreadsPath(listKey));
          setMobileNavOpen(false);
        }}
        onThemeModeChange={(nextTheme) => {
          persistThemeMode(nextTheme);
          setThemeMode(nextTheme);
        }}
      />
    ),
    [lists, navCollapsed, router, selectedListKey, themeMode],
  );

  const centerPane = (
    <section className="thread-list-pane">
      <header className="pane-header">
        <div>
          <p className="pane-kicker">Diff Files</p>
          <h1>{patchItem ? `Patch ${patchItem.patch_item_id}` : "Patch"}</h1>
        </div>
        <p className="pane-meta">{files.length} files</p>
      </header>

      <ul className="thread-list" role="listbox" aria-label="Patch files">
        {centerError && !files.length ? (
          <li className="pane-empty-list-row pane-empty-list-row-error">{centerError}</li>
        ) : centerLoading && !files.length ? (
          <li className="pane-empty-list-row">Loading patch files…</li>
        ) : files.length ? (
          files.map((file) => (
            <li key={file.path}>
              <button
                type="button"
                className={`thread-row ${resolvedSelectedPath === file.path && viewMode === "file" ? "is-selected" : ""}`}
                onClick={() => {
                  setSelectedPath(file.path);
                  setViewMode("file");
                  updateQuery({ path: file.path, view: "file" });
                }}
              >
                <div className="thread-row-main">
                  <p className="thread-subject">{file.path}</p>
                  <p className="thread-snippet">
                    {file.change_type} · hunks {file.hunks}
                  </p>
                </div>
                <div className="thread-row-meta">
                  <span>+{file.additions}</span>
                  <span>-{file.deletions}</span>
                </div>
              </button>
            </li>
          ))
        ) : (
          <li className="pane-empty-list-row">No files found for this patch.</li>
        )}
      </ul>
    </section>
  );

  const detailPane = (
    <section className="thread-detail-pane">
      <header className="pane-header">
        <div>
          <p className="pane-kicker">Patch Detail</p>
          <h2>{patchItem?.subject ?? "Patch detail"}</h2>
        </div>
        <p className="pane-meta">#{patchItem?.ordinal ?? "-"}</p>
      </header>

      <div className="series-detail-body">
        <div className="inline-controls">
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setViewMode("full");
              updateQuery({ view: "full" });
            }}
          >
            Full Diff
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setViewMode("file");
              updateQuery({ view: "file" });
            }}
          >
            File Diff
          </button>
        </div>

        <p className="muted">
          Stats: +{patchItem?.additions ?? 0} / -{patchItem?.deletions ?? 0} · hunks {patchItem?.hunks ?? 0}
        </p>

        {detailLoading ? <p className="pane-inline-status">Loading diff…</p> : null}
        {detailError ? <p className="error-text">{detailError}</p> : null}

        {viewMode === "full" && fullDiff ? (
          <MessageDiffViewer
            messageId={patchItem?.message_id ?? patchItemId}
            diffText={fullDiff}
            isDarkTheme={isDarkTheme}
          />
        ) : null}

        {viewMode === "file" && resolvedSelectedPath && selectedFileDiff ? (
          <MessageDiffViewer
            messageId={patchItem?.message_id ?? patchItemId}
            diffText={selectedFileDiff}
            isDarkTheme={isDarkTheme}
          />
        ) : null}

        {viewMode === "file" && !resolvedSelectedPath ? (
          <PaneEmptyState
            kicker="Diff"
            title="Select a file"
            description="Pick a file from the list to load its diff slice."
          />
        ) : null}
      </div>
    </section>
  );

  if (isDesktop) {
    return (
      <AppShell
        navCollapsed={navCollapsed}
        centerWidth={420}
        leftRail={leftRail}
        centerPane={centerPane}
        detailPane={detailPane}
        onCenterResizeStart={(event) => event.preventDefault()}
      />
    );
  }

  return (
    <MobileStackRouter
      showDetail={Boolean(resolvedSelectedPath) || viewMode === "full"}
      navOpen={mobileNavOpen}
      onOpenNav={() => setMobileNavOpen(true)}
      onCloseNav={() => setMobileNavOpen(false)}
      onBackToList={() => {
        setSelectedPath(null);
        setViewMode("file");
      }}
      leftRail={leftRail}
      listPane={centerPane}
      detailPane={detailPane}
    />
  );
}
