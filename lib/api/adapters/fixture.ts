import type {
  GetListsParams,
  GetMessageBodyParams,
  GetPatchItemFileDiffParams,
  GetSeriesCompareParams,
  GetSeriesExportMboxParams,
  GetSeriesParams,
  GetSeriesVersionParams,
  GetThreadMessagesParams,
  GetThreadsParams,
  NexusApiAdapter,
} from "@/lib/api/adapter";
import type {
  ListCatalogResponse,
  ListDetailResponse,
  ListStatsResponse,
  MessageBodyResponse,
  MessageDetailResponse,
  PaginationResponse,
  PatchItemDetailResponse,
  PatchItemFile,
  PatchItemFileDiffResponse,
  PatchItemFilesResponse,
  PatchItemFullDiffResponse,
  SeriesCompareResponse,
  SeriesDetailResponse,
  SeriesListItem,
  SeriesListResponse,
  SeriesVersionResponse,
  ThreadDetailResponse,
  ThreadListItem,
  ThreadListResponse,
  ThreadMessage,
  ThreadMessagesResponse,
  VersionResponse,
} from "@/lib/api/contracts";

const LIST_ITEMS: ListCatalogResponse["items"] = [
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

const LIST_DETAILS: Record<string, ListDetailResponse> = {
  lkml: {
    list_key: "lkml",
    description: "Linux Kernel Mailing List",
    posting_address: "linux-kernel@vger.kernel.org",
    mirror_state: {
      active_repos: 1,
      total_repos: 1,
      latest_repo_watermark_updated_at: "2026-02-13T11:00:00Z",
    },
    counts: {
      messages: 96211,
      threads: 18432,
      patch_series: 2481,
    },
    facets_hint: {
      default_scope: "thread",
      available_scopes: ["thread", "series", "patch_item", "email"],
    },
  },
  "linux-mm": {
    list_key: "linux-mm",
    description: "Linux Memory Management",
    posting_address: "linux-mm@kvack.org",
    mirror_state: {
      active_repos: 1,
      total_repos: 1,
      latest_repo_watermark_updated_at: "2026-02-13T10:40:00Z",
    },
    counts: {
      messages: 11472,
      threads: 2520,
      patch_series: 602,
    },
    facets_hint: {
      default_scope: "thread",
      available_scopes: ["thread", "series", "patch_item", "email"],
    },
  },
};

const LIST_STATS: Record<string, ListStatsResponse> = {
  lkml: {
    messages: 960,
    threads: 320,
    patch_series: 55,
    top_authors: [
      { from_email: "apatel@kernel.dev", from_name: "A. Patel", message_count: 35 },
      { from_email: "jyao@kernel.dev", from_name: "J. Yao", message_count: 27 },
    ],
    activity_by_day: [
      { day_utc: "2026-02-10T00:00:00Z", messages: 295, threads: 104 },
      { day_utc: "2026-02-11T00:00:00Z", messages: 310, threads: 109 },
      { day_utc: "2026-02-12T00:00:00Z", messages: 355, threads: 107 },
    ],
  },
  "linux-mm": {
    messages: 310,
    threads: 120,
    patch_series: 22,
    top_authors: [
      { from_email: "lchen@kernel.dev", from_name: "L. Chen", message_count: 19 },
      { from_email: "david@redhat.com", from_name: "D. Hildenbrand", message_count: 16 },
    ],
    activity_by_day: [
      { day_utc: "2026-02-10T00:00:00Z", messages: 100, threads: 37 },
      { day_utc: "2026-02-11T00:00:00Z", messages: 99, threads: 40 },
      { day_utc: "2026-02-12T00:00:00Z", messages: 111, threads: 43 },
    ],
  },
};

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
  ],
};

