import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@nexus/design-system";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeriesWorkspace } from "@/components/series-workspace";
import {
  getListDetail,
  getLists,
  getMessageBody,
  getPatchItemFullDiff,
  getSearch,
  getSeries,
  getSeriesCompare,
  getSeriesDetail,
  getSeriesVersion,
} from "@/lib/api/server-client";
import type {
  ListDetailResponse,
  ListSummary,
  PageInfoResponse,
  SeriesDetailResponse,
  SeriesListItem,
  SeriesVersionResponse,
} from "@/lib/api/contracts";
import type { IntegratedSearchRow } from "@/lib/api/server-data";
import {
  routerPushMock,
  routerReplaceMock,
  setNavigationState,
} from "@/tests/mocks/navigation";

vi.mock("@/lib/api/server-client", () => ({
  getListDetail: vi.fn(),
  getLists: vi.fn(),
  getMessageBody: vi.fn(),
  getPatchItemFullDiff: vi.fn(),
  getSeries: vi.fn(),
  getSeriesDetail: vi.fn(),
  getSeriesVersion: vi.fn(),
  getSeriesCompare: vi.fn(),
  getSearch: vi.fn(),
}));

const lists: ListSummary[] = [
  {
    list_key: "lkml",
    description: "Linux Kernel Mailing List",
    posting_address: "linux-kernel@vger.kernel.org",
    latest_activity_at: "2026-02-13T12:22:31Z",
    thread_count_30d: 100,
    message_count_30d: 1000,
  },
];

const pageInfo: PageInfoResponse = {
  limit: 30,
  next_cursor: null,
  prev_cursor: null,
  has_more: false,
};
const listDetail: ListDetailResponse = {
  list_key: "lkml",
  description: "Linux Kernel Mailing List",
  posting_address: "linux-kernel@vger.kernel.org",
  mirror_state: {
    active_repos: 1,
    total_repos: 1,
    latest_repo_watermark_updated_at: "2026-02-13T12:22:31Z",
  },
  counts: {
    messages: 1_000,
    threads: 42,
    patch_series: 5,
  },
  facets_hint: {
    default_scope: "thread",
    available_scopes: ["thread", "series"],
  },
};
const V1_BASE_COMMIT = "b8d687c7eeb52d0353ac27c4f71594a2e6aa365f";
const V2_BASE_COMMIT = "3f4ed13b8f6f8f487dbb34557cf95e5ee72f4b96";
const MAINLINE_COMMIT = "0123456789abcdef0123456789abcdef01234567";

const seriesItems: SeriesListItem[] = [
  {
    series_id: 10,
    canonical_subject: "mm: reclaim tuning",
    author_email: "mm@example.com",
    author_name: null,
    first_seen_at: "2026-02-10T10:00:00Z",
    latest_patchset_at: "2026-02-13T09:00:00Z",
    last_seen_at: "2026-02-13T10:00:00Z",
    latest_version_num: 2,
    is_rfc_latest: false,
    merge_summary: {
      state: "merged",
      merged_in_tag: "v6.17-rc1",
      merged_in_release: "v6.17",
      merged_version_id: 101,
      merged_commit_id: MAINLINE_COMMIT,
      matched_patch_count: 1,
      total_patch_count: 1,
    },
  },
];

