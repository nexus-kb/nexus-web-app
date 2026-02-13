import type {
  GetMessageBodyParams,
  GetPatchItemFileDiffParams,
  GetThreadsParams,
  NexusApiAdapter,
} from "@/lib/api/adapter";
import type {
  ListSummary,
  MessageBodyResponse,
  PatchItemDiffResponse,
  PatchItemFile,
  PatchItemFilesResponse,
  ThreadDetailResponse,
  ThreadListItem,
  ThreadListResponse,
  VersionResponse,
} from "@/lib/api/contracts";

const LISTS: ListSummary[] = [
  {
    list_key: "lkml",
    description: "Linux Kernel Mailing List",
    posting_address: "linux-kernel@vger.kernel.org",
    latest_activity_at: "2026-02-13T12:22:31Z",
    thread_count_30d: 18432,
    message_count_30d: 96211,
  },
  {
    list_key: "linux-mm",
    description: "Linux Memory Management",
    posting_address: "linux-mm@kvack.org",
    latest_activity_at: "2026-02-13T09:14:19Z",
    thread_count_30d: 2520,
    message_count_30d: 11472,
  },
];

const THREADS_BY_LIST: Record<string, ThreadListItem[]> = {
  lkml: [
    {
      thread_id: 3101,
      subject: "[PATCH v3 0/5] mm: rebalance lruvec stats reporting",
      root_message_id: 7001,
      last_activity_at: "2026-02-13T12:22:31Z",
      message_count: 9,
      participants: [
        { name: "A. Patel", email: "apatel@kernel.dev" },
        { name: "M. Morton", email: "akpm@linux-foundation.org" },
      ],
      has_diff: true,
    },
    {
      thread_id: 3102,
      subject: "[RFC PATCH 0/3] sched: compact rq clock updates",
      root_message_id: 7010,
      last_activity_at: "2026-02-13T10:52:09Z",
      message_count: 4,
      participants: [
        { name: "J. Yao", email: "jyao@kernel.dev" },
        { name: "P. Zijlstra", email: "peterz@infradead.org" },
      ],
      has_diff: true,
    },
    {
      thread_id: 3103,
      subject: "[BUG] ext4 deadlock after online resize",
      root_message_id: 7030,
      last_activity_at: "2026-02-12T18:03:40Z",
      message_count: 6,
      participants: [
        { name: "R. Gupta", email: "rgupta@example.com" },
        { name: "T. Ts'o", email: "tytso@mit.edu" },
      ],
      has_diff: false,
    },
  ],
  "linux-mm": [
    {
      thread_id: 4101,
      subject: "[PATCH v2 0/2] mm/khugepaged: tighten scan budget",
      root_message_id: 8101,
      last_activity_at: "2026-02-13T09:14:19Z",
      message_count: 5,
      participants: [
        { name: "L. Chen", email: "lchen@kernel.dev" },
        { name: "D. Hildenbrand", email: "david@redhat.com" },
      ],
      has_diff: true,
    },
    {
      thread_id: 4102,
      subject: "[PATCH] mm: document compact_control flags",
      root_message_id: 8110,
      last_activity_at: "2026-02-12T22:07:03Z",
      message_count: 3,
      participants: [{ name: "S. Khan", email: "skhan@kernel.dev" }],
      has_diff: true,
    },
  ],
};

