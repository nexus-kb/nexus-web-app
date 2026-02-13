import type {
  ListSummary,
  MessageBodyResponse,
  PatchItemDiffResponse,
  PatchItemFilesResponse,
  ThreadDetailResponse,
  ThreadListResponse,
  VersionResponse,
} from "@/lib/api/contracts";

export interface GetThreadsParams {
  listKey: string;
  sort?: "activity_desc" | "date_desc";
  limit?: number;
  cursor?: string;
  from?: string;
  to?: string;
  author?: string;
  hasDiff?: boolean;
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

export interface NexusApiAdapter {
  getLists(): Promise<ListSummary[]>;
  getThreads(params: GetThreadsParams): Promise<ThreadListResponse>;
  getThreadDetail(listKey: string, threadId: number): Promise<ThreadDetailResponse>;
  getMessageBody(params: GetMessageBodyParams): Promise<MessageBodyResponse>;
  getPatchItemFiles(patchItemId: number): Promise<PatchItemFilesResponse>;
  getPatchItemFileDiff(params: GetPatchItemFileDiffParams): Promise<PatchItemDiffResponse>;
  getVersion(): Promise<VersionResponse>;
}
