"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LeftRail } from "@/components/left-rail";
import { MobileStackRouter } from "@/components/mobile-stack-router";
import { queryKeys } from "@/lib/api/query-keys";
import { getLists, getSearch } from "@/lib/api/server-client";
import type { SearchScope } from "@/lib/api/contracts";
import { mergeSearchParams } from "@/lib/ui/query-state";
import {
  parseIntegratedSearchParams,
} from "@/lib/ui/search-query";
import { useRouter, useSearchParams } from "@/lib/ui/navigation";
import {
  applyVisualTheme,
  getStoredNavCollapsed,
  getStoredThemeMode,
  persistNavCollapsed,
  persistThemeMode,
  type ThemeMode,
} from "@/lib/ui/preferences";
import {
  resolveSeriesSearchRoute,
  resolveThreadSearchRoute,
} from "@/lib/ui/routes";
import { useDesktopViewport } from "@/lib/ui/use-desktop-viewport";

const SCOPE_TABS: Array<{ scope: SearchScope; label: string }> = [
  { scope: "thread", label: "Threads" },
  { scope: "series", label: "Series" },
  { scope: "patch_item", label: "Patches" },
];

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
  cursor: string;
}

function parseScope(value: string | null): SearchScope {
  if (value === "thread" || value === "series" || value === "patch_item") {
    return value;
  }
  return "thread";
}

function toSearchQuery(searchParams: URLSearchParams): SearchWorkspaceQuery {
  const record: Record<string, string | undefined> = {};
  for (const [key, value] of searchParams.entries()) {
    if (!(key in record)) {
      record[key] = value;
    }
  }

  const parsed = parseIntegratedSearchParams(record, { list_key: "" });
  return {
    q: parsed.q,
    scope: parseScope(searchParams.get("scope")),
    listKey: parsed.list_key,
    author: parsed.author,
    from: parsed.from,
    to: parsed.to,
    hasDiff: parsed.has_diff,
    sort: parsed.sort,
    hybrid: parsed.hybrid,
    semanticRatio: parsed.semantic_ratio,
    cursor: parsed.cursor,
  };
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

export function SearchWorkspace() {
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

  const query = useMemo(() => toSearchQuery(searchParams), [searchParams]);

  useEffect(() => {
    applyVisualTheme(themeMode);
  }, [themeMode]);

  const listsQuery = useQuery({
    queryKey: queryKeys.lists(),
    queryFn: () => getLists({ page: 1, pageSize: 200 }),
    staleTime: 5 * 60_000,
  });

  const hybridAvailable = query.scope !== "patch_item";
  const searchQuery = useQuery({
    queryKey: queryKeys.search({
      q: query.q,
      scope: query.scope,
      listKey: query.listKey || undefined,
      author: query.author || undefined,
      from: query.from || undefined,
      to: query.to || undefined,
      hasDiff: query.hasDiff === "" ? undefined : query.hasDiff === "true",
      sort: query.sort,
      cursor: query.cursor || undefined,
      limit: 20,
      hybrid: hybridAvailable ? query.hybrid : false,
      semanticRatio: hybridAvailable && query.hybrid ? query.semanticRatio : undefined,
    }),
    enabled: query.q.trim().length > 0,
    placeholderData: keepPreviousData,
    queryFn: () =>
      getSearch({
        q: query.q,
        scope: query.scope,
        listKey: query.listKey || undefined,
        author: query.author || undefined,
        from: query.from || undefined,
        to: query.to || undefined,
        hasDiff: query.hasDiff === "" ? undefined : query.hasDiff === "true",
        sort: query.sort,
        cursor: query.cursor || undefined,
        limit: 20,
        hybrid: hybridAvailable ? query.hybrid : false,
        semanticRatio: hybridAvailable && query.hybrid ? query.semanticRatio : undefined,
      }),
  });

  const lists = listsQuery.data?.items ?? [];
  const results = searchQuery.data ?? {
    items: [],
    facets: {},
    highlights: {},
    next_cursor: null,
  };

  const pushSearch = (updates: Record<string, string | null | undefined>) => {
    const next = mergeSearchParams(new URLSearchParams(searchParams.toString()), updates);
    router.push(`/search${next}`);
  };

  const resolveSearchRoute = (item: (typeof results.items)[number]): string => {
    if (item.scope === "thread") {
      return resolveThreadSearchRoute({
        route: item.route,
        fallbackListKey: query.listKey || null,
        itemId: item.id,
        metadataListKey:
          typeof item.metadata.list_key === "string"
            ? item.metadata.list_key
            : item.list_keys[0] ?? null,
      });
    }

    if (item.scope === "series") {
      return resolveSeriesSearchRoute({
        route: item.route,
        fallbackListKey: query.listKey || null,
        itemId: item.id,
        metadataListKey:
          typeof item.metadata.list_key === "string"
            ? item.metadata.list_key
            : item.list_keys[0] ?? null,
      });
    }

    return item.route;
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
            const requestedScope = String(formData.get("scope") ?? "thread") as SearchScope;
            const requestedHybrid =
              requestedScope !== "patch_item" && String(formData.get("hybrid") ?? "") === "true";

            pushSearch({
              q: String(formData.get("q") ?? "").trim() || null,
              scope: requestedScope,
              list_key: String(formData.get("list_key") ?? ""),
              author: String(formData.get("author") ?? "").trim() || null,
              from: String(formData.get("from") ?? "").trim() || null,
              to: String(formData.get("to") ?? "").trim() || null,
              has_diff: String(formData.get("has_diff") ?? ""),
              sort: String(formData.get("sort") ?? "relevance"),
              hybrid: requestedHybrid ? "true" : null,
              semantic_ratio: requestedHybrid ? String(formData.get("semantic_ratio") ?? "0.35") : null,
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
              <select name="list_key" defaultValue={query.listKey || ""}>
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
              <select name="has_diff" defaultValue={query.hasDiff}>
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

        {searchQuery.isFetching ? <p className="pane-inline-status">Refreshing search results…</p> : null}
        {searchQuery.error ? (
          <p className="error-text">{toErrorMessage(searchQuery.error, "Failed to load search results")}</p>
        ) : null}

        <ul className="search-results">
          {searchQuery.isLoading && !results.items.length ? (
            <li className="pane-empty-list-row">Loading search results…</li>
          ) : results.items.length ? (
            results.items.map((item) => {
              const resolvedRoute = resolveSearchRoute(item);
              return (
                <li key={`${item.scope}:${item.id}`} className="search-result-card">
                  <div className="search-result-head">
                    <span className="badge">{item.scope}</span>
                    <a
                      href={resolvedRoute}
                      className="search-result-title"
                      onClick={(event) => {
                        event.preventDefault();
                        router.push(resolvedRoute);
                      }}
                    >
                      {item.title}
                    </a>
                  </div>
                  {item.snippet ? <p className="thread-snippet">{item.snippet}</p> : null}
                  <p className="thread-timestamps">
                    {item.date_utc ?? "unknown date"}
                    {item.author_email ? ` · ${item.author_email}` : ""}
                    {item.list_keys.length ? ` · ${item.list_keys.join(", ")}` : ""}
                  </p>
                </li>
              );
            })
          ) : query.q.trim().length > 0 ? (
            <li className="pane-empty-list-row">No results found.</li>
          ) : (
            <li className="pane-empty-list-row">Enter a query to run search.</li>
          )}
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