const seriesDetail: SeriesDetailResponse = {
  series_id: 10,
  canonical_subject: "mm: reclaim tuning",
  author: { name: null, email: "mm@example.com" },
  first_seen_at: "2026-02-10T10:00:00Z",
  last_seen_at: "2026-02-13T10:00:00Z",
  lists: ["lkml"],
  merge_summary: {
    state: "merged",
    merged_in_tag: "v6.17-rc1",
    merged_in_release: "v6.17",
    merged_version_id: 101,
    merged_commit_id: MAINLINE_COMMIT,
    matched_patch_count: 1,
    total_patch_count: 1,
  },
  versions: [
    {
      series_version_id: 101,
      version_num: 1,
      is_rfc: false,
      is_resend: false,
      sent_at: "2026-02-10T10:00:00Z",
      base_commit: V1_BASE_COMMIT,
      cover_message_id: null,
      thread_refs: [
        {
          list_key: "lkml",
          thread_id: 1,
          message_count: 5,
          last_activity_at: "2026-02-10T14:30:00Z",
        },
      ],
      patch_count: 1,
      is_partial_reroll: false,
      merge_summary: {
        state: "merged",
        merged_in_tag: "v6.17-rc1",
        merged_in_release: "v6.17",
        merged_version_id: 101,
        merged_commit_id: MAINLINE_COMMIT,
        matched_patch_count: 1,
        total_patch_count: 1,
      },
    },
  ],
  latest_version_id: 101,
};
const multiVersionSeriesDetail: SeriesDetailResponse = {
  ...seriesDetail,
  versions: [
    ...seriesDetail.versions,
    {
      series_version_id: 102,
      version_num: 2,
      is_rfc: false,
      is_resend: false,
      sent_at: "2026-02-11T10:00:00Z",
      base_commit: V2_BASE_COMMIT,
      cover_message_id: 202,
      thread_refs: [
        {
          list_key: "lkml",
          thread_id: 2,
          message_count: 9,
          last_activity_at: "2026-02-11T13:45:00Z",
        },
      ],
      patch_count: 2,
      is_partial_reroll: true,
      merge_summary: {
        state: "partial",
        merged_in_tag: null,
        merged_in_release: null,
        merged_version_id: null,
        merged_commit_id: null,
        matched_patch_count: 1,
        total_patch_count: 2,
      },
    },
  ],
  latest_version_id: 102,
};
const multiVersionRfcSeriesDetail: SeriesDetailResponse = {
  ...multiVersionSeriesDetail,
  versions: multiVersionSeriesDetail.versions.map((version) => ({
    ...version,
    is_rfc: true,
  })),
};

const seriesVersionV1: SeriesVersionResponse = {
  series_id: 10,
  series_version_id: 101,
  version_num: 1,
  is_rfc: false,
  is_resend: false,
  is_partial_reroll: false,
  sent_at: "2026-02-10T10:00:00Z",
  subject: "[PATCH 0/1] mm: reclaim tuning",
  subject_norm: "mm: reclaim tuning",
  base_commit: V1_BASE_COMMIT,
  cover_message_id: null,
  first_patch_message_id: null,
  assembled: true,
  merge_summary: {
    state: "merged",
    merged_in_tag: "v6.17-rc1",
    merged_in_release: "v6.17",
    merged_version_id: 101,
    merged_commit_id: MAINLINE_COMMIT,
    matched_patch_count: 1,
    total_patch_count: 1,
  },
  patch_items: [
    {
      patch_item_id: 1001,
      ordinal: 1,
      total: 1,
      item_type: "patch",
      subject: "[PATCH 1/1] mm: reclaim tuning",
      subject_norm: "mm: reclaim tuning",
      commit_subject: "mm: reclaim tuning",
      commit_subject_norm: "mm: reclaim tuning",
      message_id: 301,
      message_id_primary: "msg-301",
      patch_id_stable: "patch-v1",
      has_diff: true,
      file_count: 1,
      additions: 10,
      deletions: 2,
      hunks: 1,
      inherited_from_version_num: null,
      mainline_commit: {
        commit_id: MAINLINE_COMMIT,
        merged_in_tag: "v6.17-rc1",
        merged_in_release: "v6.17",
        match_method: "patch_id",
      },
    },
  ],
};

