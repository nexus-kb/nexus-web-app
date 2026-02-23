import type { GetSearchParams } from "@/lib/api/adapter";

export const queryKeys = {
  lists: () => ["lists"] as const,
  threads: (params: {
    listKey: string;
    limit: number;
    cursor?: string;
    sort: "activity_desc" | "date_desc" | "date_asc";
    from?: string;
    to?: string;
    author?: string;
    hasDiff?: boolean;
  }) => ["threads", params] as const,
  threadDetail: (params: { listKey: string; threadId: number }) => ["threadDetail", params] as const,
  search: (params: GetSearchParams) => ["search", params] as const,
  series: (params: {
    listKey?: string;
    limit: number;
    cursor?: string;
    sort: "last_seen_desc" | "last_seen_asc";
  }) => ["series", params] as const,
  seriesDetail: (seriesId: number) => ["seriesDetail", seriesId] as const,
  seriesVersion: (params: { seriesId: number; seriesVersionId: number; assembled: boolean }) =>
    ["seriesVersion", params] as const,
  seriesCompare: (params: {
    seriesId: number;
    v1: number;
    v2: number;
    mode: "summary" | "per_patch" | "per_file";
  }) => ["seriesCompare", params] as const,
  patchItemDetail: (patchItemId: number) => ["patchItemDetail", patchItemId] as const,
  patchItemFiles: (patchItemId: number) => ["patchItemFiles", patchItemId] as const,
  patchItemDiff: (patchItemId: number) => ["patchItemDiff", patchItemId] as const,
  patchItemFileDiff: (params: { patchItemId: number; path: string }) => ["patchItemFileDiff", params] as const,
  messageBody: (params: { messageId: number; includeDiff: boolean }) => ["messageBody", params] as const,
};