const THREAD_MESSAGES: Record<string, ThreadMessage[]> = {
  "lkml:3101": [
    {
      message_id: 7001,
      parent_message_id: null,
      depth: 0,
      sort_key: "0001",
      from: { name: "A. Patel", email: "apatel@kernel.dev" },
      date_utc: "2026-02-13T08:12:04Z",
      subject: "[PATCH v3 0/5] mm: rebalance lruvec stats reporting",
      has_diff: false,
      snippet: "This series reduces noisy global counters and adds per-node rollups for reclaim tracing.",
      body_text: null,
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
      snippet: "Move stat flush accounting into node-local batches to reduce cacheline ping-pong.",
      body_text: null,
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
      body_text: null,
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
      snippet: "Tracepoint payload includes node-reclaim deltas and reclaim reason tags for offline analysis.",
      body_text: null,
      patch_item_id: 9002,
    },
  ],
  "lkml:3102": [
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
      body_text: null,
      patch_item_id: null,
    },
  ],
  "lkml:3103": [
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
      body_text: null,
      patch_item_id: null,
    },
  ],
  "linux-mm:4101": [
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
      body_text: null,
      patch_item_id: null,
    },
  ],
};

const MESSAGE_DETAILS: Record<number, MessageDetailResponse> = {
  7001: {
    message_id: 7001,
    message_id_primary: "<7001@example.org>",
    subject: "[PATCH v3 0/5] mm: rebalance lruvec stats reporting",
    subject_norm: "mm: rebalance lruvec stats reporting",
    from: { name: "A. Patel", email: "apatel@kernel.dev" },
    date_utc: "2026-02-13T08:12:04Z",
    to_raw: "linux-kernel@vger.kernel.org",
    cc_raw: "akpm@linux-foundation.org",
    references: [],
    in_reply_to: [],
    has_diff: false,
    has_attachments: false,
  },
  7002: {
    message_id: 7002,
    message_id_primary: "<7002@example.org>",
    subject: "[PATCH v3 1/5] mm: fold lruvec stat flush into node batching",
    subject_norm: "mm: fold lruvec stat flush into node batching",
    from: { name: "A. Patel", email: "apatel@kernel.dev" },
    date_utc: "2026-02-13T08:13:21Z",
    to_raw: "linux-kernel@vger.kernel.org",
    cc_raw: null,
    references: ["<7001@example.org>"],
    in_reply_to: ["<7001@example.org>"],
    has_diff: true,
    has_attachments: false,
  },
};

const MESSAGE_BODIES: Record<number, MessageBodyResponse> = {
  7001: {
    message_id: 7001,
    subject: "[PATCH v3 0/5] mm: rebalance lruvec stats reporting",
    body_text:
      "Hi all,\n\nThis v3 folds review feedback from v2 and includes node-local metrics to reduce global contention.\n\nThanks,\nAnanya",
    body_html: null,
    diff_text: null,
    has_diff: false,
    has_attachments: false,
    attachments: [],
  },
  7002: {
    message_id: 7002,
    subject: "[PATCH v3 1/5] mm: fold lruvec stat flush into node batching",
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
    ].join("\n"),
    has_diff: true,
    has_attachments: false,
    attachments: [],
  },
  7003: {
    message_id: 7003,
    subject: "Re: [PATCH v3 1/5] mm: fold lruvec stat flush into node batching",
    body_text: "Can you share numbers from a memcg-heavy reclaim case?",
    body_html: null,
    diff_text: null,
    has_diff: false,
    has_attachments: false,
    attachments: [],
  },
  7004: {
    message_id: 7004,
    subject: "[PATCH v3 2/5] mm/vmscan: annotate rebalance tracepoints",
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
    has_diff: true,
    has_attachments: false,
    attachments: [],
  },
};

