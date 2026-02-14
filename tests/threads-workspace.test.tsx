import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { vi } from "vitest";
import { ThreadsWorkspace } from "@/components/threads-workspace";
import { FixtureNexusApiAdapter } from "@/lib/api/adapters/fixture";
import type {
  ListSummary,
  PaginationResponse,
  ThreadDetailResponse,
  ThreadListItem,
} from "@/lib/api/contracts";
import { STORAGE_KEYS } from "@/lib/ui/preferences";
import { routerPushMock, routerReplaceMock } from "@/tests/mocks/navigation";

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

function renderWorkspace(overrides?: Partial<ComponentProps<typeof ThreadsWorkspace>>) {
  return render(
    <ThreadsWorkspace
      lists={lists}
      listKey="lkml"
      threads={threads}
      threadsPagination={threadsPagination}
      detail={detail}
      selectedThreadId={1}
      initialTheme={undefined}
      initialNav={undefined}
      initialMessage={undefined}
      apiConfig={{ mode: "fixture", baseUrl: "" }}
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
    expect(routerReplaceMock).toHaveBeenCalledWith(expect.stringContaining("theme=dark"), {
      scroll: false,
    });
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

    expect(routerPushMock).toHaveBeenCalledWith("/lists/lkml/threads/2");
  });

  it("toggles left rail collapse state", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));

    expect(localStorage.getItem(STORAGE_KEYS.nav)).toBe("collapsed");
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeInTheDocument();
    expect(routerReplaceMock).toHaveBeenCalledWith(expect.stringContaining("nav=collapsed"), {
      scroll: false,
    });
  });

  it("fetches message body lazily when expanding a message card", async () => {
    const user = userEvent.setup();
    const bodySpy = vi.spyOn(FixtureNexusApiAdapter.prototype, "getMessageBody");

    renderWorkspace();

    expect(bodySpy).not.toHaveBeenCalled();

    const detailScope = getThreadDetailScope();
    await user.click(detailScope.getByRole("button", { name: "Toggle message card: [PATCH] test one" }));

    await waitFor(() => {
      expect(bodySpy).toHaveBeenCalled();
    });

    expect(bodySpy.mock.calls.some(([params]) => params.messageId === 7002 && params.includeDiff === false)).toBe(true);

    bodySpy.mockRestore();
  });

  it("renders inline diff cards and fetches diff lazily", async () => {
    const user = userEvent.setup();
    const bodySpy = vi.spyOn(FixtureNexusApiAdapter.prototype, "getMessageBody");
    renderWorkspace();

    const detailScope = getThreadDetailScope();
    await user.click(detailScope.getByRole("button", { name: "Toggle message card: [PATCH] test one" }));

    const diffToggle = detailScope.getByRole("button", { name: "Toggle diff card: [PATCH] test one" });
    expect(diffToggle).toHaveTextContent("Expand");
    await user.click(diffToggle);

    await waitFor(() => {
      expect(bodySpy.mock.calls.some(([params]) => params.messageId === 7002 && params.includeDiff === true)).toBe(
        true,
      );
    });
    expect(detailScope.queryByRole("button", { name: /show diff/i })).not.toBeInTheDocument();

    bodySpy.mockRestore();
  });

  it("resets a message diff card when the message card is collapsed", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    const detailScope = getThreadDetailScope();
    const messageToggle = detailScope.getByRole("button", { name: "Toggle message card: [PATCH] test one" });

    await user.click(messageToggle);
    const diffToggle = detailScope.getByRole("button", { name: "Toggle diff card: [PATCH] test one" });
    await user.click(diffToggle);
    expect(diffToggle).toHaveTextContent("Collapse");

    await user.click(messageToggle);
    expect(detailScope.queryByRole("button", { name: "Toggle diff card: [PATCH] test one" })).not.toBeInTheDocument();

    await user.click(messageToggle);
    expect(detailScope.getByRole("button", { name: "Toggle diff card: [PATCH] test one" })).toHaveTextContent(
      "Expand",
    );
  });

  it("does not expose per-message raw or metadata controls", () => {
    renderWorkspace();

    expect(screen.queryByRole("button", { name: "Metadata" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Raw" })).not.toBeInTheDocument();
  });

  it("shows conversation toolbar icons in the header", () => {
    renderWorkspace();

    const detailScope = getThreadDetailScope();

    expect(detailScope.getByText("CONVERSATION")).toBeInTheDocument();
    expect(detailScope.getByText("2 messages")).toBeInTheDocument();

    const detailSubject = detailScope.getByRole("heading", { level: 2, name: "[PATCH] test one" });
    expect(detailSubject).toHaveAttribute("title", "[PATCH] test one");

    const collapseAll = detailScope.getByRole("button", { name: "Collapse all message cards and diff cards" });
    const expandAll = detailScope.getByRole("button", { name: "Expand all message cards and diff cards" });

    expect(collapseAll).toHaveClass("rail-icon-button");
    expect(expandAll).toHaveClass("rail-icon-button");
  });

  it("collapse all collapses message and diff cards and clears URL message query", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    routerReplaceMock.mockClear();

    const detailScope = getThreadDetailScope();
    await user.click(detailScope.getByRole("button", { name: "Toggle message card: [PATCH] test one" }));
    await user.click(detailScope.getByRole("button", { name: "Toggle diff card: [PATCH] test one" }));
    expect(detailScope.getByRole("button", { name: "Toggle diff card: [PATCH] test one" })).toHaveTextContent(
      "Collapse",
    );

    await user.click(detailScope.getByRole("button", { name: "Collapse all message cards and diff cards" }));

    await waitFor(() => {
      expect(detailScope.queryByRole("button", { name: "Toggle diff card: [PATCH] test one" })).not.toBeInTheDocument();
    });
    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).not.toContain("message=");
  });

  it("expand all expands message and diff cards and sets first message in URL", async () => {
    const user = userEvent.setup();
    const bodySpy = vi.spyOn(FixtureNexusApiAdapter.prototype, "getMessageBody");
    renderWorkspace();
    routerReplaceMock.mockClear();

    const detailScope = getThreadDetailScope();
    await user.click(detailScope.getByRole("button", { name: "Expand all message cards and diff cards" }));

    expect(detailScope.getByText(/This patch wires lruvec stat flush/i)).toBeInTheDocument();
    expect(detailScope.getByText(/Can you share numbers from a memcg-heavy reclaim case/i)).toBeInTheDocument();
    expect(detailScope.getByRole("button", { name: "Toggle diff card: [PATCH] test one" })).toHaveTextContent(
      "Collapse",
    );

    await waitFor(() => {
      expect(bodySpy.mock.calls.some(([params]) => params.messageId === 7002 && params.includeDiff === true)).toBe(
        true,
      );
      expect(bodySpy.mock.calls.some(([params]) => params.messageId === 7003 && params.includeDiff === false)).toBe(
        true,
      );
    });

    const lastReplacePath = String(routerReplaceMock.mock.calls.at(-1)?.[0] ?? "");
    expect(lastReplacePath).toContain("message=7002");
    bodySpy.mockRestore();
  });

  it("auto-expands the URL-targeted message card on load", async () => {
    renderWorkspace({ initialMessage: "7003" });

    const detailScope = getThreadDetailScope();
    await waitFor(() => {
      expect(detailScope.getByRole("button", { name: "Toggle message card: Re: [PATCH] test one" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });
    expect(detailScope.getByText(/Can you share numbers from a memcg-heavy reclaim case/i)).toBeInTheDocument();
    expect(detailScope.getByRole("button", { name: "Toggle message card: [PATCH] test one" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
