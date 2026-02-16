import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SeriesWorkspace } from "@/components/series-workspace";
import type { ListSummary, PaginationResponse, SeriesListItem } from "@/lib/api/contracts";
import type { IntegratedSearchRow } from "@/lib/api/server-data";
import {
  routerPushMock,
  routerReplaceMock,
  setNavigationState,
} from "@/tests/mocks/navigation";

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
    last_seen_at: "2026-02-13T10:00:00Z",
    latest_version_num: 2,
    is_rfc_latest: false,
  },
];

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
  },
];

function renderWorkspace() {
  return render(
    <SeriesWorkspace
      lists={lists}
      selectedListKey="lkml"
      seriesItems={seriesItems}
      seriesPagination={pagination}
      searchResults={[]}
      searchNextCursor={null}
      selectedSeriesId={null}
      seriesDetail={null}
      selectedVersion={null}
      compare={null}
    />,
  );
}

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
    setNavigationState("/series", new URLSearchParams("q=net"));

    render(
      <SeriesWorkspace
        lists={lists}
        selectedListKey="lkml"
        seriesItems={[]}
        seriesPagination={pagination}
        searchResults={searchResults}
        searchNextCursor={null}
        selectedSeriesId={null}
        seriesDetail={null}
        selectedVersion={null}
        compare={null}
      />,
    );

    await user.click(screen.getByRole("option", { name: /net: queue balancing/i }));

    expect(routerPushMock).toHaveBeenCalledWith("/series/900?q=net");
  });

  it("uses cursor pagination in search mode", async () => {
    const user = userEvent.setup();
    setNavigationState("/series", new URLSearchParams("q=net&author=net%40example.com"));

    render(
      <SeriesWorkspace
        lists={lists}
        selectedListKey="lkml"
        seriesItems={[]}
        seriesPagination={pagination}
        searchResults={searchResults}
        searchNextCursor="o20-next"
        selectedSeriesId={null}
        seriesDetail={null}
        selectedVersion={null}
        compare={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Next page" }));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("q=net");
    expect(lastReplacePath).toContain("author=net%40example.com");
    expect(lastReplacePath).toContain("cursor=o20-next");
    expect(lastReplacePath).not.toContain("series_page=");
  });
});
