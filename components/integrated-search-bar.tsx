"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { DateRangeField } from "@/components/date-range-field";
import type {
  IntegratedSearchDefaults,
  IntegratedSearchQuery,
  IntegratedSearchUpdates,
} from "@/lib/ui/search-query";
import {
  buildIntegratedSearchUpdates,
  clearIntegratedSearchUpdates,
} from "@/lib/ui/search-query";

interface IntegratedSearchBarProps {
  scope: "thread" | "series";
  query: IntegratedSearchQuery;
  defaults: IntegratedSearchDefaults;
  onApply: (updates: IntegratedSearchUpdates) => void;
  onClear: (updates: IntegratedSearchUpdates) => void;
}

interface SearchDraft {
  q: string;
  listKey: string;
  author: string;
  from: string;
  to: string;
  datePreset: DatePreset;
  hasDiff: "" | "true" | "false";
  sort: "relevance" | "date_desc" | "date_asc";
  hybrid: boolean;
  semanticRatio: number;
}

type DatePreset = "custom" | "7d" | "14d" | "30d" | "90d" | "180d" | "365d" | "730d";

const DATE_PRESET_DAYS: ReadonlyArray<{ value: DatePreset; label: string; days: number }> = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "14d", label: "Last 14 days", days: 14 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "180d", label: "Last 180 days", days: 180 },
  { value: "365d", label: "Last year", days: 365 },
  { value: "730d", label: "Last 2 years", days: 730 },
];

function parseDate(value: string): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function toDateString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayStart(): Date {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function getDaySpan(from: string, to: string): number | null {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) {
    return null;
  }
  const millis = Math.abs(end.getTime() - start.getTime());
  return Math.floor(millis / (1000 * 60 * 60 * 24)) + 1;
}

function matchesToday(value: string): boolean {
  return value === toDateString(getTodayStart());
}

function getDatePreset(from: string, to: string): DatePreset {
  if (!from || !to || !matchesToday(to)) {
    return "custom";
  }

  const span = getDaySpan(from, to);
  if (!span) {
    return "custom";
  }

  const preset = DATE_PRESET_DAYS.find((candidate) => candidate.days === span);
  return preset?.value ?? "custom";
}

function buildRangeFromPreset(value: DatePreset): { from: string; to: string } | null {
  const preset = DATE_PRESET_DAYS.find((candidate) => candidate.value === value);
  if (!preset) {
    return null;
  }

  const end = getTodayStart();
  const start = new Date(end);
  start.setDate(end.getDate() - (preset.days - 1));

  return {
    from: toDateString(start),
    to: toDateString(end),
  };
}

function formatDateBadge(from: string, to: string): string {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) {
    return "Custom date";
  }
  const span = getDaySpan(from, to);
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const fromLabel = fmt.format(start);
  const toLabel = fmt.format(end);
  return span ? `${fromLabel} - ${toLabel} (${span}d)` : `${fromLabel} - ${toLabel}`;
}

function shortenEmail(value: string): string {
  if (value.length <= 18) {
    return value;
  }
  const [local, domain] = value.split("@");
  if (!domain) {
    return `${value.slice(0, 15)}...`;
  }
  const shortLocal = local.length > 8 ? `${local.slice(0, 8)}...` : local;
  return `${shortLocal}@${domain}`;
}

function clampSemanticRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.35;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return Number(value.toFixed(2));
}

function makeDraft(query: IntegratedSearchQuery, defaults: IntegratedSearchDefaults): SearchDraft {
  return {
    q: query.q,
    listKey: query.list_key || defaults.list_key,
    author: query.author,
    from: query.from,
    to: query.to,
    datePreset: getDatePreset(query.from, query.to),
    hasDiff: query.has_diff,
    sort: query.sort,
    hybrid: query.hybrid,
    semanticRatio: query.hybrid ? clampSemanticRatio(query.semantic_ratio) : 0,
  };
}

