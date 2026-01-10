// API Response Types

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface SortDescriptor {
  field: string;
  direction: "asc" | "desc";
}

export interface ResponseMeta {
  pagination?: PaginationMeta;
  sort?: SortDescriptor[];
  listId?: string | null;
  filters?: Record<string, unknown> | null;
  extra?: Record<string, unknown> | null;
}

export interface ApiResponse<T> {
  data: T;
  meta: ResponseMeta;
}

// Mailing List Types

export interface MailingList {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  enabled: boolean;
  created_at: string;
  last_synced_at?: string | null;
  last_threaded_at?: string | null;
}

// Thread Types

export interface Thread {
  id: number;
  mailing_list_id: number;
  root_message_id: string;
  subject: string;
  start_date: string;
  last_date: string;
  message_count?: number | null;
}

export interface ThreadWithStarter extends Thread {
  starter_id: number;
  starter_email: string;
  starter_name?: string | null;
}

export interface ThreadDetail {
  thread: Thread;
  emails: EmailHierarchy[];
}

// Patch Types

export type PatchRegionType = "diff" | "diff_stat" | "binary_patch";

export interface PatchRegion {
  startLine: number;
  endLine: number;
  type: PatchRegionType;
}

export interface PatchMetadata {
  hasPatch: boolean;
  hasDiffstat: boolean;
  files: string[];
  regions: PatchRegion[];
}

// Email Types

export interface EmailWithAuthor {
  id: number;
  mailingListId: number;
  messageId: string;
  subject: string;
  authorId: number;
  authorEmail: string;
  authorName?: string | null;
  date: string;
  body?: string | null;
  inReplyTo?: string | null;
  blobOid: string;
  createdAt?: string | null;
  patchMetadata?: PatchMetadata | null;
}

export interface EmailHierarchy extends EmailWithAuthor {
  depth: number;
}

// Author Types

export interface AuthorWithStats {
  id: number;
  email: string;
  canonical_name?: string | null;
  name_variations: string[];
  email_count: number;
  thread_count: number;
  mailing_lists: string[];
  first_seen?: string | null;
  last_seen?: string | null;
  first_email_date?: string | null;
  last_email_date?: string | null;
}

// Stats Types

export interface MailingListStats {
  emailCount: number;
  threadCount: number;
  authorCount: number;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
}

export interface ListAggregateStats {
  totalLists: number;
  totalEmails: number;
  totalThreads: number;
  totalAuthors: number;
}

// API Response Aliases
export type MailingListListResponse = MailingList[];
export type ThreadListResponse = ApiResponse<ThreadWithStarter[]>;
export type ThreadDetailResponse = ApiResponse<ThreadDetail>;
