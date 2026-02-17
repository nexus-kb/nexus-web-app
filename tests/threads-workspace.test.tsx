import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { vi } from "vitest";
import { ThreadsWorkspace } from "@/components/threads-workspace";
import type { IntegratedSearchRow } from "@/lib/api/server-data";
import type {
  ListSummary,
  PaginationResponse,
  ThreadDetailResponse,
  ThreadListItem,
} from "@/lib/api/contracts";
import { STORAGE_KEYS } from "@/lib/ui/preferences";
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

const threads: ThreadListItem[] = [
  {
    thread_id: 1,
    subject: "[PATCH] test one",
    root_message_id: 11,
    last_activity_at: "2026-02-13T12:22:31Z",
    message_count: 3,
    participants: [{ name: "A", email: "a@example.com" }],
    has_diff: true,
  },
  {
    thread_id: 2,
    subject: "[PATCH] test two",
    root_message_id: 22,
    last_activity_at: "2026-02-13T11:10:00Z",
    message_count: 2,
    participants: [{ name: "B", email: "b@example.com" }],
    has_diff: false,
  },
];

const detail: ThreadDetailResponse = {
  thread_id: 1,
  list_key: "lkml",
  subject: "[PATCH] test one",
  membership_hash: "abc123",
  last_activity_at: "2026-02-13T12:22:31Z",
  messages: [
    {
      message_id: 7002,
      parent_message_id: null,
      depth: 0,
      sort_key: "0001",
      from: { name: "A", email: "a@example.com" },
      date_utc: "2026-02-13T12:00:00Z",
      subject: "[PATCH] test one",
      has_diff: true,
      snippet: "Snippet",
      body_text: null,
      patch_item_id: 9001,
    },
    {
      message_id: 7003,
      parent_message_id: 7002,
      depth: 1,
      sort_key: "0001.0001",
      from: { name: "B", email: "b@example.com" },
      date_utc: "2026-02-13T12:01:00Z",
      subject: "Re: [PATCH] test one",
      has_diff: false,
      snippet: "Reply",
      body_text: null,
      patch_item_id: null,
    },
  ],
};

const threadsPagination: PaginationResponse = {
  page: 1,
  page_size: 50,
  total_items: 2,
  total_pages: 1,
  has_prev: false,
  has_next: false,
};

const threadSearchResults: IntegratedSearchRow[] = [
  {
    id: 501,
    route: "/lkml/threads/501",
    title: "mm: reclaim tuning",
    snippet: "balanced reclaim pressure",
    date_utc: "2026-02-13T10:00:00Z",
    list_keys: ["lkml"],
    author_email: "mm@example.com",
    has_diff: true,
  },
  {
    id: 502,
    route: "/lkml/threads/502",
    title: "sched: latency review",
    snippet: "scheduler latency notes",
    date_utc: "2026-02-13T09:00:00Z",
    list_keys: ["lkml"],
    author_email: "sched@example.com",
    has_diff: false,
  },
];

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function installMessageBodyFetchMock() {
  const messageBodies: Record<
    number,
    { body: string; diffText: string | null; subject: string; hasDiff: boolean }
  > = {
    7002: {
      subject: "[PATCH] test one",
      body:
        "This patch wires lruvec stat flush into node-local accounting.\n\n---\n mm/vmscan.c | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)\n\ndiff --git a/mm/vmscan.c b/mm/vmscan.c\n@@ -1 +1 @@\n-old\n+new\n",
      diffText: "diff --git a/mm/vmscan.c b/mm/vmscan.c\n@@ -1 +1 @@\n-old\n+new\n",
      hasDiff: true,
    },
    7003: {
      subject: "Re: [PATCH] test one",
      body: [
        "Can you share numbers from a memcg-heavy reclaim case?",
        "",
        "> prior context",
        "> > nested context",
        "  > > > deepest context",
        "plain > symbol",
      ].join("\n"),
      diffText: null,
      hasDiff: false,
    },
  };

  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : String(input);

    const url = new URL(rawUrl, "http://localhost");
    const messageMatch = url.pathname.match(/^\/api\/messages\/(\d+)\/body$/);
    if (!messageMatch) {
      return new Response("Not found", { status: 404, statusText: "Not Found" });
    }

    const messageId = Number(messageMatch[1]);
    const includeDiff = url.searchParams.get("include_diff") === "true";
    const bodyRecord = messageBodies[messageId];
    if (!bodyRecord) {
      return new Response("Not found", { status: 404, statusText: "Not Found" });
    }

    return jsonResponse({
      message_id: messageId,
      subject: bodyRecord.subject,
      body_text: bodyRecord.body,
      body_html: null,
      diff_text: includeDiff ? bodyRecord.diffText : null,
      has_diff: bodyRecord.hasDiff,
      has_attachments: false,
      attachments: [],
    });
  });
}