const PATCH_ITEM_DETAILS: Record<number, PatchItemDetailResponse> = {
  9001: {
    patch_item_id: 9001,
    series_id: 77,
    series_version_id: 771,
    ordinal: 1,
    total: 5,
    item_type: "patch",
    subject: "[PATCH v3 1/5] mm: fold lruvec stat flush into node batching",
    subject_norm: "mm: fold lruvec stat flush into node batching",
    commit_subject: "mm: fold lruvec stat flush into node batching",
    commit_subject_norm: "mm: fold lruvec stat flush into node batching",
    message_id: 7002,
    message_id_primary: "<7002@example.org>",
    patch_id_stable: "patchid-9001",
    has_diff: true,
    file_count: 2,
    additions: 5,
    deletions: 1,
    hunks: 2,
  },
  9002: {
    patch_item_id: 9002,
    series_id: 77,
    series_version_id: 771,
    ordinal: 2,
    total: 5,
    item_type: "patch",
    subject: "[PATCH v3 2/5] mm/vmscan: annotate rebalance tracepoints",
    subject_norm: "mm/vmscan: annotate rebalance tracepoints",
    commit_subject: "mm/vmscan: annotate rebalance tracepoints",
    commit_subject_norm: "mm/vmscan: annotate rebalance tracepoints",
    message_id: 7004,
    message_id_primary: "<7004@example.org>",
    patch_id_stable: "patchid-9002",
    has_diff: true,
    file_count: 1,
    additions: 2,
    deletions: 0,
    hunks: 1,
  },
};

