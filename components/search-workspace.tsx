"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LeftRail } from "@/components/left-rail";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import type { ListSummary, SearchResponse, SearchScope } from "@/lib/api/contracts";
import { mergeSearchParams } from "@/lib/ui/query-state";
import {
  applyVisualTheme,
  getStoredNavCollapsed,
  getStoredThemeMode,
  persistNavCollapsed,
  persistThemeMode,
  type ThemeMode,
} from "@/lib/ui/preferences";
import { useDesktopViewport } from "@/lib/ui/use-desktop-viewport";

interface SearchWorkspaceQuery {
  q: string;
  scope: SearchScope;
  listKey: string;
  author: string;
  from: string;
  to: string;
  hasDiff: "" | "true" | "false";
  sort: "relevance" | "date_desc" | "date_asc";
  hybrid: boolean;
  semanticRatio: number;
}

interface SearchWorkspaceProps {
  lists: ListSummary[];
  query: SearchWorkspaceQuery;
  results: SearchResponse;
}

const SCOPE_TABS: Array<{ scope: SearchScope; label: string }> = [
  { scope: "thread", label: "Threads" },
  { scope: "series", label: "Series" },
  { scope: "patch_item", label: "Patches" },
];

export function SearchWorkspace({
  lists,
  query,
  results,
}: SearchWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useDesktopViewport(true);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    typeof window === "undefined" ? "system" : getStoredThemeMode(),
  );
  const [navCollapsed, setNavCollapsed] = useState(() =>
    typeof window === "undefined" ? false : getStoredNavCollapsed(),
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    applyVisualTheme(themeMode);
  }, [themeMode]);

  const pushSearch = (updates: Record<string, string | null | undefined>) => {
    const next = mergeSearchParams(new URLSearchParams(searchParams.toString()), updates);
    router.push(`/search${next}`);
  };

  const scopeTabs = SCOPE_TABS.map((tab) => (
    <button
      key={tab.scope}
      type="button"
      className={`search-tab ${query.scope === tab.scope ? "is-active" : ""}`}
      onClick={() =>
        pushSearch({
          scope: tab.scope,
          cursor: null,
          hybrid: tab.scope === "patch_item" ? null : query.hybrid ? "true" : null,
          semantic_ratio: tab.scope === "patch_item" ? null : String(query.semanticRatio),
        })
      }
    >
      {tab.label}
    </button>
  ));

  const listFilterValue = query.listKey || "";
  const hasDiffValue = query.hasDiff;
  const hybridAvailable = query.scope !== "patch_item";
  const resolveSearchRoute = (item: SearchResponse["items"][number]): string => {
    const preferredListKey =
      query.listKey ||
      (typeof item.metadata.list_key === "string" ? item.metadata.list_key : "") ||
      item.list_keys[0] ||
      "";
    const listPrefix = preferredListKey ? `/${encodeURIComponent(preferredListKey)}` : "";

    if (item.scope === "thread") {
      const legacyThreadMatch = item.route.match(/^\/lists\/([^/]+)\/threads(\/\d+)?$/);
      if (legacyThreadMatch) {
        const [, listKey, suffix = ""] = legacyThreadMatch;
        return `/${encodeURIComponent(listKey)}/threads${suffix}`;
      }
      if (item.route === "/threads" || /^\/[^/]+\/threads(?:\/\d+)?$/.test(item.route)) {
        return item.route;
      }
      if (Number.isFinite(item.id) && preferredListKey) {
        return `${listPrefix}/threads/${item.id}`;
      }
      return "/threads";
    }

    if (item.scope === "series") {
      const legacySeriesMatch = item.route.match(/^\/series\/(\d+)$/);
      if (legacySeriesMatch) {
        const [, seriesId] = legacySeriesMatch;
        return preferredListKey ? `${listPrefix}/series/${seriesId}` : "/series";
      }
      if (item.route === "/series" || /^\/[^/]+\/series(?:\/\d+)?$/.test(item.route)) {
        return item.route;
      }
      if (Number.isFinite(item.id) && preferredListKey) {
        return `${listPrefix}/series/${item.id}`;
      }
      return "/series";
    }

    return item.route;
  };

  const leftRail = (
    <LeftRail
      lists={lists}
      selectedListKey={null}
      showListSelector={false}
      collapsed={navCollapsed}
      themeMode={themeMode}
      onToggleCollapsed={() => {
        setNavCollapsed((prev) => {
          const next = !prev;
          persistNavCollapsed(next);
          return next;
        });
      }}
      onSelectList={() => {
        // List selector is hidden in search mode.
      }}
      onThemeModeChange={(nextTheme) => {
        persistThemeMode(nextTheme);
        setThemeMode(nextTheme);
      }}
    />
  );

  const centerPane = (
    <section className="search-pane">
      <header className="pane-header">
        <div>
          <p className="pane-kicker">Advanced Search</p>
          <h1>Thread, Series, and Patch Search</h1>
        </div>
      </header>

      <div className="search-body">
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            pushSearch({
              q: String(formData.get("q") ?? "").trim() || null,
              scope: String(formData.get("scope") ?? "thread"),
              list_key: String(formData.get("list_key") ?? ""),
              author: String(formData.get("author") ?? "").trim() || null,
              from: String(formData.get("from") ?? "").trim() || null,
              to: String(formData.get("to") ?? "").trim() || null,
              has_diff: String(formData.get("has_diff") ?? ""),
              sort: String(formData.get("sort") ?? "relevance"),
              hybrid:
                hybridAvailable && String(formData.get("hybrid") ?? "") === "true"
                  ? "true"
                  : null,
              semantic_ratio:
                hybridAvailable && String(formData.get("hybrid") ?? "") === "true"
                  ? String(formData.get("semantic_ratio") ?? "0.35")
                  : null,
              cursor: null,
            });
          }}
        >
          <div className="search-tabs">
            {scopeTabs}
            <input type="hidden" name="scope" value={query.scope} />
          </div>

          <div className="search-grid">
            <label>
              Query
              <input name="q" defaultValue={query.q} placeholder="Search text" />
            </label>
            <label>
              List
              <select name="list_key" defaultValue={listFilterValue}>
                <option value="">All lists</option>
                {lists.map((list) => (
                  <option key={list.list_key} value={list.list_key}>
                    {list.list_key}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Author
              <input name="author" defaultValue={query.author} placeholder="dev@example.com" />
            </label>
            <label>
              From
              <input name="from" type="date" defaultValue={query.from} />
            </label>
            <label>
              To
              <input name="to" type="date" defaultValue={query.to} />
            </label>
            <label>
              Has Diff
              <select name="has_diff" defaultValue={hasDiffValue}>
                <option value="">Any</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label>
              Sort
              <select name="sort" defaultValue={query.sort}>
                <option value="relevance">Relevance</option>
                <option value="date_desc">Newest first</option>
                <option value="date_asc">Oldest first</option>
              </select>
            </label>
            <label>
              Hybrid
              <select
                name="hybrid"
                defaultValue={query.hybrid ? "true" : "false"}
                disabled={!hybridAvailable}
              >
                <option value="false">Off (lexical)</option>
                <option value="true">On (hybrid)</option>
              </select>
            </label>
            <label>
              Semantic Ratio
              <input
                name="semantic_ratio"
                type="number"
                min={0}
                max={1}
                step={0.05}
                defaultValue={query.semanticRatio}
                disabled={!hybridAvailable}
              />
            </label>
          </div>

          <div className="search-actions">
            <button type="submit" className="ghost-button">
              Search
            </button>
            {results.next_cursor ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => pushSearch({ cursor: results.next_cursor })}
              >
                Next page
              </button>
            ) : null}
          </div>
        </form>

        <ul className="search-results">
          {results.items.map((item) => (
            <li key={`${item.scope}:${item.id}`} className="search-result-card">
              <div className="search-result-head">
                <span className="badge">{item.scope}</span>
                <Link href={resolveSearchRoute(item)} className="search-result-title">
                  {item.title}
                </Link>
              </div>
              {item.snippet ? <p className="thread-snippet">{item.snippet}</p> : null}
              <p className="thread-timestamps">
                {item.date_utc ?? "unknown date"}
                {item.author_email ? ` · ${item.author_email}` : ""}
                {item.list_keys.length ? ` · ${item.list_keys.join(", ")}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );

  const detailPane = (
    <section className="search-facets-pane">
      <header className="pane-header">
        <div>
          <p className="pane-kicker">Facets</p>
          <h2>Current Distribution</h2>
        </div>
      </header>
      <div className="search-facets-body">
        <pre>{JSON.stringify(results.facets, null, 2)}</pre>
      </div>
    </section>
  );

  if (isDesktop) {
    return (
      <AppShell
        navCollapsed={navCollapsed}
        centerWidth={480}
        leftRail={leftRail}
        centerPane={centerPane}
        detailPane={detailPane}
        onCenterResizeStart={(event) => event.preventDefault()}
      />
    );
  }

  return (
    <MobileStackRouter
      showDetail={false}
      navOpen={mobileNavOpen}
      onOpenNav={() => setMobileNavOpen(true)}
      onCloseNav={() => setMobileNavOpen(false)}
      onBackToList={() => setMobileNavOpen(false)}
      leftRail={leftRail}
      listPane={centerPane}
      detailPane={centerPane}
    />
  );
}
