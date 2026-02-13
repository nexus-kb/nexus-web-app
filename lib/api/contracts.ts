export interface ListSummary {
  list_key: string;
  description: string | null;
  posting_address: string | null;
  latest_activity_at: string | null;
  thread_count_30d: number;
  message_count_30d: number;
}

export interface ThreadParticipant {
  name: string | null;
  email: string;
}

export interface ThreadListItem {
  thread_id: number;
  subject: string;
  root_message_id: number;
  last_activity_at: string;
  message_count: number;
  participants: ThreadParticipant[];
  has_diff: boolean;
}

export interface ThreadListResponse {
  items: ThreadListItem[];
  next_cursor: string | null;
}

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
  snippet: string;
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

export interface MessageAttachment {
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface MessageBodyResponse {
  message_id: number;
  body_text: string;
  body_html: string | null;
  diff_text: string | null;
  attachments: MessageAttachment[];
}

export interface PatchItemFile {
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

export interface PatchItemDiffResponse {
  path: string;
  diff_text: string;
}

export interface VersionResponse {
  git_sha: string;
  build_time: string;
  schema_version: string;
}