const THREAD_DETAILS: Record<string, ThreadDetailResponse> = {
  "lkml:3101": {
    thread_id: 3101,
    list_key: "lkml",
    subject: "[PATCH v3 0/5] mm: rebalance lruvec stats reporting",
    membership_hash: "2d4f9d3b2ad0f908f15e7395f8c4e8c3",
    last_activity_at: "2026-02-13T12:22:31Z",
    messages: [
      {
        message_id: 7001,
        parent_message_id: null,
        depth: 0,
        sort_key: "0001",
        from: { name: "A. Patel", email: "apatel@kernel.dev" },
        date_utc: "2026-02-13T08:12:04Z",
        subject: "[PATCH v3 0/5] mm: rebalance lruvec stats reporting",
        has_diff: false,
        snippet:
          "This series reduces noisy global counters and adds per-node rollups for reclaim tracing.",
        patch_item_id: null,
      },
      {
        message_id: 7002,
        parent_message_id: 7001,
        depth: 1,
        sort_key: "0001.0001",
        from: { name: "A. Patel", email: "apatel@kernel.dev" },
        date_utc: "2026-02-13T08:13:21Z",
        subject: "[PATCH v3 1/5] mm: fold lruvec stat flush into node batching",
        has_diff: true,
        snippet:
          "Move stat flush accounting into node-local batches to reduce cacheline ping-pong.",
        patch_item_id: 9001,
      },
      {
        message_id: 7003,
        parent_message_id: 7002,
        depth: 2,
        sort_key: "0001.0001.0001",
        from: { name: "M. Morton", email: "akpm@linux-foundation.org" },
        date_utc: "2026-02-13T09:41:08Z",
        subject: "Re: [PATCH v3 1/5] mm: fold lruvec stat flush into node batching",
        has_diff: false,
        snippet: "Please include numbers for memcg-heavy reclaim workloads in the cover letter.",
        patch_item_id: null,
      },
      {
        message_id: 7004,
        parent_message_id: 7001,
        depth: 1,
        sort_key: "0001.0002",
        from: { name: "A. Patel", email: "apatel@kernel.dev" },
        date_utc: "2026-02-13T08:14:02Z",
        subject: "[PATCH v3 2/5] mm/vmscan: annotate rebalance tracepoints",
        has_diff: true,
        snippet:
          "Tracepoint payload includes node-reclaim deltas and reclaim reason tags for offline analysis.",
        patch_item_id: 9002,
      },
    ],
  },
  "lkml:3102": {
    thread_id: 3102,
    list_key: "lkml",
    subject: "[RFC PATCH 0/3] sched: compact rq clock updates",
    membership_hash: "ab94e29c0f06b5e2ffcc6f42556f0511",
    last_activity_at: "2026-02-13T10:52:09Z",
    messages: [
      {
        message_id: 7010,
        parent_message_id: null,
        depth: 0,
        sort_key: "0001",
        from: { name: "J. Yao", email: "jyao@kernel.dev" },
        date_utc: "2026-02-13T07:02:44Z",
        subject: "[RFC PATCH 0/3] sched: compact rq clock updates",
        has_diff: false,
        snippet: "RFC series for reducing rq clock update churn in wakeup-heavy microbenchmarks.",
        patch_item_id: null,
      },
    ],
  },
  "lkml:3103": {
    thread_id: 3103,
    list_key: "lkml",
    subject: "[BUG] ext4 deadlock after online resize",
    membership_hash: "23aa4f333d0f3598a6f0abfc29ce14fa",
    last_activity_at: "2026-02-12T18:03:40Z",
    messages: [
      {
        message_id: 7030,
        parent_message_id: null,
        depth: 0,
        sort_key: "0001",
        from: { name: "R. Gupta", email: "rgupta@example.com" },
        date_utc: "2026-02-12T17:44:02Z",
        subject: "[BUG] ext4 deadlock after online resize",
        has_diff: false,
        snippet: "Hitting lock inversion after repeated online resize on 6.10-rc1.",
        patch_item_id: null,
      },
    ],
  },
  "linux-mm:4101": {
    thread_id: 4101,
    list_key: "linux-mm",
    subject: "[PATCH v2 0/2] mm/khugepaged: tighten scan budget",
    membership_hash: "f2b1a0c9e5dc11ad11f4aa7cb88c16ef",
    last_activity_at: "2026-02-13T09:14:19Z",
    messages: [
      {
        message_id: 8101,
        parent_message_id: null,
        depth: 0,
        sort_key: "0001",
        from: { name: "L. Chen", email: "lchen@kernel.dev" },
        date_utc: "2026-02-13T05:13:19Z",
        subject: "[PATCH v2 0/2] mm/khugepaged: tighten scan budget",
        has_diff: false,
        snippet: "Minor v2 update to bound scan budget under memcg pressure.",
        patch_item_id: null,
      },
    ],
  },
  "linux-mm:4102": {
    thread_id: 4102,
    list_key: "linux-mm",
    subject: "[PATCH] mm: document compact_control flags",
    membership_hash: "9fd3e5d32db6a57a198ce774a30b6f20",
    last_activity_at: "2026-02-12T22:07:03Z",
    messages: [
      {
        message_id: 8110,
        parent_message_id: null,
        depth: 0,
        sort_key: "0001",
        from: { name: "S. Khan", email: "skhan@kernel.dev" },
        date_utc: "2026-02-12T20:50:42Z",
        subject: "[PATCH] mm: document compact_control flags",
        has_diff: true,
        snippet: "Adds missing comments for COMPACT_NO_SUITABLE_PAGE and related flags.",
        patch_item_id: 9302,
      },
    ],
  },
};

