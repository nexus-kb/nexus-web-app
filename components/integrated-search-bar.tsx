"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, Minus, Search, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
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
  merged: "" | "true" | "false";
  sort: "relevance" | "date_desc" | "date_asc";
  hybrid: boolean;
  semanticRatio: number;
}

type DatePreset = "custom" | "7d" | "14d" | "30d" | "90d" | "180d" | "365d" | "730d";
type BadgeId = "list" | "author" | "date" | "has_diff" | "merged" | "hybrid";

interface SearchBadge {
  id: BadgeId;
  label: string;
}

interface ComposerExtraction {
  consumed: boolean;
  nextDraft: SearchDraft;
}

interface SearchToggleOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

const DEFAULT_HYBRID_RATIO = 0.35;
const MAINLINE_TOGGLE_OPTIONS: ReadonlyArray<SearchToggleOption<SearchDraft["merged"]>> = [
  { value: "false", label: "No", icon: X },
  { value: "", label: "Any", icon: Minus },
  { value: "true", label: "Yes", icon: Check },
] as const;
const HAS_DIFF_TOGGLE_OPTIONS: ReadonlyArray<SearchToggleOption<SearchDraft["hasDiff"]>> = [
  { value: "false", label: "No", icon: X },
  { value: "", label: "Any", icon: Minus },
  { value: "true", label: "Yes", icon: Check },
] as const;

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
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function toDateString(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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
  start.setUTCDate(end.getUTCDate() - (preset.days - 1));

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
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
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
    return DEFAULT_HYBRID_RATIO;
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
    merged: query.merged,
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
  formData.set("merged", draft.merged);
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
    a.merged === b.merged &&
    a.sort === b.sort &&
    a.hybrid === b.hybrid &&
    a.semanticRatio === b.semanticRatio
  );
}

function getBadgeTextClassName(badgeId: BadgeId): string {
  if (badgeId === "hybrid") {
    return "integrated-search-badge-text is-hybrid is-hybrid-bump";
  }
  return "integrated-search-badge-text";
}

function getSearchPlaceholder(scope: IntegratedSearchBarProps["scope"]): string {
  return scope === "series" ? "Search series" : "Search threads";
}

function parseBooleanFilter(rawValue: string): "" | "true" | "false" {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "yes" || normalized === "true" || normalized === "1") {
    return "true";
  }
  if (normalized === "no" || normalized === "false" || normalized === "0") {
    return "false";
  }
  return "";
}

function parseSortFilter(rawValue: string): SearchDraft["sort"] | null {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "relevance") {
    return "relevance";
  }
  if (normalized === "newest" || normalized === "recent" || normalized === "date_desc") {
    return "date_desc";
  }
  if (normalized === "oldest" || normalized === "date_asc") {
    return "date_asc";
  }
  return null;
}

function parseHybridFilter(rawValue: string, currentRatio: number): Pick<SearchDraft, "hybrid" | "semanticRatio"> | null {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "on" || normalized === "true") {
    return {
      hybrid: true,
      semanticRatio: currentRatio > 0 ? clampSemanticRatio(currentRatio) : DEFAULT_HYBRID_RATIO,
    };
  }
  if (normalized === "off" || normalized === "false") {
    return { hybrid: false, semanticRatio: 0 };
  }

  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    return null;
  }
  const semanticRatio = clampSemanticRatio(numeric);
  return {
    hybrid: semanticRatio > 0,
    semanticRatio,
  };
}

