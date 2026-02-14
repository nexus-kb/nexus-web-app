"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LeftRail } from "@/components/left-rail";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import {
  createNexusApiAdapter,
  resolveNexusApiClientRuntimeConfig,
  type NexusApiRuntimeConfig,
} from "@/lib/api";
import type {
  ListSummary,
  PatchItemDetailResponse,
  PatchItemFile,
} from "@/lib/api/contracts";
import { mergeSearchParams } from "@/lib/ui/query-state";
import {
  applyVisualTheme,
  parseNavMode,
  parseThemeMode,
  STORAGE_KEYS,
  type ThemeMode,
} from "@/lib/ui/preferences";

interface DiffWorkspaceProps {
  lists: ListSummary[];
  selectedListKey: string;
  patchItem: PatchItemDetailResponse;
  files: PatchItemFile[];
  initialTheme: string | undefined;
  initialNav: string | undefined;
  initialPath: string | undefined;
  initialView: string | undefined;
  apiConfig: NexusApiRuntimeConfig;
}

export function DiffWorkspace({
  lists,
  selectedListKey,
  patchItem,
  files,
  initialTheme,
  initialNav,
  initialPath,
  initialView,
  apiConfig,
}: DiffWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const runtimeApiConfig = useMemo(() => resolveNexusApiClientRuntimeConfig(apiConfig), [apiConfig]);
  const adapter = useMemo(() => createNexusApiAdapter(runtimeApiConfig), [runtimeApiConfig]);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return parseThemeMode(initialTheme);
    }
    return parseThemeMode(initialTheme ?? localStorage.getItem(STORAGE_KEYS.theme) ?? undefined);
  });
  const [navCollapsed, setNavCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return parseNavMode(initialNav) === "collapsed";
    }
    return parseNavMode(initialNav ?? localStorage.getItem(STORAGE_KEYS.nav) ?? undefined) === "collapsed";
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [selectedPath, setSelectedPath] = useState<string | null>(initialPath ?? null);
  const [viewMode, setViewMode] = useState<"file" | "full">(initialView === "full" ? "full" : "file");
  const [fileDiffs, setFileDiffs] = useState<Record<string, string>>({});
  const [fullDiff, setFullDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    applyVisualTheme(themeMode);
  }, [themeMode]);

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const nextQuery = mergeSearchParams(new URLSearchParams(searchParams.toString()), updates);
      router.replace(`${pathname}${nextQuery}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError(null);
      if (viewMode === "full") {
        if (fullDiff) {
          return;
        }
        setLoading(true);
        try {
          const response = await adapter.getPatchItemFullDiff(patchItem.patch_item_id);
          if (!cancelled) {
            setFullDiff(response.diff_text);
          }
        } catch (loadError) {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : "Failed to load full diff");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
        return;
      }

      if (!selectedPath) {
        return;
      }

      if (fileDiffs[selectedPath]) {
        return;
      }

      setLoading(true);
      try {
        const response = await adapter.getPatchItemFileDiff({
          patchItemId: patchItem.patch_item_id,
          path: selectedPath,
        });
        if (!cancelled) {
          setFileDiffs((prev) => ({ ...prev, [selectedPath]: response.diff_text }));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load file diff");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [adapter, fileDiffs, fullDiff, patchItem.patch_item_id, selectedPath, viewMode]);

  const selectedFileDiff = selectedPath ? fileDiffs[selectedPath] : null;

  const leftRail = (
    <LeftRail
      lists={lists}
      selectedListKey={selectedListKey}
      collapsed={navCollapsed}
      themeMode={themeMode}
      onToggleCollapsed={() => {
        setNavCollapsed((prev) => {
          const next = !prev;
          localStorage.setItem(STORAGE_KEYS.nav, next ? "collapsed" : "expanded");
          updateQuery({ nav: next ? "collapsed" : "expanded" });
          return next;
        });
      }}
      onSelectList={(listKey) => {
        router.push(`/lists/${encodeURIComponent(listKey)}/threads`);
        setMobileNavOpen(false);
      }}
      onThemeModeChange={(nextTheme) => {
        localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
        setThemeMode(nextTheme);
        updateQuery({ theme: nextTheme });
      }}
    />
  );

  const centerPane = (
    <section className="thread-list-pane">
      <header className="pane-header">
        <div>
          <p className="pane-kicker">Diff Files</p>
          <h1>Patch {patchItem.patch_item_id}</h1>
        </div>
        <p className="pane-meta">{files.length} files</p>
      </header>

      <ul className="thread-list" role="listbox" aria-label="Patch files">
        {files.map((file) => (
          <li key={file.path}>
            <button
              type="button"
              className={`thread-row ${selectedPath === file.path && viewMode === "file" ? "is-selected" : ""}`}
              onClick={() => {
                setSelectedPath(file.path);
                setViewMode("file");
                updateQuery({ path: file.path, view: "file" });
              }}
            >
              <div className="thread-row-main">
                <p className="thread-subject">{file.path}</p>
                <p className="thread-snippet">{file.change_type} · hunks {file.hunks}</p>
              </div>
              <div className="thread-row-meta">
                <span>+{file.additions}</span>
                <span>-{file.deletions}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  const detailPane = (
    <section className="thread-detail-pane">
      <header className="pane-header">
        <div>
          <p className="pane-kicker">Patch Detail</p>
          <h2>{patchItem.subject}</h2>
        </div>
        <p className="pane-meta">#{patchItem.ordinal}</p>
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
          <a
            className="ghost-button"
            href={adapter.getMessageRawUrl(patchItem.message_id)}
            target="_blank"
            rel="noreferrer"
          >
            Message raw
          </a>
        </div>

        <p className="muted">Stats: +{patchItem.additions} / -{patchItem.deletions} · hunks {patchItem.hunks}</p>

        {loading ? <p className="muted">Loading diff…</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {viewMode === "full" && fullDiff ? <pre className="diff-block">{fullDiff}</pre> : null}
        {viewMode === "file" && selectedPath && selectedFileDiff ? <pre className="diff-block">{selectedFileDiff}</pre> : null}
        {viewMode === "file" && !selectedPath ? <p className="muted">Select a file to load its diff slice.</p> : null}
      </div>
    </section>
  );

  return (
    <>
      <AppShell
        navCollapsed={navCollapsed}
        centerWidth={420}
        leftRail={leftRail}
        centerPane={centerPane}
        detailPane={detailPane}
        onCenterResizeStart={(event) => event.preventDefault()}
      />

      <MobileStackRouter
        showDetail={Boolean(selectedPath) || viewMode === "full"}
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
    </>
  );
}