const MESSAGE_BODIES: Record<number, MessageBodyResponse> = {
  7001: {
    message_id: 7001,
    body_text:
      "Hi all,\n\nThis v3 folds review feedback from v2 and includes node-local metrics to reduce global contention.\n\nThanks,\nAnanya",
    body_html: null,
    diff_text: null,
    attachments: [],
  },
  7002: {
    message_id: 7002,
    body_text:
      "This patch wires lruvec stat flush through batched node accounting.\n\n> Previous version used global atomics on hot paths\n> which showed heavy contention in memcg stress tests.\n\nSigned-off-by: A. Patel <apatel@kernel.dev>",
    body_html: null,
    diff_text: [
      "diff --git a/mm/vmscan.c b/mm/vmscan.c",
      "index 1111111..2222222 100644",
      "--- a/mm/vmscan.c",
      "+++ b/mm/vmscan.c",
      "@@ -128,7 +128,9 @@ static void flush_stats(struct lruvec *lruvec)",
      "-\tatomic_long_add(delta, &vm_node_stat[item]);",
      "+\tstruct pglist_data *pgdat = lruvec_pgdat(lruvec);",
      "+\t/* batch updates per-node to reduce cross-cpu cache bouncing */",
      "+\tmod_node_page_state(pgdat, item, delta);",
      " }",
      "diff --git a/include/linux/mmzone.h b/include/linux/mmzone.h",
      "index 3333333..4444444 100644",
      "--- a/include/linux/mmzone.h",
      "+++ b/include/linux/mmzone.h",
      "@@ -342,6 +342,8 @@ struct lruvec {",
      "+\t/* deferred flush budget to amortize stat updates */",
      "+\tint stat_flush_budget;",
      " };",
    ].join("\n"),
    attachments: [],
  },
  7003: {
    message_id: 7003,
    body_text: "Can you share numbers from a memcg-heavy reclaim case?",
    body_html: null,
    diff_text: null,
    attachments: [],
  },
  7004: {
    message_id: 7004,
    body_text: "Adds new trace fields to help correlate reclaim spikes.",
    body_html: null,
    diff_text: [
      "diff --git a/include/trace/events/vmscan.h b/include/trace/events/vmscan.h",
      "index aa11111..bb22222 100644",
      "--- a/include/trace/events/vmscan.h",
      "+++ b/include/trace/events/vmscan.h",
      "@@ -44,6 +44,8 @@ TRACE_EVENT(mm_vmscan_lru_isolate,",
      "+\t__field(int, rebalance_reason)",
      "+\t__field(long, reclaimed_delta)",
      " );",
    ].join("\n"),
    attachments: [],
  },
  7010: {
    message_id: 7010,
    body_text: "RFC cover letter for scheduler clock update compaction.",
    body_html: null,
    diff_text: null,
    attachments: [],
  },
  7030: {
    message_id: 7030,
    body_text: "Bug report details and lockdep trace attached below.",
    body_html: null,
    diff_text: null,
    attachments: [],
  },
  8101: {
    message_id: 8101,
    body_text: "v2 cover for khugepaged scan budget changes.",
    body_html: null,
    diff_text: null,
    attachments: [],
  },
  8110: {
    message_id: 8110,
    body_text: "Documents compact_control flags and callsites.",
    body_html: null,
    diff_text: [
      "diff --git a/mm/compaction.c b/mm/compaction.c",
      "index cc12345..dd56789 100644",
      "--- a/mm/compaction.c",
      "+++ b/mm/compaction.c",
      "@@ -140,6 +140,9 @@ struct compact_control {",
      "+\t/* reason code for compaction bailouts */",
      "+\tint reason;",
      " };",
    ].join("\n"),
    attachments: [],
  },
};

const PATCH_ITEM_FILES: Record<number, PatchItemFile[]> = {
  9001: [
    {
      path: "include/linux/mmzone.h",
      old_path: "include/linux/mmzone.h",
      change_type: "M",
      is_binary: false,
      additions: 2,
      deletions: 0,
      hunks: 1,
      diff_start: 402,
      diff_end: 712,
    },
    {
      path: "mm/vmscan.c",
      old_path: "mm/vmscan.c",
      change_type: "M",
      is_binary: false,
      additions: 3,
      deletions: 1,
      hunks: 1,
      diff_start: 0,
      diff_end: 401,
    },
  ],
  9002: [
    {
      path: "include/trace/events/vmscan.h",
      old_path: "include/trace/events/vmscan.h",
      change_type: "M",
      is_binary: false,
      additions: 2,
      deletions: 0,
      hunks: 1,
      diff_start: 0,
      diff_end: 331,
    },
  ],
  9302: [
    {
      path: "mm/compaction.c",
      old_path: "mm/compaction.c",
      change_type: "M",
      is_binary: false,
      additions: 2,
      deletions: 0,
      hunks: 1,
      diff_start: 0,
      diff_end: 292,
    },
  ],
};