const seriesVersionV2: SeriesVersionResponse = {
  series_id: 10,
  series_version_id: 102,
  version_num: 2,
  is_rfc: false,
  is_resend: false,
  is_partial_reroll: true,
  sent_at: "2026-02-11T10:00:00Z",
  subject: "[PATCH v2 0/2] mm: reclaim tuning",
  subject_norm: "mm: reclaim tuning",
  base_commit: V2_BASE_COMMIT,
  cover_message_id: 202,
  first_patch_message_id: 302,
  assembled: true,
  merge_summary: {
    state: "partial",
    merged_in_tag: null,
    merged_in_release: null,
    merged_version_id: null,
    merged_commit_id: null,
    matched_patch_count: 1,
    total_patch_count: 2,
  },
  patch_items: [
    {
      patch_item_id: 1002,
      ordinal: 0,
      total: 2,
      item_type: "cover",
      subject: "[PATCH v2 0/2] mm: reclaim tuning",
      subject_norm: "mm: reclaim tuning",
      commit_subject: null,
      commit_subject_norm: null,
      message_id: 302,
      message_id_primary: "msg-302",
      patch_id_stable: null,
      has_diff: false,
      file_count: 0,
      additions: 0,
      deletions: 0,
      hunks: 0,
      inherited_from_version_num: null,
      mainline_commit: null,
    },
    {
      patch_item_id: 1003,
      ordinal: 1,
      total: 2,
      item_type: "patch",
      subject: "[PATCH v2 1/2] mm: reclaim tuning",
      subject_norm: "mm: reclaim tuning",
      commit_subject: "mm: reclaim tuning",
      commit_subject_norm: "mm: reclaim tuning",
      message_id: 303,
      message_id_primary: "msg-303",
      patch_id_stable: "patch-v2",
      has_diff: true,
      file_count: 1,
      additions: 12,
      deletions: 1,
      hunks: 2,
      inherited_from_version_num: null,
      mainline_commit: {
        commit_id: MAINLINE_COMMIT,
        merged_in_tag: "v6.17-rc1",
        merged_in_release: "v6.17",
        match_method: "patch_id",
      },
    },
    {
      patch_item_id: 1004,
      ordinal: 2,
      total: 2,
      item_type: "patch",
      subject: "[PATCH v2 2/2] mm: reclaim cleanup",
      subject_norm: "mm: reclaim cleanup",
      commit_subject: "mm: reclaim cleanup",
      commit_subject_norm: "mm: reclaim cleanup",
      message_id: 304,
      message_id_primary: "msg-304",
      patch_id_stable: "patch-v2-cleanup",
      has_diff: true,
      file_count: 1,
      additions: 7,
      deletions: 0,
      hunks: 1,
      inherited_from_version_num: 1,
      mainline_commit: null,
    },
  ],
};

const searchResults: IntegratedSearchRow[] = [
  {
    id: 900,
    route: "/series/900",
    title: "net: queue balancing",
    snippet: "rebalance tx queue setup",
    date_utc: "2026-02-13T08:00:00Z",
    list_keys: ["netdev"],
    author_email: "net@example.com",
    has_diff: true,
    metadata: {
      latest_version_num: 3,
      is_rfc_latest: true,
      list_key: "netdev",
      merge_state: "merged",
      merged_in_release: "v6.18",
    },
  },
];

