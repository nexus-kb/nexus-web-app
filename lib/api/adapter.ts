export interface CursorPagingParams {
  limit?: number;
  cursor?: string;
}

export interface GetListsParams extends CursorPagingParams {
  view?: "default" | "compact";
}

export interface GetThreadsParams extends CursorPagingParams {
  listKey: string;
  sort?: "activity_desc" | "date_desc" | "date_asc";
  from?: string;
  to?: string;
  author?: string;
  hasDiff?: boolean;
}

export interface GetThreadMessagesParams extends CursorPagingParams {
  listKey: string;
  threadId: number;
  view?: "full" | "snippets";
}

export interface GetMessageBodyParams {
  messageId: number;
  includeDiff?: boolean;
  stripQuotes?: boolean;
}

export interface GetPatchItemFileDiffParams {
  patchItemId: number;
  path: string;
}

export interface GetSeriesParams extends CursorPagingParams {
  listKey?: string;
  sort?: "last_seen_desc" | "last_seen_asc";
  merged?: boolean;
}

export interface GetSeriesVersionParams {
  seriesId: number;
  seriesVersionId: number;
  assembled?: boolean;
}

export interface GetSeriesCompareParams {
  seriesId: number;
  v1: number;
  v2: number;
  mode?: "summary" | "per_patch" | "per_file";
}

export interface GetSeriesExportMboxParams {
  seriesId: number;
  seriesVersionId: number;
  assembled?: boolean;
  includeCover?: boolean;
}

export interface GetSearchParams {
  q: string;
  scope?: "thread" | "series";
  listKey?: string;
  author?: string;
  from?: string;
  to?: string;
  hasDiff?: boolean;
  merged?: boolean;
  sort?: "relevance" | "date_desc" | "date_asc";
  limit?: number;
  cursor?: string;
  hybrid?: boolean;
  semanticRatio?: number;
}