function createUpdates(draft: SearchDraft, defaults: IntegratedSearchDefaults): IntegratedSearchUpdates {
  const formData = new FormData();
  formData.set("q", draft.q);
  formData.set("list_key", draft.listKey);
  formData.set("author", draft.author);
  formData.set("from", draft.from);
  formData.set("to", draft.to);
  formData.set("has_diff", draft.hasDiff);
  formData.set("sort", draft.sort);
  if (draft.hybrid) {
    formData.set("hybrid", "on");
    formData.set("semantic_ratio", String(draft.semanticRatio));
  }
  return buildIntegratedSearchUpdates(formData, defaults);
}

function draftsEqual(a: SearchDraft, b: SearchDraft): boolean {
  return (
    a.q === b.q &&
    a.listKey === b.listKey &&
    a.author === b.author &&
    a.from === b.from &&
    a.to === b.to &&
    a.datePreset === b.datePreset &&
    a.hasDiff === b.hasDiff &&
    a.sort === b.sort &&
    a.hybrid === b.hybrid &&
    a.semanticRatio === b.semanticRatio
  );
}

type BadgeId = "list" | "author" | "date" | "has_diff" | "hybrid";
const BADGE_REMOVE_MS = 120;
const DEFAULT_HYBRID_RATIO = 0.35;

interface SearchBadge {
  id: BadgeId;
  label: string;
}

function getBadgeTextClassName(badgeId: BadgeId): string {
  if (badgeId === "hybrid") {
    return "integrated-search-badge-text is-hybrid is-hybrid-bump";
  }
  return "integrated-search-badge-text";
}