function renderWorkspace(overrides?: Partial<ComponentProps<typeof SeriesWorkspace>>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SeriesWorkspace selectedListKey="lkml" selectedSeriesId={null} {...overrides} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

const getListsMock = vi.mocked(getLists);
const getSeriesMock = vi.mocked(getSeries);
const getSeriesDetailMock = vi.mocked(getSeriesDetail);
const getSeriesVersionMock = vi.mocked(getSeriesVersion);
const getSeriesCompareMock = vi.mocked(getSeriesCompare);
const getSearchMock = vi.mocked(getSearch);
const getListDetailMock = vi.mocked(getListDetail);
const getMessageBodyMock = vi.mocked(getMessageBody);
const getPatchItemFullDiffMock = vi.mocked(getPatchItemFullDiff);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.themeMode = "system";
  document.documentElement.dataset.navCollapsed = "false";
  document.documentElement.classList.remove("dark");
  document.documentElement.classList.add("light");
  document.documentElement.style.colorScheme = "light";

  getListsMock.mockResolvedValue({
    items: lists,
    page_info: { limit: 1, next_cursor: null, prev_cursor: null, has_more: false },
  });
  getSeriesMock.mockResolvedValue({
    items: seriesItems,
    page_info: pageInfo,
  });
  getListDetailMock.mockResolvedValue(listDetail);
  getSeriesDetailMock.mockResolvedValue(seriesDetail);
  getSeriesVersionMock.mockImplementation(async ({ seriesVersionId }) =>
    seriesVersionId === 102 ? seriesVersionV2 : seriesVersionV1,
  );
  getMessageBodyMock.mockResolvedValue({
    message_id: 202,
    subject: "[PATCH v2 0/2] mm: reclaim tuning",
    body_text:
      "Changes since v1:\n- refreshed reclaim heuristics\n\nBase tree: 3f4ed13b8f6f8f487dbb34557cf95e5ee72f4b96\n\nFull changelog:\n- rebased onto latest mm tree\n- refreshed docs",
    body_html: null,
    diff_text: null,
    has_diff: false,
    has_attachments: false,
    attachments: [],
  });
  getPatchItemFullDiffMock.mockImplementation(async (patchItemId) => {
    if (patchItemId === 1004) {
      return {
        patch_item_id: 1004,
        diff_text: `diff --git a/mm/page_alloc.c b/mm/page_alloc.c
index 3333333..4444444 100644
--- a/mm/page_alloc.c
+++ b/mm/page_alloc.c
@@ -10,1 +10,2 @@ static int compact(void)
+\ttrace_compaction();
 \treturn 0;
`,
      };
    }

    return {
      patch_item_id: patchItemId,
      diff_text: `diff --git a/mm/vmscan.c b/mm/vmscan.c
index 1111111..2222222 100644
--- a/mm/vmscan.c
+++ b/mm/vmscan.c
@@ -1,2 +1,3 @@
static int reclaim(void)
-\treturn 0;
+\ttrace_reclaim();
+\treturn 1;
`,
    };
  });
  getSeriesCompareMock.mockResolvedValue({
    series_id: 10,
    v1: 101,
    v2: 102,
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
        additions_delta: 2,
        deletions_delta: -1,
        hunks_delta: 1,
      },
      {
        path: "mm/unchanged.c",
        status: "unchanged",
        additions_delta: 0,
        deletions_delta: 0,
        hunks_delta: 0,
      },
    ],
  });
  getSearchMock.mockResolvedValue({
    items: searchResults.map((item) => ({
      scope: "series",
      id: item.id,
      title: item.title,
      snippet: item.snippet,
      route: item.route,
      date_utc: item.date_utc,
      list_keys: item.list_keys,
      has_diff: item.has_diff,
      author_email: item.author_email,
      metadata: item.metadata,
    })),
    facets: {},
    highlights: {},
    page_info: { limit: 20, next_cursor: "o20-next", prev_cursor: null, has_more: true },
  });
  setNavigationState("/series/lkml", new URLSearchParams());
});