function renderWorkspace(overrides?: Partial<ComponentProps<typeof ThreadsWorkspace>>) {
  return render(
    <ThreadsWorkspace
      lists={lists}
      listKey="lkml"
      threads={threads}
      threadsPagination={threadsPagination}
      searchResults={[]}
      searchNextCursor={null}
      detail={detail}
      selectedThreadId={1}
      initialMessage={undefined}
      {...overrides}
    />,
  );
}

function getThreadDetailScope() {
  const [detailRegion] = screen.getAllByRole("region", { name: "Thread detail" });
  return within(detailRegion);
}

describe("ThreadsWorkspace", () => {
  it("renders the redesigned thread list header and row metadata", () => {
    renderWorkspace({ selectedThreadId: null, detail: null });

    const [threadList] = screen.getAllByRole("region", { name: "Thread list" });
    const listScope = within(threadList);

    expect(listScope.getByText("LIST")).toBeInTheDocument();
    expect(listScope.getByText("lkml | 2 threads")).toBeInTheDocument();

    const subject = listScope.getByText("[PATCH] test one");
    expect(subject).toHaveAttribute("title", "[PATCH] test one");
    expect(listScope.getByText("A")).toBeInTheDocument();
    expect(listScope.getAllByText(/created:/i).length).toBeGreaterThan(0);
    expect(listScope.queryByText(/^diff$/i)).not.toBeInTheDocument();
  });

  it("renders integrated search controls in the thread list pane", () => {
    renderWorkspace({ selectedThreadId: null, detail: null });

    expect(screen.getByRole("textbox", { name: "Search query" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear search and filters" })).toBeInTheDocument();
  });

  it("applies integrated search filters explicitly on submit", async () => {
    const user = userEvent.setup();
    renderWorkspace({ selectedThreadId: null, detail: null });

    await user.type(screen.getByRole("textbox", { name: "Search query" }), "reclaim");
    await user.click(screen.getByRole("button", { name: "Run search" }));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("/lkml/threads?");
    expect(lastReplacePath).toContain("q=reclaim");
    expect(lastReplacePath).not.toContain("cursor=");
    expect(lastReplacePath).not.toContain("threads_page=");
  });

  it("clears integrated search params and returns to browse mode", async () => {
    const user = userEvent.setup();
    setNavigationState(
      "/lkml/threads",
      new URLSearchParams("q=memcg&author=dev%40example.com&cursor=o20-h1"),
    );

    renderWorkspace({
      selectedThreadId: null,
      detail: null,
      searchResults: threadSearchResults,
      searchNextCursor: "o20-h2",
    });

    await user.click(screen.getByRole("button", { name: "Clear search and filters" }));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toBe("/lkml/threads");
  });

  it("renders search rows and navigates with preserved search params", async () => {
    const user = userEvent.setup();
    setNavigationState("/lkml/threads", new URLSearchParams("q=memcg"));

    renderWorkspace({
      selectedThreadId: null,
      detail: null,
      searchResults: threadSearchResults,
      searchNextCursor: null,
    });

    const searchButton = screen.getByRole("option", { name: /mm: reclaim tuning/i });
    await user.click(searchButton);

    expect(routerPushMock).toHaveBeenCalledWith("/lkml/threads/501?q=memcg");
  });

  it("loads next search page by updating only cursor-related state", async () => {
    const user = userEvent.setup();
    setNavigationState(
      "/lkml/threads",
      new URLSearchParams("q=memcg&author=dev%40example.com"),
    );

    renderWorkspace({
      selectedThreadId: null,
      detail: null,
      searchResults: threadSearchResults,
      searchNextCursor: "o20-h2",
    });

    await user.click(screen.getByRole("button", { name: "Next page" }));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("q=memcg");
    expect(lastReplacePath).toContain("author=dev%40example.com");
    expect(lastReplacePath).toContain("cursor=o20-h2");
    expect(lastReplacePath).not.toContain("threads_page=");
  });

  it("toggles search date ordering from newest to oldest", async () => {
    const user = userEvent.setup();
    setNavigationState("/lkml/threads", new URLSearchParams("q=memcg&sort=date_desc"));

    renderWorkspace({
      selectedThreadId: null,
      detail: null,
      searchResults: threadSearchResults,
      searchNextCursor: null,
    });

    await user.click(screen.getByRole("button", { name: "Sort oldest first" }));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("q=memcg");
    expect(lastReplacePath).toContain("sort=date_asc");
  });

  it("does not change relevance sort via sort order toggle in search mode", async () => {
    const user = userEvent.setup();
    setNavigationState("/lkml/threads", new URLSearchParams("q=memcg"));

    renderWorkspace({
      selectedThreadId: null,
      detail: null,
      searchResults: threadSearchResults,
      searchNextCursor: null,
    });

    const replaceCallsBefore = routerReplaceMock.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Sort newest first" }));

    expect(routerReplaceMock.mock.calls.length).toBe(replaceCallsBefore);
  });

  it("applies date ordering even when query text is empty", async () => {
    const user = userEvent.setup();
    setNavigationState("/lkml/threads", new URLSearchParams());

    renderWorkspace({
      selectedThreadId: null,
      detail: null,
      searchResults: [],
      searchNextCursor: null,
    });

    await user.click(screen.getByRole("button", { name: "Sort newest first" }));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("sort=date_desc");
    expect(lastReplacePath).not.toContain("q=");
  });

  it("applies author filter from thread author badge click", async () => {
    const user = userEvent.setup();
    setNavigationState("/lkml/threads", new URLSearchParams());

    renderWorkspace({
      selectedThreadId: null,
      detail: null,
      searchResults: [],
      searchNextCursor: null,
    });

    await user.click(screen.getByText("A"));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("author=a%40example.com");
    expect(lastReplacePath).not.toContain("q=");
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("applies author filter from conversation author click", async () => {
    const user = userEvent.setup();
    setNavigationState("/lkml/threads/1", new URLSearchParams());

    renderWorkspace({
      searchResults: [],
      searchNextCursor: null,
    });

    await user.click(screen.getByText(/a@example\.com/i));

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("author=a%40example.com");
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("keeps filters collapsed by default even with sort query params", () => {
    setNavigationState("/lkml/threads", new URLSearchParams("sort=date_desc"));

    renderWorkspace({
      selectedThreadId: null,
      detail: null,
      searchResults: [],
      searchNextCursor: null,
    });

    expect(screen.getByRole("button", { name: "Filters" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("allows switching sort type back to relevance", async () => {
    const user = userEvent.setup();
    setNavigationState("/lkml/threads", new URLSearchParams("q=memcg&sort=date_desc"));

    renderWorkspace({
      selectedThreadId: null,
      detail: null,
      searchResults: threadSearchResults,
      searchNextCursor: null,
    });

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort type" }), "relevance");

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("q=memcg");
    expect(lastReplacePath).not.toContain("sort=");
  });

  it("auto-switches hybrid mode based on semantic ratio", async () => {
    const user = userEvent.setup();
    setNavigationState("/lkml/threads", new URLSearchParams("q=memcg"));

    renderWorkspace({
      selectedThreadId: null,
      detail: null,
      searchResults: threadSearchResults,
      searchNextCursor: null,
    });

    await user.click(screen.getByRole("button", { name: "Filters" }));

    const slider = screen.getByRole("slider", { name: "Semantic weight" });
    fireEvent.change(slider, { target: { value: "0.45" } });

    let lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("q=memcg");
    expect(lastReplacePath).toContain("hybrid=true");
    expect(lastReplacePath).toContain("semantic_ratio=0.45");

    fireEvent.change(slider, { target: { value: "0" } });
    lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("q=memcg");
    expect(lastReplacePath).not.toContain("hybrid=true");
    expect(lastReplacePath).not.toContain("semantic_ratio=");
  });

  it("shows the pick-list empty state when no list is selected", () => {
    renderWorkspace({
      listKey: null,
      threads: [],
      detail: null,
      selectedThreadId: null,
      threadsPagination: {
        page: 1,
        page_size: 50,
        total_items: 0,
        total_pages: 1,
        has_prev: false,
        has_next: false,
      },
    });

    expect(screen.getAllByRole("heading", { name: "Select a list" })).toHaveLength(2);
    expect(
      screen.getByText("Pick a mailing list from the sidebar to browse thread conversations."),
    ).toBeInTheDocument();
  });

  it("persists and applies theme changes", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    const themeButton = screen.getByRole("button", { name: /Theme: system/i });
    await user.click(themeButton);
    await user.click(themeButton);

    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe("dark");
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(routerReplaceMock).not.toHaveBeenCalledWith(
      expect.stringContaining("theme=dark"),
      expect.anything(),
    );
  });

  it("persists pane resize width", () => {
    renderWorkspace();

    const separator = screen.getByRole("separator", {
      name: "Resize thread list and detail panes",
    });

    fireEvent.pointerDown(separator, { clientX: 100 });
    fireEvent.pointerMove(window, { clientX: 260 });
    fireEvent.pointerUp(window);

    const stored = localStorage.getItem(STORAGE_KEYS.paneLayout);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored ?? "{}");
    expect(parsed.centerWidth).toBeGreaterThan(420);
  });

  it("navigates selected thread with keyboard", () => {
    renderWorkspace({ selectedThreadId: null, detail: null });

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(routerPushMock).toHaveBeenCalledWith("/lkml/threads/2");
  });

  it("toggles left rail collapse state", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));

    expect(localStorage.getItem(STORAGE_KEYS.nav)).toBe("collapsed");
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeInTheDocument();
    expect(routerReplaceMock).not.toHaveBeenCalledWith(
      expect.stringContaining("nav=collapsed"),
      expect.anything(),
    );
  });

  it("fetches message body lazily when expanding a message card", async () => {
    const user = userEvent.setup();
    const fetchMock = installMessageBodyFetchMock();

    renderWorkspace();

    const detailScope = getThreadDetailScope();
    await user.click(
      detailScope.getByRole("button", { name: "Toggle message card: [PATCH] test one" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/messages/7002/body?include_diff=false"),
      ),
    ).toBe(true);

    fetchMock.mockRestore();
  });

  it("renders quote depth attributes for conversation preview lines", async () => {
    const user = userEvent.setup();
    const fetchMock = installMessageBodyFetchMock();
    renderWorkspace();

    const detailScope = getThreadDetailScope();
    await user.click(
      detailScope.getByRole("button", {
        name: "Toggle message card: Re: [PATCH] test one",
      }),
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/messages/7003/body?include_diff=false"),
        ),
      ).toBe(true);
    });

    const previewRoot = detailScope
      .getByText(/Can you share numbers from a memcg-heavy reclaim case/i)
      .closest(".conversation-body-preview");
    expect(previewRoot).not.toBeNull();
    if (!previewRoot) {
      throw new Error("Expected conversation body preview to be rendered");
    }

    expect(
      previewRoot.querySelector('.conversation-body-line[data-quote-depth="1"][data-quote-palette="0"]'),
    ).not.toBeNull();
    expect(
      previewRoot.querySelector('.conversation-body-line[data-quote-depth="2"][data-quote-palette="1"]'),
    ).not.toBeNull();
    expect(
      previewRoot.querySelector('.conversation-body-line[data-quote-depth="3"][data-quote-palette="2"]'),
    ).not.toBeNull();

    const plainLine = Array.from(previewRoot.querySelectorAll(".conversation-body-line")).find(
      (node) => node.textContent === "plain > symbol",
    );
    expect(plainLine).toBeDefined();
    if (!plainLine) {
      throw new Error("Expected to find plain non-quoted line");
    }
    expect(plainLine).not.toHaveAttribute("data-quote-depth");
    expect(plainLine).not.toHaveAttribute("data-quote-palette");

    fetchMock.mockRestore();
  });

  it("renders inline diff cards and fetches diff lazily", async () => {
    const user = userEvent.setup();
    const fetchMock = installMessageBodyFetchMock();
    renderWorkspace();

    const detailScope = getThreadDetailScope();
    await user.click(
      detailScope.getByRole("button", { name: "Toggle message card: [PATCH] test one" }),
    );

    const diffToggle = detailScope.getByRole("button", {
      name: "Toggle diff card: [PATCH] test one",
    });
    expect(diffToggle).toHaveTextContent("Expand");
    await user.click(diffToggle);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/messages/7002/body?include_diff=true"),
        ),
      ).toBe(true);
    });
    expect(detailScope.getByRole("button", { name: "Show rich diff view" })).toBeInTheDocument();
    expect(detailScope.getByRole("button", { name: "Show raw diff view" })).toBeInTheDocument();
    expect(
      detailScope.getByRole("button", { name: "Toggle file diff card: mm/vmscan.c" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(detailScope.queryByRole("button", { name: /show diff/i })).not.toBeInTheDocument();

    fetchMock.mockRestore();
  });

  it("resets a message diff card when the message card is collapsed", async () => {
    const user = userEvent.setup();
    const fetchMock = installMessageBodyFetchMock();
    renderWorkspace();

    const detailScope = getThreadDetailScope();
    const messageToggle = detailScope.getByRole("button", {
      name: "Toggle message card: [PATCH] test one",
    });

    await user.click(messageToggle);
    const diffToggle = detailScope.getByRole("button", {
      name: "Toggle diff card: [PATCH] test one",
    });
    await user.click(diffToggle);
    expect(diffToggle).toHaveTextContent("Collapse");

    await user.click(messageToggle);
    expect(
      detailScope.queryByRole("button", { name: "Toggle diff card: [PATCH] test one" }),
    ).not.toBeInTheDocument();

    await user.click(messageToggle);
    expect(
      detailScope.getByRole("button", { name: "Toggle diff card: [PATCH] test one" }),
    ).toHaveTextContent("Expand");

    fetchMock.mockRestore();
  });

  it("does not expose per-message raw or metadata controls", () => {
    renderWorkspace();

    expect(screen.queryByRole("button", { name: "Metadata" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Raw" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Full patch" })).not.toBeInTheDocument();
  });

  it("shows conversation toolbar icons in the header", () => {
    renderWorkspace();

    const detailScope = getThreadDetailScope();

    expect(detailScope.getByText("CONVERSATION")).toBeInTheDocument();
    expect(detailScope.getByText("2 messages")).toBeInTheDocument();

    const detailSubject = detailScope.getByRole("heading", {
      level: 2,
      name: "[PATCH] test one",
    });
    expect(detailSubject).toHaveAttribute("title", "[PATCH] test one");

    const collapseAll = detailScope.getByRole("button", {
      name: "Collapse all message cards and diff cards",
    });
    const expandAll = detailScope.getByRole("button", {
      name: "Expand all message cards and diff cards",
    });

    expect(collapseAll).toHaveClass("rail-icon-button");
    expect(expandAll).toHaveClass("rail-icon-button");
  });

  it("collapse all collapses message and diff cards and clears URL message query", async () => {
    const user = userEvent.setup();
    const fetchMock = installMessageBodyFetchMock();
    renderWorkspace();
    routerReplaceMock.mockClear();

    const detailScope = getThreadDetailScope();
    await user.click(
      detailScope.getByRole("button", { name: "Toggle message card: [PATCH] test one" }),
    );
    await user.click(
      detailScope.getByRole("button", { name: "Toggle diff card: [PATCH] test one" }),
    );
    expect(
      detailScope.getByRole("button", { name: "Toggle diff card: [PATCH] test one" }),
    ).toHaveTextContent("Collapse");

    await user.click(
      detailScope.getByRole("button", {
        name: "Collapse all message cards and diff cards",
      }),
    );

    await waitFor(() => {
      expect(
        detailScope.queryByRole("button", {
          name: "Toggle diff card: [PATCH] test one",
        }),
      ).not.toBeInTheDocument();
    });
    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).not.toContain("message=");

    fetchMock.mockRestore();
  });

  it("expand all expands message and diff cards and sets first message in URL", async () => {
    const user = userEvent.setup();
    const fetchMock = installMessageBodyFetchMock();
    renderWorkspace();
    routerReplaceMock.mockClear();

    const detailScope = getThreadDetailScope();
    await user.click(
      detailScope.getByRole("button", { name: "Expand all message cards and diff cards" }),
    );

    expect(
      detailScope.getByText(/This patch wires lruvec stat flush/i),
    ).toBeInTheDocument();
    expect(
      detailScope.getByText(/Can you share numbers from a memcg-heavy reclaim case/i),
    ).toBeInTheDocument();
    expect(
      detailScope.getByRole("button", { name: "Toggle diff card: [PATCH] test one" }),
    ).toHaveTextContent("Collapse");

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/messages/7002/body?include_diff=true"),
        ),
      ).toBe(true);
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/messages/7003/body?include_diff=false"),
        ),
      ).toBe(true);
    });

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("message=7002");
    fetchMock.mockRestore();
  });

  it("auto-expands the URL-targeted message card on load", async () => {
    const fetchMock = installMessageBodyFetchMock();
    renderWorkspace({ initialMessage: "7003" });

    const detailScope = getThreadDetailScope();
    await waitFor(() => {
      expect(
        detailScope.getByRole("button", {
          name: "Toggle message card: Re: [PATCH] test one",
        }),
      ).toHaveAttribute("aria-expanded", "true");
    });
    expect(
      detailScope.getByText(/Can you share numbers from a memcg-heavy reclaim case/i),
    ).toBeInTheDocument();
    expect(
      detailScope.getByRole("button", { name: "Toggle message card: [PATCH] test one" }),
    ).toHaveAttribute("aria-expanded", "false");

    fetchMock.mockRestore();
  });
});
