export interface PagingParams {
  page?: number;
  pageSize?: number;
}

export type GetListsParams = PagingParams;

export interface GetThreadsParams extends PagingParams {
  listKey: string;
  sort?: "activity_desc" | "date_desc";
  from?: string;
  to?: string;
  author?: string;
  hasDiff?: boolean;
}

export interface GetThreadMessagesParams extends PagingParams {
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

export interface GetSeriesParams extends PagingParams {
  listKey?: string;
  sort?: "last_seen_desc";
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
  scope?: "thread" | "series" | "patch_item";
  listKey?: string;
  author?: string;
  from?: string;
  to?: string;
  hasDiff?: boolean;
  sort?: "relevance" | "date_desc" | "date_asc";
  limit?: number;
  cursor?: string;
  hybrid?: boolean;
  semanticRatio?: number;
}
