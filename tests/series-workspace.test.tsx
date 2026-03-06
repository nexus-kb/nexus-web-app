import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@nexus/design-system";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeriesWorkspace } from "@/components/series-workspace";
import {
  getListDetail,
  getLists,
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
  },
];

const seriesDetail: SeriesDetailResponse = {
  series_id: 10,
  canonical_subject: "mm: reclaim tuning",
  author: { name: null, email: "mm@example.com" },
  first_seen_at: "2026-02-10T10:00:00Z",
  last_seen_at: "2026-02-13T10:00:00Z",
  lists: ["lkml"],
  versions: [
    {
      series_version_id: 101,
      version_num: 1,
      is_rfc: false,
      is_resend: false,
      sent_at: "2026-02-10T10:00:00Z",
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
    },
  ],
  latest_version_id: 102,
};

const seriesVersionV1 = {
  series_id: 10,
  series_version_id: 101,
  version_num: 1,
  is_rfc: false,
  is_resend: false,
  is_partial_reroll: false,
  sent_at: "2026-02-10T10:00:00Z",
  subject: "[PATCH 0/1] mm: reclaim tuning",
  subject_norm: "mm: reclaim tuning",
  cover_message_id: null,
  first_patch_message_id: null,
  assembled: true,
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
    },
  ],
};

const seriesVersionV2 = {
  series_id: 10,
  series_version_id: 102,
  version_num: 2,
  is_rfc: false,
  is_resend: false,
  is_partial_reroll: true,
  sent_at: "2026-02-11T10:00:00Z",
  subject: "[PATCH v2 0/2] mm: reclaim tuning",
  subject_norm: "mm: reclaim tuning",
  cover_message_id: 202,
  first_patch_message_id: 302,
  assembled: true,
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

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.themeMode = "system";
  document.documentElement.dataset.navCollapsed = "false";
  document.documentElement.dataset.densityMode = "comfortable";
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
  getSeriesCompareMock.mockResolvedValue({
    series_id: 10,
    v1: 101,
    v2: 102,
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
        title_norm: "mm: reclaim tuning",
        status: "changed",
        v1_patch_item_id: 1001,
        v1_patch_id_stable: "patch-v1",
        v1_subject: "[PATCH 1/1] mm: reclaim tuning",
        v2_patch_item_id: 1003,
        v2_patch_id_stable: "patch-v2",
        v2_subject: "[PATCH v2 1/2] mm: reclaim tuning",
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
    expect(screen.queryByText(/^diff$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^mail$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/RFC/i)).toBeInTheDocument();

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
    expect(screen.getByText(/author: mm@example.com/i)).toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: /compare to/i })).not.toBeInTheDocument();
    expect(getSeriesCompareMock).not.toHaveBeenCalled();
  });

  it("renders revision navigator and discussion links for multi-version series", async () => {
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionSeriesDetail);
    getSeriesVersionMock.mockImplementationOnce(async () => seriesVersionV2);
    routerReplaceMock.mockClear();
    setNavigationState("/series/lkml/10", new URLSearchParams());

    renderWorkspace({ selectedSeriesId: 10 });

    await screen.findByText("SERIES DETAIL");
    expect(screen.getByText("REVISIONS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lkml discussion/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compare to v1/i })).toBeInTheDocument();
    expect(screen.queryByText("REVISION DELTA")).not.toBeInTheDocument();
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });

  it("opens the revision discussion thread with the cover message selected", async () => {
    const user = userEvent.setup();
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionSeriesDetail);
    getSeriesVersionMock.mockImplementationOnce(async () => seriesVersionV2);
    setNavigationState("/series/lkml/10", new URLSearchParams());

    renderWorkspace({ selectedSeriesId: 10 });

    await user.click(await screen.findByRole("button", { name: /lkml discussion/i }));

    expect(routerPushMock).toHaveBeenCalledWith("/threads/lkml/2?message=202");
  });

  it("switches revisions in place and clears compare params", async () => {
    const user = userEvent.setup();
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionSeriesDetail);
    setNavigationState("/series/lkml/10", new URLSearchParams("v1=101&v2=102&compare_mode=per_patch"));

    renderWorkspace({ selectedSeriesId: 10 });

    await user.click(await screen.findByRole("button", { name: /v1/i }));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("/series/lkml/10");
    expect(lastReplacePath).toContain("version=101");
    expect(lastReplacePath).not.toContain("v1=");
    expect(lastReplacePath).not.toContain("v2=");
  });

  it("opens compare as a secondary drawer for the selected revision", async () => {
    const user = userEvent.setup();
    getSeriesDetailMock.mockResolvedValueOnce(multiVersionSeriesDetail);
    getSeriesVersionMock.mockImplementationOnce(async () => seriesVersionV2);
    routerReplaceMock.mockClear();
    setNavigationState("/series/lkml/10", new URLSearchParams());

    renderWorkspace({ selectedSeriesId: 10 });

    await user.click(await screen.findByRole("button", { name: /compare to v1/i }));

    expect(routerReplaceMock).toHaveBeenCalledWith("/series/lkml/10?version=102&v1=101&v2=102&compare_mode=per_patch", { scroll: false });
  });
});