export function IntegratedSearchBar({
  scope,
  query,
  defaults,
  onApply,
  onClear,
}: IntegratedSearchBarProps) {
  const [draft, setDraft] = useState(() => makeDraft(query, defaults));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [removingBadgeIds, setRemovingBadgeIds] = useState<Set<BadgeId>>(new Set());
  const removalTimersRef = useRef<Map<BadgeId, ReturnType<typeof setTimeout>>>(new Map());
  const clearRemovalTimers = () => {
    for (const timer of removalTimersRef.current.values()) {
      clearTimeout(timer);
    }
    removalTimersRef.current.clear();
  };

  useEffect(() => {
    const nextDraft = makeDraft(query, defaults);
    // Intentional sync: URL/query updates should refresh local form state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft((prev) => (draftsEqual(prev, nextDraft) ? prev : nextDraft));
  }, [defaults, query]);

  useEffect(() => {
    const timers = removalTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const clearAll = () => {
    clearRemovalTimers();
    setRemovingBadgeIds(new Set());
    const cleared = clearIntegratedSearchUpdates();
    setDraft({
      q: "",
      listKey: defaults.list_key,
      author: "",
      from: "",
      to: "",
      datePreset: "custom",
      hasDiff: "",
      sort: "relevance",
      hybrid: false,
      semanticRatio: 0,
    });
    setFiltersOpen(false);
    onClear(cleared);
  };

  const badges = useMemo(() => {
    const nextBadges: SearchBadge[] = [];
    const makeBadge = (id: BadgeId, label: string): SearchBadge => ({ id, label });

    if (draft.listKey && draft.listKey !== defaults.list_key) {
      nextBadges.push(makeBadge("list", `List ${draft.listKey}`));
    }
    if (draft.author) {
      nextBadges.push(makeBadge("author", `By ${shortenEmail(draft.author)}`));
    }
    if (draft.from || draft.to) {
      nextBadges.push(makeBadge("date", formatDateBadge(draft.from, draft.to)));
    }
    if (draft.hasDiff === "true") {
      nextBadges.push(makeBadge("has_diff", "Diff"));
    }
    if (draft.hasDiff === "false") {
      nextBadges.push(makeBadge("has_diff", "No diff"));
    }
    if (draft.hybrid) {
      nextBadges.push(makeBadge("hybrid", `Hybrid ${Math.round(draft.semanticRatio * 100)}%`));
    }
    return nextBadges;
  }, [defaults.list_key, draft]);

  const applyDraft = (nextDraft: SearchDraft) => {
    onApply(createUpdates(nextDraft, defaults));
  };

  const updateDraft = (nextDraft: SearchDraft, autoApply = false) => {
    setDraft(nextDraft);
    if (autoApply) {
      applyDraft(nextDraft);
    }
  };

  const removeBadgeNow = (badgeId: BadgeId) => {
    const nextDraft = { ...draft };
    if (badgeId === "list") {
      nextDraft.listKey = defaults.list_key;
    }
    if (badgeId === "author") {
      nextDraft.author = "";
    }
    if (badgeId === "date") {
      nextDraft.from = "";
      nextDraft.to = "";
      nextDraft.datePreset = "custom";
    }
    if (badgeId === "has_diff") {
      nextDraft.hasDiff = "";
    }
    if (badgeId === "hybrid") {
      nextDraft.hybrid = false;
      nextDraft.semanticRatio = 0;
    }

    updateDraft(nextDraft, true);
  };

  const removeBadge = (badgeId: BadgeId) => {
    if (removalTimersRef.current.has(badgeId)) {
      return;
    }

    setRemovingBadgeIds((prev) => {
      const next = new Set(prev);
      next.add(badgeId);
      return next;
    });

    const timer = setTimeout(() => {
      removalTimersRef.current.delete(badgeId);
      setRemovingBadgeIds((prev) => {
        const next = new Set(prev);
        next.delete(badgeId);
        return next;
      });
      removeBadgeNow(badgeId);
    }, BADGE_REMOVE_MS);

    removalTimersRef.current.set(badgeId, timer);
  };

  return (
    <form
      className={`integrated-search-form ${filtersOpen ? "is-open" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        applyDraft(draft);
      }}
    >
      <div className="integrated-search-shell">
        <div className="integrated-search-row">
          <div className="integrated-search-input-wrap">
            <button
              type="submit"
              className="integrated-search-submit-icon"
              aria-label="Run search"
              title="Run search"
            >
              <Search className="integrated-search-input-icon" size={14} aria-hidden="true" />
            </button>
            <input
              name="q"
              className="integrated-search-input"
              value={draft.q}
              onChange={(event) => updateDraft({ ...draft, q: event.target.value })}
              placeholder="Search text"
              aria-label="Search query"
            />
            <button
              type="button"
              className="integrated-search-filter-icon"
              onClick={() => {
                setFiltersOpen((prev) => !prev);
              }}
              aria-label="Filters"
              title="Filters"
              aria-expanded={filtersOpen}
              aria-controls={`integrated-filters-${scope}`}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="integrated-search-input-clear"
              onClick={clearAll}
              aria-label="Clear search and filters"
              title="Clear search and filters"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
        {badges.length ? (
          <div className="integrated-search-toolbar">
            <div className="integrated-search-chip-row" aria-live="polite">
              {badges.map((badge) => (
                <span
                  key={badge.id}
                  className={`integrated-search-badge ${removingBadgeIds.has(badge.id) ? "is-removing" : ""}`}
                >
                  <span
                    key={badge.id === "hybrid" ? badge.label : badge.id}
                    className={getBadgeTextClassName(badge.id)}
                  >
                    {badge.label}
                  </span>
                  <button
                    type="button"
                    className="integrated-search-badge-remove"
                    onClick={() => removeBadge(badge.id)}
                    aria-label={`Remove filter ${badge.label}`}
                    disabled={removingBadgeIds.has(badge.id)}
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={`integrated-search-filters-panel ${filtersOpen ? "is-open" : ""}`}
          aria-hidden={!filtersOpen}
        >
          <div
            id={`integrated-filters-${scope}`}
            className={`integrated-search-filters ${filtersOpen ? "is-open" : ""}`}
          >
            <div className="integrated-date-row">
              <label className="integrated-date-preset">
                <span>Quick range</span>
                <select
                  name="date_preset"
                  value={draft.datePreset}
                  onChange={(event) => {
                    const value = event.target.value as DatePreset;
                    if (value === "custom") {
                      updateDraft({ ...draft, datePreset: "custom" });
                      return;
                    }
                    const nextRange = buildRangeFromPreset(value);
                    if (!nextRange) {
                      return;
                    }
                    updateDraft(
                      {
                        ...draft,
                        datePreset: value,
                        from: nextRange.from,
                        to: nextRange.to,
                      },
                      true,
                    );
                  }}
                >
                  <option value="custom">Custom</option>
                  {DATE_PRESET_DAYS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="integrated-range-group">
                <span>Date range</span>
                <DateRangeField
                  from={draft.from}
                  to={draft.to}
                  onChange={({ from, to }) => {
                    const nextDraft = {
                      ...draft,
                      from,
                      to,
                      datePreset: getDatePreset(from, to),
                    };
                    updateDraft(nextDraft, true);
                  }}
                />
              </label>
            </div>

            <label className="integrated-author-field">
              <span>Author</span>
              <input
                name="author"
                value={draft.author}
                onChange={(event) => updateDraft({ ...draft, author: event.target.value })}
                onBlur={(event) => updateDraft({ ...draft, author: event.target.value }, true)}
                placeholder="dev@example.com"
              />
            </label>

            <div className="integrated-filter-field">
              <span>Has diff</span>
              <div className="integrated-segmented" aria-label="Has diff filter">
                <label>
                  <input
                    type="radio"
                    name="has_diff"
                    value=""
                    checked={draft.hasDiff === ""}
                    onChange={() => updateDraft({ ...draft, hasDiff: "" }, true)}
                  />
                  <span>Any</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="has_diff"
                    value="true"
                    checked={draft.hasDiff === "true"}
                    onChange={() => updateDraft({ ...draft, hasDiff: "true" }, true)}
                  />
                  <span>Yes</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="has_diff"
                    value="false"
                    checked={draft.hasDiff === "false"}
                    onChange={() => updateDraft({ ...draft, hasDiff: "false" }, true)}
                  />
                  <span>No</span>
                </label>
              </div>
            </div>

            <label>
              <span>Sort type</span>
              <select
                name="sort_type"
                value={draft.sort === "relevance" ? "relevance" : "recent"}
                onChange={(event) => {
                  const sortType = event.target.value;
                  if (sortType === "relevance") {
                    updateDraft({ ...draft, sort: "relevance" }, true);
                    return;
                  }
                  const nextSort = draft.sort === "date_asc" ? "date_asc" : "date_desc";
                  updateDraft({ ...draft, sort: nextSort }, true);
                }}
              >
                <option value="relevance">Relevance</option>
                <option value="recent">Recent (date)</option>
              </select>
            </label>

            <div className="integrated-filter-field integrated-hybrid-field">
              <span>Hybrid ranking</span>
              <div className={`integrated-hybrid-card ${draft.hybrid ? "is-hybrid" : ""}`}>
                <div className="integrated-hybrid-inline">
                  <div className="integrated-hybrid-mode" role="group" aria-label="Hybrid mode">
                    <button
                      type="button"
                      className={!draft.hybrid ? "is-active" : ""}
                      onClick={() =>
                        updateDraft({ ...draft, hybrid: false, semanticRatio: 0 }, true)}
                    >
                      Keyword
                    </button>
                    <button
                      type="button"
                      className={draft.hybrid ? "is-active" : ""}
                      onClick={() =>
                        updateDraft(
                          {
                            ...draft,
                            hybrid: true,
                            semanticRatio:
                              draft.semanticRatio > 0 ? draft.semanticRatio : DEFAULT_HYBRID_RATIO,
                          },
                          true,
                        )}
                    >
                      Hybrid
                    </button>
                  </div>
                  <input
                    aria-label="Semantic weight"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={draft.semanticRatio}
                    onChange={(event) => {
                      const semanticRatio = clampSemanticRatio(Number(event.target.value));
                      updateDraft(
                        {
                          ...draft,
                          semanticRatio,
                          hybrid: semanticRatio > 0,
                        },
                        true,
                      );
                    }}
                  />
                  <output className="integrated-hybrid-value">
                    {Math.round(draft.semanticRatio * 100)}%
                  </output>
                </div>
                <input name="semantic_ratio" type="hidden" value={draft.semanticRatio} />
              </div>
            </div>
          </div>
          <input type="hidden" name="list_key" value={draft.listKey || defaults.list_key} />
        </div>
      </div>
    </form>
  );
}