function extractComposerTokens(
  input: string,
  scope: IntegratedSearchBarProps["scope"],
  draft: SearchDraft,
): ComposerExtraction {
  const segments = input.trim().split(/\s+/).filter(Boolean);
  if (!segments.length) {
    return {
      consumed: false,
      nextDraft: { ...draft, q: "" },
    };
  }

  let consumed = false;
  const remainingSegments: string[] = [];
  const nextDraft: SearchDraft = { ...draft };

  for (const segment of segments) {
    const separatorIndex = segment.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex === segment.length - 1) {
      remainingSegments.push(segment);
      continue;
    }

    const key = segment.slice(0, separatorIndex).toLowerCase();
    const rawValue = segment.slice(separatorIndex + 1).trim();
    if (!rawValue) {
      remainingSegments.push(segment);
      continue;
    }

    if (key === "from" || key === "to") {
      const parsedDate = parseDate(rawValue);
      if (!parsedDate) {
        remainingSegments.push(segment);
        continue;
      }
      const dateValue = toDateString(parsedDate);
      if (key === "from") {
        nextDraft.from = dateValue;
      } else {
        nextDraft.to = dateValue;
      }
      nextDraft.datePreset = getDatePreset(
        key === "from" ? dateValue : nextDraft.from,
        key === "to" ? dateValue : nextDraft.to,
      );
      consumed = true;
      continue;
    }

    if (key === "diff") {
      const parsed = parseBooleanFilter(rawValue);
      if (!parsed) {
        remainingSegments.push(segment);
        continue;
      }
      nextDraft.hasDiff = parsed;
      consumed = true;
      continue;
    }

    if (key === "sort") {
      const parsed = parseSortFilter(rawValue);
      if (!parsed) {
        remainingSegments.push(segment);
        continue;
      }
      nextDraft.sort = parsed;
      consumed = true;
      continue;
    }

    if (key === "hybrid") {
      const parsed = parseHybridFilter(rawValue, nextDraft.semanticRatio);
      if (!parsed) {
        remainingSegments.push(segment);
        continue;
      }
      nextDraft.hybrid = parsed.hybrid;
      nextDraft.semanticRatio = parsed.semanticRatio;
      consumed = true;
      continue;
    }

    if ((key === "mainline" || key === "merged") && scope === "series") {
      const parsed = parseBooleanFilter(rawValue);
      if (!parsed) {
        remainingSegments.push(segment);
        continue;
      }
      nextDraft.merged = parsed;
      consumed = true;
      continue;
    }

    remainingSegments.push(segment);
  }

  nextDraft.q = remainingSegments.join(" ").trim();
  return { consumed, nextDraft };
}

