import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeriesWorkspace } from "@/components/series-workspace";
import {
  getLists,
  getSearch,
  getSeries,
  getSeriesCompare,
  getSeriesDetail,
  getSeriesVersion,
} from "@/lib/api/server-client";
import type {
  ListSummary,
  PaginationResponse,
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

const pagination: PaginationResponse = {
  page: 1,
  page_size: 30,
  total_items: 2,
  total_pages: 1,
  has_prev: false,
  has_next: false,
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
      thread_refs: [{ list_key: "lkml", thread_id: 1 }],
      patch_count: 1,
      is_partial_reroll: false,
    },
  ],
  latest_version_id: 101,
};

const searchResults: IntegratedSearchRow[] = [
  {
    id: 900,
    route: "/series/lkml/900",
    title: "net: queue balancing",
    snippet: "rebalance tx queue setup",
    date_utc: "2026-02-13T08:00:00Z",
    list_keys: ["netdev"],
    author_email: "net@example.com",
    has_diff: true,
  },
];

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SeriesWorkspace selectedListKey="lkml" selectedSeriesId={null} />
    </QueryClientProvider>,
  );
}

const getListsMock = vi.mocked(getLists);
const getSeriesMock = vi.mocked(getSeries);
const getSeriesDetailMock = vi.mocked(getSeriesDetail);
const getSeriesVersionMock = vi.mocked(getSeriesVersion);
const getSeriesCompareMock = vi.mocked(getSeriesCompare);
const getSearchMock = vi.mocked(getSearch);

beforeEach(() => {
  getListsMock.mockResolvedValue({
    items: lists,
    pagination: {
      page: 1,
      page_size: 1,
      total_items: 1,
      total_pages: 1,
      has_prev: false,
      has_next: false,
    },
  });
  getSeriesMock.mockResolvedValue({
    items: seriesItems,
    pagination,
  });
  getSeriesDetailMock.mockResolvedValue(seriesDetail);
  getSeriesVersionMock.mockResolvedValue({
    series_id: 10,
    series_version_id: 101,
    version_num: 1,
    is_rfc: false,
    is_resend: false,
    is_partial_reroll: false,
    sent_at: "2026-02-10T10:00:00Z",
    subject: "mm: reclaim tuning",
    subject_norm: "mm: reclaim tuning",
    cover_message_id: null,
    first_patch_message_id: null,
    assembled: true,
    patch_items: [],
  });
  getSeriesCompareMock.mockResolvedValue({
    series_id: 10,
    v1: 101,
    v2: 101,
    mode: "summary",
    summary: {
      v1_patch_count: 1,
      v2_patch_count: 1,
      patch_count_delta: 0,
      changed: 0,
      added: 0,
      removed: 0,
    },
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
      metadata: {},
    })),
    facets: {},
    highlights: {},
    next_cursor: "o20-next",
  });
  setNavigationState("/series/lkml", new URLSearchParams());
});

describe("SeriesWorkspace", () => {
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

  it("applies author filter from series detail author badge click", async () => {
    const user = userEvent.setup();
    setNavigationState("/series/lkml/10", new URLSearchParams());
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SeriesWorkspace selectedListKey="lkml" selectedSeriesId={10} />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "mm@example.com" }));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("author=mm%40example.com");
    expect(lastReplacePath).not.toContain("q=");
    expect(routerPushMock).not.toHaveBeenCalled();
  });
});