const PATCH_ITEM_FILES: Record<number, PatchItemFile[]> = {
  9001: [
    {
      patch_item_id: 9001,
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
    {
      patch_item_id: 9001,
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
  ],
  9002: [
    {
      patch_item_id: 9002,
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
};

const PATCH_FILE_DIFFS: Record<string, PatchItemFileDiffResponse> = {
  "9001:mm/vmscan.c": {
    patch_item_id: 9001,
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
    patch_item_id: 9001,
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
};

const PATCH_FULL_DIFFS: Record<number, PatchItemFullDiffResponse> = {
  9001: {
    patch_item_id: 9001,
    diff_text: `${PATCH_FILE_DIFFS["9001:mm/vmscan.c"].diff_text}\n\n${PATCH_FILE_DIFFS["9001:include/linux/mmzone.h"].diff_text}`,
  },
  9002: {
    patch_item_id: 9002,
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
};

const SERIES_ITEMS: SeriesListItem[] = [
  {
    series_id: 77,
    canonical_subject: "mm: rebalance lruvec stats reporting",
    author_email: "apatel@kernel.dev",
    last_seen_at: "2026-02-13T12:22:31Z",
    latest_version_num: 3,
    is_rfc_latest: false,
  },
  {
    series_id: 78,
    canonical_subject: "sched: compact rq clock updates",
    author_email: "jyao@kernel.dev",
    last_seen_at: "2026-02-13T10:52:09Z",
    latest_version_num: 1,
    is_rfc_latest: true,
  },
];

const SERIES_DETAILS: Record<number, SeriesDetailResponse> = {
  77: {
    series_id: 77,
    canonical_subject: "mm: rebalance lruvec stats reporting",
    author: { name: "A. Patel", email: "apatel@kernel.dev" },
    first_seen_at: "2026-02-10T08:00:00Z",
    last_seen_at: "2026-02-13T12:22:31Z",
    lists: ["lkml", "linux-mm"],
    versions: [
      {
        series_version_id: 771,
        version_num: 2,
        is_rfc: false,
        is_resend: false,
        sent_at: "2026-02-12T08:00:00Z",
        cover_message_id: 6901,
        thread_refs: [{ list_key: "lkml", thread_id: 3001 }],
        patch_count: 5,
        is_partial_reroll: false,
      },
      {
        series_version_id: 772,
        version_num: 3,
        is_rfc: false,
        is_resend: false,
        sent_at: "2026-02-13T08:12:04Z",
        cover_message_id: 7001,
        thread_refs: [{ list_key: "lkml", thread_id: 3101 }],
        patch_count: 5,
        is_partial_reroll: false,
      },
    ],
    latest_version_id: 772,
  },
};

const SERIES_VERSIONS: Record<string, SeriesVersionResponse> = {
  "77:771": {
    series_id: 77,
    series_version_id: 771,
    version_num: 2,
    is_rfc: false,
    is_resend: false,
    is_partial_reroll: false,
    sent_at: "2026-02-12T08:00:00Z",
    subject: "[PATCH v2 0/5] mm: rebalance lruvec stats reporting",
    subject_norm: "mm: rebalance lruvec stats reporting",
    cover_message_id: 6901,
    first_patch_message_id: 6902,
    assembled: true,
    patch_items: [
      {
        patch_item_id: 8901,
        ordinal: 1,
        total: 5,
        item_type: "patch",
        subject: "[PATCH v2 1/5] mm: fold lruvec stat flush into node batching",
        subject_norm: "mm: fold lruvec stat flush into node batching",
        commit_subject: "mm: fold lruvec stat flush into node batching",
        commit_subject_norm: "mm: fold lruvec stat flush into node batching",
        message_id: 6902,
        message_id_primary: "<6902@example.org>",
        patch_id_stable: "patchid-8901",
        has_diff: true,
        file_count: 2,
        additions: 4,
        deletions: 1,
        hunks: 2,
        inherited_from_version_num: null,
      },
    ],
  },
  "77:772": {
    series_id: 77,
    series_version_id: 772,
    version_num: 3,
    is_rfc: false,
    is_resend: false,
    is_partial_reroll: false,
    sent_at: "2026-02-13T08:12:04Z",
    subject: "[PATCH v3 0/5] mm: rebalance lruvec stats reporting",
    subject_norm: "mm: rebalance lruvec stats reporting",
    cover_message_id: 7001,
    first_patch_message_id: 7002,
    assembled: true,
    patch_items: [
      {
        patch_item_id: 9001,
        ordinal: 1,
        total: 5,
        item_type: "patch",
        subject: "[PATCH v3 1/5] mm: fold lruvec stat flush into node batching",
        subject_norm: "mm: fold lruvec stat flush into node batching",
        commit_subject: "mm: fold lruvec stat flush into node batching",
        commit_subject_norm: "mm: fold lruvec stat flush into node batching",
        message_id: 7002,
        message_id_primary: "<7002@example.org>",
        patch_id_stable: "patchid-9001",
        has_diff: true,
        file_count: 2,
        additions: 5,
        deletions: 1,
        hunks: 2,
        inherited_from_version_num: null,
      },
      {
        patch_item_id: 9002,
        ordinal: 2,
        total: 5,
        item_type: "patch",
        subject: "[PATCH v3 2/5] mm/vmscan: annotate rebalance tracepoints",
        subject_norm: "mm/vmscan: annotate rebalance tracepoints",
        commit_subject: "mm/vmscan: annotate rebalance tracepoints",
        commit_subject_norm: "mm/vmscan: annotate rebalance tracepoints",
        message_id: 7004,
        message_id_primary: "<7004@example.org>",
        patch_id_stable: "patchid-9002",
        has_diff: true,
        file_count: 1,
        additions: 2,
        deletions: 0,
        hunks: 1,
        inherited_from_version_num: null,
      },
    ],
  },
};

const SERIES_COMPARE: Record<string, SeriesCompareResponse> = {
  "77:771:772:summary": {
    series_id: 77,
    v1: 771,
    v2: 772,
    mode: "summary",
    summary: {
      v1_patch_count: 1,
      v2_patch_count: 2,
      patch_count_delta: 1,
      changed: 1,
      added: 1,
      removed: 0,
    },
  },
  "77:771:772:per_patch": {
    series_id: 77,
    v1: 771,
    v2: 772,
    mode: "per_patch",
    summary: {
      v1_patch_count: 1,
      v2_patch_count: 2,
      patch_count_delta: 1,
      changed: 1,
      added: 1,
      removed: 0,
    },
    patches: [
      {
        slot: 1,
        title_norm: "mm: fold lruvec stat flush into node batching",
        status: "changed",
        v1_patch_item_id: 8901,
        v1_patch_id_stable: "patchid-8901",
        v1_subject: "[PATCH v2 1/5] mm: fold lruvec stat flush into node batching",
        v2_patch_item_id: 9001,
        v2_patch_id_stable: "patchid-9001",
        v2_subject: "[PATCH v3 1/5] mm: fold lruvec stat flush into node batching",
      },
      {
        slot: 2,
        title_norm: "mm/vmscan: annotate rebalance tracepoints",
        status: "added",
        v1_patch_item_id: null,
        v1_patch_id_stable: null,
        v1_subject: null,
        v2_patch_item_id: 9002,
        v2_patch_id_stable: "patchid-9002",
        v2_subject: "[PATCH v3 2/5] mm/vmscan: annotate rebalance tracepoints",
      },
    ],
  },
  "77:771:772:per_file": {
    series_id: 77,
    v1: 771,
    v2: 772,
    mode: "per_file",
    summary: {
      v1_patch_count: 1,
      v2_patch_count: 2,
      patch_count_delta: 1,
      changed: 1,
      added: 1,
      removed: 0,
    },
    files: [
      {
        path: "mm/vmscan.c",
        status: "changed",
        additions_delta: 1,
        deletions_delta: 0,
        hunks_delta: 0,
      },
      {
        path: "include/trace/events/vmscan.h",
        status: "added",
        additions_delta: 2,
        deletions_delta: 0,
        hunks_delta: 1,
      },
    ],
  },
};

const VERSION: VersionResponse = {
  git_sha: "fixture-live-wiring",
  build_time: "2026-02-13T20:00:00Z",
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

function paginate<T>(items: T[], page = 1, pageSize = 50): { items: T[]; pagination: PaginationResponse } {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / safePageSize);
  const start = (safePage - 1) * safePageSize;
  const end = start + safePageSize;

  return {
    items: deepClone(items.slice(start, end)),
    pagination: {
      page: safePage,
      page_size: safePageSize,
      total_items: totalItems,
      total_pages: totalPages,
      has_prev: safePage > 1 && totalPages > 0,
      has_next: safePage < totalPages,
    },
  };
}

function normalizeListKey(listKey?: string): string {
  if (listKey && LIST_ITEMS.some((list) => list.list_key === listKey)) {
    return listKey;
  }
  return LIST_ITEMS[0]?.list_key ?? "lkml";
}

function threadKey(listKey: string, threadId: number): string {
  return `${listKey}:${threadId}`;
}

export class FixtureNexusApiAdapter implements NexusApiAdapter {
  getMessageRawUrl(messageId: number): string {
    return `/api/v1/messages/${messageId}/raw`;
  }

  getSeriesExportMboxUrl(params: GetSeriesExportMboxParams): string {
    const search = new URLSearchParams();
    if (params.assembled != null) {
      search.set("assembled", String(params.assembled));
    }
    if (params.includeCover != null) {
      search.set("include_cover", String(params.includeCover));
    }

    const query = search.toString();
    return `/api/v1/series/${params.seriesId}/versions/${params.seriesVersionId}/export/mbox${query ? `?${query}` : ""}`;
  }

  async getLists(params?: GetListsParams): Promise<ListCatalogResponse> {
    return paginate(LIST_ITEMS, params?.page ?? 1, params?.pageSize ?? 200);
  }

  async getListDetail(listKey: string): Promise<ListDetailResponse> {
    const detail = LIST_DETAILS[normalizeListKey(listKey)];
    if (!detail) {
      throw new Error(`List detail not found for ${listKey}`);
    }
    return deepClone(detail);
  }

  async getListStats(listKey: string): Promise<ListStatsResponse> {
    const stats = LIST_STATS[normalizeListKey(listKey)];
    if (!stats) {
      throw new Error(`List stats not found for ${listKey}`);
    }
    return deepClone(stats);
  }

  async getThreads(params: GetThreadsParams): Promise<ThreadListResponse> {
    const key = normalizeListKey(params.listKey);
    const rows = THREADS_BY_LIST[key] ?? [];
    return paginate(rows, params.page ?? 1, params.pageSize ?? 50);
  }

  async getThreadDetail(listKey: string, threadId: number): Promise<ThreadDetailResponse> {
    const key = threadKey(normalizeListKey(listKey), threadId);
    const messages = THREAD_MESSAGES[key];
    if (!messages) {
      throw new Error(`Thread detail not found for ${key}`);
    }

    const firstThread = (THREADS_BY_LIST[normalizeListKey(listKey)] ?? []).find((thread) => thread.thread_id === threadId);

    return {
      thread_id: threadId,
      list_key: normalizeListKey(listKey),
      subject: firstThread?.subject ?? "Thread",
      membership_hash: `fixture-${threadId}`,
      last_activity_at: firstThread?.last_activity_at ?? "2026-02-13T00:00:00Z",
      messages: deepClone(messages),
    };
  }

  async getThreadMessages(params: GetThreadMessagesParams): Promise<ThreadMessagesResponse> {
    const key = threadKey(normalizeListKey(params.listKey), params.threadId);
    const messages = THREAD_MESSAGES[key];
    if (!messages) {
      throw new Error(`Thread messages not found for ${key}`);
    }

    const page = paginate(messages, params.page ?? 1, params.pageSize ?? 50);

    return {
      thread_id: params.threadId,
      list_key: normalizeListKey(params.listKey),
      view: params.view ?? "snippets",
      messages: page.items.map((message) => ({
        ...message,
        snippet: params.view === "full" ? null : message.snippet,
        body_text: params.view === "full" ? MESSAGE_BODIES[message.message_id]?.body_text ?? null : null,
      })),
      pagination: page.pagination,
    };
  }

  async getMessageDetail(messageId: number): Promise<MessageDetailResponse> {
    const detail = MESSAGE_DETAILS[messageId];
    if (!detail) {
      throw new Error(`Message detail not found for ${messageId}`);
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

  async getPatchItemDetail(patchItemId: number): Promise<PatchItemDetailResponse> {
    const detail = PATCH_ITEM_DETAILS[patchItemId];
    if (!detail) {
      throw new Error(`Patch item not found for ${patchItemId}`);
    }
    return deepClone(detail);
  }

  async getPatchItemFiles(patchItemId: number): Promise<PatchItemFilesResponse> {
    return { items: deepClone(PATCH_ITEM_FILES[patchItemId] ?? []) };
  }

  async getPatchItemFileDiff(params: GetPatchItemFileDiffParams): Promise<PatchItemFileDiffResponse> {
    const key = `${params.patchItemId}:${params.path}`;
    const diff = PATCH_FILE_DIFFS[key];
    if (!diff) {
      throw new Error(`Patch file diff not found for ${key}`);
    }
    return deepClone(diff);
  }

  async getPatchItemFullDiff(patchItemId: number): Promise<PatchItemFullDiffResponse> {
    const diff = PATCH_FULL_DIFFS[patchItemId];
    if (!diff) {
      throw new Error(`Patch full diff not found for ${patchItemId}`);
    }
    return deepClone(diff);
  }

  async getSeries(params?: GetSeriesParams): Promise<SeriesListResponse> {
    const filtered = params?.listKey
      ? SERIES_ITEMS.filter((item) => item.series_id === 77 && params.listKey === "lkml")
      : SERIES_ITEMS;
    return paginate(filtered, params?.page ?? 1, params?.pageSize ?? 50);
  }

  async getSeriesDetail(seriesId: number): Promise<SeriesDetailResponse> {
    const detail = SERIES_DETAILS[seriesId];
    if (!detail) {
      throw new Error(`Series detail not found for ${seriesId}`);
    }
    return deepClone(detail);
  }

  async getSeriesVersion(params: GetSeriesVersionParams): Promise<SeriesVersionResponse> {
    const key = `${params.seriesId}:${params.seriesVersionId}`;
    const version = SERIES_VERSIONS[key];
    if (!version) {
      throw new Error(`Series version not found for ${key}`);
    }
    return {
      ...deepClone(version),
      assembled: params.assembled ?? true,
    };
  }

  async getSeriesCompare(params: GetSeriesCompareParams): Promise<SeriesCompareResponse> {
    const key = `${params.seriesId}:${params.v1}:${params.v2}:${params.mode ?? "summary"}`;
    const compare = SERIES_COMPARE[key];
    if (!compare) {
      throw new Error(`Series compare not found for ${key}`);
    }
    return deepClone(compare);
  }

  async getVersion(): Promise<VersionResponse> {
    return deepClone(VERSION);
  }
}
