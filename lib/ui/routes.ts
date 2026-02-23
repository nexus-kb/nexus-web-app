export type WorkspaceRoute =
  | { kind: "threads"; listKey: string | null; threadId: number | null }
  | { kind: "series"; listKey: string | null; seriesId: number | null }
  | { kind: "search" }
  | { kind: "diff"; patchItemId: number | null }
  | { kind: "unknown"; pathname: string };

export function decodeRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parsePositiveInt(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parsePathSegments(pathname: string): string[] {
  return pathname
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(decodeRouteSegment);
}

export function parseWorkspaceRoute(pathname: string): WorkspaceRoute {
  const segments = parsePathSegments(pathname);

  if (segments.length === 0) {
    return { kind: "threads", listKey: null, threadId: null };
  }

  if (segments[0] === "threads") {
    const listKey = segments[1] ?? null;
    const threadId = segments[2] ? parsePositiveInt(segments[2]) : null;
    return { kind: "threads", listKey, threadId };
  }

  if (segments[0] === "series") {
    const listKey = segments[1] ?? null;
    const seriesId = segments[2] ? parsePositiveInt(segments[2]) : null;
    return { kind: "series", listKey, seriesId };
  }

  if (segments[0] === "search") {
    return { kind: "search" };
  }

  if (segments[0] === "diff") {
    const patchItemId = segments[1] ? parsePositiveInt(segments[1]) : null;
    return { kind: "diff", patchItemId };
  }

  // Legacy route shape: /{list}/threads/{threadId?}
  if (segments[1] === "threads") {
    const listKey = segments[0] ?? null;
    const threadId = segments[2] ? parsePositiveInt(segments[2]) : null;
    return { kind: "threads", listKey, threadId };
  }

  // Legacy route shape: /{list}/series/{seriesId?}
  if (segments[1] === "series") {
    const listKey = segments[0] ?? null;
    const seriesId = segments[2] ? parsePositiveInt(segments[2]) : null;
    return { kind: "series", listKey, seriesId };
  }

  return { kind: "unknown", pathname };
}

export function normalizeRoutePath(route: string): string {
  return route.split("?")[0] ?? route;
}

export function getThreadsPath(listKey: string | null): string {
  return listKey ? `/threads/${encodeURIComponent(listKey)}` : "/threads";
}

export function getThreadPath(listKey: string, threadId: number): string {
  return `/threads/${encodeURIComponent(listKey)}/${threadId}`;
}

export function getSeriesPath(listKey: string | null): string {
  return listKey ? `/series/${encodeURIComponent(listKey)}` : "/series";
}

export function getSeriesDetailPath(listKey: string, seriesId: number): string {
  return `/series/${encodeURIComponent(listKey)}/${seriesId}`;
}

export function getDiffPath(patchItemId: number): string {
  return `/diff/${patchItemId}`;
}

export interface SearchRouteResolutionInput {
  route: string;
  fallbackListKey: string | null;
  itemId?: number;
  metadataListKey?: string | null;
}

function resolvePreferredListKey(input: SearchRouteResolutionInput): string | null {
  if (input.fallbackListKey) {
    return input.fallbackListKey;
  }

  if (input.metadataListKey) {
    return input.metadataListKey;
  }

  return null;
}

export function resolveThreadSearchRoute(input: SearchRouteResolutionInput): string {
  const normalized = normalizeRoutePath(input.route);
  const segments = parsePathSegments(normalized);

  if (segments[0] === "threads") {
    const listKey = segments[1] ?? null;
    const threadId = segments[2] ? parsePositiveInt(segments[2]) : null;
    if (listKey) {
      return threadId ? getThreadPath(listKey, threadId) : getThreadsPath(listKey);
    }
    return "/threads";
  }

  // Legacy route shape: /lists/{list}/threads/{threadId?}
  if (segments[0] === "lists" && segments[2] === "threads") {
    const listKey = segments[1] ?? null;
    const threadId = segments[3] ? parsePositiveInt(segments[3]) : null;
    if (listKey) {
      return threadId ? getThreadPath(listKey, threadId) : getThreadsPath(listKey);
    }
  }

  // Canonical route shape.
  if (/^\/threads(?:\/[^/]+)?(?:\/\d+)?$/.test(normalized)) {
    return normalized;
  }

  // Legacy route shape: /{list}/threads/{threadId?}
  const legacyMatch = normalized.match(/^\/([^/]+)\/threads(?:\/(\d+))?$/);
  if (legacyMatch) {
    const [, listKey, threadId] = legacyMatch;
    return threadId
      ? getThreadPath(listKey, Number(threadId))
      : getThreadsPath(listKey);
  }

  const preferredListKey = resolvePreferredListKey(input);
  if (preferredListKey && input.itemId && Number.isFinite(input.itemId)) {
    return getThreadPath(preferredListKey, input.itemId);
  }

  return preferredListKey ? getThreadsPath(preferredListKey) : "/threads";
}

export function resolveSeriesSearchRoute(input: SearchRouteResolutionInput): string {
  const normalized = normalizeRoutePath(input.route);
  const segments = parsePathSegments(normalized);
  const preferredListKey = resolvePreferredListKey(input);

  if (segments[0] === "series") {
    // Legacy route shape: /series/{seriesId}
    if (segments.length === 2) {
      const seriesId = parsePositiveInt(segments[1]);
      if (seriesId && preferredListKey) {
        return getSeriesDetailPath(preferredListKey, seriesId);
      }
    }

    const listKey = segments[1] ?? null;
    const seriesId = segments[2] ? parsePositiveInt(segments[2]) : null;
    if (listKey && !parsePositiveInt(listKey)) {
      return seriesId ? getSeriesDetailPath(listKey, seriesId) : getSeriesPath(listKey);
    }
    if (segments.length === 1) {
      return "/series";
    }
  }

  // Legacy route shape: /lists/{list}/series/{seriesId?}
  if (segments[0] === "lists" && segments[2] === "series") {
    const listKey = segments[1] ?? null;
    const seriesId = segments[3] ? parsePositiveInt(segments[3]) : null;
    if (listKey) {
      return seriesId ? getSeriesDetailPath(listKey, seriesId) : getSeriesPath(listKey);
    }
  }

  // Canonical route shape.
  if (/^\/series(?:\/[^/]+)?(?:\/\d+)?$/.test(normalized)) {
    return normalized;
  }

  // Legacy route shape: /{list}/series/{seriesId?}
  const legacyListMatch = normalized.match(/^\/([^/]+)\/series(?:\/(\d+))?$/);
  if (legacyListMatch) {
    const [, listKey, seriesId] = legacyListMatch;
    return seriesId
      ? getSeriesDetailPath(listKey, Number(seriesId))
      : getSeriesPath(listKey);
  }

  // Legacy route shape: /series/{seriesId}
  const legacyRootMatch = normalized.match(/^\/series\/(\d+)$/);
  if (legacyRootMatch) {
    const preferredListKey = resolvePreferredListKey(input);
    if (preferredListKey) {
      return getSeriesDetailPath(preferredListKey, Number(legacyRootMatch[1]));
    }
  }

  if (preferredListKey && input.itemId && Number.isFinite(input.itemId)) {
    return getSeriesDetailPath(preferredListKey, input.itemId);
  }

  return preferredListKey ? getSeriesPath(preferredListKey) : "/series";
}
