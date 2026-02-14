export interface PaginationResponse {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_prev: boolean;
  has_next: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationResponse;
}

export interface ListSummary {
  list_key: string;
  description: string | null;
  posting_address: string | null;
  latest_activity_at: string | null;
  thread_count_30d: number;
  message_count_30d: number;
}

export type ListCatalogResponse = PaginatedResponse<ListSummary>;

export interface ListMirrorState {
  active_repos: number;
  total_repos: number;
  latest_repo_watermark_updated_at: string | null;
}

export interface ListCounts {
  messages: number;
  threads: number;
  patch_series: number;
}

export interface ListFacetsHint {
  default_scope: string;
  available_scopes: string[];
}

export interface ListDetailResponse {
  list_key: string;
  description: string | null;
  posting_address: string | null;
  mirror_state: ListMirrorState;
  counts: ListCounts;
  facets_hint: ListFacetsHint;
}

export interface ListTopAuthor {
  from_email: string;
  from_name: string | null;
  message_count: number;
}

export interface ListActivityByDay {
  day_utc: string;
  messages: number;
  threads: number;
}

export interface ListStatsResponse {
  messages: number;
  threads: number;
  patch_series: number;
  top_authors: ListTopAuthor[];
  activity_by_day: ListActivityByDay[];
}

export interface ThreadParticipant {
  name: string | null;
  email: string;
}

export interface ThreadListItem {
  thread_id: number;
  subject: string;
  root_message_id: number | null;
  created_at?: string;
  last_activity_at: string;
  message_count: number;
  participants: ThreadParticipant[];
  starter?: ThreadParticipant | null;
  has_diff: boolean;
}

export type ThreadListResponse = PaginatedResponse<ThreadListItem>;

export interface ThreadMessageFrom {
  name: string | null;
  email: string;
}

export interface ThreadMessage {
  message_id: number;
  parent_message_id: number | null;
  depth: number;
  sort_key: string;
  from: ThreadMessageFrom;
  date_utc: string | null;
  subject: string;
  has_diff: boolean;
  snippet: string | null;
  body_text: string | null;
  patch_item_id: number | null;
}

export interface ThreadDetailResponse {
  thread_id: number;
  list_key: string;
  subject: string;
  membership_hash: string;
  last_activity_at: string;
  messages: ThreadMessage[];
}

export interface ThreadMessagesResponse {
  thread_id: number;
  list_key: string;
  view: "full" | "snippets";
  messages: ThreadMessage[];
  pagination: PaginationResponse;
}

export interface MessageAttachment {
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface MessageBodyResponse {
  message_id: number;
  subject: string;
  body_text: string;
  body_html: string | null;
  diff_text: string | null;
  has_diff: boolean;
  has_attachments: boolean;
  attachments: MessageAttachment[];
}

export interface MessageDetailResponse {
  message_id: number;
  message_id_primary: string;
  subject: string;
  subject_norm: string;
  from: ThreadMessageFrom;
  date_utc: string | null;
  to_raw: string | null;
  cc_raw: string | null;
  references: string[];
  in_reply_to: string[];
  has_diff: boolean;
  has_attachments: boolean;
}

export interface PatchItemDetailResponse {
  patch_item_id: number;
  series_id: number;
  series_version_id: number;
  ordinal: number;
  total: number | null;
  item_type: string;
  subject: string;
  subject_norm: string;
  commit_subject: string | null;
  commit_subject_norm: string | null;
  message_id: number;
  message_id_primary: string;
  patch_id_stable: string | null;
  has_diff: boolean;
  file_count: number;
  additions: number;
  deletions: number;
  hunks: number;
}

export interface PatchItemFile {
  patch_item_id: number;
  path: string;
  old_path: string | null;
  change_type: "A" | "M" | "D" | "R" | "C" | "B";
  is_binary: boolean;
  additions: number;
  deletions: number;
  hunks: number;
  diff_start: number;
  diff_end: number;
}

export interface PatchItemFilesResponse {
  items: PatchItemFile[];
}

export interface PatchItemFileDiffResponse {
  patch_item_id: number;
  path: string;
  diff_text: string;
}

export interface PatchItemFullDiffResponse {
  patch_item_id: number;
  diff_text: string;
}

export interface SeriesListItem {
  series_id: number;
  canonical_subject: string;
  author_email: string;
  last_seen_at: string;
  latest_version_num: number;
  is_rfc_latest: boolean;
}

export type SeriesListResponse = PaginatedResponse<SeriesListItem>;

export interface SeriesAuthor {
  name: string | null;
  email: string;
}

export interface SeriesThreadRef {
  list_key: string;
  thread_id: number;
}

export interface SeriesVersionSummary {
  series_version_id: number;
  version_num: number;
  is_rfc: boolean;
  is_resend: boolean;
  sent_at: string;
  cover_message_id: number | null;
  thread_refs: SeriesThreadRef[];
  patch_count: number;
  is_partial_reroll: boolean;
}

export interface SeriesDetailResponse {
  series_id: number;
  canonical_subject: string;
  author: SeriesAuthor;
  first_seen_at: string;
  last_seen_at: string;
  lists: string[];
  versions: SeriesVersionSummary[];
  latest_version_id: number | null;
}

export interface SeriesVersionPatchItem {
  patch_item_id: number;
  ordinal: number;
  total: number | null;
  item_type: string;
  subject: string;
  subject_norm: string;
  commit_subject: string | null;
  commit_subject_norm: string | null;
  message_id: number;
  message_id_primary: string;
  patch_id_stable: string | null;
  has_diff: boolean;
  file_count: number;
  additions: number;
  deletions: number;
  hunks: number;
  inherited_from_version_num: number | null;
}

export interface SeriesVersionResponse {
  series_id: number;
  series_version_id: number;
  version_num: number;
  is_rfc: boolean;
  is_resend: boolean;
  is_partial_reroll: boolean;
  sent_at: string;
  subject: string;
  subject_norm: string;
  cover_message_id: number | null;
  first_patch_message_id: number | null;
  assembled: boolean;
  patch_items: SeriesVersionPatchItem[];
}

export interface SeriesCompareSummary {
  v1_patch_count: number;
  v2_patch_count: number;
  patch_count_delta: number;
  changed: number;
  added: number;
  removed: number;
}

export interface SeriesComparePatchRow {
  slot: number;
  title_norm: string;
  status: "unchanged" | "changed" | "added" | "removed";
  v1_patch_item_id: number | null;
  v1_patch_id_stable: string | null;
  v1_subject: string | null;
  v2_patch_item_id: number | null;
  v2_patch_id_stable: string | null;
  v2_subject: string | null;
}

export interface SeriesCompareFileRow {
  path: string;
  status: "unchanged" | "changed" | "added" | "removed";
  additions_delta: number;
  deletions_delta: number;
  hunks_delta: number;
}

export interface SeriesCompareResponse {
  series_id: number;
  v1: number;
  v2: number;
  mode: "summary" | "per_patch" | "per_file";
  summary: SeriesCompareSummary;
  patches?: SeriesComparePatchRow[];
  files?: SeriesCompareFileRow[];
}

export interface VersionResponse {
  git_sha: string;
  build_time: string;
  schema_version: string;
}
