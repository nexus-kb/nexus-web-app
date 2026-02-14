import type {
  ListCatalogResponse,
  ListDetailResponse,
  ListStatsResponse,
  MessageBodyResponse,
  MessageDetailResponse,
  PatchItemDetailResponse,
  PatchItemFileDiffResponse,
  PatchItemFilesResponse,
  PatchItemFullDiffResponse,
  SeriesCompareResponse,
  SeriesDetailResponse,
  SeriesListResponse,
  SeriesVersionResponse,
  ThreadDetailResponse,
  ThreadListResponse,
  ThreadMessagesResponse,
  VersionResponse,
} from "@/lib/api/contracts";

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

export interface NexusApiAdapter {
  getLists(params?: GetListsParams): Promise<ListCatalogResponse>;
  getListDetail(listKey: string): Promise<ListDetailResponse>;
  getListStats(listKey: string, window?: string): Promise<ListStatsResponse>;

  getThreads(params: GetThreadsParams): Promise<ThreadListResponse>;
  getThreadDetail(listKey: string, threadId: number): Promise<ThreadDetailResponse>;
  getThreadMessages(params: GetThreadMessagesParams): Promise<ThreadMessagesResponse>;

  getMessageDetail(messageId: number): Promise<MessageDetailResponse>;
  getMessageBody(params: GetMessageBodyParams): Promise<MessageBodyResponse>;
  getMessageRawUrl(messageId: number): string;

  getPatchItemDetail(patchItemId: number): Promise<PatchItemDetailResponse>;
  getPatchItemFiles(patchItemId: number): Promise<PatchItemFilesResponse>;
  getPatchItemFileDiff(params: GetPatchItemFileDiffParams): Promise<PatchItemFileDiffResponse>;
  getPatchItemFullDiff(patchItemId: number): Promise<PatchItemFullDiffResponse>;

  getSeries(params?: GetSeriesParams): Promise<SeriesListResponse>;
  getSeriesDetail(seriesId: number): Promise<SeriesDetailResponse>;
  getSeriesVersion(params: GetSeriesVersionParams): Promise<SeriesVersionResponse>;
  getSeriesCompare(params: GetSeriesCompareParams): Promise<SeriesCompareResponse>;
  getSeriesExportMboxUrl(params: GetSeriesExportMboxParams): string;

  getVersion(): Promise<VersionResponse>;
}