describe("SeriesWorkspace", () => {
  it("shows UTC tooltip for relative timestamps in series list", async () => {
    renderWorkspace();
    await screen.findByText("mm: reclaim tuning");

    expect(screen.getByTitle("2026-02-13 10:00 UTC")).toBeInTheDocument();
    expect(screen.getAllByText("Merged")[0]).toBeInTheDocument();
    expect(screen.getByText("lkml | 5 total series")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /total series/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument();
  });

  it("renders integrated search controls in the series pane", () => {
    renderWorkspace();

    expect(screen.getByRole("textbox", { name: "Search query" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear search and filters" })).toBeInTheDocument();
  });

  it("navigates to series route from search results while preserving query params", async () => {
    const user = userEvent.setup();
    setNavigationState("/series/lkml", new URLSearchParams("q=net"));
    renderWorkspace();

    await user.click(await screen.findByRole("option", { name: /net: queue balancing/i }));

    expect(routerPushMock).toHaveBeenCalledWith("/series/lkml/900?q=net");
  });

  it("keeps series row parity in search mode with version badges", async () => {
    const user = userEvent.setup();
    setNavigationState("/series/lkml", new URLSearchParams("q=net"));
    renderWorkspace();

    await screen.findByRole("option", { name: /net: queue balancing/i });

    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText(/release v6\.18/i)).toBeInTheDocument();
    expect(screen.queryByText(/^diff$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^mail$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^RFC$/i)).not.toBeInTheDocument();

    await user.click(screen.getByText("net@example.com"));
    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("author=net%40example.com");
  });

  it("normalizes legacy /lists/{list}/series routes from search results", async () => {
    const user = userEvent.setup();
    getSearchMock.mockResolvedValueOnce({
      items: [
        {
          scope: "series",
          id: 901,
          title: "net: queue balancing",
          snippet: "rebalance tx queue setup",
          route: "/lists/lkml/series/901",
          date_utc: "2026-02-13T08:00:00Z",
          list_keys: ["lkml"],
          has_diff: true,
          author_email: "net@example.com",
          metadata: {},
        },
      ],
      facets: {},
      highlights: {},
      page_info: { limit: 20, next_cursor: null, prev_cursor: null, has_more: false },
    });
    setNavigationState("/series/lkml", new URLSearchParams("q=net"));
    renderWorkspace();

    await user.click(await screen.findByRole("option", { name: /net: queue balancing/i }));

    expect(routerPushMock).toHaveBeenCalledWith("/series/lkml/901?q=net");
  });

  it("uses cursor pagination in search mode", async () => {
    const user = userEvent.setup();
    setNavigationState("/series/lkml", new URLSearchParams("q=net&author=net%40example.com"));
    renderWorkspace();

    await user.click(await screen.findByRole("button", { name: "Next page" }));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("q=net");
    expect(lastReplacePath).toContain("author=net%40example.com");
    expect(lastReplacePath).toContain("cursor=o20-next");
    expect(lastReplacePath).not.toContain("series_page=");
  });

  it("toggles search date ordering from newest to oldest", async () => {
    const user = userEvent.setup();
    setNavigationState("/series/lkml", new URLSearchParams("q=net&sort=date_desc"));
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Sort oldest first" }));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("q=net");
    expect(lastReplacePath).toContain("sort=date_asc");
  });

  it("does not change relevance sort via sort order toggle in search mode", async () => {
    const user = userEvent.setup();
    setNavigationState("/series/lkml", new URLSearchParams("q=net"));
    renderWorkspace();

    const replaceCallsBefore = routerReplaceMock.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Sort newest first" }));

    expect(routerReplaceMock.mock.calls.length).toBe(replaceCallsBefore);
  });

  it("applies date ordering even when query text is empty", async () => {
    const user = userEvent.setup();
    setNavigationState("/series/lkml", new URLSearchParams());
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Sort newest first" }));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("sort=date_desc");
    expect(lastReplacePath).not.toContain("q=");
  });

  it("applies author filter from series list author click", async () => {
    const user = userEvent.setup();
    setNavigationState("/series/lkml", new URLSearchParams());
    renderWorkspace();

    await user.click(await screen.findByText("mm@example.com"));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("author=mm%40example.com");
    expect(lastReplacePath).not.toContain("q=");
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("shows versions count in header and subject in dedicated subtitle strip", async () => {
    setNavigationState("/series/lkml/10", new URLSearchParams());
    renderWorkspace({ selectedSeriesId: 10 });

    await screen.findByText("SERIES DETAIL");
    const subject = screen.getByRole("heading", { name: "mm: reclaim tuning" });
    expect(subject).toHaveAttribute("title", "mm: reclaim tuning");
    expect(screen.getByText("1 versions")).toBeInTheDocument();
    expect(screen.getAllByText("Author")[0]).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: V1_BASE_COMMIT.slice(0, 12) }),
    ).toHaveAttribute(
      "href",
      `https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=${V1_BASE_COMMIT}`,
    );
    expect(screen.getByText("Mainline")).toBeInTheDocument();
    expect(screen.getAllByText(/release v6\.17/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: MAINLINE_COMMIT.slice(0, 12) })[0]).toHaveAttribute(
      "href",
      `https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=${MAINLINE_COMMIT}`,
    );
    expect(screen.getByRole("button", { name: "Patchset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Diff" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Version" })).not.toBeInTheDocument();
  });

  it("hides compare state for single-version series and strips stale compare params", async () => {
    routerReplaceMock.mockClear();
    setNavigationState("/series/lkml/10", new URLSearchParams("v1=101&compare_mode=summary"));

    renderWorkspace({ selectedSeriesId: 10 });

    await screen.findByText("SERIES DETAIL");
    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith("/series/lkml/10", { scroll: false });
    });
    expect(screen.queryByRole("button", { name: "Compare" })).not.toBeInTheDocument();
    expect(getSeriesCompareMock).not.toHaveBeenCalled();
  });

  it("renders revision tabs without redundant lineage chrome", async () => {
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionSeriesDetail);
    getSeriesVersionMock.mockImplementationOnce(async () => seriesVersionV2);
    routerReplaceMock.mockClear();
    setNavigationState("/series/lkml/10", new URLSearchParams());

    renderWorkspace({ selectedSeriesId: 10 });

    await screen.findByText("SERIES DETAIL");
    const tablist = screen.getByRole("tablist", { name: "Series revisions" });
    expect(within(tablist).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "PATCH v2",
      "PATCH v1",
    ]);
    expect(screen.getByText("COVER LETTER")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lkml · 9 msgs/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discussion" })).toBeInTheDocument();
    expect(screen.queryByText(/final/i)).not.toBeInTheDocument();
    expect(screen.queryByText("LINEAGE")).not.toBeInTheDocument();
    expect(screen.queryByText(/selected v/i)).not.toBeInTheDocument();
    expect(within(tablist).queryByText(/^latest$/i)).not.toBeInTheDocument();
    expect(within(tablist).queryByText(/patches/i)).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "PATCH v2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "PATCH v2" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PATCH v2" })).toBeInTheDocument();
    expect(await screen.findByText(/Changes since v1/i)).toBeInTheDocument();
    expect(screen.getByText(/Full changelog:/i)).toBeInTheDocument();
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });

  it("formats RFC revision tabs without a v1 suffix", async () => {
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionRfcSeriesDetail);
    getSeriesVersionMock.mockImplementationOnce(async () => seriesVersionV2);
    setNavigationState("/series/lkml/10", new URLSearchParams());

    renderWorkspace({ selectedSeriesId: 10 });

    const tablist = await screen.findByRole("tablist", { name: "Series revisions" });
    expect(within(tablist).getByRole("tab", { name: "RFC" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "RFC v2" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "RFC v2" })).toBeInTheDocument();
  });

  it("opens the revision discussion thread with the cover message selected", async () => {
    const user = userEvent.setup();
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionSeriesDetail);
    getSeriesVersionMock.mockImplementationOnce(async () => seriesVersionV2);
    setNavigationState("/series/lkml/10", new URLSearchParams());

    renderWorkspace({ selectedSeriesId: 10 });

    await user.click(await screen.findByRole("button", { name: "Discussion" }));

    expect(routerPushMock).toHaveBeenCalledWith("/threads/lkml/2?message=202");
  });

  it("switches revisions in place and clears compare params", async () => {
    const user = userEvent.setup();
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionSeriesDetail);
    setNavigationState("/series/lkml/10", new URLSearchParams("v1=101&v2=102&compare_mode=per_patch"));

    renderWorkspace({ selectedSeriesId: 10 });

    await user.click(await screen.findByRole("tab", { name: "PATCH v1" }));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("/series/lkml/10");
    expect(lastReplacePath).toContain("version=101");
    expect(lastReplacePath).not.toContain("v1=");
    expect(lastReplacePath).not.toContain("v2=");
  });

  it("supports keyboard navigation across revision tabs", async () => {
    const user = userEvent.setup();
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionSeriesDetail);
    routerReplaceMock.mockClear();
    setNavigationState("/series/lkml/10", new URLSearchParams());

    renderWorkspace({ selectedSeriesId: 10 });

    const selectedTab = await screen.findByRole("tab", { name: "PATCH v2" });
    selectedTab.focus();

    await user.keyboard("{ArrowRight}");

    await waitFor(() => {
      const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
      expect(lastReplacePath).toContain("version=101");
    });
    expect(screen.getByRole("tab", { name: "PATCH v1" })).toHaveFocus();
  });

  it("opens compare as a full detail mode for the selected revision", async () => {
    const user = userEvent.setup();
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionSeriesDetail);
    getSeriesVersionMock.mockImplementationOnce(async () => seriesVersionV2);
    routerReplaceMock.mockClear();
    setNavigationState("/series/lkml/10", new URLSearchParams());

    renderWorkspace({ selectedSeriesId: 10 });

    await user.click(await screen.findByRole("button", { name: "Compare" }));

    await waitFor(() => {
      const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
      expect(lastReplacePath).toContain("/series/lkml/10");
      expect(lastReplacePath).toContain("mode=compare");
      expect(lastReplacePath).toContain("v1=101");
      expect(lastReplacePath).toContain("v2=102");
      expect(lastReplacePath).not.toContain("compare_mode");
    });
  });

  it("opens in-series diff mode from patch exploration controls without patch query state", async () => {
    const user = userEvent.setup();
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionSeriesDetail);
    getSeriesVersionMock.mockImplementationOnce(async () => seriesVersionV2);
    routerReplaceMock.mockClear();
    setNavigationState("/series/lkml/10", new URLSearchParams());

    renderWorkspace({ selectedSeriesId: 10 });

    const patchItemsTitle = await screen.findByText("PATCH ITEMS");
    const patchItemsSection = patchItemsTitle.closest("section");
    if (!patchItemsSection) {
      throw new Error("Expected patch items section");
    }

    await user.click(
      within(patchItemsSection).getByRole("button", { name: /mm: reclaim tuning/i }),
    );

    await waitFor(() => {
      const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
      expect(lastReplacePath).toContain("mode=diff");
      expect(lastReplacePath).not.toContain("patch=");
    });
  });

  it("renders stacked patch diffs and strips legacy diff params", async () => {
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionSeriesDetail);
    getSeriesVersionMock.mockImplementationOnce(async () => seriesVersionV2);
    routerReplaceMock.mockClear();
    setNavigationState(
      "/series/lkml/10",
      new URLSearchParams("mode=diff&patch=1003&path=mm%2Fvmscan.c&view=file&diff_view=split"),
    );

    renderWorkspace({ selectedSeriesId: 10 });

    expect(await screen.findByText("PATCH DIFF")).toBeInTheDocument();
    const diffStack = document.querySelector(".series-diff-stack") as HTMLElement | null;
    if (!diffStack) {
      throw new Error("Expected diff stack");
    }
    expect(within(diffStack).getByText("mm: reclaim tuning")).toBeInTheDocument();
    expect(within(diffStack).getByText("mm: reclaim cleanup")).toBeInTheDocument();
    await waitFor(() => {
      expect(getPatchItemFullDiffMock).toHaveBeenCalledWith(1003);
      expect(getPatchItemFullDiffMock).toHaveBeenCalledWith(1004);
    });

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("mode=diff");
    expect(lastReplacePath).not.toContain("diff_view=");
    expect(lastReplacePath).not.toContain("patch=");
    expect(lastReplacePath).not.toContain("path=");
    expect(lastReplacePath).not.toContain("&view=");
    expect(screen.queryByRole("combobox", { name: "Patch" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Files" })).not.toBeInTheDocument();
  });

  it("keeps diff view controls local to each patch section", async () => {
    const user = userEvent.setup();
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionSeriesDetail);
    getSeriesVersionMock.mockImplementationOnce(async () => seriesVersionV2);
    setNavigationState("/series/lkml/10", new URLSearchParams("mode=diff"));

    renderWorkspace({ selectedSeriesId: 10 });

    const patchDiffTitle = await screen.findByText("PATCH DIFF");
    const patchDiffSection = patchDiffTitle.closest("section");
    if (!patchDiffSection) {
      throw new Error("Expected patch diff section");
    }

    await waitFor(() => {
      expect(getPatchItemFullDiffMock).toHaveBeenCalledWith(1003);
      expect(getPatchItemFullDiffMock).toHaveBeenCalledWith(1004);
    });

    const firstPatchSection = within(patchDiffSection)
      .getByText("mm: reclaim tuning")
      .closest(".series-diff-section") as HTMLElement | null;
    const secondPatchSection = within(patchDiffSection)
      .getByText("mm: reclaim cleanup")
      .closest(".series-diff-section") as HTMLElement | null;

    if (!firstPatchSection || !secondPatchSection) {
      throw new Error("Expected stacked patch sections");
    }

    const replaceCallsBefore = routerReplaceMock.mock.calls.length;

    await user.click(within(firstPatchSection).getByRole("button", { name: "Split" }));

    expect(
      within(firstPatchSection).getByRole("button", { name: "Split" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(secondPatchSection).getByRole("button", { name: "Unified" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(routerReplaceMock).toHaveBeenCalledTimes(replaceCallsBefore);
  });

  it("uses file compare only and omits unchanged file rows", async () => {
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionSeriesDetail);
    getSeriesVersionMock.mockImplementationOnce(async () => seriesVersionV2);
    setNavigationState("/series/lkml/10", new URLSearchParams("mode=compare&v1=101&v2=102"));

    renderWorkspace({ selectedSeriesId: 10 });

    await waitFor(() => {
      expect(getSeriesCompareMock).toHaveBeenLastCalledWith({
        seriesId: 10,
        v1: 101,
        v2: 102,
        mode: "per_file",
      });
    });

    expect(screen.queryByRole("button", { name: "Patches" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Files" })).not.toBeInTheDocument();
    expect(screen.getByText("1 unchanged files omitted.")).toBeInTheDocument();
    expect(screen.getByText("mm/vmscan.c")).toBeInTheDocument();
    expect(screen.getByText("delta: adds +2 · dels -1 · hunks +1")).toBeInTheDocument();
    expect(screen.queryByText("mm/unchanged.c")).not.toBeInTheDocument();
  });

  it("shows per-patch mainline commit metadata in patchset detail", async () => {
    setNavigationState("/series/lkml/10", new URLSearchParams());
    renderWorkspace({ selectedSeriesId: 10 });

    await screen.findByText("PATCH ITEMS");

    expect(screen.getAllByRole("link", { name: MAINLINE_COMMIT.slice(0, 12) }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/release v6.17/i).length).toBeGreaterThan(0);
  });

  it("loads later patch diffs only after viewport intersection when observers are available", async () => {
    const originalObserver = window.IntersectionObserver;
    const observed = new Map<Element, IntersectionObserverCallback>();

    class TestIntersectionObserver {
      private readonly callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        observed.set(target, this.callback);
      }

      unobserve(target: Element) {
        observed.delete(target);
      }

      disconnect() {
        observed.clear();
      }

      takeRecords() {
        return [];
      }
    }

    window.IntersectionObserver = TestIntersectionObserver as unknown as typeof IntersectionObserver;

    const seriesVersionWithThreePatches: SeriesVersionResponse = {
      ...seriesVersionV2,
      patch_items: [
        ...seriesVersionV2.patch_items,
        {
          patch_item_id: 1005,
          ordinal: 3,
          total: 3,
          item_type: "patch",
          subject: "[PATCH v2 3/3] mm: reclaim tracing",
          subject_norm: "mm: reclaim tracing",
          commit_subject: "mm: reclaim tracing",
          commit_subject_norm: "mm: reclaim tracing",
          message_id: 305,
          message_id_primary: "msg-305",
          patch_id_stable: "patch-v2-tracing",
          has_diff: true,
          file_count: 1,
          additions: 5,
          deletions: 0,
          hunks: 1,
          inherited_from_version_num: null,
          mainline_commit: null,
        },
      ],
    };

    getSeriesDetailMock.mockResolvedValueOnce({
      ...multiVersionSeriesDetail,
      versions: multiVersionSeriesDetail.versions.map((version) =>
        version.series_version_id === 102
          ? { ...version, patch_count: 3 }
          : version,
      ),
    });
    getSeriesVersionMock.mockImplementationOnce(async () => seriesVersionWithThreePatches);
    getPatchItemFullDiffMock.mockImplementation(async (patchItemId) => ({
      patch_item_id: patchItemId,
      diff_text: `diff --git a/mm/file-${patchItemId}.c b/mm/file-${patchItemId}.c
index 1111111..2222222 100644
--- a/mm/file-${patchItemId}.c
+++ b/mm/file-${patchItemId}.c
@@ -1,1 +1,2 @@
+return ${patchItemId};
 return 0;
`,
    }));

    setNavigationState("/series/lkml/10", new URLSearchParams("mode=diff"));
    renderWorkspace({ selectedSeriesId: 10 });

    await waitFor(() => {
      expect(getPatchItemFullDiffMock).toHaveBeenCalledWith(1003);
      expect(getPatchItemFullDiffMock).toHaveBeenCalledWith(1004);
    });
    expect(getPatchItemFullDiffMock).not.toHaveBeenCalledWith(1005);

    const thirdSection = document.getElementById("patch-1005");
    if (!thirdSection) {
      throw new Error("Expected third patch section");
    }

    await act(async () => {
      observed.get(thirdSection)?.(
        [{ isIntersecting: true, target: thirdSection } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    await waitFor(() => {
      expect(getPatchItemFullDiffMock).toHaveBeenCalledWith(1005);
    });

    window.IntersectionObserver = originalObserver;
  });
});
