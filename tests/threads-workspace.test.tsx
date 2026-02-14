import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const messagePagination: PaginationResponse = {
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
      messagePagination={messagePagination}
      selectedThreadId={1}
      initialTheme={undefined}
      initialDensity={undefined}
      initialNav={undefined}
      initialMessage={undefined}
      apiConfig={{ mode: "fixture", baseUrl: "" }}
      {...overrides}
    />,
  );
}

describe("ThreadsWorkspace", () => {
  it("persists and applies theme changes", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.selectOptions(screen.getByLabelText("Theme"), "dark");

    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe("dark");
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(routerReplaceMock).toHaveBeenCalledWith(expect.stringContaining("theme=dark"), {
      scroll: false,
    });
  });

  it("persists and applies density changes", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.selectOptions(screen.getByLabelText("Density"), "comfortable");

    expect(localStorage.getItem(STORAGE_KEYS.density)).toBe("comfortable");
    await waitFor(() => {
      expect(document.documentElement.dataset.density).toBe("comfortable");
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
    renderWorkspace({ selectedThreadId: null, detail: null, messagePagination: null });

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(routerPushMock).toHaveBeenCalledWith("/lists/lkml/threads/2?messages_page=1");
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

  it("fetches diff lazily when expanding a message", async () => {
    const user = userEvent.setup();
    const bodySpy = vi.spyOn(FixtureNexusApiAdapter.prototype, "getMessageBody");

    renderWorkspace();

    expect(bodySpy).not.toHaveBeenCalled();

    const showDiffButtons = screen.getAllByRole("button", { name: "Show diff" });
    await user.click(showDiffButtons[0]);

    await waitFor(() => {
      expect(bodySpy).toHaveBeenCalled();
    });

    expect(bodySpy.mock.calls[0]?.[0]).toMatchObject({ includeDiff: true, messageId: 7002 });

    bodySpy.mockRestore();
  });

  it("keeps an expanded diff when detail data is refreshed for the same thread", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWorkspace();

    const showDiffButtons = screen.getAllByRole("button", { name: "Show diff" });
    await user.click(showDiffButtons[0]);

    expect(await screen.findAllByRole("button", { name: "Hide diff" })).toHaveLength(2);

    const refreshedDetail: ThreadDetailResponse = {
      ...detail,
      messages: detail.messages.map((message) => ({ ...message })),
    };

    rerender(
      <ThreadsWorkspace
        lists={lists}
        listKey="lkml"
        threads={threads}
        threadsPagination={threadsPagination}
        detail={refreshedDetail}
        messagePagination={messagePagination}
        selectedThreadId={1}
        initialTheme={undefined}
        initialDensity={undefined}
        initialNav={undefined}
        initialMessage={undefined}
        apiConfig={{ mode: "fixture", baseUrl: "" }}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Hide diff" })).toHaveLength(2);
  });

  it("does not expose per-message raw or metadata controls", () => {
    renderWorkspace();

    expect(screen.queryByRole("button", { name: "Metadata" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Raw" })).not.toBeInTheDocument();
  });

  it("shows conversation diff toolbar icons in the header", () => {
    renderWorkspace();

    const collapseButtons = screen.getAllByRole("button", { name: "Collapse all message diffs" });
    const expandButtons = screen.getAllByRole("button", { name: "Expand all message diffs" });

    expect(collapseButtons.length).toBeGreaterThanOrEqual(1);
    expect(expandButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("hides diff error blocks when collapsing all message diffs", async () => {
    const user = userEvent.setup();
    const bodySpy = vi
      .spyOn(FixtureNexusApiAdapter.prototype, "getMessageBody")
      .mockRejectedValue(new Error("Failed to fetch"));

    renderWorkspace();

    await user.click(screen.getAllByRole("button", { name: "Show diff" })[0]);
    expect(await screen.findAllByText("Failed to fetch")).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Collapse all message diffs" })[0]);

    await waitFor(() => {
      expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
    });

    bodySpy.mockRestore();
  });
});