function joinClassNames(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

function SearchToggleGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<SearchToggleOption<T>>;
  onChange: (value: T) => void;
  className?: string;
}) {
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));

  return (
    <div
      className={joinClassNames("integrated-segmented-toggle", className)}
      role="group"
      aria-label={label}
      style={{ ["--integrated-toggle-index" as string]: String(activeIndex) }}
    >
      <span className="integrated-segmented-toggle-track" aria-hidden="true" />
      <span className="integrated-segmented-toggle-markers" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="integrated-segmented-toggle-thumb" aria-hidden="true" />
      {options.map((option) => {
        const selected = value === option.value;
        const Icon = option.icon;

        return (
          <button
            key={`${label}-${option.value}`}
            type="button"
            className={joinClassNames(
              "integrated-segmented-toggle-button",
              selected && "is-active",
            )}
            aria-pressed={selected}
            aria-label={option.label}
            onClick={() => onChange(option.value)}
          >
            <Icon className="integrated-segmented-toggle-icon" size={14} strokeWidth={2.1} aria-hidden="true" />
            <span className="integrated-sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
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
  const composerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const nextDraft = makeDraft(query, defaults);
    // Intentional sync: URL/query updates should refresh local form state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft((prev) => (draftsEqual(prev, nextDraft) ? prev : nextDraft));
  }, [defaults, query]);

  const badges = useMemo(() => {
    const nextBadges: SearchBadge[] = [];
    const makeBadge = (id: BadgeId, label: string): SearchBadge => ({ id, label });

    if (query.list_key && query.list_key !== defaults.list_key) {
      nextBadges.push(makeBadge("list", `List ${query.list_key}`));
    }
    if (query.author) {
      nextBadges.push(makeBadge("author", `By ${shortenEmail(query.author)}`));
    }
    if (query.from || query.to) {
      nextBadges.push(makeBadge("date", formatDateBadge(query.from, query.to)));
    }
    if (query.has_diff === "true") {
      nextBadges.push(makeBadge("has_diff", "Diff"));
    }
    if (query.has_diff === "false") {
      nextBadges.push(makeBadge("has_diff", "No diff"));
    }
    if (scope === "series" && query.merged === "true") {
      nextBadges.push(makeBadge("merged", "Merged"));
    }
    if (scope === "series" && query.merged === "false") {
      nextBadges.push(makeBadge("merged", "Unmerged"));
    }
    if (query.hybrid) {
      nextBadges.push(makeBadge("hybrid", `Hybrid ${Math.round(query.semantic_ratio * 100)}%`));
    }
    return nextBadges;
  }, [defaults.list_key, query, scope]);

  const applyDraft = (nextDraft: SearchDraft) => {
    onApply(createUpdates(nextDraft, defaults));
  };

  const updateDraft = (nextDraft: SearchDraft, autoApply = false) => {
    setDraft(nextDraft);
    if (autoApply) {
      applyDraft(nextDraft);
    }
  };

  const clearAll = () => {
    const cleared = clearIntegratedSearchUpdates();
    setDraft({
      q: "",
      listKey: defaults.list_key,
      author: "",
      from: "",
      to: "",
      datePreset: "custom",
      hasDiff: "",
      merged: "",
      sort: "relevance",
      hybrid: false,
      semanticRatio: 0,
    });
    setFiltersOpen(false);
    onClear(cleared);
  };

  const removeBadge = (badgeId: BadgeId) => {
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
    if (badgeId === "merged") {
      nextDraft.merged = "";
    }
    if (badgeId === "hybrid") {
      nextDraft.hybrid = false;
      nextDraft.semanticRatio = 0;
    }

    updateDraft(nextDraft, true);
    composerInputRef.current?.focus();
  };

  const commitComposerFilters = () => {
    const extraction = extractComposerTokens(draft.q, scope, draft);
    if (!extraction.consumed) {
      return false;
    }
    updateDraft(extraction.nextDraft, true);
    return true;
  };

  const handleComposerKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && draft.q.length === 0 && badges.length > 0) {
      event.preventDefault();
      const lastBadge = badges[badges.length - 1];
      if (lastBadge) {
        removeBadge(lastBadge.id);
      }
      return;
    }

    if (event.key === "Enter") {
      if (commitComposerFilters()) {
        event.preventDefault();
      }
      return;
    }

    if (event.key === " " || event.key === "Tab" || event.key === ",") {
      if (commitComposerFilters()) {
        event.preventDefault();
      }
    }
  };

  const renderQuickRangeField = () => (
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
  );

  const renderDateRangeField = () => (
    <label className="integrated-range-group">
      <span>Date range</span>
      <DateRangeField
        from={draft.from}
        to={draft.to}
        onChange={({ from, to }) => {
          updateDraft(
            {
              ...draft,
              from,
              to,
              datePreset: getDatePreset(from, to),
            },
            true,
          );
        }}
      />
    </label>
  );

  const renderDateEditor = () => (
    <>
      {renderQuickRangeField()}
      {renderDateRangeField()}
    </>
  );

  const renderAuthorEditor = () => (
    <label className="integrated-author-field">
      <span>Author</span>
      <input
        key={`badge-author-${query.author || ""}`}
        name="author"
        defaultValue={draft.author}
        placeholder="dev@example.com"
        onChange={(event) => updateDraft({ ...draft, author: event.target.value })}
        onBlur={(event) => {
          updateDraft({ ...draft, author: event.target.value }, true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            updateDraft({ ...draft, author: event.currentTarget.value }, true);
          }
        }}
      />
    </label>
  );

  const renderHybridEditor = () => (
    <div
      className="integrated-filter-field integrated-hybrid-field"
    >
      <span>Hybrid ranking</span>
      <div
        className={`integrated-hybrid-card ${draft.hybrid ? "is-hybrid" : ""}`}
        style={{
          ["--integrated-hybrid-progress" as string]: `${
            draft.hybrid ? Math.round(draft.semanticRatio * 100) : 0
          }%`,
        }}
      >
        <div className="integrated-hybrid-inline">
          <input
            aria-label="Semantic weight"
            type="range"
            min={0}
            max={100}
            step={5}
            value={draft.hybrid ? Math.round(draft.semanticRatio * 100) : 0}
            aria-valuetext={`${draft.hybrid ? Math.round(draft.semanticRatio * 100) : 0}%`}
            onChange={(event) => {
              const nextPercent = Math.max(
                0,
                Math.min(100, Number.parseInt(event.target.value, 10) || 0),
              );
              const semanticRatio = clampSemanticRatio(nextPercent / 100);

              updateDraft(
                {
                  ...draft,
                  semanticRatio,
                  hybrid: nextPercent > 0,
                },
                true,
              );
            }}
          />
          <output className="integrated-hybrid-value">
            {draft.hybrid ? Math.round(draft.semanticRatio * 100) : 0}%
          </output>
        </div>
        <input name="semantic_ratio" type="hidden" value={draft.semanticRatio} />
      </div>
    </div>
  );

  return (
    <form
      className={`integrated-search-form ${filtersOpen ? "is-open" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        applyDraft(draft);
      }}
    >
      <div className="integrated-search-row">
        <div className="integrated-search-input-wrap">
          <button
            type="submit"
            className="integrated-search-submit-icon"
            aria-label="Run search"
            title="Run search"
          >
            <Search className="integrated-search-input-icon" size={18} aria-hidden="true" />
          </button>

          <div
            className="integrated-search-composer"
            onClick={(event) => {
              const target = event.target;
              if (target instanceof HTMLElement && target.closest("button, input, select, textarea")) {
                return;
              }
              composerInputRef.current?.focus();
            }}
          >
            <input
              ref={composerInputRef}
              name="q"
              className="integrated-search-input"
              value={draft.q}
              onChange={(event) => updateDraft({ ...draft, q: event.target.value })}
              onBlur={() => {
                commitComposerFilters();
              }}
              onKeyDown={handleComposerKeyDown}
              placeholder={getSearchPlaceholder(scope)}
              aria-label="Search query"
            />
          </div>

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
            <SlidersHorizontal size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="integrated-search-input-clear"
            onClick={clearAll}
            aria-label="Clear search and filters"
            title="Clear search and filters"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {badges.length ? (
          <div className="integrated-search-badges" aria-live="polite">
            <div className="integrated-search-chip-row">
              {badges.map((badge) => (
                <span
                  key={badge.id === "hybrid" ? badge.label : badge.id}
                  className="integrated-search-badge-shell"
                >
                  <span className="integrated-search-badge">
                    <button
                      type="button"
                      className={joinClassNames(
                        "integrated-search-badge-trigger",
                        getBadgeTextClassName(badge.id),
                      )}
                      aria-label={`Open filters for ${badge.label}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setFiltersOpen(true);
                      }}
                    >
                      {badge.label}
                    </button>
                    <button
                      type="button"
                      className="integrated-search-badge-remove"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeBadge(badge.id);
                      }}
                      aria-label={`Remove filter ${badge.label}`}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div
        className={`integrated-search-filters-panel ${filtersOpen ? "is-open" : ""}`}
        aria-hidden={!filtersOpen}
      >
        <div
          id={`integrated-filters-${scope}`}
          className={`integrated-search-filters ${filtersOpen ? "is-open" : ""}`}
        >
          {renderDateEditor()}

          {renderAuthorEditor()}

          <div className="integrated-filter-field integrated-has-diff-field">
            <span>Has diff</span>
            <SearchToggleGroup
              label="Has diff filter"
              value={draft.hasDiff}
              options={HAS_DIFF_TOGGLE_OPTIONS}
              onChange={(value) => updateDraft({ ...draft, hasDiff: value }, true)}
            />
          </div>

          {scope === "series" ? (
            <div className="integrated-filter-field integrated-mainline-field">
              <span>Merge status</span>
              <SearchToggleGroup
                label="Merge status filter"
                value={draft.merged}
                options={MAINLINE_TOGGLE_OPTIONS}
                onChange={(value) => updateDraft({ ...draft, merged: value }, true)}
              />
            </div>
          ) : null}

          {renderHybridEditor()}
        </div>
        <input type="hidden" name="list_key" value={draft.listKey || defaults.list_key} />
      </div>
    </form>
  );
}
