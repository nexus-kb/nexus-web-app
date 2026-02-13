import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { vi } from "vitest";
import { ThreadsWorkspace } from "@/components/threads-workspace";
import { FixtureNexusApiAdapter } from "@/lib/api/adapters/fixture";
import type {
  ListSummary,
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
      patch_item_id: null,
    },
  ],
};

function renderWorkspace(overrides?: Partial<ComponentProps<typeof ThreadsWorkspace>>) {
  return render(
    <ThreadsWorkspace
      lists={lists}
      listKey="lkml"
      threads={threads}
      detail={detail}
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
});