const PATCH_ITEM_DIFFS: Record<string, PatchItemDiffResponse> = {
  "9001:mm/vmscan.c": {
    path: "mm/vmscan.c",
    diff_text: [
      "diff --git a/mm/vmscan.c b/mm/vmscan.c",
      "index 1111111..2222222 100644",
      "--- a/mm/vmscan.c",
      "+++ b/mm/vmscan.c",
      "@@ -128,7 +128,9 @@ static void flush_stats(struct lruvec *lruvec)",
      "-\tatomic_long_add(delta, &vm_node_stat[item]);",
      "+\tstruct pglist_data *pgdat = lruvec_pgdat(lruvec);",
      "+\t/* batch updates per-node to reduce cross-cpu cache bouncing */",
      "+\tmod_node_page_state(pgdat, item, delta);",
      " }",
    ].join("\n"),
  },
  "9001:include/linux/mmzone.h": {
    path: "include/linux/mmzone.h",
    diff_text: [
      "diff --git a/include/linux/mmzone.h b/include/linux/mmzone.h",
      "index 3333333..4444444 100644",
      "--- a/include/linux/mmzone.h",
      "+++ b/include/linux/mmzone.h",
      "@@ -342,6 +342,8 @@ struct lruvec {",
      "+\t/* deferred flush budget to amortize stat updates */",
      "+\tint stat_flush_budget;",
      " };",
    ].join("\n"),
  },
  "9002:include/trace/events/vmscan.h": {
    path: "include/trace/events/vmscan.h",
    diff_text: [
      "diff --git a/include/trace/events/vmscan.h b/include/trace/events/vmscan.h",
      "index aa11111..bb22222 100644",
      "--- a/include/trace/events/vmscan.h",
      "+++ b/include/trace/events/vmscan.h",
      "@@ -44,6 +44,8 @@ TRACE_EVENT(mm_vmscan_lru_isolate,",
      "+\t__field(int, rebalance_reason)",
      "+\t__field(long, reclaimed_delta)",
      " );",
    ].join("\n"),
  },
  "9302:mm/compaction.c": {
    path: "mm/compaction.c",
    diff_text: [
      "diff --git a/mm/compaction.c b/mm/compaction.c",
      "index cc12345..dd56789 100644",
      "--- a/mm/compaction.c",
      "+++ b/mm/compaction.c",
      "@@ -140,6 +140,9 @@ struct compact_control {",
      "+\t/* reason code for compaction bailouts */",
      "+\tint reason;",
      " };",
    ].join("\n"),
  },
};

const VERSION: VersionResponse = {
  git_sha: "fixture-frontend-redesign",
  build_time: "2026-02-13T16:10:00Z",
  schema_version: "phase0-fixture",
};

function deepClone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}

function stripQuoted(bodyText: string): string {
  return bodyText
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .trim();
}

export class FixtureNexusApiAdapter implements NexusApiAdapter {
  async getLists(): Promise<ListSummary[]> {
    return deepClone(LISTS);
  }

  async getThreads(params: GetThreadsParams): Promise<ThreadListResponse> {
    const listThreads = THREADS_BY_LIST[params.listKey] ?? [];
    return {
      items: deepClone(listThreads.slice(0, params.limit ?? listThreads.length)),
      next_cursor: null,
    };
  }

  async getThreadDetail(listKey: string, threadId: number): Promise<ThreadDetailResponse> {
    const key = `${listKey}:${threadId}`;
    const detail = THREAD_DETAILS[key];
    if (!detail) {
      throw new Error(`Thread detail not found for ${key}`);
    }
    return deepClone(detail);
  }

  async getMessageBody(params: GetMessageBodyParams): Promise<MessageBodyResponse> {
    const body = MESSAGE_BODIES[params.messageId];
    if (!body) {
      throw new Error(`Message body not found for ${params.messageId}`);
    }

    return {
      ...deepClone(body),
      body_text: params.stripQuotes ? stripQuoted(body.body_text) : body.body_text,
      diff_text: params.includeDiff ? body.diff_text : null,
    };
  }

  async getPatchItemFiles(patchItemId: number): Promise<PatchItemFilesResponse> {
    return { items: deepClone(PATCH_ITEM_FILES[patchItemId] ?? []) };
  }

  async getPatchItemFileDiff(params: GetPatchItemFileDiffParams): Promise<PatchItemDiffResponse> {
    const key = `${params.patchItemId}:${params.path}`;
    const diff = PATCH_ITEM_DIFFS[key];
    if (!diff) {
      throw new Error(`Patch item diff not found for ${key}`);
    }
    return deepClone(diff);
  }

  async getVersion(): Promise<VersionResponse> {
    return deepClone(VERSION);
  }
}
